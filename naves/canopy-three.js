import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const G = window.TrussGeometry;
const STATE = {
  host: null,
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  model: null,
  observer: null,
  raf: 0,
  lastFitKey: '',
  disposed: false
};

const FRAME_COLOR = 0x0f0f11;          // RAL 9005 from the original calculator
const CLEAR_COLOR = 0xc9c9c9;          // original renderer clear color
const AMBIENT_COLOR = 0x404040;        // original ambient light
const LIGHT_COLOR = 0xfdfdfd;          // original directional light
const CONCRETE_COLOR = 0x888888;       // original concrete color

function parseProfile(profile, fallback=[0.025,0.025]){
  const nums=String(profile||'').replace(/,/g,'.').match(/\d+(?:\.\d+)?/g)?.map(Number)||[];
  return [Math.max(0.012,(nums[0]||fallback[0]*1000)/1000),Math.max(0.012,(nums[1]||nums[0]||fallback[1]*1000)/1000)];
}
function disposeObject(obj){
  obj.traverse?.(node=>{
    node.geometry?.dispose?.();
    if(Array.isArray(node.material)) node.material.forEach(m=>m?.dispose?.());
    else node.material?.dispose?.();
  });
}
function material(color,opts={}){
  return new THREE.MeshPhongMaterial({
    color,
    shininess: opts.shininess ?? 36,
    transparent: Boolean(opts.transparent),
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite ?? true
  });
}
function addBoxBetween(group,a,b,sizeX,sizeY,mat,name='profile'){
  const start=new THREE.Vector3(a.x,a.y,a.z),end=new THREE.Vector3(b.x,b.y,b.z);
  const direction=new THREE.Vector3().subVectors(end,start);
  const length=direction.length();
  if(length<1e-5)return null;
  const geometry=new THREE.BoxGeometry(sizeX,sizeY,length);
  const mesh=new THREE.Mesh(geometry,mat);
  mesh.name=name;
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction.normalize());
  group.add(mesh);
  return mesh;
}
function addCurveProfile(group,points,sizeX,sizeY,mat,name){
  for(let i=0;i<points.length-1;i++) addBoxBetween(group,points[i],points[i+1],sizeX,sizeY,mat,name);
}
function topY(g,x){ return G.arcY(x,g.widthM,g.riseM); }
function lowerY(g,x){
  if(Math.abs(x)>=g.innerChordM/2-1e-7)return 0;
  return G.arcY(x,g.innerChordM,g.lowerRiseM);
}
function curvePoints(g,z,lower=false,segments=42){
  const pts=[];
  for(let i=0;i<=segments;i++){
    const x=-g.widthM/2+g.widthM*i/segments;
    pts.push(new THREE.Vector3(x,lower?lowerY(g,x):topY(g,x),z));
  }
  return pts;
}
function buildTruss(group,g,z,baseY,frameMat,webMat){
  const [cw,ch]=parseProfile(g.chordProfile,[.025,.025]);
  const [ww,wh]=parseProfile(g.webProfile,[.020,.020]);
  const truss=new THREE.Group();
  truss.position.y=baseY;
  truss.name='farm';

  addCurveProfile(truss,curvePoints(g,z,false,50),cw,ch,frameMat,'top chord');
  addCurveProfile(truss,curvePoints(g,z,true,50),cw,ch,frameMat,'bottom chord');

  const leftX=-g.innerChordM/2,rightX=g.innerChordM/2;
  addBoxBetween(truss,{x:leftX,y:0,z},{x:leftX,y:topY(g,leftX),z},ww,wh,webMat,'end post');
  addBoxBetween(truss,{x:rightX,y:0,z},{x:rightX,y:topY(g,rightX),z},ww,wh,webMat,'end post');

  for(let i=0;i<g.nodes.length-1;i++){
    const a=g.nodes[i],b=g.nodes[i+1];
    addBoxBetween(
      truss,
      {x:a.x,y:a.yWeb,z},
      {x:b.x,y:b.yWeb,z},
      ww,wh,webMat,'farm web'
    );
  }
  group.add(truss);
  return truss;
}
function roofArcY(g,x){
  const r=g.topCircle.radius;
  const cy=-(r-g.riseM);
  return cy+Math.sqrt(Math.max(0,r*r-x*x));
}
function buildRoof(group,g,c,baseY){
  if(c.coverage==='Без покрытия')return;
  const width=g.widthM+.20;     // 10 cm beyond the truss each side
  const length=c.lengthM+.40;   // 20 cm front/back, from the calculator rules
  const nx=48,nz=1;
  const positions=[],indices=[];
  for(let iz=0;iz<=nz;iz++){
    const z=-length/2+length*iz/nz;
    for(let ix=0;ix<=nx;ix++){
      const x=-width/2+width*ix/nx;
      positions.push(x,baseY+roofArcY(g,x)+.055,z);
    }
  }
  for(let ix=0;ix<nx;ix++){
    const a=ix,b=ix+1,c1=(nx+1)+ix,d=(nx+1)+ix+1;
    indices.push(a,c1,b,b,c1,d);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const isPoly=c.coverage==='Поликарбонат';
  const mat=new THREE.MeshPhongMaterial({
    color:isPoly?0x8f6034:0x757b80,
    transparent:isPoly,
    opacity:isPoly?.52:1,
    side:THREE.DoubleSide,
    shininess:isPoly?92:26,
    depthWrite:!isPoly
  });
  const mesh=new THREE.Mesh(geo,mat);
  mesh.name='roof';
  mesh.renderOrder=isPoly?3:0;
  group.add(mesh);

  if(isPoly){
    const edgeMat=material(0x6e5030,{shininess:55});
    const edgeSize=.022;
    [-length/2,length/2].forEach(z=>{
      const pts=[];
      for(let i=0;i<=48;i++){
        const x=-width/2+width*i/48;
        pts.push(new THREE.Vector3(x,baseY+roofArcY(g,x)+.058,z));
      }
      addCurveProfile(group,pts,edgeSize,edgeSize,edgeMat,'polycarbonate edge');
    });
  }
}
function buildSupports(group,g,c,baseY,frameMat){
  const postSize=.08,beamSize=.08;
  const xPosts=[-g.widthPostsM/2,g.widthPostsM/2];
  const n=Math.max(2,Math.round(c.postsPerSide||2));
  const zs=Array.from({length:n},(_,i)=>n===1?0:-c.lengthM/2+c.lengthM*i/(n-1));

  if(c.totalPosts>0){
    for(const z of zs)for(const x of xPosts){
      addBoxBetween(group,{x,y:0,z},{x,y:baseY,z},postSize,postSize,frameMat,'pillar');
      if(c.installType==='Бетонирование'){
        const footing=new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,.36,18),material(0x777777,{shininess:8}));
        footing.position.set(x,-.16,z);group.add(footing);
      }else{
        const flange=new THREE.Mesh(new THREE.BoxGeometry(.18,.012,.18),material(0x2d2d2d));
        flange.position.set(x,.006,z);group.add(flange);
      }
    }
  }
  if(!c.beamsExisting){
    for(const x of xPosts){
      addBoxBetween(group,{x,y:baseY-.04,z:-c.lengthM/2},{x,y:baseY-.04,z:c.lengthM/2},beamSize,beamSize,frameMat,'longitudinal beam');
    }
  }
}
function buildPurlins(group,g,c,baseY,purlinMat){
  const count=Math.max(2,c.lagLines||2);
  const width=g.widthM;
  const [pw,ph]=[.040,.020];
  for(let i=0;i<count;i++){
    const x=-width/2+width*i/(count-1);
    const y=baseY+topY(g,x)+.028;
    addBoxBetween(group,{x,y,z:-c.lengthM/2-.20},{x,y,z:c.lengthM/2+.20},pw,ph,purlinMat,'purlin');
  }
}
function buildBase(group,g,c){
  const slab=new THREE.Mesh(
    new THREE.BoxGeometry(g.widthPostsM+1,c.installType==='Бетонирование'?.14:.08,c.lengthM+.7),
    material(CONCRETE_COLOR,{shininess:6})
  );
  slab.position.y=c.installType==='Бетонирование'?-.09:-.05;
  slab.name='concrete base';
  group.add(slab);

  const grid=new THREE.GridHelper(Math.max(g.widthPostsM+2,c.lengthM+2),20,0xa7a7a7,0xbcbcbc);
  grid.position.y=.002;
  grid.material.opacity=.26;grid.material.transparent=true;
  group.add(grid);
}
function buildModel(g,c){
  const root=new THREE.Group();
  root.name='canopy';
  const frameMat=material(FRAME_COLOR,{shininess:48});
  const webMat=material(0x171719,{shininess:42});
  const purlinMat=material(0x242629,{shininess:36});
  const baseY=c.visibleHeightM;

  buildBase(root,g,c);
  buildSupports(root,g,c,baseY,frameMat);

  const trussCount=Math.max(2,c.trussCount||2);
  for(let i=0;i<trussCount;i++){
    const z=-c.lengthM/2+c.lengthM*i/(trussCount-1);
    buildTruss(root,g,z,baseY,frameMat,webMat);
  }
  buildPurlins(root,g,c,baseY,purlinMat);
  buildRoof(root,g,c,baseY);
  return root;
}
function renderOnce(){
  if(!STATE.renderer||!STATE.scene||!STATE.camera)return;
  STATE.renderer.render(STATE.scene,STATE.camera);
}
function animate(){
  cancelAnimationFrame(STATE.raf);
  const loop=()=>{
    if(STATE.disposed)return;
    STATE.controls?.update();
    renderOnce();
    STATE.raf=requestAnimationFrame(loop);
  };
  STATE.raf=requestAnimationFrame(loop);
}
function resize(){
  if(!STATE.host||!STATE.renderer||!STATE.camera)return;
  const rect=STATE.host.getBoundingClientRect();
  const w=Math.max(280,Math.floor(rect.width));
  const h=Math.max(260,Math.floor(rect.height));
  STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  STATE.renderer.setSize(w,h,false);
  STATE.camera.aspect=w/h;
  STATE.camera.updateProjectionMatrix();
  renderOnce();
}
function fitCamera(g,c,force=false){
  const key=[g.widthPostsM,c.lengthM,c.visibleHeightM,g.riseM].map(v=>Number(v).toFixed(2)).join('|');
  if(!force&&STATE.lastFitKey===key)return;
  STATE.lastFitKey=key;
  const span=Math.max(g.widthM,c.lengthM);
  const height=c.visibleHeightM+g.riseM;
  const distance=Math.max(6.5,span*1.18+height*1.35);
  STATE.camera.position.set(span*.38,height*.95,distance*.78);
  STATE.controls.target.set(0,Math.max(.8,c.visibleHeightM*.56),0);
  STATE.controls.minDistance=Math.max(2.5,span*.35);
  STATE.controls.maxDistance=Math.max(24,span*4.2);
  STATE.controls.update();
}
function init(host){
  if(STATE.host===host&&STATE.renderer)return;
  if(STATE.renderer){
    STATE.observer?.disconnect();
    cancelAnimationFrame(STATE.raf);
    STATE.renderer.dispose();
    STATE.host?.querySelector('canvas')?.remove();
  }
  STATE.disposed=false;
  STATE.host=host;
  host.innerHTML='';
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(CLEAR_COLOR);

  const camera=new THREE.PerspectiveCamera(45,1,.01,200);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.shadowMap.enabled=false;
  renderer.localClippingEnabled=true;
  renderer.domElement.className='canopy-webgl-canvas';
  renderer.domElement.setAttribute('aria-label','Интерактивная 3D модель арочного навеса');
  host.append(renderer.domElement);

  // Original calculator: 3 directional lights around the object + ambient light.
  for(let i=0;i<3;i++){
    const light=new THREE.DirectionalLight(LIGHT_COLOR,.62);
    const angle=2*i*Math.PI/3;
    light.position.set(10*Math.cos(angle),6,10*Math.sin(angle));
    light.lookAt(0,0,0);scene.add(light);
  }
  scene.add(new THREE.AmbientLight(AMBIENT_COLOR,1.15));

  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableZoom=true;
  controls.enablePan=true;
  controls.enableDamping=true;
  controls.dampingFactor=.07;
  controls.rotateSpeed=.72;
  controls.zoomSpeed=.85;
  controls.panSpeed=.65;
  controls.maxPolarAngle=Math.PI*.49;

  STATE.scene=scene;STATE.camera=camera;STATE.renderer=renderer;STATE.controls=controls;
  STATE.observer=new ResizeObserver(resize);STATE.observer.observe(host);
  resize();animate();
}
function showError(host,message){
  host.innerHTML='<div class="three-fallback"><b>3D временно недоступен</b><span>'+String(message||'Не удалось запустить WebGL')+'</span></div>';
}
function update(host,g,c){
  try{
    if(!host||!g?.ok||!c)return;
    init(host);
    if(STATE.model){
      STATE.scene.remove(STATE.model);
      disposeObject(STATE.model);
    }
    STATE.model=buildModel(g,c);
    STATE.scene.add(STATE.model);
    fitCamera(g,c);
    resize();
  }catch(error){
    console.error('[canopy-three]',error);
    showError(host,error?.message);
  }
}
window.Canopy3D={render:update,resetView(){
  const g=window.__TRUSS_CURRENT,c=window.__CANOPY_PUBLIC;
  if(g?.ok&&c)fitCamera(g,c,true);
}};
window.dispatchEvent(new CustomEvent('canopy3d-ready'));

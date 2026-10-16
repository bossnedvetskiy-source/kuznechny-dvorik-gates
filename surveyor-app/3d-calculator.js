import * as THREE from '../naves/vendor/three.module.js';
import { OrbitControls } from '../naves/vendor/OrbitControls.js';

// Standalone DEV prototype. This is visual geometry only, not a retail price quote.
const DRAFT_KEY = 'kd-surveyor-3d-draft-v1';
const DEFAULT = { length: 12, height: 1.8, step: 2.5, fill: 'picket', gap: 0.05, ral: '7024' };
const RAL = { '7024': '#45494a', '8017': '#4d3227', '6005': '#1c493c', '9005': '#222426', '9003': '#e8e9e6' };
let instance = null;

function numeric(value, min, max, fallback) {
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function loadDraft() {
  try {
    const o = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!o || typeof o !== 'object') return { ...DEFAULT };
    return {
      length: numeric(o.length, 1, 60, DEFAULT.length),
      gap: numeric(o.gap, 0.02, 0.12, DEFAULT.gap),
      height: numeric(o.height, 0.8, 3, DEFAULT.height),
      step: numeric(o.step, 1, 3, DEFAULT.step),
      fill: ['picket', 'picket-double', 'horizontal', 'sheet', 'jalousie'].includes(o.fill) ? o.fill : DEFAULT.fill,
      ral: Object.hasOwn(RAL, o.ral) ? o.ral : DEFAULT.ral
    };
  } catch { return { ...DEFAULT }; }
}
function saveDraft(model) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(model)); } catch { /* Storage may be blocked. */ }
}
function frameGeometry(group, base, w, h, d, x, y, z, material) {
  const mesh = new THREE.Mesh(base, material);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
function dimensionLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(80, 24, 352, 76);
  ctx.strokeStyle = '#b1b8ba';
  ctx.strokeRect(80, 24, 352, 76);
  ctx.fillStyle = '#253037';
  ctx.font = 'bold 43px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 77);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.25, 0.56, 1);
  sprite.renderOrder = 2;
  return { sprite, material, texture };
}

// Low-poly, physically shaped steel sheets. All dimensions are in metres.
// С10: approximate 100 mm pitch, 10 mm trapezoid relief, 0.6 mm sheet thickness.
// This is a visual profile, not a manufacturing cutting specification.
function buildC10Geometry(width, height) {
  const profile = [{ x:0, z:0 }];
  const pitch = 0.10, depth = 0.010, thickness = 0.0006;
  const points = [[0.020,0], [0.034,depth], [0.066,depth], [0.080,0], [0.100,0]];
  for (let start = 0; start < width - 0.00001; start += pitch) {
    for (const [offset,z] of points) {
      const x = Math.min(width, start + offset);
      if (x > profile[profile.length-1].x + 0.000001) profile.push({ x, z });
      if (x >= width) break;
    }
  }
  if(profile[profile.length-1].x < width-0.000001) profile.push({x:width,z:0});
  const vertices = [];
  const tri = (a,b,c)=>vertices.push(...a,...b,...c);
  const quad = (a,b,c,d)=>{tri(a,b,c);tri(b,d,c);};
  for (let i=0;i<profile.length-1;i++) {
    const a=profile[i], b=profile[i+1];
    const x0=a.x-width/2, x1=b.x-width/2;
    const p0=[x0,0,a.z], p1=[x1,0,b.z], t0=[x0,height,a.z], t1=[x1,height,b.z];
    quad(p0,p1,t0,t1); // facing viewer
    quad([x1,0,b.z-thickness],[x0,0,a.z-thickness],
      [x1,height,b.z-thickness],[x0,height,a.z-thickness]);
    quad(t0,t1,[x0,height,a.z-thickness],[x1,height,b.z-thickness]);
    quad([x0,0,a.z-thickness],[x1,0,b.z-thickness],p0,p1);
  }
  const first=profile[0], last=profile[profile.length-1];
  quad([-width/2,0,first.z-thickness],[-width/2,0,first.z],
    [-width/2,height,first.z-thickness],[-width/2,height,first.z]);
  quad([width/2,0,last.z],[width/2,0,last.z-thickness],
    [width/2,height,last.z],[width/2,height,last.z-thickness]);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// One metal picket with rolled side flanges and a shallow raised central ridge.
// Slightly rounded top, open-backed steel profile rather than a rectangular bar.
function buildPicketGeometry(length, horizontal=false) {
  const width=0.12;
  const profile=[[-.060,.003],[-.052,.001],[-.038,.017],[-.012,.027],
    [.012,.027],[.038,.017],[.052,.001],[.060,.003]];
  const vertices=[];
  const tri=(a,b,c)=>vertices.push(...a,...b,...c);
  for(let i=0;i<profile.length-1;i++){
    const [x0,z0]=profile[i], [x1,z1]=profile[i+1];
    const top0=length-0.018*Math.pow(Math.abs(x0)/(.06),3);
    const top1=length-0.018*Math.pow(Math.abs(x1)/(.06),3);
    const a=[x0,0,z0],b=[x1,0,z1],c=[x0,top0,z0],d=[x1,top1,z1];
    tri(a,b,c);tri(b,d,c);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  if(horizontal) {
    geometry.rotateZ(-Math.PI/2);
    geometry.translate(-length/2,0,0);
  }
  geometry.computeBoundingSphere();
  return geometry;
}

function instancePickets(group, geometry, material, positions) {
  if(!positions.length)return;
  const mesh=new THREE.InstancedMesh(geometry,material,positions.length);
  const dummy=new THREE.Object3D();
  positions.forEach((p,i)=>{
    dummy.position.set(p.x,p.y,p.z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;
  mesh.frustumCulled=false;
  group.add(mesh);
}

export function mount3DCalculator(root) {
  if (instance && instance.root === root) {
    instance.resize();
    return;
  }
  if (!root) throw new Error('Не найден раздел 3D расчёта');
  const config = loadDraft();
  root.innerHTML = [
    '<div class="kd3d-top"><div><strong>Конструктор участка</strong><small>Этап 2 · реалистичное заполнение</small></div><span>DEV</span></div>',
    '<div class="kd3d-mode" role="group" aria-label="Вид результата"><button type="button" data-mode="scene" class="active">3D-модель</button><button type="button" data-mode="parts">Комплектация</button></div>',
    '<div class="kd3d-viewport" data-viewport><div class="kd3d-scene" data-scene></div><div class="kd3d-parts" data-parts hidden></div>',
    '<div class="kd3d-scene-controls"><button type="button" data-fit>Показать целиком</button></div>',
    '<p class="kd3d-webgl-error" data-error hidden></p></div>',
    '<div class="kd3d-form"><h3>Параметры забора</h3>',
    '<div class="kd3d-fields"><label>Длина стороны А, м<input data-field="length" inputmode="decimal" type="number" min="1" max="60" step="0.1"></label>',
    '<label>Высота, м<input data-field="height" inputmode="decimal" type="number" min="0.8" max="3" step="0.1"></label>',
    '<label>Макс. шаг столбов, м<input data-field="step" inputmode="decimal" type="number" min="1" max="3" step="0.1"></label></div>',
    '<label class="kd3d-select-label">Заполнение<select data-field="fill"><option value="picket">Штакетник · вертикальный односторонний</option><option value="picket-double">Штакетник · вертикальный шахматка</option><option value="horizontal">Штакетник · горизонтальный</option><option value="sheet">Профнастил С10 · объёмный</option><option value="jalousie">Жалюзи · схематично</option></select></label>',
    '<div class="kd3d-picket-settings" data-picket-settings><div><strong>Штакетник 120 мм</strong><span>Объёмный профиль с продольным ребром и загнутыми краями</span></div><label>Зазор между планками, см<input data-field="gap" inputmode="decimal" type="number" min="2" max="12" step="0.5"></label></div>',
    '<label class="kd3d-select-label">Цвет RAL<select data-field="ral"><option value="7024">7024 · графит</option><option value="8017">8017 · шоколад</option><option value="6005">6005 · зелёный</option><option value="9005">9005 · чёрный</option><option value="9003">9003 · белый</option></select></label>',
    '<div class="kd3d-stats" data-stats></div>',
    '<div class="kd3d-hint">Первая версия: настоящая 3D-модель прямой линии с базовыми заполнениями. Ворота, калитки, несколько сторон, точная спецификация и цена будут добавлены следующими этапами. Сейчас стоимость не рассчитывается.</div>',
    '<button type="button" data-reset class="kd3d-reset">↶ Сбросить тестовые параметры</button></div>'
  ].join('');
  const find = selector => root.querySelector(selector);
  for (const key of ['length','height','step','fill','ral']) find('[data-field="' + key + '"]').value = config[key];
  find('[data-field="gap"]').value = Number((config.gap*100).toFixed(1));
  const sceneHost = find('[data-scene]');
  const parts = find('[data-parts]');
  const stats = find('[data-stats]');
  const error = find('[data-error]');
  let renderer, camera, scene, controls, fence, grid, base;
  let previousMaterials = [];
  let previousLineGeometries = [];
  let labelObjects = [];
  let webglOk = false;
  try {
    renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0xe8eaeb);
    sceneHost.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8eaeb);
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 2;
    controls.maxDistance = 100;
    const light = new THREE.DirectionalLight(0xffffff, 2.1);
    light.position.set(10, 20, 10);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 1.05));
    const fillLight=new THREE.DirectionalLight(0xe7f4ff,0.65);
    fillLight.position.set(-5,8,-12);
    scene.add(fillLight);
    grid = new THREE.GridHelper(140, 140, 0xc4ced2, 0xd4dcde);
    grid.position.y = -0.025;
    scene.add(grid);
    fence = new THREE.Group();
    scene.add(fence);
    base = new THREE.BoxGeometry(1, 1, 1);
    webglOk = true;
  } catch (e) {
    error.hidden = false;
    error.textContent = 'На этом устройстве 3D недоступно. Параметры и комплектация продолжают работать.';
    console.warn('KD surveyor 3D WebGL unavailable:', e);
  }
  function summary() {
    const count = Math.max(1, Math.ceil(config.length / config.step));
    const actualSpan = config.length / count;
    stats.innerHTML = '<div><small>Пролётов</small><b>' + count + '</b></div><div><small>Столбов</small><b>' + (count + 1) + '</b></div><div><small>Длина пролёта</small><b>' + actualSpan.toFixed(2).replace('.', ',') + ' м</b></div>';
    const names={picket:'Евроштакетник вертикальный, один ряд', 'picket-double':'Евроштакетник вертикальный, шахматка', horizontal:'Евроштакетник горизонтальный',sheet:'Профнастил С10',jalousie:'Жалюзи (схематично)'};
    parts.innerHTML = '<h3>Комплектация · предварительная геометрия</h3><p>Сторона А: ' + config.length.toFixed(1).replace('.', ',') + ' м · высота ' + config.height.toFixed(1).replace('.', ',') + ' м</p><p>Пролётов: <b>' + count + '</b>; металлических столбов: <b>' + (count+1) + '</b>.</p><p>Средний пролёт: <b>' + actualSpan.toFixed(2).replace('.', ',') + ' м</b>.</p><p>Заполнение: <b>'+names[config.fill]+'</b>'+(config.fill==='sheet'?' · приблизительный профиль 10 мм':' · планка 120 мм, зазор '+(config.gap*100).toFixed(1).replace('.',',')+' см')+'.</p><p class="kd3d-unpriced">Только визуализация! Это не раскрой материала и не расчёт стоимости. Действующие калькуляторы не затронуты.</p>';
    find('[data-picket-settings]').hidden = !['picket','picket-double','horizontal'].includes(config.fill);
    return { count, actualSpan };
  }
  function clearGeometry() {
    if (!fence) return;
    fence.clear();
    previousMaterials.forEach(m => m.dispose());
    previousLineGeometries.forEach(g => g.dispose());
    labelObjects.forEach(x => { x.material.dispose(); x.texture.dispose(); });
    previousMaterials = [];
    previousLineGeometries = [];
    labelObjects = [];
  }
  function updateModel() {
    const { count, actualSpan } = summary();
    saveDraft(config);
    if (!webglOk) return;
    clearGeometry();
    const postMat = new THREE.MeshStandardMaterial({ color:0x333c42, metalness:0.5, roughness:0.5 });
    const fillMat = new THREE.MeshStandardMaterial({ color:RAL[config.ral], metalness:0.38, roughness:0.43, side:THREE.DoubleSide });
    previousMaterials.push(postMat, fillMat);
    const start = -config.length / 2;
    const railY = [0.38, Math.max(0.56, config.height - 0.38)];
    for (let i=0; i<=count; i++) {
      const x = start + i * actualSpan;
      frameGeometry(fence, base, 0.085, config.height + 0.16, 0.085, x, (config.height+0.16)/2, 0, postMat);
      frameGeometry(fence, base, 0.105, 0.035, 0.105, x, config.height+0.16, 0, postMat);
    }
    const frontPickets=[], rearPickets=[], horizontalPickets=[];
    const isPicket=['picket','picket-double','horizontal'].includes(config.fill);
    for (let i=0; i<count; i++) {
      const mid = start + (i+0.5)*actualSpan;
      const width = Math.max(0.2, actualSpan - 0.11);
      if (config.fill === 'sheet') {
        const geometry=buildC10Geometry(width,config.height-0.12);
        previousLineGeometries.push(geometry);
        const panel=new THREE.Mesh(geometry,fillMat);
        panel.position.set(mid,0.06,0.015);
        panel.receiveShadow=true;
        fence.add(panel);
        // The real profiled sheet is mounted over two steel horizontal rails.
        railY.forEach(y=>frameGeometry(fence,base,width,0.04,0.035,mid,y,-0.07,postMat));
      } else if (config.fill === 'jalousie') {
        // Temporarily schematic; dedicated louvre geometry will be a later step.
        const rows=Math.max(1,Math.floor((config.height-0.12)/0.14));
        for(let n=0;n<rows;n++)
          frameGeometry(fence,base,width,0.11,0.026,mid,0.13+n*0.14,0,fillMat);
      } else if (config.fill === 'horizontal') {
        // Vertical 40x20 supports, horizontal separate folded strips with a true profile.
        [-.28,.28].forEach(factor=>
          frameGeometry(fence,base,0.035,config.height-0.12,0.035,mid+width*factor,config.height/2,-0.065,postMat));
        const plank=0.12, gap=config.gap, available=config.height-0.12;
        const n=Math.max(1,Math.floor((available+gap)/(plank+gap)));
        const filled=n*plank+(n-1)*gap;
        const firstY=0.06+(available-filled)/2+plank/2;
        for(let k=0;k<n;k++)
          horizontalPickets.push({x:mid,y:firstY+k*(plank+gap),z:0.025});
      } else if(isPicket) {
        railY.forEach(y=>frameGeometry(fence,base,width,0.04,0.035,mid,y,-0.065,postMat));
        const plank=0.12, gap=config.gap;
        const n=Math.max(1,Math.floor((width+gap)/(plank+gap)));
        const occupied=n*plank+(n-1)*gap;
        const firstX=mid-occupied/2+plank/2;
        for(let k=0;k<n;k++)
          frontPickets.push({x:firstX+k*(plank+gap),y:0.065,z:0.038});
        if(config.fill==='picket-double') {
          // The rear layer is staggered between front strips (one fewer strip).
          for(let k=0;k<n-1;k++)
            rearPickets.push({x:firstX+(k+0.5)*(plank+gap),y:0.065,z:-0.10});
        }
      }
    }
    if(frontPickets.length || rearPickets.length) {
      const geo=buildPicketGeometry(config.height-0.13);
      previousLineGeometries.push(geo);
      instancePickets(fence,geo,fillMat,frontPickets);
      instancePickets(fence,geo,fillMat,rearPickets);
    }
    if(horizontalPickets.length) {
      // One instanced set for all horizontal boards rather than hundreds of meshes.
      const geo=buildPicketGeometry(Math.max(0.2,actualSpan-0.11),true);
      previousLineGeometries.push(geo);
      instancePickets(fence,geo,fillMat,horizontalPickets);
    }
    const dimMaterial = new THREE.LineBasicMaterial({color:0x536477});
    previousMaterials.push(dimMaterial);
    const z = 0.85;
    const y=0.015;
    const segments = [[start,z,start+config.length,z],[start,z-0.17,start,z+0.17],[start+config.length,z-0.17,start+config.length,z+0.17]];
    segments.forEach(s=>{
      const geom=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s[0],y,s[1]),new THREE.Vector3(s[2],y,s[3])]);
      previousLineGeometries.push(geom);
      fence.add(new THREE.Line(geom,dimMaterial));
    });
    const label = dimensionLabel(config.length.toFixed(1).replace('.', ',') + ' м');
    label.sprite.position.set(0,0.38,z+0.06);
    labelObjects.push(label);
    fence.add(label.sprite);
  }
  function fit() {
    if (!webglOk) return;
    const dist = Math.max(9,config.length*1.15);
    camera.position.set(dist*0.34,Math.max(4,config.height*2.8),dist*0.95);
    controls.target.set(0,config.height*0.5,0);
    controls.update();
  }
  function resize() {
    if (!webglOk) return;
    const width = Math.max(1,sceneHost.clientWidth), height=Math.max(1,sceneHost.clientHeight);
    camera.aspect=width/height;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    renderer.render(scene,camera);
  }
  for (const input of root.querySelectorAll('[data-field]')) {
    input.addEventListener('change',()=>{
      const field=input.dataset.field;
      if (field === 'fill') config.fill=input.value;
      else if (field === 'gap') config.gap=numeric(input.value,2,12,config.gap*100)/100;
      else if(field === 'ral') config.ral=input.value;
      else config[field]=numeric(input.value,field==='length'?1:field==='height'?0.8:1,field==='length'?60:3,config[field]);
      input.value=field==='gap' ? Number((config.gap*100).toFixed(1)) : config[field];
      updateModel();
    });
  }
  root.querySelector('[data-fit]').addEventListener('click',fit);
  root.querySelector('[data-reset]').addEventListener('click',()=>{
    Object.assign(config,DEFAULT);
    for(const key of ['length','height','step','fill','ral'])find('[data-field="'+key+'"]').value=config[key];
    find('[data-field="gap"]').value=Number((config.gap*100).toFixed(1));
    updateModel();fit();
  });
  root.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
    const isScene=button.dataset.mode==='scene';
    root.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b===button));
    sceneHost.hidden=!isScene;parts.hidden=isScene;
    root.querySelector('.kd3d-scene-controls').hidden=!isScene;
    if(isScene)resize();
  }));
  const observer=new ResizeObserver(resize);
  observer.observe(sceneHost);
  updateModel();
  fit();
  resize();
  if (webglOk) {
    const tick=()=>{
      if (!root.isConnected) return;
      if (!document.hidden && root.getClientRects().length) {
        controls.update();
        renderer.render(scene,camera);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  instance={root,resize};
}

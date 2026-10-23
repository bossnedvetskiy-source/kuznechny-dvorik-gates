import * as THREE from '../naves/vendor/three.module.js';
import { getSlidingInstallationPlan } from './3d-sliding-installation.js';
import {renderSlidingHardware} from './3d-sliding-hardware.js';

// One movable steel frame: a rectangular opening panel and a real cantilever
// tail, either square or triangular. This is a visual model, not a cut list.
export function renderSlidingGate(options){
  const {group,base,opening,openingStart,postWidth,side,sideLength,otherOpenings,
    installationPlan,postMat,fillMat,gap,standalone=false,
    frameGeometry,buildC10Geometry,buildPicketGeometry,instancePickets,
    horizontalPicketRows,verticalPicketPlan,ownedGeometries,ownedMaterials}=options;
  const plan=installationPlan||getSlidingInstallationPlan(opening,sideLength,otherOpenings,{
    postWidth,sideHeight:side.height,postMode:side.postMode
  });
  // Every steel member and sheet panel travels as ONE rigid assembly.
  // The ground parking zone remains stationary in the perimeter-side group.
  const moving=new THREE.Group();
  moving.position.x=plan.shift;
  moving.userData.kdSlidingMoving=true;
  moving.userData.kdSlidingShift=plan.shift;
  moving.userData.kdSlidingParkingValid=plan.valid;
  group.add(moving);
  const fill=opening.fill&&opening.fill!=='side'?opening.fill:side.fill;
  const tube=opening.frameProfile==='60x40'?.06:.04;
  const depth=opening.frameProfile==='40x25'?.025:.04;
  const x=value=>openingStart+value;
  const z=plan.trackOffset;
  // Cantilever beam encloses the carriage rollers at ground level. Keep
  // enough space for it under the frame without changing its nominal top.
  const yBottom=Math.max(plan.bottom,.22);
  const yTop=plan.bottom+plan.leafHeight;
  const leafHeight=yTop-yBottom;
  const centerY=(yBottom+yTop)/2;
  function bar(x1,y1,x2,y2,width=tube,barDepth=depth){
    const length=Math.hypot(x2-x1,y2-y1);
    const obj=frameGeometry(moving,base,length,width,barDepth,
      x((x1+x2)/2),(y1+y2)/2,z,postMat);
    obj.rotation.z=Math.atan2(y2-y1,x2-x1);
    return obj;
  }
  const marker=new THREE.Group();
  marker.userData.kdSlidingLeaf=true;
  marker.userData.kdSlidingSide=opening.sideId;
  marker.userData.kdSlidingDirection=plan.direction;
  marker.userData.kdSlidingShape=plan.tailShape;
  marker.userData.kdSlidingTailLength=plan.tail;
  moving.add(marker);
  const sideLeft=plan.left,sideRight=plan.right;
  bar(sideLeft,yBottom,sideRight,yBottom);
  bar(sideLeft,yTop,sideRight,yTop);
  bar(sideLeft,yBottom,sideLeft,yTop);
  bar(sideRight,yBottom,sideRight,yTop);
  if(opening.innerFrame!==false){
    bar(sideLeft+tube/2,centerY,sideRight-tube/2,centerY,.035);
  }
  if(plan.centerPost){
    const upright=bar(plan.center,yBottom+tube/2,plan.center,yTop-tube/2);
    upright.userData.kdSlidingCenterPost=true;
  }
  // Continuous cantilever GUIDE runs under the whole leaf and tail.
  // Unlike a solid rectangular bar, this is a downward-facing C profile:
  // wheels on BOTH carriages are visibly captured between its side lips.
  const guideCenterX=x(Math.min(plan.left,plan.tailFrom)+plan.gateLength/2);
  const guide=frameGeometry(moving,base,plan.gateLength,.020,.27,
    guideCenterX,yBottom-.003,z,postMat);
  guide.userData.kdSlidingBeam=true;
  guide.userData.kdSlidingGuideWeb=true;
  for(const sign of [-1,1]){
    const lip=frameGeometry(moving,base,plan.gateLength,.06,.026,
      guideCenterX,yBottom-.046,z+sign*.122,postMat);
    lip.userData.kdSlidingGuideLip=true;
  }

  const tip=plan.tailTip,junction=plan.junction;
  // Square counterweight has a full-height outer member. Triangular one
  // tapers towards the low end and still retains the horizontal guide.
  // Tail reinforcement uses the workshop 60x40 tube in BOTH modes,
  // irrespective of the chosen face-frame profile.
  const tailTubeW=.06,tailTubeD=.04;
  const tailBar=(x1,y1,x2,y2,kind)=>{
    const member=bar(x1,y1,x2,y2,tailTubeW,tailTubeD);
    member.userData.kdSlidingTailMember=kind;
    member.userData.kdSlidingTailTube='60x40';
    member.userData.kdSlidingTailEndpoints=[x1,y1,x2,y2];
    return member;
  };
  if(plan.tailShape==='square'){
    // Rectangular tail, two full intersecting 60x40 diagonals (X).
    // The lower chord is the continuous guiding/structural beam.
    tailBar(tip,yBottom,tip,yTop,'end-post');
    tailBar(tip,yTop,junction,yTop,'top-chord');
    tailBar(tip,yBottom,junction,yTop,'cross-a');
    tailBar(tip,yTop,junction,yBottom,'cross-b');
  }else{
    // Triangular tail: primary brace runs from gate top DOWN to tail tip.
    // Secondary brace runs from the lower gate junction to the MIDPOINT
    // of the primary diagonal. No square outer vertical or X.
    const midX=(tip+junction)/2,midY=(yBottom+yTop)/2;
    tailBar(junction,yTop,tip,yBottom,'primary-diagonal');
    tailBar(junction,yBottom,midX,midY,'half-diagonal');
  }
  const tailGroup=new THREE.Group();
  tailGroup.userData.kdSlidingTail=true;
  tailGroup.userData.kdTailWidth=plan.tail;
  moving.add(tailGroup);

  // Cover only the useful gateway panel: the counterweight stays unfilled.
  const panelInnerW=Math.max(.12,plan.panelWidth-2*tube-.016);
  const panelInnerH=Math.max(.18,leafHeight-2*tube-.022);
  const mid=plan.center,baseY=yBottom+tube+.011;
  if(fill==='sheet'){
    const geometry=buildC10Geometry(panelInnerW,panelInnerH);
    ownedGeometries.push(geometry);
    const panel=new THREE.Mesh(geometry,fillMat);
    panel.position.set(x(mid),baseY,z+.033);
    moving.add(panel);
  }else if(fill==='horizontal'||fill==='horizontal-double'||fill==='jalousie'){
    const rows=horizontalPicketRows(panelInnerH,gap,fill==='horizontal-double');
    if(fill==='jalousie'){
      for(const relY of rows.front){
        frameGeometry(moving,base,panelInnerW,.11,.023,x(mid),
          baseY+relY,z+.033,fillMat);
      }
    }else{
      const geometry=buildPicketGeometry(panelInnerW,true);
      ownedGeometries.push(geometry);
      instancePickets(moving,geometry,fillMat,rows.front.map(v=>({
        x:x(mid),y:baseY+v,z:z+.035
      })),0);
      instancePickets(moving,geometry,fillMat,rows.rear.map(v=>({
        x:x(mid),y:baseY+v,z:z-.052
      })),Math.PI);
    }
  }else{
    const planPickets=verticalPicketPlan(panelInnerW,gap,true);
    const geometry=buildPicketGeometry(panelInnerH);
    ownedGeometries.push(geometry);
    instancePickets(moving,geometry,fillMat,planPickets.strips.map(p=>({
      x:x(mid+p.x),y:baseY,z:z+.034,width:p.width
    })),0);
    if(fill==='picket-double'){
      const back=[];
      for(let i=0;i<planPickets.strips.length-1;i++){
        const a=planPickets.strips[i],b=planPickets.strips[i+1];
        back.push({x:x(mid+(a.x+b.x)/2),y:baseY,z:z-.052});
      }
      instancePickets(moving,geometry,fillMat,back,Math.PI);
    }
  }
  renderSlidingHardware({group,base,opening,installation:plan,openingStart,
    postWidth,postMat,frameGeometry,ownedGeometries,ownedMaterials});
  if(plan.showZone){
    // Product mode has no fence line; place the free-travel markings beneath
    // the actual track rather than 440 mm away from the structure.
    const zoneZ=standalone?plan.trackOffset:.44;
    // plan.from/to are SIDE-LOCAL positions; openingStart is relative to
    // the centre of the side and already contains opening.start.
    // Subtract the opening offset once or the ground band drifts from the
    // actual parking space whenever the gate is moved off the corner.
    const sideBaseX=openingStart-plan.start;
    // Transparent ground strips: green = available space along this side;
    // amber = part of the necessary parking that extends beyond its corner.
    // Amber marks a wicket collision as well. This is a planning aid, not
    // proof that rails / rollers can actually be installed.
    const strip=(from,to,color,kind,level=.025)=>{
      if(to-from<.002)return;
      const geometry=new THREE.PlaneGeometry(to-from,.58);
      ownedGeometries.push(geometry);
      const material=new THREE.MeshBasicMaterial({
        color,side:THREE.DoubleSide,transparent:true,opacity:.48,
        depthWrite:false,depthTest:true
      });
      ownedMaterials.push(material);
      const band=new THREE.Mesh(geometry,material);
      band.rotation.x=-Math.PI/2;
      band.position.set(sideBaseX+(from+to)/2,level,zoneZ);
      band.renderOrder=9;
      band.userData.kdSlidingParkingZone=kind;
      band.userData.kdSlidingParkingSide=opening.sideId;
      group.add(band);
    };
    strip(Math.max(0,plan.from),Math.min(sideLength,plan.to),0x2eac7b,'available');
    strip(plan.from,Math.min(0,plan.to),0xf0a036,'shortage',.034);
    strip(Math.max(sideLength,plan.from),plan.to,0xf0a036,'shortage',.034);
    for(const wicket of plan.wicketCollisions)
      strip(Math.max(plan.from,wicket.start),Math.min(plan.to,wicket.end),
        0xe45044,'wicket',.043);
    for(const obstacle of plan.collisions){
      if(obstacle.kind==='obstacle'||obstacle.kind==='post'||obstacle.kind==='fence')
        strip(Math.max(plan.from,obstacle.from),Math.min(plan.to,obstacle.to),
          0xe45044,obstacle.kind,.048);
    }
    // Arrows point from the opening toward the parking area; they are fixed
    // to the ground so the direction stays legible in open and closed views.
    const end=plan.direction==='left'?plan.from:plan.to;
    const origin=plan.boundary;
    const sign=plan.direction==='left'?-1:1;
    const wing=Math.min(.23,plan.required*.12);
    const ax=distance=>sideBaseX+distance;
    const vertices=[
      ax(origin),.087,zoneZ,ax(end),.087,zoneZ,
      ax(end),.087,zoneZ,ax(end-sign*wing),.087,zoneZ-wing*.50,
      ax(end),.087,zoneZ,ax(end-sign*wing),.087,zoneZ+wing*.50
    ];
    const arrowGeo=new THREE.BufferGeometry();
    arrowGeo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    ownedGeometries.push(arrowGeo);
    const arrowMat=new THREE.LineBasicMaterial({
      color:plan.valid?0x176d52:0xad591c,depthTest:false
    });
    ownedMaterials.push(arrowMat);
    const arrow=new THREE.LineSegments(arrowGeo,arrowMat);
    arrow.renderOrder=10;
    arrow.userData.kdSlidingTravelArrow=true;
    arrow.userData.kdSlidingRequired=plan.required;
    group.add(arrow);
  }
  return plan;
}

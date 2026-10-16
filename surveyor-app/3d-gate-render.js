import * as THREE from '../naves/vendor/three.module.js';
import { GATE_FRAME_VISUAL, getGateFramePlan } from './3d-gate-frame.js';

// Physical-looking swing gate and wicket models. Every leaf is a separate
// group; hinge barrels are fixed in the gap between post and welded frame.
// No fabrication loads, welding joints or shop cut lengths are certified here.
export function renderGateFrame(options){
  const {group,base,opening,openingStart,postWidth,side,behind,gap,
    postMat,fillMat,frameGeometry,buildC10Geometry,buildPicketGeometry,
    instancePickets,horizontalPicketRows,verticalPicketPlan,
    ownedGeometries,ownedMaterials}=options;
  const plan=getGateFramePlan(opening,postWidth,side.height);
  const z=behind?.093:0,faceZ=z+.029;
  const tube=GATE_FRAME_VISUAL.outerProfileWidth;
  const hingeMat=new THREE.MeshStandardMaterial({
    color:0x323940,metalness:.60,roughness:.36
  });
  ownedMaterials.push(hingeMat);
  const hingeGeo=new THREE.CylinderGeometry(
    GATE_FRAME_VISUAL.hingeRadius,GATE_FRAME_VISUAL.hingeRadius,
    GATE_FRAME_VISUAL.hingeHeight,12
  );
  ownedGeometries.push(hingeGeo);
  for(const part of plan.leaves){
    const leaf=new THREE.Group();
    leaf.userData.kdGateLeaf=opening.kind==='gate';
    leaf.userData.kdWicketLeaf=opening.kind==='wicket';
    leaf.userData.kdFrameWidth=part.width;
    leaf.userData.kdPostFaceClearance=plan.sideClearance;
    leaf.position.x=openingStart+part.center;
    group.add(leaf);
    const half=part.width/2, bottom=plan.bottomClearance;
    const midY=bottom+part.height/2;
    const edgeX=half-tube/2;
    // 40x25 mm outside frame, with 40x20 mm center rail.
    for(const x of [-edgeX,edgeX])
      frameGeometry(leaf,base,tube,part.height-2*tube,
        GATE_FRAME_VISUAL.outerProfileDepth,x,midY,z,postMat);
    for(const y of [bottom+tube/2,bottom+part.height-tube/2])
      frameGeometry(leaf,base,part.width,tube,
        GATE_FRAME_VISUAL.outerProfileDepth,0,y,z,postMat);
    frameGeometry(leaf,base,part.width-2*tube,GATE_FRAME_VISUAL.railWidth,
      GATE_FRAME_VISUAL.railDepth,0,midY,z-.005,postMat);
    // Stiffening brace on the back: low at the hinge, high at the free end.
    const xa=part.hingeSide==='left'?-half+.068:half-.068;
    const xb=-xa,ya=bottom+.082,yb=bottom+part.height-.082;
    const brace=frameGeometry(leaf,base,Math.hypot(xb-xa,yb-ya),
      GATE_FRAME_VISUAL.diagonalWidth,GATE_FRAME_VISUAL.diagonalDepth,
      (xa+xb)/2,(ya+yb)/2,z-.027,postMat);
    brace.rotation.z=Math.atan2(yb-ya,xb-xa);
    brace.userData.kdDiagonalBrace=true;
    const insideWidth=Math.max(.13,part.width-2*tube-.018);
    const insideHeight=Math.max(.18,part.height-2*tube-.026);
    const fillY=bottom+tube+.012;
    if(side.fill==='sheet'){
      const geo=buildC10Geometry(insideWidth,insideHeight);
      ownedGeometries.push(geo);
      const panel=new THREE.Mesh(geo,fillMat);
      panel.position.set(0,fillY,faceZ);
      leaf.add(panel);
    }else if(side.fill==='horizontal'||side.fill==='horizontal-double'||side.fill==='jalousie'){
      const double=side.fill==='horizontal-double';
      const rows=horizontalPicketRows(insideHeight,gap,double);
      if(side.fill==='jalousie'){
        rows.front.forEach(y=>frameGeometry(leaf,base,insideWidth,.11,.023,
          0,fillY+y,faceZ,fillMat));
      }else{
        const geo=buildPicketGeometry(insideWidth,true);
        ownedGeometries.push(geo);
        instancePickets(leaf,geo,fillMat,rows.front.map(y=>({
          x:0,y:fillY+y,z:faceZ
        })),0);
        instancePickets(leaf,geo,fillMat,rows.rear.map(y=>({
          x:0,y:fillY+y,z:faceZ-.087
        })),Math.PI);
      }
    }else{
      const strips=verticalPicketPlan(insideWidth,gap,true).strips;
      const geo=buildPicketGeometry(insideHeight);
      ownedGeometries.push(geo);
      instancePickets(leaf,geo,fillMat,strips.map(p=>({
        x:p.x,y:fillY,z:faceZ,width:p.width
      })),0);
      if(side.fill==='picket-double'){
        const rear=[];
        for(let k=0;k<strips.length-1;k++)
          rear.push({x:(strips[k].x+strips[k+1].x)/2,
            y:fillY,z:faceZ-.087});
        instancePickets(leaf,geo,fillMat,rear,Math.PI);
      }
    }
    // Two real cylindrical hinge barrels per leaf, against the metal posts.
    for(const y of part.hingeHeights){
      const barrel=new THREE.Mesh(hingeGeo,hingeMat);
      barrel.position.set(openingStart+part.hingeAxis,y,z+.012);
      barrel.userData.kdHinge=true;
      group.add(barrel);
      frameGeometry(group,base,plan.sideClearance+.044,.025,.009,
        openingStart+part.hingeAxis,y,z+.012,hingeMat);
    }
    // Handle and lock escutcheon on the free vertical tube.
    const latchX=part.freeSide==='left'?-half+.048:half-.048;
    frameGeometry(leaf,base,.046,.116,.009,latchX,midY,z+.020,hingeMat);
    frameGeometry(leaf,base,.070,.009,.013,
      latchX+(part.freeSide==='left'?-.025:.025),
      midY+.016,z+.033,hingeMat);
  }
  return plan;
}

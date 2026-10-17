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
    // Real post-side hinge axis: the hinge barrels remain stationary.
    const pivot=new THREE.Group();
    pivot.position.set(openingStart+part.hingeAxis,0,z+.012);
    pivot.rotation.y=part.swingAngle;
    pivot.userData.kdSwingPivot=true;
    pivot.userData.kdSwingSignature=opening.sideId+':'+opening.kind+':'+
      part.hingeSide+':'+part.swingAngle.toFixed(3);
    group.add(pivot);
    const leaf=new THREE.Group();
    leaf.userData.kdGateLeaf=opening.kind==='gate';
    leaf.userData.kdWicketLeaf=opening.kind==='wicket';
    leaf.userData.kdFrameWidth=part.width;
    leaf.userData.kdPostFaceClearance=plan.sideClearance;
    leaf.position.x=part.center-part.hingeAxis;
    leaf.position.z=-(z+.012);
    pivot.add(leaf);
    const half=part.width/2, bottom=plan.bottomClearance;
    const midY=bottom+part.height/2;
    const edgeX=half-tube/2;
    const embedded=plan.embedded?.leafIndex===part.index?plan.embedded:null;
    // 40x25 mm outside frame, with 40x20 mm center rail.
    for(const x of [-edgeX,edgeX])
      frameGeometry(leaf,base,tube,part.height-2*tube,
        GATE_FRAME_VISUAL.outerProfileDepth,x,midY,z,postMat);
    for(const y of [bottom+tube/2,bottom+part.height-tube/2])
      frameGeometry(leaf,base,part.width,tube,
        GATE_FRAME_VISUAL.outerProfileDepth,0,y,z,postMat);
    if(embedded){
      frameGeometry(leaf,base,Math.max(.08,embedded.fixedWidth-.045),
        GATE_FRAME_VISUAL.railWidth,GATE_FRAME_VISUAL.railDepth,
        (embedded.fixedLeft+embedded.fixedRight)/2,midY,z-.005,postMat);
    }else frameGeometry(leaf,base,part.width-2*tube,GATE_FRAME_VISUAL.railWidth,
      GATE_FRAME_VISUAL.railDepth,0,midY,z-.005,postMat);
    // Stiffening brace on the back: low at the hinge, high at the free end.
    const xa=part.hingeSide==='left'?-half+.068:half-.068;
    const xb=embedded?
      (part.hingeSide==='left'?embedded.fixedRight-.035:embedded.fixedLeft+.035):
      -xa;
    const ya=bottom+.082,yb=bottom+part.height-.082;
    const brace=frameGeometry(leaf,base,Math.hypot(xb-xa,yb-ya),
      GATE_FRAME_VISUAL.diagonalWidth,GATE_FRAME_VISUAL.diagonalDepth,
      (xa+xb)/2,(ya+yb)/2,z-.027,postMat);
    brace.rotation.z=Math.atan2(yb-ya,xb-xa);
    brace.userData.kdDiagonalBrace=true;
    function renderInfill(xCenter,insideWidth,insideHeight,fillY,target=leaf){
      if(insideWidth<.09||insideHeight<.1)return;
      if(side.fill==='sheet'){
        const geo=buildC10Geometry(insideWidth,insideHeight);
        ownedGeometries.push(geo);
        const panel=new THREE.Mesh(geo,fillMat);
        panel.position.set(xCenter,fillY,faceZ);
        target.add(panel);
      }else if(side.fill==='horizontal'||side.fill==='horizontal-double'||side.fill==='jalousie'){
        const double=side.fill==='horizontal-double';
        const rows=horizontalPicketRows(insideHeight,gap,double);
        if(side.fill==='jalousie'){
          rows.front.forEach(y=>frameGeometry(target,base,insideWidth,.11,.023,
            xCenter,fillY+y,faceZ,fillMat));
        }else{
          const geo=buildPicketGeometry(insideWidth,true);
          ownedGeometries.push(geo);
          instancePickets(target,geo,fillMat,rows.front.map(y=>({
            x:xCenter,y:fillY+y,z:faceZ
          })),0);
          instancePickets(target,geo,fillMat,rows.rear.map(y=>({
            x:xCenter,y:fillY+y,z:faceZ-.087
          })),Math.PI);
        }
      }else{
        // All strips stay at nominal 120mm; available space is taken up by margins/gaps.
        const strips=verticalPicketPlan(insideWidth,gap,true).strips;
        const geo=buildPicketGeometry(insideHeight);
        ownedGeometries.push(geo);
        instancePickets(target,geo,fillMat,strips.map(p=>({
          x:xCenter+p.x,y:fillY,z:faceZ,width:p.width
        })),0);
        if(side.fill==='picket-double'){
          const rear=[];
          for(let k=0;k<strips.length-1;k++)
            rear.push({x:xCenter+(strips[k].x+strips[k+1].x)/2,
              y:fillY,z:faceZ-.087});
          instancePickets(target,geo,fillMat,rear,Math.PI);
        }
      }
    }
    if(embedded){
      // Only the fixed section receives rigid gate infill. Wicket infill
      // is generated separately within its own perimeter so no plate
      // spans across the opening and hides the step-over threshold.
      renderInfill((embedded.fixedLeft+embedded.fixedRight)/2,
        Math.max(.10,embedded.fixedWidth-.055),
        Math.max(.18,part.height-2*tube-.026),bottom+tube+.012);
      const door=new THREE.Group();
      door.userData.kdEmbeddedWicket=true;
      door.userData.kdEmbeddedWidth=embedded.width;
      door.position.x=(embedded.localLeft+embedded.localRight)/2;
      leaf.add(door);
      const frame=embedded.frameWidth;
      const thresholdY=bottom+embedded.bottomThreshold;
      for(const x of [-embedded.width/2+frame/2,embedded.width/2-frame/2]){
        const jamb=frameGeometry(door,base,frame,part.height-tube,
          embedded.frameDepth,x,midY,z+.008,postMat);
        jamb.userData.kdEmbeddedJamb=true;
      }
      const header=frameGeometry(door,base,embedded.width,frame,
        embedded.frameDepth,0,bottom+part.height-frame/2,z+.008,postMat);
      header.userData.kdEmbeddedHeader=true;
      const threshold=frameGeometry(door,base,embedded.width,.045,
        embedded.frameDepth,0,thresholdY,z+.013,postMat);
      threshold.userData.kdEmbeddedThreshold=true;
      frameGeometry(door,base,Math.max(.1,embedded.width-2*frame),.032,.020,
        0,midY,z+.006,postMat);
      const innerFillW=embedded.width-2*frame-.022;
      const innerFillH=part.height-embedded.bottomThreshold-frame-.042;
      renderInfill(0,innerFillW,Math.max(.15,innerFillH),
        thresholdY+.035,door);
      // Independent pair of hinges on the INNER jamb, not on the gate post.
      for(const y of embedded.hingeHeights){
        const barrel=new THREE.Mesh(hingeGeo,hingeMat);
        barrel.position.set(embedded.hingeX-door.position.x,y,z+.039);
        barrel.userData.kdHinge=true;
        barrel.userData.kdEmbeddedHinge=true;
        door.add(barrel);
      }
      const latchLocal=(embedded.hingeSide==='left'?1:-1)*(embedded.width/2-.062);
      const innerHandle=frameGeometry(door,base,.040,.106,.013,
        latchLocal,midY,z+.052,hingeMat);
      innerHandle.userData.kdEmbeddedHandle=true;
    }else renderInfill(0,Math.max(.13,part.width-2*tube-.018),
      Math.max(.18,part.height-2*tube-.026),bottom+tube+.012);
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

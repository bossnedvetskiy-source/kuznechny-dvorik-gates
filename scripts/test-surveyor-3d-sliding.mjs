import assert from 'node:assert/strict';
import * as THREE from 'three';
import {getSlidingGatePlan,getSlidingTravelPlan,getSlidingParkingWarning} from '../surveyor-app/3d-sliding-frame.js';
import {getSiteLayout,createDefaultSides,normalizeOpenings} from '../surveyor-app/3d-layout.js';
import {buildSlidingSketchSvg} from '../surveyor-app/3d-drawing.js';
import {readFile} from 'node:fs/promises';

for(const width of [2,3.4,4,4.5,5]){
  for(const shape of ['square','triangle']){
    for(const direction of ['left','right']){
      for(const centerPost of [false,true]){
        const gate={kind:'gate',type:'sliding',width,tailShape:shape,
          slideDirection:direction,centerPost};
        const plan=getSlidingGatePlan(gate,.08,1.8);
        const beam=width>=4.5?7:6;
        const tail=Math.min(width/2,beam-width);
        assert.equal(plan.beam,beam,'beam length follows the existing KD slide calculator');
        assert(Math.abs(plan.tail-tail)<1e-8);
        assert(Math.abs(plan.gateLength-width-tail)<1e-8);
        assert.equal(plan.tailShape,shape);
        assert.equal(plan.direction,direction);
        assert.equal(plan.centerPost,centerPost);
        assert(plan.left>=.08/2&&plan.right<=width-.08/2);
        assert.equal(plan.tailFrom<plan.left,direction==='left');
        assert.equal(plan.tailTo>plan.right,direction==='right');
        const svg=buildSlidingSketchSvg(plan,{sideId:'A',opening:gate,postSize:80,fillName:'Профнастил'});
        assert(svg.includes('ОТКАТНЫЕ ВОРОТА'));
        assert(svg.includes('Хвост'));
        assert(svg.includes(centerPost?'со средней стойкой':'без средней стойки'));
        assert(!svg.includes('₽'));
      }
    }
  }
}
assert.throws(()=>getSlidingGatePlan({width:5.5},.08,1.8));
const sides=createDefaultSides({length:12});
sides.B.enabled=true;sides.V.enabled=true;sides.G.enabled=true;
const options=normalizeOpenings(sides,{
  A:{gate:{enabled:true,type:'sliding',width:4,offset:6,
    slideDirection:'left',tailShape:'square',centerPost:false},
    wicket:{enabled:true,width:1,offset:11}},
  B:{gate:{enabled:true,type:'sliding',width:3.4,offset:1.4,
    slideDirection:'right',tailShape:'triangle',centerPost:true}}
});
const layout=getSiteLayout(sides,options);
assert.equal(layout.edges.length,4);
assert.equal(layout.openings.filter(o=>o.type==='sliding').length,2);
assert.equal(layout.edges.find(e=>e.id==='A').gate.tailShape,'square');
assert.equal(layout.edges.find(e=>e.id==='B').gate.slideDirection,'right');
assert.equal(layout.edges.find(e=>e.id==='A').gate.centerPost,false);
assert.equal(layout.edges.find(e=>e.id==='B').gate.centerPost,true);
assert.equal(getSlidingParkingWarning(layout.edges[0].gate,12,layout.edges[0].openings),null);
assert.equal(layout.posts.filter(p=>p.gateSupport).length>0,true);
assert.equal(layout.warnings.length,0,'full parking zones must fit on both sides');
const constrained=getSiteLayout(createDefaultSides({length:6}),{
  A:{gate:{enabled:true,type:'sliding',width:4,offset:1,
    slideDirection:'left'}}
});
assert(constrained.warnings.some(w=>w.includes('Недостаточно места')),
  'insufficient parking needs a warning, not silent geometry clipping');
const overlap=getSiteLayout(createDefaultSides({length:12}),{
  A:{gate:{enabled:true,type:'sliding',width:4,offset:3,
    slideDirection:'right'},wicket:{enabled:true,width:1,offset:7.5}}
});
assert(overlap.warnings.some(w=>w.includes('пересекает проём')));
const migrated=normalizeOpenings(createDefaultSides({length:12}),null,
  {enabled:true,width:3.4,offset:2});
assert.equal(migrated.A.gate.type,'swing','old gate projects stay swing');
assert.equal(normalizeOpenings(sides,{
  A:{gate:{enabled:true,type:'sliding',width:6,tailShape:'broken',slideDirection:'bad'}}
}).A.gate.width,5,'sliding gate width is capped at the supported 5m');
const source=await readFile('surveyor-app/3d-sliding-render.js','utf8');
const renderFactory=new Function('THREE','getSlidingTravelPlan',
  source.replace(/^import .*$/gm,'').replace(/^export /gm,'')+
  '\nreturn renderSlidingGate;');
const render=renderFactory(THREE,getSlidingTravelPlan);

const travelStart=8,sideLength=20;
for(const direction of ['left','right']){
  for(const slideOpen of [false,true]){
    const g={type:'sliding',kind:'gate',width:4,slideDirection:direction,
      tailShape:'triangle',slideOpen,showSlideZone:true,start:travelStart};
    const travel=getSlidingTravelPlan(g,sideLength,[]);
    assert.equal(travel.required,6);
    assert.equal(travel.available,8);
    assert.equal(travel.valid,true);
    assert.equal(travel.shortage,0);
    assert.equal(travel.shift,slideOpen?(direction==='left'?-4:4):0);
    assert.equal(travel.from,direction==='left'?2:12);
    assert.equal(travel.to,direction==='left'?8:18);
    assert.equal(getSlidingParkingWarning(g,sideLength,[]),null);
    assert.equal(getSlidingTravelPlan({...g,showSlideZone:false},sideLength,[]).showZone,false);
  }
}
const shortPlan=getSlidingTravelPlan({type:'sliding',kind:'gate',width:4,
  start:3,slideDirection:'left'},12,[]);
assert.equal(shortPlan.shortage,3);
assert.equal(shortPlan.available,3);
assert(getSlidingParkingWarning({type:'sliding',kind:'gate',width:4,
  start:3,slideDirection:'left'},12,[]).includes('не хватает 3,00 м'));
const wicketBlock={kind:'wicket',start:6.5,end:7.5};
const clashing=getSlidingTravelPlan({type:'sliding',kind:'gate',width:4,
  start:3,slideDirection:'right'},12,[wicketBlock]);
assert.equal(clashing.wicketCollisions.length,1);
assert.equal(clashing.valid,false);

const material=new THREE.MeshStandardMaterial({color:0x565d65});
for(const shape of ['square','triangle']){
  for(const centerPost of [false,true]){
    for(const direction of ['left','right']){
      for(const slideOpen of [false,true]){
        for(const showSlideZone of [false,true]){
          const group=new THREE.Group(),base=new THREE.BoxGeometry(1,1,1);
          const geometries=[],materials=[];
          const frameGeometry=(g,b,w,h,d,x,y,z,mat)=>{
            const mesh=new THREE.Mesh(b,mat);
            mesh.scale.set(w,h,d);mesh.position.set(x,y,z);g.add(mesh);return mesh;
          };
          const opening={kind:'gate',type:'sliding',sideId:'V',start:8,
            width:4,tailShape:shape,slideDirection:direction,slideOpen,
            showSlideZone,centerPost,frameProfile:'40x25',fill:'sheet'};
          const plan=render({group,base,opening,openingStart:-2,postWidth:.08,
            sideLength:20,otherOpenings:[],side:{height:1.8,fill:'sheet'},
            postMat:material,fillMat:material,gap:.05,frameGeometry,
            buildC10Geometry:(w,h)=>new THREE.PlaneGeometry(w,h),
            buildPicketGeometry:(w,h)=>new THREE.PlaneGeometry(w,h),
            instancePickets:()=>{},horizontalPicketRows:()=>({front:[],rear:[]}),
            verticalPicketPlan:()=>({strips:[]}),
            ownedGeometries:geometries,ownedMaterials:materials
          });
          let leaves=0,tail=0,beams=0,centers=0,movers=0,zoneBands=0,arrows=0;
          group.traverse(o=>{
            if(o.userData.kdSlidingLeaf)leaves++;
            if(o.userData.kdSlidingTail)tail++;
            if(o.userData.kdSlidingBeam)beams++;
            if(o.userData.kdSlidingCenterPost)centers++;
            if(o.userData.kdSlidingMoving){
              movers++;
              assert(Math.abs(o.position.x-
                (slideOpen?(direction==='left'?-4:4):0))<1e-8,
                'entire physical model must translate horizontally');
              assert(o.children.length>6,'all parts of movable frame must share one parent');
            }
            if(o.userData.kdSlidingParkingZone)zoneBands++;
            if(o.userData.kdSlidingTravelArrow)arrows++;
          });
          assert.deepEqual([leaves,tail,beams,centers,movers],
            [1,1,1,centerPost?1:0,1]);
          assert.equal(zoneBands,showSlideZone?1:0,'valid parking strip stays fixed on ground');
          assert.equal(arrows,showSlideZone?1:0);
          assert.equal(plan.tailShape,shape);
          assert.equal(plan.shift,slideOpen?(direction==='left'?-4:4):0);
          assert.equal(group.children.some(o=>o.userData.kdGateLeaf),false);
          geometries.forEach(g=>g.dispose());
          materials.forEach(m=>m.dispose());
          base.dispose();
        }
      }
    }
  }
}
material.dispose();
console.log('Sliding gates 3D: both states/directions/shapes, full parking envelope, ground zones, SVG and collision warnings OK');

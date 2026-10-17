import assert from 'node:assert/strict';
import {createDefaultSides,normalizeSides,getSiteLayout,verticalPicketPlan,verticalPicketLayout,normalizePostMode,isHorizontalFill,normalizeSwingGate,normalizeOpenings,getClearDimensionPlan} from '../surveyor-app/3d-layout.js';

const sides=createDefaultSides({length:12,height:1.8,step:2.5,fill:'picket-double',ral:'8017'});
let layout=getSiteLayout(sides);
assert.equal(layout.edges.length,1,'existing projects default to only side A');
assert.equal(layout.totalSpans,5);
assert.equal(layout.posts.length,6);
assert.equal(layout.perimeter,12);
assert.equal(layout.edges[0].side.fill,'picket-double');

sides.B.enabled=true;
layout=getSiteLayout(sides);
assert.equal(layout.edges.length,2);
assert.equal(layout.posts.length,10,'A and B must share one corner post (6 + 5 - 1)');
assert.equal(layout.perimeter,22);
assert.equal(layout.posts.filter(p=>p.sides.includes('A')&&p.sides.includes('B')).length,1);
sides.B.height=2.5;
const shared=layout.posts.find(p=>p.sides.includes('A')&&p.sides.includes('B'));
assert(shared,'shared corner must exist');
layout=getSiteLayout(sides);
assert.equal(layout.posts.find(p=>p.sides.includes('A')&&p.sides.includes('B')).height,2.5,
  'shared post height should match the taller connected fence');

sides.V.enabled=true;sides.G.enabled=true;
sides.V.length=12;sides.G.length=10;
sides.B.fill='sheet';sides.G.ral='6005';
layout=getSiteLayout(sides);
assert.equal(layout.edges.length,4);
assert.equal(layout.warnings.length,0,'rectangular plot should close');
assert.equal(layout.totalSpans,18,'5+4+5+4 spans');
assert.equal(layout.posts.length,18,'four corner posts counted once across 4 edges');
assert.equal(layout.perimeter,44);
assert.equal(layout.posts.filter(p=>p.sides.length===2).length,4);
assert.equal(layout.edges.find(e=>e.id==='B').side.fill,'sheet');
assert.equal(layout.edges.find(e=>e.id==='G').side.ral,'6005');
sides.V.length=11.5;
assert(getSiteLayout(sides).warnings.length===1,'unequal opposite sides must show open-contour warning');
assert.equal(getSiteLayout(sides).edges.find(e=>e.id==='A').side.length,12,
  'side A must remain independent');
sides.V.length=12;sides.G.length=9;
assert(getSiteLayout(sides).warnings.length===1,'unequal depth should be flagged');

sides.A.enabled=false;sides.B.enabled=false;sides.V.enabled=false;sides.G.enabled=false;
layout=getSiteLayout(sides);
assert.equal(layout.edges.length,0);
assert.equal(layout.posts.length,0);
assert.equal(layout.perimeter,0);
assert.equal(layout.totalSpans,0);


const gateSides=createDefaultSides({length:12,height:1.8,step:2.5,fill:'picket'});
const baseLayout=getSiteLayout(gateSides);
const gateDraft={enabled:true,type:'swing',width:3.4,offset:1};
const layoutGate=getSiteLayout(gateSides,gateDraft);
assert.equal(baseLayout.totalSpans,5,'legacy fence spans unchanged without gate');
assert.equal(layoutGate.gate.start,1);
assert.equal(layoutGate.gate.end,4.4);
assert.equal(layoutGate.fenceLength,8.6);
assert.equal(layoutGate.perimeter,12,'outer boundary length retains gate opening');
assert.equal(layoutGate.edges[0].sections.length,2);
assert.equal(layoutGate.totalSpans,5,'different residual fence lengths divided independently');
assert.equal(layoutGate.posts.length,7,'one post at each gate edge');
for(const segment of layoutGate.edges[0].sections){
  assert(segment.from>=layoutGate.gate.end-.00001 || segment.to<=layoutGate.gate.start+.00001,
    'no fence section may overlap gate aperture');
  assert(segment.span<=gateSides.A.step+.00001,'fence spans cannot exceed post step');
}
for(const x of [layoutGate.gate.start,layoutGate.gate.end])
  assert(layoutGate.posts.some(p=>Math.abs(p.x-x)<.00001&&p.gateSupport),
    'gate needs separate hinge support at both boundaries');
const atBeginning=getSiteLayout(gateSides,{enabled:true,width:3.4,offset:0});
assert.equal(atBeginning.edges[0].sections.length,1,'no zero-length fence at the starting corner');
assert.equal(atBeginning.posts.filter(p=>Math.abs(p.x)<.00001).length,1);
const atEnd=getSiteLayout(gateSides,{enabled:true,width:3.4,offset:8.6});
assert.equal(atEnd.edges[0].sections.length,1,'no zero-length fence at the far corner');
assert.equal(atEnd.posts.filter(p=>Math.abs(p.x-12)<.00001).length,1);
gateSides.B.enabled=true;
const cornerGate=getSiteLayout(gateSides,{enabled:true,width:3.4,offset:8.6});
assert.equal(cornerGate.posts.filter(p=>Math.abs(p.x-12)<.00001&&Math.abs(p.z)<.00001).length,1,
  'shared hinge/corner pillar cannot be duplicated');
assert(cornerGate.posts.find(p=>Math.abs(p.x-12)<.00001&&Math.abs(p.z)<.00001).gateSupport);
assert.equal(normalizeSwingGate({enabled:true,width:4,offset:99},12).offset,8,
  'gate shift must remain inside side A');
gateSides.A.enabled=false;
assert.equal(getSiteLayout(gateSides,gateDraft).gate,null,'disabled A never paints gate');
assert(getSiteLayout(gateSides,gateDraft).warnings.some(w=>w.includes('включите сторону А')),
  'show explicit warning when gate is requested on disabled facade');
console.log('Swing gate layout: aperture subtraction, boundary pillars, end/corner cases OK');

// Four-sided entrance combinations: gate only, wicket only, and both on EACH side.
for(const target of ['A','B','V','G']){
  for(const combination of ['gate','wicket','both','touch','overlap']){
    const all=createDefaultSides({length:12,height:1.8,step:2.5,fill:'picket'});
    all.B.enabled=true;all.V.enabled=true;all.G.enabled=true;
    all.B.length=10;all.G.length=10;
    const openings=Object.fromEntries(['A','B','V','G'].map(id=>[id,{
      gate:{enabled:id===target&&combination!=='wicket',width:3.4,offset:2},
      wicket:{enabled:id===target&&combination!=='gate',width:1,
        offset:combination==='touch'?5.4:combination==='overlap'?2:6}
    }]));
    const result=getSiteLayout(all,openings);
    const edge=result.edges.find(e=>e.id===target);
    const sum=edge.openings.reduce((v,o)=>v+o.width,0);
    assert(Math.abs(edge.fenceLength+sum-edge.side.length)<1e-7,
      'fence length excludes exact gate and wicket openings on '+target);
    assert.equal(edge.openings.length,combination==='gate'||combination==='wicket'?1:2);
    assert(edge.openings.every((o,i)=>!edge.openings.slice(i+1)
      .some(p=>o.end>p.start+1e-9)),
      'gate and wicket must never overlap on '+target);
    if(combination==='touch'){
      const joint=edge.openings[0].end;
      const dx=edge.end.x-edge.start.x,dz=edge.end.z-edge.start.z;
      const f=joint/edge.side.length;
      const px=edge.start.x+dx*f,pz=edge.start.z+dz*f;
      assert.equal(result.posts.filter(p=>Math.abs(p.x-px)<1e-8 &&
        Math.abs(p.z-pz)<1e-8).length,1,'two adjacent openings share one post');
    }
    for(const opening of edge.openings){
      const matched=getClearDimensionPlan(result,80).find(d=>d.id===target).spans
        .find(d=>d.kind===opening.kind);
      assert.equal(matched.clearMm,Math.round((opening.width-.08)*1000),
        'all gate/wicket labels measure between post faces');
      const dx=edge.end.x-edge.start.x,dz=edge.end.z-edge.start.z;
      for(const pos of [opening.start,opening.end]){
        const f=pos/edge.side.length;
        assert(result.posts.some(p=>p.gateSupport &&
          Math.abs(p.x-edge.start.x-dx*f)<1e-8 &&
          Math.abs(p.z-edge.start.z-dz*f)<1e-8),'hinge posts on any direction');
      }
    }
  }
}
const tooShort=createDefaultSides({length:4});
const noOverlap=getSiteLayout(tooShort,{A:{
  gate:{enabled:true,width:3.4,offset:0},
  wicket:{enabled:true,width:1,offset:2}
}});
assert.equal(noOverlap.openings.length,1,'impossible second opening must not overlap first');
assert(noOverlap.warnings.some(x=>x.includes('не хватает места')));
const migrated=normalizeOpenings(createDefaultSides({length:12}),null,
  {enabled:true,width:3.4,offset:2});
assert.equal(migrated.A.gate.enabled,true,'legacy A gate draft must migrate');
assert.equal(migrated.B.gate.enabled,false,'migration must not create gates on other sides');
// Opening directions are independent per side and survive normalization.
const allSides=createDefaultSides({length:12});
for(const id of ['B','V','G'])allSides[id].enabled=true;
const custom=normalizeOpenings(allSides,{
  A:{gate:{enabled:true,openDirection:'outward'},wicket:{enabled:true,hingeSide:'right'}},
  B:{gate:{enabled:true,openDirection:'inward'},wicket:{enabled:true,openDirection:'outward',hingeSide:'right'}},
  V:{gate:{enabled:true,openDirection:'outward'},wicket:{enabled:true,hingeSide:'left'}}
});
assert.equal(custom.A.gate.openDirection,'outward');
assert.equal(custom.A.wicket.hingeSide,'right');
assert.equal(custom.B.wicket.openDirection,'outward');
assert.equal(custom.V.gate.openDirection,'outward');
assert.equal(custom.G.wicket.hingeSide,'left');
const directed=getSiteLayout(allSides,custom);
assert.equal(directed.edges.find(e=>e.id==='B').wicket.hingeSide,'right');
assert.equal(directed.edges.find(e=>e.id==='V').gate.openDirection,'outward');
assert.equal(normalizeSwingGate({},12).openDirection,'inward');
assert.equal(normalizeOpenings(allSides).A.wicket.openDirection,'inward');
assert.equal(normalizeOpenings(allSides).A.wicket.hingeSide,'left');
console.log('Opening direction: side-local defaults, persistence and layout OK');
console.log('Four-side gate/wicket combinations, shared posts and collisions OK');

// DIMENSIONS MUST BE MEASURED FROM THE INSIDE FACES, NOT POST AXES.
const dimensionsBase=getClearDimensionPlan(getSiteLayout(createDefaultSides({length:20,step:3})),80);
assert.equal(dimensionsBase[0].spans.length,7,'20 m side at max 3 m yields seven bays');
assert.equal(dimensionsBase[0].spans[0].clearMm,2777,
  '2857 mm centre spacing minus 80 mm post = 2777 mm clear');
assert.equal(dimensionsBase[0].length,20);
assert(Math.abs(dimensionsBase[0].spans[0].from-.04)<1e-9);
assert.equal(getClearDimensionPlan(getSiteLayout(createDefaultSides({length:20,step:3})),100)[0].spans[0].clearMm,2757,
  'changing to 100x100 steel posts changes each clear opening by 20 mm');
const dimensionGate=getClearDimensionPlan(getSiteLayout(createDefaultSides({length:12,step:2.5}),{
  enabled:true,width:3.4,offset:2
}),80)[0];
assert.equal(dimensionGate.spans.filter(p=>p.kind==='gate').length,1);
assert.equal(dimensionGate.spans.find(p=>p.kind==='gate').clearMm,3320,
  'the 3400 mm gate centreline aperture has 3320 mm clear between 80 mm posts');
assert(Math.abs(dimensionGate.spans.find(p=>p.kind==='gate').from-2.04)<1e-9);
for(const item of dimensionGate.spans){
  assert(item.from>=.04-1e-8 && item.to<=12-.04+1e-8,
    'dimension guides must always start/end inside the steel post faces');
}
const sideNone=createDefaultSides({length:12});
sideNone.A.enabled=false;
assert.equal(getClearDimensionPlan(getSiteLayout(sideNone),80).length,0,
  'disabled sides must not emit dimension labels');
console.log('3D face-to-face dimensions: normal bays, 80/100 mm posts, gate clear aperture OK');

const legacy=normalizeSides(null,{length:15,height:2,step:2.5,fill:'horizontal-double',ral:'7024'});
assert.equal(legacy.A.length,15);
assert.equal(legacy.A.fill,'horizontal-double');
assert.equal(legacy.B.enabled,false);
const invalid=normalizeSides({A:{length:999,height:-3,fill:'foo',ral:'oops',step:0}}, {});
assert.equal(invalid.A.length,60);
assert.equal(invalid.A.height,.8);
assert.equal(invalid.A.fill,'picket');
assert.equal(invalid.A.step,1);

// Product rule: standard vertical 120 mm pickets must NEVER be trimmed.
for(const postSize of [.06,.08,.10]){
  for(const span of [1,1.35,2.1,2.42,2.5,2.82]){
    for(const gap of [0,.02,.05,.115,.12]){
      for(const mode of ['visible','behind']){
        const width=mode==='behind'?span:span-postSize;
        const initial=verticalPicketPlan(width,gap,false);
        const fitted=verticalPicketPlan(width,gap,true);
        assert(initial.strips.every(p=>Math.abs(p.width-.12)<1e-10),
          'all default pickets must be full-width 120 mm');
        assert(fitted.strips.every(p=>Math.abs(p.width-.12)<1e-10),
          'quick-fit is forbidden from cutting pickets');
        assert.equal(verticalPicketLayout(width,gap).length,initial.count);
        const check=(plan)=>{
          if(plan.count){
            const occupied=plan.count*.12+(plan.count-1)*plan.gapUsed+2*plan.edgeMargin;
            assert(Math.abs(occupied-width)<1e-7,'pickets+gaps+margins must fill bay dimensions');
            for(let i=1;i<plan.strips.length;i++){
              const a=plan.strips[i-1],b=plan.strips[i];
              assert(Math.abs(b.x-a.x-.12-plan.gapUsed)<1e-7,'consistent full plank and gap spacing');
            }
          }
        };
        check(initial);check(fitted);
        assert(fitted.gapUsed<=gap+1e-9,'quick fit must never increase selected gap');
        if(initial.edgeMargin>.0001 && initial.canFit){
          assert(fitted.edgeMargin<1e-7,'one click must close post-side margins');
          assert(fitted.gapUsed<gap,'gap must decrease to accommodate one more whole picket');
        }else if(initial.edgeMargin>.0001){
          assert(!initial.canFit,'unsafe gap must raise a warning');
          assert(fitted.edgeMargin>.0001,'never hide a physically unsatisfiable gap');
        }
      }
    }
  }
}
const demo=verticalPicketPlan(2.42,.05,true);
assert.equal(demo.count,15);
assert(Math.abs(demo.gapUsed-.044285714285714296)<1e-8);
assert.equal(demo.edgeMargin,0);
assert(verticalPicketPlan(.97,0,true).canFit===false,
  'if no whole additional picket fits, reducing zero gap cannot close the bay');
console.log('Vertical steel pickets: no trimming, visible warning, one-click gap reduction OK');
assert.equal(normalizePostMode('picket','behind'),'behind');
assert.equal(normalizePostMode('picket-double','behind'),'behind');
assert.equal(normalizePostMode('sheet','behind'),'behind');
assert.equal(normalizePostMode('horizontal','behind'),'visible');
assert.equal(normalizePostMode('horizontal-double','behind'),'visible');
assert(isHorizontalFill('horizontal-double'));
const rear=createDefaultSides({fill:'picket',postMode:'behind'});
assert.equal(rear.A.postMode,'behind');
const restored=normalizeSides({A:{fill:'horizontal-double',postMode:'behind'}});
assert.equal(restored.A.postMode,'visible','invalid horizontal layout must be migrated to visible posts');
const old=normalizeSides({A:{fill:'picket',length:12}});
assert.equal(old.A.postMode,'visible','old drafts remain visible-post by default');

console.log('3D post modes and whole-width, adjustable-gap pickets OK');

console.log('3D layout A/B/V/G shared corners, independent sides, warnings and legacy drafts OK');

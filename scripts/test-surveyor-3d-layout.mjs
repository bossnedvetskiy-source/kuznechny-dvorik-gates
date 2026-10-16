import assert from 'node:assert/strict';
import {createDefaultSides,normalizeSides,getSiteLayout,verticalPicketPlan,verticalPicketLayout,normalizePostMode,isHorizontalFill,normalizeSwingGate} from '../surveyor-app/3d-layout.js';

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

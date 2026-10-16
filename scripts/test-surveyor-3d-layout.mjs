import assert from 'node:assert/strict';
import {createDefaultSides,normalizeSides,getSiteLayout} from '../surveyor-app/3d-layout.js';

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

const legacy=normalizeSides(null,{length:15,height:2,step:2.5,fill:'horizontal-double',ral:'7024'});
assert.equal(legacy.A.length,15);
assert.equal(legacy.A.fill,'horizontal-double');
assert.equal(legacy.B.enabled,false);
const invalid=normalizeSides({A:{length:999,height:-3,fill:'foo',ral:'oops',step:0}}, {});
assert.equal(invalid.A.length,60);
assert.equal(invalid.A.height,.8);
assert.equal(invalid.A.fill,'picket');
assert.equal(invalid.A.step,1);

console.log('3D layout A/B/V/G shared corners, independent sides, warnings and legacy drafts OK');

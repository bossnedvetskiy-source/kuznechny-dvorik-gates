import assert from 'node:assert/strict';
import {createDefaultSides,getSiteLayout,getClearDimensionPlan} from '../surveyor-app/3d-layout.js';
import {PRODUCT_TYPES,normalizeProduct,getProductLayout} from '../surveyor-app/3d-product-layout.js';

const site=createDefaultSides({length:12,height:1.8,fill:'picket'});
const original=getSiteLayout(site);
const product=normalizeProduct(null,site.A,{gate:{width:3.4},wicket:{width:1}});
assert.equal(product.type,'pair');
assert.equal(PRODUCT_TYPES.length,5);
for(const type of PRODUCT_TYPES){
  const layout=getProductLayout({...product,type});
  assert.equal(layout.product,true,type+' must be product mode');
  assert.equal(layout.edges.length,1);
  assert.equal(layout.edges[0].sections.length,0,type+' must not contain fence bays');
  assert.equal(layout.totalSpans,0);
  assert.equal(layout.fenceLength,0);
  assert.equal(layout.edges[0].side.fill,'picket');
  assert.equal(layout.posts.length,type==='pair'?3:2,type+' must have only support posts');
  assert.equal(layout.openings.length,type==='pair'?2:1,type+' opening count');
  assert(layout.posts.every(p=>p.gateSupport),type+' only support posts');
  assert.equal(layout.edges[0].side.ral,product.ral);
  const dims=getClearDimensionPlan(layout,product.postSize);
  const clearOpenings=dims[0].spans.filter(span=>span.kind==='gate'||span.kind==='wicket');
  assert.equal(clearOpenings.length,type==='pair'?2:1);
  const expectedClearWidths=type==='wicket'?[1000]:type==='pair'?[3400,1000]:[3400];
  assert.deepEqual(clearOpenings.map(span=>span.clearMm),expectedClearWidths,
    type+' displayed widths MUST be clear inner-post spans, not axis distances');
  assert.equal(layout.productOverallWidth,
    layout.productWidth+layout.posts.length*product.postSize/1000,
    type+' outside span includes every structural post');
  if(type==='pair'){
    assert.equal(layout.openings[0].kind,'gate');
    assert.equal(layout.openings[0].start,0);
    assert.equal(layout.openings[1].start,product.gate.width+product.postSize/1000);
    assert.equal(layout.productWidth,4.4);
  }
  if(type==='embedded'){
    assert.equal(layout.gate.builtInWicket,true);
    assert.equal(layout.openings.filter(o=>o.kind==='wicket').length,0);
  }
  if(type==='wicket')assert.equal(layout.openings[0].kind,'wicket');
  if(type==='sliding'){
    assert.equal(layout.gate.type,'sliding');
    const installation=layout.edges[0].installation;
    assert.equal(installation.trackOffset,.14,
      '80mm posts use a compact 140mm sliding offset including clearance');
    assert(installation.lane.from>=product.postSize/2000,
      'sliding carriage corridor must clear the face of the posts');
    assert(installation.valid,'standalone parking lane must be unobstructed');
    assert(layout.edges[0].side.length>layout.gate.width,'sliding tail requires clear parking room');
  }
}
for(const direction of ['left','right']){
  const layout=getProductLayout({...product,type:'sliding',
    gate:{...product.gate,width:4,slideDirection:direction,tailShape:'triangle',centerPost:true}});
  const gate=layout.gate,sideLength=layout.edges[0].side.length;
  assert.equal(gate.tailShape,'triangle');
  assert.equal(gate.centerPost,true);
  assert.equal(direction==='left'?gate.start>0:gate.start===0,true);
  assert.equal(layout.edges[0].installation.valid,true);
  assert(sideLength>8);
}
assert.equal(getSiteLayout(site).totalSpans,original.totalSpans,
  'product mode must not mutate original site geometry');
// 60/80/100 mm posts preserve safe shallow offsets and clear aperture widths.
for(const postSize of [60,80,100]){
  const p={...product,postSize};
  const layout=getProductLayout({...p,type:'sliding'});
  const installation=layout.edges[0].installation;
  assert.equal(getClearDimensionPlan(layout,postSize)[0].spans.find(x=>x.kind==='gate').clearMm,3400);
  assert(installation.lane.from>=postSize/2000-1e-8);
  assert(installation.valid);
}
assert.equal(site.A.length,12);
console.log('Standalone 3D product-only layouts: five variants, support posts, sliding lanes and site isolation OK');

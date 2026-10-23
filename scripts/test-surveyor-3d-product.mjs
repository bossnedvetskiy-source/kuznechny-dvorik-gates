import assert from 'node:assert/strict';
import {createDefaultSides,getSiteLayout} from '../surveyor-app/3d-layout.js';
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
  if(type==='pair'){
    assert.equal(layout.openings[0].kind,'gate');
    assert.equal(layout.openings[0].start,0);
    assert.equal(layout.openings[1].start,product.gate.width);
    assert.equal(layout.productWidth,4.4);
  }
  if(type==='embedded'){
    assert.equal(layout.gate.builtInWicket,true);
    assert.equal(layout.openings.filter(o=>o.kind==='wicket').length,0);
  }
  if(type==='wicket')assert.equal(layout.openings[0].kind,'wicket');
  if(type==='sliding'){
    assert.equal(layout.gate.type,'sliding');
    assert(layout.edges[0].installation.valid,'standalone parking lane must be unobstructed');
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
assert.equal(site.A.length,12);
console.log('Standalone 3D product-only layouts: five variants, support posts, sliding lanes and site isolation OK');

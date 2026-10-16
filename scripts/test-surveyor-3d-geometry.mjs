import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const source = await readFile('surveyor-app/3d-calculator.js','utf8');
// Exercise the same geometry functions used by the browser without instantiating WebGL.
const expression = source.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const factory = new Function('THREE', expression + '\nreturn {buildC10Geometry,buildPicketGeometry,horizontalPicketRows,RAL};');
const {buildC10Geometry,buildPicketGeometry,horizontalPicketRows,RAL} = factory(THREE);
const bounds = geometry => {
  geometry.computeBoundingBox();
  const b=geometry.boundingBox;
  return {min:b.min,max:b.max};
};

const c10=buildC10Geometry(2.39,1.68);
const wave=bounds(c10);
assert(c10.getAttribute('position').count > 800,'C10 must contain individual trapezoid faces');
assert(wave.max.z-wave.min.z >= .010,'C10 must have full depth of approx. 10 mm');
assert(Math.abs((wave.max.x-wave.min.x)-2.39)<0.0001);
assert(Math.abs(wave.max.y-1.68)<0.0001);
const normals=c10.getAttribute('normal').array;
assert([...normals].every(Number.isFinite),'C10 normals must be valid');
c10.dispose();

const picket=buildPicketGeometry(1.67);
const b=bounds(picket);
assert(picket.getAttribute('position').count>=36,'Pickets need real folded geometry');
assert(Math.abs(b.min.x+.06)<0.0001 && Math.abs(b.max.x-.06)<0.0001,'Picket width should be 120 mm');
assert(b.max.z-b.min.z>.02,'Picket must have a pronounced raised center');
assert(Math.abs(b.max.y-1.67)<0.0001);
picket.dispose();

const horizontal=buildPicketGeometry(2.25,true);
const h=bounds(horizontal);
assert(Math.abs(h.max.x-h.min.x-2.25)<0.0001,'Horizontal board should span the selected section');
assert(h.max.y-h.min.y > .115 && h.max.y-h.min.y < .125,'Horizontal board should be 120 mm wide');
horizontal.dispose();
// Horizontal checkerboard has a real second row shifted by half a pitch.
const rows=horizontalPicketRows(1.8,.05,true);
const single=horizontalPicketRows(1.8,.05,false);
assert(rows.front.length>=8, 'front side must have actual horizontal boards');
assert.equal(rows.front.length,rows.rear.length+1,'back row must have one fewer board');
assert.equal(single.rear.length,0,'single-row variant cannot have a back row');
for(let i=0;i<rows.rear.length;i++){
  const middle=(rows.front[i]+rows.front[i+1])/2;
  assert(Math.abs(rows.rear[i]-middle)<1e-8,'rear row must bridge the front gap');
}
for(const gap of [.02,.05,.12]){
  const result=horizontalPicketRows(1.5,gap,true);
  assert.equal(result.rear.length,Math.max(0,result.front.length-1));
  assert(result.front[0]>=.06,'first row must stay inside the span');
  assert(result.front.at(-1)<=1.5-.06,'last row must stay inside the span');
}
assert.equal(Object.keys(RAL).length,5,'RAL choices should remain available');
assert(RAL['9003']!==RAL['9005'],'white and black must have independent tones');
console.log('Surveyor 3D: C10, profiled pickets, checkerboard and RAL OK');

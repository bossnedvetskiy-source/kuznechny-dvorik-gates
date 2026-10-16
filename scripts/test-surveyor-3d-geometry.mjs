import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const source = await readFile('surveyor-app/3d-calculator.js','utf8');
// Exercise the same geometry functions used by the browser without instantiating WebGL.
const expression = source.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const factory = new Function('THREE', expression + '\nreturn {buildC10Geometry,buildPicketGeometry,horizontalPicketRows,buildPostCapGeometry,instancePickets,guideOffsets,RAL};');
const {buildC10Geometry,buildPicketGeometry,horizontalPicketRows,buildPostCapGeometry,instancePickets,guideOffsets,RAL} = factory(THREE);
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
// Rolled/rounded picket tops finish just below nominal centerline height.
assert(b.max.y <= 1.67 && b.max.y >= 1.665,
  'Rounded picket top must remain within 5 mm of the nominal height');
picket.dispose();

const horizontal=buildPicketGeometry(2.25,true);
const h=bounds(horizontal);
assert(Math.abs(h.max.x-h.min.x-2.25)<0.001,'Rounded horizontal board should span the section within 1 mm');
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
assert.equal(Object.keys(RAL).length,9,'all reference RAL swatches should be available');
assert(RAL['9003']!==RAL['9005'],'white and black must have independent tones');
// Verify that the two staggered picket rows face in opposite directions.
const instanceGeometry=buildPicketGeometry(1.8);
const testMaterial=new THREE.MeshStandardMaterial({side:THREE.DoubleSide});
const group=new THREE.Group();
instancePickets(group,instanceGeometry,testMaterial,[{x:0,y:0,z:0}],0);
instancePickets(group,instanceGeometry,testMaterial,[{x:0,y:0,z:-0.09}],Math.PI);
assert.equal(group.children.length,2,'both picket rows must create separate meshes');
const matrixA=new THREE.Matrix4(), matrixB=new THREE.Matrix4();
group.children[0].getMatrixAt(0,matrixA);
group.children[1].getMatrixAt(0,matrixB);
const face=new THREE.Vector3(0,0,1);
const frontNormal=face.clone().transformDirection(matrixA);
const rearNormal=face.clone().transformDirection(matrixB);
assert(frontNormal.z>0.999 && rearNormal.z<-.999,
 'rear pickets must face away from front pickets for both layouts');
assert(Math.abs(matrixB.elements[14]+.09)<1e-7,
 'rear pickets must retain their depth and not mirror their positions');
// Steel pickets must have native width after quick gap fit; NEVER scale to trim.
const wholeGroup=new THREE.Group();
instancePickets(wholeGroup,instanceGeometry,testMaterial,[{x:0,y:0,z:.115,width:.12}],0);
const wholeMatrix=new THREE.Matrix4();
wholeGroup.children[0].getMatrixAt(0,wholeMatrix);
const wholeScale=new THREE.Vector3();
wholeMatrix.decompose(new THREE.Vector3(),new THREE.Quaternion(),wholeScale);
assert(Math.abs(wholeScale.x-1)<1e-7,'steel pickets must remain 120 mm wide');
assert(Math.abs(wholeScale.y-1)<1e-7,'gap fitting must preserve height');
wholeGroup.children.forEach(mesh=>mesh.dispose());
group.children.forEach(mesh=>mesh.dispose());
instanceGeometry.dispose();
testMaterial.dispose();

// Match the visual posts and rails to real square/profile-tube dimensions.
for(const side of [.06,.08,.10]){
 const cap=buildPostCapGeometry(side);
 const limits=bounds(cap);
 assert(Math.abs(limits.max.x-limits.min.x-(side+.008))<1e-6,'cap must fit post size');
 assert(Math.abs(limits.max.y-.032)<1e-6,'the cap should be 32 mm high');
 assert([...cap.getAttribute('normal').array].every(Number.isFinite),
  'cap normals must be valid');
 cap.dispose();
}
assert.equal(guideOffsets(2.3).length,3,'standard horizontal bay needs three vertical guides');
assert.equal(guideOffsets(1.1).length,2,'short horizontal bay needs two guides');
const positions=guideOffsets(2.3);
assert(Math.abs(positions[0]+positions[2])<1e-8 && positions[1]===0,
 'three guides must be distributed evenly across the bay');
assert(source.includes('frameGeometry(group,base,.04,side.height-.12,.02'),
 'horizontal supports must use 40x20 profiles');
assert(source.includes('instancePickets(group,geo,fillMat,rearPickets,Math.PI)'),
 'vertical double-row pickets must turn backwards');
assert(source.includes('instancePickets(group,geo,fillMat,rearHorizontalPickets,Math.PI)'),
 'horizontal double-row pickets must turn backwards');
console.log('Surveyor 3D: caps, guides, rotated double pickets and previous geometry OK');

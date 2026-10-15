import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile('surveyor-app/sliding-gates/index.html','utf8');
const code=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert.ok(code,'Sliding-gate script exists');
new vm.Script(code,{filename:'surveyor-app/sliding-gates/index.html'});
const source=code.match(/function nominalMaterialSpec\(\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(source,'4x2 manufacturing specification exists');
function calculateSpec({center=false,frame='prof',width=4,height=2,tail='square'}={}){
 const context={state:{width,height,tail,centerPost:center,frame}};
 vm.runInNewContext(source+';result=nominalMaterialSpec()',context,{timeout:1000});
 return context.result;
}
for(const [frame,center,m60,m20,area] of [
 ['prof',false,24,22,6.56],
 ['prof',true,26,24,7.12],
 ['vertical',false,24,22,6.56],
 ['horizontal',true,26,24,7.12],
 ['jalousie',false,24,0,4.8],
 ['jalousie',true,26,0,5.2]
]){
 const spec=calculateSpec({frame,center});
 assert.deepEqual([spec.m60,spec.m20,spec.paintArea],[m60,m20,area],frame+' center='+center);
}
assert.equal(calculateSpec({width:4.5}),null,'Unconfirmed dimensions are not fabricated');
assert.equal(calculateSpec({tail:'triangle'}),null,'Unconfirmed triangle is not fabricated');
assert.match(code,/const keys=\[[^\n]*"centerPost"/,'Center setting persists in orders');
assert.match(code,/state\.centerPost=\s*b\.dataset\.center==="yes"/,'Center selection updates state');
assert.match(code,/state\.fill=choice!=="none"&&choice!=="jalousie"/,'Fill independent of construction');
assert.match(code,/\$\("saveBtn"\)\.disabled=/,'Save checks quote validity');
assert.match(code,/state\.frame==="jalousie" \|\| \(state\.tail==="square"/,'Unverified quote guard remains');
assert.ok(!html.includes('id="fill"'),'No duplicate filling toggle');
for(const value of ['prof','vertical','horizontal','jalousie','none'])assert.ok(html.includes('data-fill-type="'+value+'"'),'Filling '+value);
for(const value of ['yes','no'])assert.ok(html.includes('data-center="'+value+'"'),'Center '+value);
console.log('Sliding-gate construction reference and UI integrity OK');

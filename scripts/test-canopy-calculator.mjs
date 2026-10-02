import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const sandbox={window:{},console};
vm.createContext(sandbox);
for(const file of ['naves/geometry.js','naves/pricing.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
}
const G=sandbox.window.TrussGeometry;
const C=sandbox.window.CanopyPricing;

function calc(overrides={}){
  const raw={
    widthPostsM:3.4,lengthM:8.4,visibleHeightM:2.1,installType:'Бетонирование',
    coverage:'Поликарбонат',materialMode:'Авто',overhangMm:150,riseMm:567,
    heightMm:250,endFlatMm:300,cellStepMm:400,postsNeeded:true,existingPosts:0,
    beamsExisting:false,paint:true,delivery:0,...overrides
  };
  raw.trussCount=C.autoTrussCount(raw.lengthM);
  const geometry=G.compute(raw);
  assert.equal(geometry.ok,true,'Base canopy geometry must be valid');
  return {raw,geometry,price:C.compute(raw,geometry,{})};
}

const base=calc();
assert.equal(base.price.trussCount,6,'3.4 × 8.4 must use 6 trusses');
assert.equal(base.price.totalPosts,8,'3.4 × 8.4 must require 8 posts');
assert.equal(base.price.newPosts,8,'No existing posts means 8 new posts');
assert.equal(base.price.tube80Sticks,7,'Baseline 80×80 layout must use 7 sticks');
assert.equal(base.price.coverageData.buyMeters,24,'Baseline polycarbonate purchase must be 24 running metres');
assert.equal(base.price.coverageData.connectors,4,'Baseline must use 4 connector kits');
assert.equal(base.price.coverageData.endProfiles,10,'Baseline must use 10 end profiles');
assert.equal(base.geometry.chordProfile,'25×25×1,5','Auto profile below 4 m must be 25×25');
assert.equal(base.geometry.webProfile,'20×20×1,5','25×25 chord must use 20×20 web');
assert(base.price.total>214000&&base.price.total<216000,'Baseline total should remain close to approved Excel calculation');

const twoPosts=calc({existingPosts:2});
assert.equal(twoPosts.price.newPosts,6);
assert(twoPosts.price.total<base.price.total);

const beams=calc({beamsExisting:true});
assert.equal(beams.price.beamCount,0);
assert.equal(beams.price.tube80Sticks,4);
assert(beams.price.total<base.price.total);

const prof=calc({coverage:'Профнастил'});
assert(prof.price.coverageCost>0);
assert.equal(prof.price.lagLines,5);

const none=calc({coverage:'Без покрытия'});
assert.equal(none.price.coverageCost,0);
assert.equal(none.price.fittingsCost,0);
assert.equal(none.price.mountRate,900);

const wide=calc({widthPostsM:4.2,riseMm:700});
assert.equal(wide.geometry.chordProfile,'30×30×2');
assert.equal(wide.geometry.webProfile,'25×25×1,5');

console.log('Canopy calculator checks passed:',Math.round(base.price.total),'₽');

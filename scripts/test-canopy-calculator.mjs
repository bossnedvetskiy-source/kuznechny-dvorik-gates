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
    coverage:'Поликарбонат',trussType:'Треугольная',materialMode:'30×30×2',overhangMm:150,riseMm:567,
    heightMm:250,endFlatMm:300,cellStepMm:400,lagMode:'Стандарт',postsNeeded:true,existingPosts:0,
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
assert.equal(base.geometry.trussType,'Треугольная');
assert.equal(base.geometry.chordProfile,'30×30×2','New client default must use 30×30×2');
assert.equal(base.geometry.webProfile,'30×30×2','Selected material applies to the whole truss');
assert(base.geometry.diagonals.length>0,'Triangular truss must contain diagonal members');
assert.equal(base.geometry.verticals.length,0,'Triangular truss must not contain vertical lattice members');
assert(base.price.total>0,'Baseline total must be positive');

// Manual arc rise must change structural geometry, materials and customer price.
const tallerArc=calc({riseMm:800});
assert.equal(tallerArc.geometry.riseM,0.8);
assert(tallerArc.geometry.topCircle.length>base.geometry.topCircle.length);
assert.notEqual(tallerArc.price.total,base.price.total,'Manual rise change must recalculate price');

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

const vertical=calc({trussType:'Вертикальная'});
assert.equal(vertical.geometry.trussType,'Вертикальная');
assert.equal(vertical.geometry.diagonals.length,0);
assert(vertical.geometry.verticals.length>=4,'Vertical truss must contain vertical posts');
assert(vertical.price.webUsedM>0);

const strengthened=calc({trussType:'Усиленная'});
assert.equal(strengthened.geometry.trussType,'Усиленная');
assert(strengthened.geometry.diagonals.length>0,'Strengthened truss must keep diagonals');
assert(strengthened.geometry.verticals.length>0,'Strengthened truss must add vertical posts');
assert(strengthened.price.webUsedM>vertical.price.webUsedM,'Strengthened truss must use more lattice metal than vertical-only');

const tube40=calc({materialMode:'40×20×2'});
assert.equal(tube40.geometry.chordProfile,'40×20×2');
assert.equal(tube40.geometry.webProfile,'40×20×2');

const standard3=calc({widthPostsM:3,lengthM:5.9,riseMm:500,coverage:'Без покрытия',lagMode:'Стандарт'});
assert.equal(standard3.price.lagLines,10,'3 m canopy standard mode must use 10 purlin lines');
assert(standard3.price.lagStep<0.4,'Standard purlin step must stay around 40 cm');

const economy3=calc({widthPostsM:3,lengthM:5.9,riseMm:500,coverage:'Без покрытия',lagMode:'Эконом'});
assert.equal(economy3.price.lagLines,8,'3 m canopy economy mode must use 8 purlin lines');
assert(economy3.price.lagStep<=0.5+1e-9,'Economy purlin step must not exceed 50 cm');
assert(economy3.price.lagCost<standard3.price.lagCost,'Economy purlin mode must reduce 40×20 cost');

const legacy=calc({materialMode:'Авто'});
assert.equal(legacy.geometry.chordProfile,'25×25×1,5','Legacy Auto mode must remain readable for old orders');

console.log('Canopy calculator checks passed:',Math.round(base.price.total),'₽; 3m lags standard/economy:',standard3.price.lagLines,'/',economy3.price.lagLines);

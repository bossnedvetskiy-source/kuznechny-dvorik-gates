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

// Manual arc rise: independently check radius/arc length and that purchasing,
// roof cutting and customer quotes track all four commonly used heights.
let previous=null;
for(const riseMm of [400,567,800,1000]){
  const {raw,geometry:g,price:c}=calc({riseMm});
  const riseM=riseMm/1000;
  const widthM=raw.widthPostsM+2*raw.overhangMm/1000;
  const radius=widthM*widthM/(8*riseM)+riseM/2;
  const angle=2*Math.asin(widthM/(2*radius));
  assert(Math.abs(g.topCircle.radius-radius)<1e-9,'Top arc radius must match chord and sagitta');
  assert(Math.abs(g.topCircle.length-radius*angle)<1e-9,'Top arc length must use custom rise');
  assert(Math.abs(g.lowerTotalM-(g.lowerCircle.length+2*g.endFlatM))<1e-9,'Bottom chord must include both straight ends');
  assert(c.lagStep<=c.p.maxRib+1e-9,'Roof purlin spacing must not exceed 50 cm');
  assert(c.chordUsedM+c.webUsedM<=(c.chordSticks+c.webPurchaseSticks)*c.p.stick+1e-6,'Truss stock must cover all measured tube');
  assert.equal(c.chordSticks+c.webPurchaseSticks,c.combinedProfilePack.sticks,'Same-profile truss uses one common cutting plan');
  assert.equal(c.materialRows.reduce((sum,row)=>sum+row.cost,0),c.metalCost,'Procurement rows must reconcile with metal cost');
  assert.equal(c.coverageData.warning,'','Normal arc rises must have a valid polycarbonate roof');
  assert(c.coverageData.coverArcM>=g.topCircle.length,'Cover with two overhangs must be longer than top chord');
  assert(c.coverageData.buyMeters>=c.coverageData.coverArcM*c.coverageData.strips-c.p.stick*1e-9,'Purchased polycarbonate must cover strips');
  assert(c.total>0);
  if(previous){
    assert(g.topCircle.length>previous.geometry.topCircle.length,'A greater sagitta lengthens the upper arc');
    assert(g.lowerTotalM>previous.geometry.lowerTotalM,'A greater sagitta lengthens the lower chord');
    assert(c.coverageData.coverArcM>previous.price.coverageData.coverArcM,'A greater sagitta lengthens the roof');
    assert(c.total>previous.price.total,'Example client quote must reflect added material at these heights');
  }
  previous={geometry:g,price:c};
}

assert(base.price.webPack.sticks>base.price.webPurchaseSticks,'Offcuts must reduce the additional tube purchase');
assert.equal(base.price.chordSticks+base.price.webPurchaseSticks,13,'567 mm example needs 13 six-metre 30×30 sticks with shared offcuts');
assert.equal(base.price.webPurchaseSticks,1,'Only one extra stock tube is needed for lattice after reusing chord offcuts');

// On multi-section profiled sheets the overlap is needed only at the joints.
const profCut=calc({coverage:'Профнастил'});
assert.equal(profCut.price.coverageData.parts,3);
assert(profCut.price.coverageData.partLength<=profCut.price.p.profMaxPart);
assert(Math.abs(
  profCut.price.coverageData.parts*profCut.price.coverageData.partLength
  -(profCut.price.coverageData.parts-1)*profCut.price.p.profOverlap
  -profCut.price.coverageData.coverLengthM
)<1e-8,'Profiled roof must have exactly the required joined length');
assert(Math.abs(profCut.price.coverageData.buyArea-
  profCut.price.coverageData.totalParts*profCut.price.p.profFullWidth*profCut.price.coverageData.partLength
)<1e-8);

const disallowedRoof=calc({riseMm:1750});
assert(disallowedRoof.price.coverageData.warning.includes('выпуск покрытия'),'Impossible circular 100 mm overhang must not be quoted without a warning');
assert.equal(calc({riseMm:1750,coverage:'Без покрытия'}).price.coverageData.warning,'','No-cover truss does not require roof overhang validation');

const legacy=calc({materialMode:'Авто'});
assert.equal(legacy.geometry.chordProfile,'25×25×1,5','Legacy Auto mode must remain readable for old orders');
assert.equal(legacy.price.webPurchaseSticks,legacy.price.webPack.sticks,'Different chord and web profiles must never mix offcuts');

console.log('Canopy calculator checks passed:',Math.round(base.price.total),'₽; 3m lags standard/economy:',standard3.price.lagLines,'/',economy3.price.lagLines);

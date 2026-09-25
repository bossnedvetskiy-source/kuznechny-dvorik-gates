import assert from 'node:assert/strict';
import { calculateFence, FENCE_SETTINGS } from '../evroshtaketnik/engine.js';

const verticalDouble = calculateFence({
  type: 'vertical-double',
  post: '80x80x3',
  includeNewPosts: true,
  deliveryCost: 4500,
  sections: [
    { length: 10, height: 1.8, sharedWithNext: true },
    { length: 5, height: 1.5, sharedWithNext: false }
  ]
});

assert.equal(verticalDouble.summary.totalLength, 15);
assert.equal(verticalDouble.summary.totalSpans, 6);
assert.equal(verticalDouble.summary.sharedPosts, 1);
assert.equal(verticalDouble.summary.postsByScheme, 7);
assert.equal(verticalDouble.summary.picketsActual, 162);
assert.equal(verticalDouble.summary.tubeStocks, 6);
assert.equal(verticalDouble.costs.picket, 37518);
assert.equal(verticalDouble.costs.tube, 5184);
assert.equal(verticalDouble.costs.posts, 12600);
assert.equal(verticalDouble.costs.materials, 55302);
assert.equal(verticalDouble.costs.paint, 6608);
assert.equal(verticalDouble.costs.work, 27000);
assert.equal(verticalDouble.costs.postInstall, 5600);
assert.equal(verticalDouble.costs.screws, 1296);
assert.equal(verticalDouble.costs.order, 95806);
assert.equal(verticalDouble.costs.measurer, 3832);
assert.equal(verticalDouble.costs.total, 104138);

const horizontal = calculateFence({
  type: 'horizontal-double',
  post: '100x100x3',
  includeNewPosts: true,
  deliveryCost: 0,
  sections: [{ length: 12, height: 1.8 }]
});

assert.equal(horizontal.summary.totalSpans, 5);
assert.equal(horizontal.summary.postsByScheme, 6);
assert.equal(horizontal.summary.picketsActual, 105);
assert.equal(horizontal.summary.tubeStocks, 10);
assert.equal(horizontal.sections[0].frontPerSpan, 11);
assert.equal(horizontal.sections[0].rearPerSpan, 10);
assert.equal(horizontal.sections[0].picketLengthMm, 2280);
assert.equal(horizontal.costs.picket, 32308);
assert.equal(horizontal.costs.tube, 8640);
assert.equal(horizontal.costs.posts, 13500);
assert.equal(horizontal.costs.paint, 8564);
assert.equal(horizontal.costs.work, 24000);
assert.equal(horizontal.costs.postInstall, 4800);
assert.equal(horizontal.costs.screws, 1260);
assert.equal(horizontal.costs.order, 93072);
assert.equal(horizontal.costs.measurer, 3723);
assert.equal(horizontal.costs.total, 96795);

const singleExistingPosts = calculateFence({
  type: 'vertical-single',
  post: '60x60x2',
  includeNewPosts: false,
  deliveryCost: 1000,
  sections: [{ length: 8, height: 1.8 }]
});

assert.equal(singleExistingPosts.summary.totalSpans, 4);
assert.equal(singleExistingPosts.summary.postsByScheme, 5);
assert.equal(singleExistingPosts.summary.newPosts, 0);
assert.equal(singleExistingPosts.summary.picketsActual, 48);
assert.equal(singleExistingPosts.summary.tubeStocks, 3);
assert.equal(singleExistingPosts.sections[0].frontPerSpan, 12);
assert.equal(singleExistingPosts.sections[0].rearPerSpan, 0);
assert.equal(singleExistingPosts.costs.picket, 9504);
assert.equal(singleExistingPosts.costs.tube, 2592);
assert.equal(singleExistingPosts.costs.posts, 0);
assert.equal(singleExistingPosts.costs.paint, 1201);
assert.equal(singleExistingPosts.costs.work, 10400);
assert.equal(singleExistingPosts.costs.screws, 384);
assert.equal(singleExistingPosts.costs.order, 24081);
assert.equal(singleExistingPosts.costs.measurer, 963);
assert.equal(singleExistingPosts.costs.total, 26044);


const runtimeBase = calculateFence({
  type: 'vertical-double',
  post: '80x80x3',
  includeNewPosts: true,
  sections: [{ length: 10, height: 1.8 }]
});
const runtimeCustom = calculateFence({
  type: 'vertical-double',
  post: '80x80x3',
  includeNewPosts: true,
  sections: [{ length: 10, height: 1.8 }],
  settings: {
    picketDoublePrice: FENCE_SETTINGS.picketDoublePrice * 2,
    tube40Price: FENCE_SETTINGS.tube40Price * 2,
    post80Price: FENCE_SETTINGS.post80Price * 2
  }
});
assert.equal(runtimeCustom.costs.picket, runtimeBase.costs.picket * 2);
assert.equal(runtimeCustom.costs.tube, runtimeBase.costs.tube * 2);
assert.equal(runtimeCustom.costs.posts, runtimeBase.costs.posts * 2);
assert.equal(runtimeCustom.summary.totalLength, runtimeBase.summary.totalLength);
assert.equal(runtimeCustom.summary.totalSpans, runtimeBase.summary.totalSpans);


const openingsAndExistingPosts = calculateFence({
  type: 'vertical-double',
  post: '80x80x3',
  includeNewPosts: true,
  existingPostsCount: 2,
  sections: [{
    length: 10,
    height: 1.8,
    gateOpening: 3.4,
    wicketOpening: 1
  }]
});
assert.equal(openingsAndExistingPosts.summary.grossLineLength, 10);
assert.equal(openingsAndExistingPosts.summary.openingsWidth, 4.4);
assert.equal(openingsAndExistingPosts.summary.totalLength, 5.6);
assert.equal(openingsAndExistingPosts.sections[0].fenceLength, 5.6);
assert.equal(openingsAndExistingPosts.summary.existingPostsUsed, Math.min(2, openingsAndExistingPosts.summary.postsByScheme));
assert.equal(
  openingsAndExistingPosts.summary.newPosts,
  Math.max(0, openingsAndExistingPosts.summary.postsByScheme - 2)
);
assert.equal(openingsAndExistingPosts.purchase.posts, openingsAndExistingPosts.summary.newPosts);

const invalidOpenings = calculateFence({
  type: 'vertical-single',
  post: '80x80x3',
  includeNewPosts: true,
  sections: [{length: 4, height: 1.8, gateOpening: 3.4, wicketOpening: 1}]
});
assert.match(invalidOpenings.summary.check, /ПРОЁМЫ/);

const allOpening = calculateFence({
  type: 'vertical-single',
  post: '80x80x3',
  includeNewPosts: true,
  sections: [{length: 4.4, height: 1.8, gateOpening: 3.4, wicketOpening: 1}]
});
assert.equal(allOpening.summary.totalLength, 0);
assert.equal(allOpening.summary.totalSpans, 0);
assert.match(allOpening.summary.check, /НЕ ОСТАЛОСЬ/);

const techDefault = calculateFence({
  type: 'vertical-single',
  post: '80x80x3',
  includeNewPosts: true,
  sections: [{length: 10, height: 1.8}]
});
const techCustom = calculateFence({
  type: 'vertical-single',
  post: '80x80x3',
  includeNewPosts: true,
  sections: [{length: 10, height: 1.8}],
  settings: {
    maxSpan: 2,
    screwVertical: 6,
    tubeStockLength: 7,
    postLength: 4
  }
});
assert.equal(techDefault.summary.totalSpans, 4);
assert.equal(techCustom.summary.totalSpans, 5);
assert.equal(techCustom.purchase.screws, techCustom.summary.picketsActual * 6);
assert.equal(techCustom.purchase.tubePurchased, techCustom.purchase.tubeStocks * 7);
assert.equal(techCustom.purchase.postLm, techCustom.summary.newPosts * 4);

const customReserve = calculateFence({
  type: 'vertical-double',
  post: '80x80x3',
  includeNewPosts: true,
  sections: [{length: 5, height: 1.8}],
  settings: {picketReservePerSide: 3}
});
assert.equal(customReserve.purchase.pickets[0].reserveFront, 3);
assert.equal(customReserve.purchase.pickets[0].reserveRear, 3);

console.log('Euro picket calculator matches Excel reference scenarios.');

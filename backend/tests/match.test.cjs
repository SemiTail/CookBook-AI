const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ingredientMatch } = require('../dist/src/recommendations/match.js');
const ingredients = n => Array.from({ length: n }, (_, i) => ({ ingredientId: String(i), optional: false }));

test('positive: 3 of 4 required ingredients gives 75% and missing ID', () => {
  assert.deepEqual(ingredientMatch(ingredients(4), new Set(['0', '1', '2'])),
    { matchPercent: 75, eligible: true, missingIds: ['3'] });
});
test('negative: malformed ingredient data is rejected', () => {
  for (const invalid of [null, [null], [{}], [{ ingredientId: '', optional: false }], [{ ingredientId: 'a', optional: 'no' }]]) {
    assert.throws(() => ingredientMatch(invalid, new Set()), TypeError);
  }
});
test('edge: empty recipe and optional-only recipe do not match', () => {
  for (const items of [[], [{ ingredientId: 'salt', optional: true }]]) {
    assert.deepEqual(ingredientMatch(items, new Set(['salt'])), { matchPercent: 0, eligible: false, missingIds: [] });
  }
});
test('empty fridge gives 0%; all available gives 100%', () => {
  assert.equal(ingredientMatch(ingredients(2), new Set()).matchPercent, 0);
  assert.equal(ingredientMatch(ingredients(2), new Set(['0', '1'])).matchPercent, 100);
});
test('optional ingredients and repeated IDs do not change the ratio', () => {
  assert.equal(ingredientMatch([...ingredients(1), ...ingredients(1), { ingredientId: 'salt', optional: true }], new Set(['0'])).matchPercent, 100);
});
test('exact 70% qualifies; rounded 69.565% does not', () => {
  assert.equal(ingredientMatch(ingredients(10), new Set(ingredients(7).map(x => x.ingredientId))).eligible, true);
  const match = ingredientMatch(ingredients(23), new Set(ingredients(16).map(x => x.ingredientId)));
  assert.equal(match.matchPercent, 70);
  assert.equal(match.eligible, false);
});

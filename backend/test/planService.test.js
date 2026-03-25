'use strict';

const assert = require('assert');
const { getPlanDefinition, canPlanDo, getPlanLimit, getAllPlans, DEFAULT_PLAN } = require('../src/services/planService');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 planService tests\n');

test('DEFAULT_PLAN is free', () => assert.strictEqual(DEFAULT_PLAN, 'free'));

test('getPlanDefinition returns free plan', () => {
  const plan = getPlanDefinition('free');
  assert.strictEqual(plan.code, 'free');
  assert.strictEqual(plan.monthlyGenerationLimit, 10);
});

test('getPlanDefinition falls back to free for unknown code', () => {
  const plan = getPlanDefinition('unknown_xyz');
  assert.strictEqual(plan.code, 'free');
});

test('pro plan has higher limits than free', () => {
  const free = getPlanDefinition('free');
  const pro  = getPlanDefinition('pro');
  assert.ok(pro.monthlyGenerationLimit > free.monthlyGenerationLimit);
  assert.ok(pro.creditsPerMonth > free.creditsPerMonth);
});

test('team plan allows teamWorkspace feature', () => {
  assert.strictEqual(canPlanDo('team', 'teamWorkspace'), true);
});

test('free plan does not allow exportStl', () => {
  assert.strictEqual(canPlanDo('free', 'exportStl'), false);
});

test('pro plan allows exportStl', () => {
  assert.strictEqual(canPlanDo('pro', 'exportStl'), true);
});

test('free plan does not allow teamWorkspace', () => {
  assert.strictEqual(canPlanDo('free', 'teamWorkspace'), false);
});

test('getPlanLimit returns correct generation limit for free', () => {
  const limit = getPlanLimit('free', 'monthlyGenerationLimit');
  assert.strictEqual(limit, 10);
});

test('admin plan has Infinity generation limit', () => {
  const limit = getPlanLimit('admin', 'monthlyGenerationLimit');
  assert.strictEqual(limit, Infinity);
});

test('getAllPlans returns all 4 plans', () => {
  const plans = getAllPlans();
  assert.strictEqual(plans.length, 4);
  const codes = plans.map(p => p.code);
  assert.ok(codes.includes('free'));
  assert.ok(codes.includes('pro'));
  assert.ok(codes.includes('team'));
  assert.ok(codes.includes('admin'));
});

test('plan credits: free < pro < team', () => {
  const f = getPlanDefinition('free');
  const p = getPlanDefinition('pro');
  const t = getPlanDefinition('team');
  assert.ok(f.creditsPerMonth < p.creditsPerMonth);
  assert.ok(p.creditsPerMonth < t.creditsPerMonth);
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

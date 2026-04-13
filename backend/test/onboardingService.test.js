'use strict';

const assert = require('assert');
const { STEPS, createOnboarding, getOnboarding, advanceStep, completeOnboarding, skipOnboarding,
        hasCompletedOnboarding, getOnboardingFunnelMetrics } = require('../src/services/onboardingService');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 onboardingService tests\n');

const u1 = `ob-user-a-${Date.now()}`;
const u2 = `ob-user-b-${Date.now()}`;
const u3 = `ob-user-c-${Date.now()}`;
const u4 = `ob-user-d-${Date.now()}`;

test('STEPS array has 7 items', () => assert.strictEqual(STEPS.length, 7));
test('first step is welcome', () => assert.strictEqual(STEPS[0], 'welcome'));
test('last step is next_steps', () => assert.strictEqual(STEPS[STEPS.length - 1], 'next_steps'));

test('createOnboarding returns a record', () => {
  const r = createOnboarding(u1);
  assert.strictEqual(r.userId, u1);
  assert.strictEqual(r.currentStep, 'welcome');
  assert.strictEqual(r.stepIndex, 0);
  assert.ok(!r.completedAt);
});

test('createOnboarding is idempotent', () => {
  const r1 = createOnboarding(u1);
  const r2 = createOnboarding(u1);
  assert.strictEqual(r1.id, r2.id);
});

test('getOnboarding auto-creates for new user', () => {
  const r = getOnboarding(`new-user-${Date.now()}`);
  assert.strictEqual(r.currentStep, 'welcome');
});

test('advanceStep moves to next step', () => {
  const r = advanceStep(u1);
  assert.strictEqual(r.stepIndex, 1);
  assert.strictEqual(r.currentStep, STEPS[1]);
});

test('stepsCompleted grows on each advance', () => {
  advanceStep(u1); // step 2→3
  const r = getOnboarding(u1);
  assert.ok(r.stepsCompleted.length >= 2);
});

test('advanceStep through all steps completes onboarding', () => {
  const u = `ob-full-${Date.now()}`;
  createOnboarding(u);
  for (let i = 0; i < STEPS.length; i++) advanceStep(u);
  const r = getOnboarding(u);
  assert.ok(r.completedAt, 'should have completedAt');
  assert.strictEqual(r.currentStep, 'done');
});

test('completeOnboarding immediately marks done', () => {
  const r = completeOnboarding(u2);
  assert.ok(r.completedAt);
  assert.strictEqual(r.currentStep, 'done');
});

test('completeOnboarding is idempotent', () => {
  const t1 = completeOnboarding(u2).completedAt;
  const t2 = completeOnboarding(u2).completedAt;
  assert.strictEqual(t1, t2);
});

test('skipOnboarding marks skipped and done', () => {
  const r = skipOnboarding(u3);
  assert.strictEqual(r.skipped, true);
  assert.ok(r.completedAt);
  assert.strictEqual(r.currentStep, 'done');
});

test('hasCompletedOnboarding returns true after complete', () => {
  completeOnboarding(u4);
  assert.strictEqual(hasCompletedOnboarding(u4), true);
});

test('hasCompletedOnboarding returns false for fresh user', () => {
  const fresh = `ob-fresh-${Date.now()}`;
  assert.strictEqual(hasCompletedOnboarding(fresh), false);
});

test('getOnboardingFunnelMetrics returns correct shape', () => {
  const m = getOnboardingFunnelMetrics();
  assert.ok(typeof m.started === 'number');
  assert.ok(typeof m.completed === 'number');
  assert.ok(typeof m.completionRate === 'number');
  assert.ok(m.steps.length === STEPS.length);
  assert.ok(m.stepReachCounts);
});

test('funnel metrics: completed ≤ started', () => {
  const m = getOnboardingFunnelMetrics();
  assert.ok(m.completed <= m.started);
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

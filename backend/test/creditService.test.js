'use strict';

const assert = require('assert');
const { checkCredits, deductCredits, getCreditBalance, addCredits, refillCredits, CREDIT_COSTS } = require('../src/services/creditService');

// creditService depends on subscriptionService for plan-based balance
// We prime a test user to have a known plan
const { setUserPlan } = require('../src/services/subscriptionService');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 creditService tests\n');

const freeUser = `credit-free-${Date.now()}`;
const proUser  = `credit-pro-${Date.now()}`;
setUserPlan(freeUser, 'free');
setUserPlan(proUser, 'pro');

test('getCreditBalance returns free plan credits for new user', () => {
  const bal = getCreditBalance(freeUser);
  assert.strictEqual(bal.balance, 20, `expected 20, got ${bal.balance}`);
  assert.strictEqual(bal.maxBalance, 20);
});

test('getCreditBalance returns pro plan credits', () => {
  const bal = getCreditBalance(proUser);
  assert.strictEqual(bal.balance, 500);
});

test('checkCredits returns allowed=true when sufficient', () => {
  const result = checkCredits(freeUser, 'generation');
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.cost, CREDIT_COSTS.generation);
});

test('deductCredits reduces balance correctly', () => {
  const uid = `deduct-user-${Date.now()}`;
  setUserPlan(uid, 'free');
  getCreditBalance(uid); // init
  const before = getCreditBalance(uid).balance;
  deductCredits(uid, 'generation');
  const after = getCreditBalance(uid).balance;
  assert.strictEqual(after, before - CREDIT_COSTS.generation);
});

test('deductCredits throws when balance is zero', () => {
  const uid = `zero-bal-${Date.now()}`;
  setUserPlan(uid, 'free');
  // Drain credits
  const bal = getCreditBalance(uid);
  bal.balance = 0; // force zero
  assert.throws(() => deductCredits(uid, 'generation'), (err) => {
    assert.strictEqual(err.status, 402);
    assert.strictEqual(err.code, 'INSUFFICIENT_CREDITS');
    return true;
  });
});

test('checkCredits returns allowed=false when insufficient', () => {
  const uid = `low-bal-${Date.now()}`;
  setUserPlan(uid, 'free');
  const bal = getCreditBalance(uid);
  bal.balance = 1; // set to 1 — not enough for solid_build (costs 8)
  const result = checkCredits(uid, 'solid_build');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.reason?.includes('Insufficient credits'));
});

test('addCredits increases balance', () => {
  const uid = `add-credits-${Date.now()}`;
  setUserPlan(uid, 'free');
  const before = getCreditBalance(uid).balance;
  addCredits(uid, 50);
  const after = getCreditBalance(uid).balance;
  assert.strictEqual(after, before + 50);
});

test('refillCredits resets balance to plan max', () => {
  const uid = `refill-${Date.now()}`;
  setUserPlan(uid, 'pro');
  const bal = getCreditBalance(uid);
  bal.balance = 10; // drain
  refillCredits(uid);
  const after = getCreditBalance(uid).balance;
  assert.strictEqual(after, 500);
});

test('CREDIT_COSTS solid_build costs more than generation', () => {
  assert.ok(CREDIT_COSTS.solid_build > CREDIT_COSTS.generation);
});

test('blueprint_upload costs 0 credits', () => {
  assert.strictEqual(CREDIT_COSTS.blueprint_upload, 0);
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

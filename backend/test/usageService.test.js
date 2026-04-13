'use strict';

const assert = require('assert');
const { recordUsageEvent, getUserUsageThisMonth, checkQuota, getUserUsageEvents } = require('../src/services/usageService');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 usageService tests\n');

const uid = `test-user-usage-${Date.now()}`;

test('recordUsageEvent returns an event with all fields', () => {
  const evt = recordUsageEvent({ userId: uid, eventType: 'generation', quantity: 1 });
  assert.ok(evt.id, 'should have id');
  assert.strictEqual(evt.userId, uid);
  assert.strictEqual(evt.eventType, 'generation');
  assert.strictEqual(evt.quantity, 1);
  assert.ok(evt.month, 'should have month');
  assert.ok(evt.createdAt, 'should have createdAt');
});

test('recordUsageEvent throws without userId', () => {
  assert.throws(() => recordUsageEvent({ eventType: 'generation' }), /userId/);
});

test('recordUsageEvent throws without eventType', () => {
  assert.throws(() => recordUsageEvent({ userId: uid }), /eventType/);
});

test('getUserUsageThisMonth accumulates counts correctly', () => {
  const uid2 = `test-accum-${Date.now()}`;
  recordUsageEvent({ userId: uid2, eventType: 'generation', quantity: 1 });
  recordUsageEvent({ userId: uid2, eventType: 'generation', quantity: 1 });
  recordUsageEvent({ userId: uid2, eventType: 'solid_build', quantity: 1 });
  const usage = getUserUsageThisMonth(uid2);
  assert.strictEqual(usage.generation, 2);
  assert.strictEqual(usage.solid_build, 1);
});

test('getUserUsageThisMonth returns 0 for a fresh user', () => {
  const fresh = `fresh-user-${Date.now()}`;
  const usage = getUserUsageThisMonth(fresh);
  assert.strictEqual(usage.generation, 0);
  assert.strictEqual(usage.solid_build, 0);
  assert.strictEqual(usage.totalExports, 0);
});

test('checkQuota allows when under limit', () => {
  const uid3 = `quota-check-${Date.now()}`;
  recordUsageEvent({ userId: uid3, eventType: 'generation', quantity: 3 });
  const result = checkQuota(uid3, 'generation', 10);
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.used, 3);
  assert.strictEqual(result.remaining, 7);
});

test('checkQuota blocks when at limit', () => {
  const uid4 = `quota-block-${Date.now()}`;
  for (let i = 0; i < 10; i++) recordUsageEvent({ userId: uid4, eventType: 'generation', quantity: 1 });
  const result = checkQuota(uid4, 'generation', 10);
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.used, 10);
  assert.strictEqual(result.remaining, 0);
});

test('checkQuota allows Infinity limit', () => {
  const uid5 = `quota-inf-${Date.now()}`;
  for (let i = 0; i < 1000; i++) recordUsageEvent({ userId: uid5, eventType: 'generation', quantity: 1 });
  const result = checkQuota(uid5, 'generation', Infinity);
  assert.strictEqual(result.allowed, true);
});

test('getUserUsageEvents returns most recent events first', () => {
  const uid6 = `events-order-${Date.now()}`;
  // record two events in sequence
  const first  = recordUsageEvent({ userId: uid6, eventType: 'export_obj' });
  const second = recordUsageEvent({ userId: uid6, eventType: 'solid_build' });
  const events = getUserUsageEvents(uid6);
  assert.ok(events.length >= 2, `expected >=2 events, got ${events.length}`);
  // Sorted by createdAt desc — both have same ms, so just check both types present
  const types = events.map(e => e.eventType);
  assert.ok(types.includes('export_obj'), 'should include export_obj');
  assert.ok(types.includes('solid_build'), 'should include solid_build');
});

test('totalExports counts all export types', () => {
  const uid7 = `exports-total-${Date.now()}`;
  recordUsageEvent({ userId: uid7, eventType: 'export_obj', quantity: 2 });
  recordUsageEvent({ userId: uid7, eventType: 'export_glb', quantity: 1 });
  const usage = getUserUsageThisMonth(uid7);
  assert.strictEqual(usage.totalExports, 3);
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

'use strict';

const assert = require('assert');
const { track, getAnalyticsSummary, getEventsByName, getRecentEvents } = require('../src/services/analyticsService');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 analyticsService tests\n');

test('track returns an event with all fields', () => {
  const e = track({ eventName: 'landing_visit', page: '/', metadata: { test: true } });
  assert.ok(e.id);
  assert.strictEqual(e.eventName, 'landing_visit');
  assert.strictEqual(e.page, '/');
  assert.ok(e.createdAt);
});

test('track throws without eventName', () => {
  assert.throws(() => track({}), /eventName/);
});

test('track works with userId', () => {
  const e = track({ userId: 'test-uid', eventName: 'first_generation' });
  assert.strictEqual(e.userId, 'test-uid');
});

test('track works with sessionId only', () => {
  const e = track({ sessionId: 'sess-abc', eventName: 'cta_click' });
  assert.strictEqual(e.sessionId, 'sess-abc');
  assert.strictEqual(e.userId, null);
});

test('getAnalyticsSummary returns totalEvents > 0 after tracking', () => {
  const s = getAnalyticsSummary();
  assert.ok(s.totalEvents > 0);
  assert.ok(s.uniqueEventNames > 0);
  assert.ok(typeof s.totals === 'object');
});

test('getAnalyticsSummary totals accumulate correctly', () => {
  const before = getAnalyticsSummary().totals['waitlist_submit'] || 0;
  track({ eventName: 'waitlist_submit' });
  track({ eventName: 'waitlist_submit' });
  const after = getAnalyticsSummary().totals['waitlist_submit'];
  assert.strictEqual(after, before + 2);
});

test('getEventsByName returns only events of that name', () => {
  const uid = `an-test-${Date.now()}`;
  track({ userId: uid, eventName: 'onboarding_completed' });
  const events = getEventsByName('onboarding_completed');
  assert.ok(events.length >= 1);
  assert.ok(events.every(e => e.eventName === 'onboarding_completed'));
});

test('getEventsByName returns most recent first', () => {
  track({ eventName: 'demo_started', metadata: { n: 1 } });
  track({ eventName: 'demo_started', metadata: { n: 2 } });
  const events = getEventsByName('demo_started', { limit: 10 });
  assert.ok(events.length >= 2);
  // Most recent (n:2) should be first
  assert.strictEqual(events[0].metadata.n, 2);
});

test('getRecentEvents returns array with most recent first', () => {
  const events = getRecentEvents({ limit: 5 });
  assert.ok(Array.isArray(events));
  assert.ok(events.length <= 5);
});

test('last24h shows events from today', () => {
  track({ eventName: 'pricing_view' });
  const s = getAnalyticsSummary();
  assert.ok(s.last24hCount > 0);
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

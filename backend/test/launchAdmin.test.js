'use strict';

const assert = require('assert');

// We don't require the full launchAdminService here because it aggregates
// from other services; instead we test the shape contract directly.

const { getLaunchSummary } = require('../src/services/launchAdminService');

// Seed some data so the summary has values to aggregate
const { track }         = require('../src/services/analyticsService');
const { addToWaitlist } = require('../src/services/waitlistService');
const { submitFeedback } = require('../src/services/feedbackService');
const { createOnboarding, completeOnboarding } = require('../src/services/onboardingService');
const { seedDemoData, getDemoProject } = require('../src/services/demoService');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 launchAdmin tests\n');

// Seed data for aggregation
track({ eventName: 'landing_visit', page: '/' });
track({ eventName: 'waitlist_submit' });
track({ eventName: 'first_generation_succeeded', userId: 'la-uid-1' });
addToWaitlist({ email: `la-${Date.now()}@test.io`, name: 'Tester' });
submitFeedback({ category: 'bug', message: 'Something broke in the pipeline.' });
submitFeedback({ category: 'feature_request', message: 'Please add STEP export support.' });
createOnboarding('la-user-1');
createOnboarding('la-user-2');
completeOnboarding('la-user-2');
seedDemoData({ project: { id: 'demo-la', name: 'LA Demo', userId: 'demo-user' }, generations: [], blueprint: null });
getDemoProject(); // increment load count

let summary;

test('getLaunchSummary returns without throwing', () => {
  summary = getLaunchSummary();
  assert.ok(summary);
});

test('summary has timestamp', () => {
  assert.ok(typeof summary.timestamp === 'string');
  assert.ok(new Date(summary.timestamp).getTime() > 0);
});

test('summary.analytics has correct shape', () => {
  assert.ok(typeof summary.analytics.totalEvents === 'number');
  assert.ok(summary.analytics.totalEvents > 0);
  assert.ok(typeof summary.analytics.totals === 'object');
  assert.ok(typeof summary.analytics.last24hCount === 'number');
});

test('summary.waitlist has total ≥ 1', () => {
  assert.ok(typeof summary.waitlist.total === 'number');
  assert.ok(summary.waitlist.total >= 1);
});

test('summary.waitlist has recentEntries array', () => {
  assert.ok(Array.isArray(summary.waitlist.recentEntries));
});

test('summary.feedback has correct shape', () => {
  assert.ok(typeof summary.feedback.total === 'number');
  assert.ok(summary.feedback.total >= 2);
  assert.ok(typeof summary.feedback.openCount === 'number');
  assert.ok(typeof summary.feedback.byCategory === 'object');
});

test('summary.feedback has recentOpen array', () => {
  assert.ok(Array.isArray(summary.feedback.recentOpen));
});

test('summary.onboarding has started/completed/completionRate', () => {
  assert.ok(typeof summary.onboarding.started === 'number');
  assert.ok(summary.onboarding.started >= 2);
  assert.ok(typeof summary.onboarding.completed === 'number');
  assert.ok(summary.onboarding.completed >= 1);
  assert.ok(typeof summary.onboarding.completionRate === 'number');
  assert.ok(summary.onboarding.completionRate >= 0 && summary.onboarding.completionRate <= 100);
});

test('summary.demo has totalLoads ≥ 1', () => {
  assert.ok(typeof summary.demo.totalLoads === 'number');
  assert.ok(summary.demo.totalLoads >= 1);
});

test('summary is reproducible (two calls same timestamp prefix)', () => {
  const s2 = getLaunchSummary();
  assert.strictEqual(s2.timestamp.slice(0, 16), summary.timestamp.slice(0, 16));
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

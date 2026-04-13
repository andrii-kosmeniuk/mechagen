'use strict';

const assert = require('assert');
const { submitFeedback, getFeedback, updateFeedbackStatus, getFeedbackSummary, VALID_CATEGORIES } = require('../src/services/feedbackService');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 feedbackService tests\n');

let fbId;

test('VALID_CATEGORIES has all expected values', () => {
  const expected = ['bug','feature_request','usability','generation_quality','export_issue','billing_issue','other'];
  assert.deepStrictEqual(VALID_CATEGORIES, expected);
});

test('submitFeedback returns entry with all fields', () => {
  const e = submitFeedback({ category: 'bug', message: 'Export button disappears on mobile.' });
  assert.ok(e.id);
  assert.strictEqual(e.category, 'bug');
  assert.strictEqual(e.status, 'open');
  assert.ok(e.createdAt);
  fbId = e.id;
});

test('submitFeedback stores userId and project context', () => {
  const e = submitFeedback({ userId: 'u1', projectId: 'p1', generationId: 'g1', category: 'generation_quality', message: 'Bracket holes are too small.' });
  assert.strictEqual(e.userId, 'u1');
  assert.strictEqual(e.projectId, 'p1');
  assert.strictEqual(e.generationId, 'g1');
});

test('submitFeedback truncates message to 2000 chars', () => {
  const e = submitFeedback({ category: 'other', message: 'x'.repeat(3000) });
  assert.strictEqual(e.message.length, 2000);
});

test('submitFeedback throws for invalid category', () => {
  assert.throws(() => submitFeedback({ category: 'invalid', message: 'test test' }), { status: 400, code: 'INVALID_CATEGORY' });
});

test('submitFeedback throws for message too short', () => {
  assert.throws(() => submitFeedback({ category: 'bug', message: 'ok' }), { status: 400, code: 'MISSING_MESSAGE' });
});

test('submitFeedback throws for missing category', () => {
  assert.throws(() => submitFeedback({ message: 'something useful' }), { status: 400 });
});

test('getFeedback returns all entries', () => {
  const { entries, total } = getFeedback();
  assert.ok(entries.length >= 3);
  assert.ok(total >= 3);
});

test('getFeedback filters by category', () => {
  const { entries } = getFeedback({ category: 'bug' });
  assert.ok(entries.every(e => e.category === 'bug'));
});

test('getFeedback filters by status', () => {
  const { entries } = getFeedback({ status: 'open' });
  assert.ok(entries.every(e => e.status === 'open'));
});

test('updateFeedbackStatus changes status', () => {
  const updated = updateFeedbackStatus(fbId, 'in_review');
  assert.strictEqual(updated.status, 'in_review');
});

test('updateFeedbackStatus throws for invalid status', () => {
  assert.throws(() => updateFeedbackStatus(fbId, 'not_valid'), { status: 400 });
});

test('updateFeedbackStatus throws for unknown id', () => {
  assert.throws(() => updateFeedbackStatus('no-such-id', 'resolved'), { status: 404 });
});

test('getFeedbackSummary returns correct shape', () => {
  const s = getFeedbackSummary();
  assert.ok(typeof s.total === 'number');
  assert.ok(typeof s.openCount === 'number');
  assert.ok(typeof s.byCategory === 'object');
  for (const cat of VALID_CATEGORIES) assert.ok(cat in s.byCategory, `missing ${cat}`);
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

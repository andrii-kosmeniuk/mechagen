'use strict';

const assert = require('assert');
const { addToWaitlist, isOnWaitlist, getWaitlistEntry, getWaitlist, getWaitlistCount } = require('../src/services/waitlistService');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 waitlistService tests\n');

const email1 = `user-wl-${Date.now()}@mechagen.test`;
const email2 = `user-wl2-${Date.now()}@mechagen.test`;

test('addToWaitlist adds a new entry', () => {
  const { entry, alreadyRegistered } = addToWaitlist({ email: email1, name: 'Alice', company: 'ACME', useCase: '3d_printing' });
  assert.strictEqual(alreadyRegistered, false);
  assert.ok(entry.id);
  assert.strictEqual(entry.email, email1);
  assert.strictEqual(entry.name, 'Alice');
  assert.strictEqual(entry.company, 'ACME');
  assert.strictEqual(entry.useCase, '3d_printing');
  assert.strictEqual(entry.status, 'pending');
  assert.ok(entry.createdAt);
});

test('addToWaitlist deduplicates by email', () => {
  const { alreadyRegistered } = addToWaitlist({ email: email1 });
  assert.strictEqual(alreadyRegistered, true);
});

test('addToWaitlist deduplicates case-insensitively', () => {
  const { alreadyRegistered } = addToWaitlist({ email: email1.toUpperCase() });
  assert.strictEqual(alreadyRegistered, true);
});

test('isOnWaitlist returns true for registered email', () => {
  assert.strictEqual(isOnWaitlist(email1), true);
});

test('isOnWaitlist returns false for unknown email', () => {
  assert.strictEqual(isOnWaitlist(`unknown-${Date.now()}@no.test`), false);
});

test('isOnWaitlist is case-insensitive', () => {
  assert.strictEqual(isOnWaitlist(email1.toUpperCase()), true);
});

test('getWaitlistEntry returns the entry', () => {
  const entry = getWaitlistEntry(email1);
  assert.strictEqual(entry.email, email1);
});

test('getWaitlistEntry returns null for unknown email', () => {
  assert.strictEqual(getWaitlistEntry('nobody@noone.xyz'), null);
});

test('addToWaitlist throws for missing email', () => {
  assert.throws(() => addToWaitlist({ name: 'Bob' }), { status: 400, code: 'MISSING_EMAIL' });
});

test('addToWaitlist throws for invalid email format', () => {
  assert.throws(() => addToWaitlist({ email: 'not-an-email' }), { status: 400, code: 'INVALID_EMAIL' });
});

test('addToWaitlist accepts optional fields as null', () => {
  const { entry } = addToWaitlist({ email: email2 });
  assert.strictEqual(entry.name, null);
  assert.strictEqual(entry.company, null);
});

test('getWaitlist returns entries array and total', () => {
  const { entries, total } = getWaitlist({ limit: 100 });
  assert.ok(Array.isArray(entries));
  assert.ok(total >= 2); // at least email1 and email2
});

test('getWaitlist respects limit', () => {
  const { entries } = getWaitlist({ limit: 1 });
  assert.strictEqual(entries.length, 1);
});

test('getWaitlistCount returns positive number', () => {
  const count = getWaitlistCount();
  assert.ok(count >= 2);
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

'use strict';

const assert = require('assert');
const { checkRateLimit, resetRateLimit, getRateLimitStatus, RATE_LIMIT_CONFIG } = require('../src/services/rateLimitService');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 rateLimitService tests\n');

test('checkRateLimit allows first request', () => {
  const key = `test-rl-${Date.now()}`;
  const result = checkRateLimit(key, 'general');
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.current, 1);
});

test('checkRateLimit tracks request count', () => {
  const key = `test-count-${Date.now()}`;
  checkRateLimit(key, 'general');
  checkRateLimit(key, 'general');
  const result = checkRateLimit(key, 'general');
  assert.strictEqual(result.current, 3);
  assert.strictEqual(result.allowed, true);
});

test('checkRateLimit blocks after limit exceeded', () => {
  const key = `test-block-${Date.now()}`;
  const limit = RATE_LIMIT_CONFIG['generation'].requests; // 5
  for (let i = 0; i < limit; i++) checkRateLimit(key, 'generation');
  const result = checkRateLimit(key, 'generation');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.retryAfterMs > 0, 'should have retryAfterMs > 0');
});

test('checkRateLimit returns correct limit for each class', () => {
  for (const [cls, cfg] of Object.entries(RATE_LIMIT_CONFIG)) {
    const key   = `test-class-${cls}-${Date.now()}`;
    const result = checkRateLimit(key, cls);
    assert.strictEqual(result.limit, cfg.requests, `limit mismatch for ${cls}`);
  }
});

test('resetRateLimit clears the window', () => {
  const key = `test-reset-${Date.now()}`;
  const limit = RATE_LIMIT_CONFIG['generation'].requests;
  for (let i = 0; i < limit; i++) checkRateLimit(key, 'generation');
  // Should be blocked
  assert.strictEqual(checkRateLimit(key, 'generation').allowed, false);
  // Reset and first request should be allowed again
  resetRateLimit(key);
  const result = checkRateLimit(key, 'generation');
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.current, 1);
});

test('getRateLimitStatus returns current count', () => {
  const key = `test-status-${Date.now()}`;
  checkRateLimit(key, 'export');
  checkRateLimit(key, 'export');
  const status = getRateLimitStatus(key, 'export');
  assert.strictEqual(status.current, 2);
  assert.ok(status.remaining >= 0);
});

test('unknown limit class falls back to general', () => {
  const key = `test-fallback-${Date.now()}`;
  const result = checkRateLimit(key, 'some_unknown_class');
  assert.strictEqual(result.limit, RATE_LIMIT_CONFIG['general'].requests);
  assert.strictEqual(result.allowed, true);
});

test('different keys are tracked independently', () => {
  const key1 = `test-ind-a-${Date.now()}`;
  const key2 = `test-ind-b-${Date.now()}`;
  checkRateLimit(key1, 'general');
  checkRateLimit(key1, 'general');
  checkRateLimit(key2, 'general');
  assert.strictEqual(getRateLimitStatus(key1, 'general').current, 2);
  assert.strictEqual(getRateLimitStatus(key2, 'general').current, 1);
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

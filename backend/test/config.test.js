'use strict';

const assert = require('assert');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 config tests\n');

// ── Test env loading ──────────────────────────────────────────────────────────

test('config.PORT defaults to 3001', () => {
  delete process.env.PORT;
  const cfg = require('../src/config');
  assert.strictEqual(cfg.PORT, 3001);
});

test('config.PORT reads from env', () => {
  process.env.PORT = '4000';
  const cfg = require('../src/config').reload();
  assert.strictEqual(cfg.PORT, 4000);
  delete process.env.PORT;
});

test('config.NODE_ENV defaults to development', () => {
  delete process.env.NODE_ENV;
  const cfg = require('../src/config').reload();
  assert.strictEqual(cfg.NODE_ENV, 'development');
});

test('config.IS_DEV is true in development', () => {
  process.env.NODE_ENV = 'development';
  const cfg = require('../src/config').reload();
  assert.strictEqual(cfg.IS_DEV, true);
  delete process.env.NODE_ENV;
});

test('config.IS_DEV is false in production', () => {
  process.env.NODE_ENV = 'production';
  process.env.NVIDIA_API_KEY = 'test-key';  // satisfy validation in prod
  process.env.OPENAI_API_KEY = 'test-key';
  const cfg = require('../src/config').reload();
  assert.strictEqual(cfg.IS_DEV, false);
  delete process.env.NODE_ENV;
  delete process.env.NVIDIA_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

test('config validate() throws in production when AI keys are missing', () => {
  process.env.NODE_ENV = 'production';
  delete process.env.NVIDIA_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.NIM_API_KEY;
  assert.throws(() => require('../src/config').reload(), /Missing required/);
  delete process.env.NODE_ENV;
});

test('config.API_KEY_REQUIRED defaults to false', () => {
  delete process.env.API_KEY_REQUIRED;
  const cfg = require('../src/config').reload();
  assert.strictEqual(cfg.API_KEY_REQUIRED, false);
});

test('config.API_KEY_REQUIRED reads true from env', () => {
  process.env.API_KEY_REQUIRED = 'true';
  const cfg = require('../src/config').reload();
  assert.strictEqual(cfg.API_KEY_REQUIRED, true);
  delete process.env.API_KEY_REQUIRED;
});

test('config.WORKER_TIMEOUT defaults to 120000', () => {
  delete process.env.WORKER_TIMEOUT;
  const cfg = require('../src/config').reload();
  assert.strictEqual(cfg.WORKER_TIMEOUT, 120000);
});

test('config.WORKER_URL defaults to localhost:5001', () => {
  delete process.env.WORKER_URL;
  const cfg = require('../src/config').reload();
  assert.strictEqual(cfg.WORKER_URL, 'http://127.0.0.1:5001');
});

test('config.DATA_DIR is a non-empty string', () => {
  const cfg = require('../src/config').reload();
  assert.ok(typeof cfg.DATA_DIR === 'string' && cfg.DATA_DIR.length > 0);
});

test('config is accessible as direct properties (proxy)', () => {
  const cfg = require('../src/config');
  // Should not throw
  assert.ok(cfg.PORT !== undefined);
  assert.ok(cfg.NODE_ENV !== undefined);
});

// Reset
require('../src/config').reload();

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

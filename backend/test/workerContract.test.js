'use strict';

const assert = require('assert');
const { buildWorkerRequest, validateWorkerRequest, validateWorkerResponse, parseWorkerResponse } = require('../src/schemas/workerContract');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 workerContract tests\n');

// ── buildWorkerRequest ─────────────────────────────────────────────────────────

test('buildWorkerRequest returns a well-shaped object', () => {
  const r = buildWorkerRequest({ jobId: 'gen_abc', cadScript: 'import cadquery' });
  assert.strictEqual(r.jobId, 'gen_abc');
  assert.strictEqual(r.cadScript, 'import cadquery');
  assert.strictEqual(r.outputFormat, 'stl');
  assert.ok(r.sentAt);
});

test('buildWorkerRequest accepts custom outputFormat', () => {
  const r = buildWorkerRequest({ jobId: 'g1', cadScript: 'x = 1', outputFormat: 'step' });
  assert.strictEqual(r.outputFormat, 'step');
});

test('buildWorkerRequest defaults timeoutMs to 120000', () => {
  const r = buildWorkerRequest({ jobId: 'g1', cadScript: 'x = 1' });
  assert.strictEqual(r.timeoutMs, 120_000);
});

// ── validateWorkerRequest ──────────────────────────────────────────────────────

test('validateWorkerRequest passes a valid request', () => {
  const { valid } = validateWorkerRequest({ jobId: 'gen_123', cadScript: 'import cadquery as cq; result = cq.Workplane()' });
  assert.strictEqual(valid, true);
});

test('validateWorkerRequest fails on missing jobId', () => {
  const { valid, errors } = validateWorkerRequest({ cadScript: 'import cadquery' });
  assert.strictEqual(valid, false);
  assert.ok(errors.some(e => e.includes('jobId')));
});

test('validateWorkerRequest fails on missing cadScript', () => {
  const { valid, errors } = validateWorkerRequest({ jobId: 'gen_1' });
  assert.strictEqual(valid, false);
  assert.ok(errors.some(e => e.includes('cadScript')));
});

test('validateWorkerRequest fails on non-object input', () => {
  const { valid } = validateWorkerRequest(null);
  assert.strictEqual(valid, false);
});

test('validateWorkerRequest fails on too-short cadScript', () => {
  const { valid, errors } = validateWorkerRequest({ jobId: 'gen_1', cadScript: 'x' });
  assert.strictEqual(valid, false);
  assert.ok(errors.some(e => e.includes('too short')));
});

// ── validateWorkerResponse ─────────────────────────────────────────────────────

test('validateWorkerResponse passes a valid success response', () => {
  const { valid } = validateWorkerResponse({ jobId: 'gen_1', status: 'success', stlBase64: 'abc123' });
  assert.strictEqual(valid, true);
});

test('validateWorkerResponse passes a valid error response', () => {
  const { valid } = validateWorkerResponse({ jobId: 'gen_1', status: 'error', error: 'Script failed' });
  assert.strictEqual(valid, true);
});

test('validateWorkerResponse fails on missing status', () => {
  const { valid } = validateWorkerResponse({ jobId: 'gen_1' });
  assert.strictEqual(valid, false);
});

test('validateWorkerResponse fails on unknown status', () => {
  const { valid } = validateWorkerResponse({ jobId: 'gen_1', status: 'running' });
  assert.strictEqual(valid, false);
});

test('validateWorkerResponse fails on success with no output', () => {
  const { valid } = validateWorkerResponse({ jobId: 'gen_1', status: 'success' });
  assert.strictEqual(valid, false);
});

// ── parseWorkerResponse ────────────────────────────────────────────────────────

test('parseWorkerResponse normalizes a success response', () => {
  const r = parseWorkerResponse({ jobId: 'gen_1', status: 'success', stlBase64: 'data123', executionMs: 5000 });
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.stlBase64, 'data123');
  assert.strictEqual(r.executionMs, 5000);
  assert.ok(r.completedAt);
});

test('parseWorkerResponse normalizes an error response', () => {
  const r = parseWorkerResponse({ jobId: 'gen_1', status: 'error', error: 'SyntaxError', code: 'WORKER_ERROR' });
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.error, 'SyntaxError');
  assert.strictEqual(r.code, 'WORKER_ERROR');
});

test('parseWorkerResponse handles null/garbage input', () => {
  const r = parseWorkerResponse(null);
  assert.strictEqual(r.success, false);
  assert.ok(r.error);
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

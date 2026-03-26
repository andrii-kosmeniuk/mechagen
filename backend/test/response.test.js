'use strict';

const assert   = require('assert');
const response = require('../src/lib/response');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

// Mock res object
function mockRes() {
  const r = { _status: null, _json: null, _ended: false };
  r.status = (s) => { r._status = s; return r; };
  r.json   = (j) => { r._json  = j; return r; };
  r.end    = ()  => { r._ended = true; r._status = r._status || 204; return r; };
  return r;
}

console.log('\n📋 response helper tests\n');

// ── ok ────────────────────────────────────────────────────────────────────────
test('ok() returns 200 with data', () => {
  const res = mockRes();
  response.ok(res, { id: '1', name: 'test' });
  assert.strictEqual(res._status, 200);
  assert.deepStrictEqual(res._json.data, { id: '1', name: 'test' });
});

test('ok() includes meta when provided', () => {
  const res = mockRes();
  response.ok(res, [], { total: 0, page: 1 });
  assert.deepStrictEqual(res._json.meta, { total: 0, page: 1 });
});

test('ok() omits meta when not provided', () => {
  const res = mockRes();
  response.ok(res, []);
  assert.strictEqual(res._json.meta, undefined);
});

// ── created ───────────────────────────────────────────────────────────────────
test('created() returns 201', () => {
  const res = mockRes();
  response.created(res, { id: 'new' });
  assert.strictEqual(res._status, 201);
  assert.deepStrictEqual(res._json.data, { id: 'new' });
});

// ── accepted ──────────────────────────────────────────────────────────────────
test('accepted() returns 202', () => {
  const res = mockRes();
  response.accepted(res, { jobId: 'gen_1' });
  assert.strictEqual(res._status, 202);
});

// ── noContent ─────────────────────────────────────────────────────────────────
test('noContent() returns 204', () => {
  const res = mockRes();
  response.noContent(res);
  assert.strictEqual(res._status, 204);
  assert.strictEqual(res._ended, true);
});

// ── error ─────────────────────────────────────────────────────────────────────
test('error() sets status, error message, and code', () => {
  const res = mockRes();
  response.error(res, 422, 'Invalid geometry', 'GEOMETRY_PLAN_INVALID');
  assert.strictEqual(res._status, 422);
  assert.strictEqual(res._json.error, 'Invalid geometry');
  assert.strictEqual(res._json.code, 'GEOMETRY_PLAN_INVALID');
});

test('error() includes details when provided', () => {
  const res = mockRes();
  response.error(res, 400, 'Bad field', 'BAD_REQUEST', { field: 'email' });
  assert.deepStrictEqual(res._json.details, { field: 'email' });
});

test('error() omits details when not provided', () => {
  const res = mockRes();
  response.error(res, 404, 'Not found', 'NOT_FOUND');
  assert.strictEqual(res._json.details, undefined);
});

// ── shortcut helpers ──────────────────────────────────────────────────────────
test('badRequest() returns 400', () => {
  const res = mockRes(); response.badRequest(res, 'nope');
  assert.strictEqual(res._status, 400);
});
test('unauthorized() returns 401', () => {
  const res = mockRes(); response.unauthorized(res);
  assert.strictEqual(res._status, 401);
});
test('forbidden() returns 403', () => {
  const res = mockRes(); response.forbidden(res);
  assert.strictEqual(res._status, 403);
});
test('notFound() returns 404 with resource name', () => {
  const res = mockRes(); response.notFound(res, 'Blueprint');
  assert.strictEqual(res._status, 404);
  assert.ok(res._json.error.includes('Blueprint'));
});
test('conflict() returns 409', () => {
  const res = mockRes(); response.conflict(res, 'duplicate');
  assert.strictEqual(res._status, 409);
});
test('tooManyRequests() returns 429', () => {
  const res = mockRes(); response.tooManyRequests(res);
  assert.strictEqual(res._status, 429);
});
test('paymentRequired() returns 402', () => {
  const res = mockRes(); response.paymentRequired(res);
  assert.strictEqual(res._status, 402);
});
test('internal() returns 500', () => {
  const res = mockRes(); response.internal(res);
  assert.strictEqual(res._status, 500);
});

// ── fromError ─────────────────────────────────────────────────────────────────
test('fromError() handles AppError-shaped object', () => {
  const res = mockRes();
  response.fromError(res, { status: 403, code: 'FORBIDDEN', message: 'nope' });
  assert.strictEqual(res._status, 403);
  assert.strictEqual(res._json.code, 'FORBIDDEN');
});

test('fromError() defaults to 500 for plain errors', () => {
  const res = mockRes();
  response.fromError(res, new Error('oops'));
  assert.strictEqual(res._status, 500);
});

// ── pageMeta ──────────────────────────────────────────────────────────────────
test('pageMeta() computes pages correctly', () => {
  const m = response.pageMeta(47, 1, 10);
  assert.strictEqual(m.total, 47);
  assert.strictEqual(m.pages, 5);
});

test('pageMeta() handles exact division', () => {
  const m = response.pageMeta(20, 1, 10);
  assert.strictEqual(m.pages, 2);
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

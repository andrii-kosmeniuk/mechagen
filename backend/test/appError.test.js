'use strict';

const assert = require('assert');
const { AppError } = require('../src/errors/AppError');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 AppError tests\n');

test('constructor sets message, status, code', () => {
  const e = new AppError('Not found', 404, 'NOT_FOUND');
  assert.strictEqual(e.message, 'Not found');
  assert.strictEqual(e.status, 404);
  assert.strictEqual(e.code, 'NOT_FOUND');
});

test('constructor defaults status to 500', () => {
  const e = new AppError('oops');
  assert.strictEqual(e.status, 500);
});

test('constructor defaults code to INTERNAL_ERROR', () => {
  const e = new AppError('oops');
  assert.strictEqual(e.code, 'INTERNAL_ERROR');
});

test('is an instance of Error', () => {
  const e = new AppError('test');
  assert.ok(e instanceof Error);
});

test('AppError.badRequest creates 400 error', () => {
  const e = AppError.badRequest('bad input');
  assert.strictEqual(e.status, 400);
  assert.strictEqual(e.message, 'bad input');
});

test('AppError.notFound creates 404 with resource name', () => {
  const e = AppError.notFound('Blueprint');
  assert.strictEqual(e.status, 404);
  assert.ok(e.message.includes('Blueprint'));
});

test('AppError.unauthorized creates 401', () => {
  const e = AppError.unauthorized();
  assert.strictEqual(e.status, 401);
});

test('AppError.forbidden creates 403', () => {
  const e = AppError.forbidden();
  assert.strictEqual(e.status, 403);
});

test('AppError.tooManyRequests creates 429', () => {
  const e = AppError.tooManyRequests();
  assert.strictEqual(e.status, 429);
  assert.strictEqual(e.code, 'RATE_LIMITED');
});

test('AppError.paymentRequired creates 402', () => {
  const e = AppError.paymentRequired('Quota exceeded');
  assert.strictEqual(e.status, 402);
});

test('AppError.internal creates 500', () => {
  const e = AppError.internal();
  assert.strictEqual(e.status, 500);
});

test('AppError.conflict creates 409', () => {
  const e = AppError.conflict('Already exists');
  assert.strictEqual(e.status, 409);
});

test('AppError.from returns same shape for AppError instance', () => {
  const original = new AppError('test', 422, 'UNPROCESSABLE');
  const shaped   = AppError.from(original);
  assert.strictEqual(shaped.status, 422);
  assert.strictEqual(shaped.code, 'UNPROCESSABLE');
  assert.strictEqual(shaped.message, 'test');
});

test('AppError.from normalizes plain Error', () => {
  const plain = new Error('something broke');
  const shaped = AppError.from(plain);
  assert.strictEqual(shaped.status, 500);
  assert.strictEqual(shaped.message, 'something broke');
});

test('AppError.from normalizes error-shaped object', () => {
  const obj = { status: 403, code: 'FORBIDDEN', message: 'nope' };
  const shaped = AppError.from(obj);
  assert.strictEqual(shaped.status, 403);
  assert.strictEqual(shaped.code, 'FORBIDDEN');
});

test('toJSON returns { error, code }', () => {
  const e = new AppError('oops', 400, 'BAD');
  const j = e.toJSON();
  assert.strictEqual(j.error, 'oops');
  assert.strictEqual(j.code, 'BAD');
});

test('AppError.respond calls res.status().json()', () => {
  let calledStatus = null;
  let calledJson   = null;
  const res = {
    status(s) { calledStatus = s; return this; },
    json(obj) { calledJson = obj; return this; },
  };
  AppError.respond(res, new AppError('fail', 422, 'FAIL'));
  assert.strictEqual(calledStatus, 422);
  assert.strictEqual(calledJson.error, 'fail');
  assert.strictEqual(calledJson.code, 'FAIL');
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

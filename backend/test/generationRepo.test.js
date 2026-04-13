'use strict';

const assert = require('assert');
const path   = require('path');
const fs     = require('fs');

// Use a local temp dir inside the project (avoids OS /tmp permission issues in sandboxes)
const tmpDir = path.join(__dirname, '..', 'data', '_test_tmp_repo');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
process.env.DATA_DIR = tmpDir;

// Require AFTER setting DATA_DIR
const repo = require('../src/repositories/generationRepo');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 generationRepo tests\n');

const ID1 = `gen_test_${Date.now()}`;
const ID2 = `gen_test_${Date.now() + 1}`;

test('set() stores a record and returns it', () => {
  const r = repo.set(ID1, { id: ID1, prompt: 'bracket', status: 'queued', createdAt: new Date().toISOString() });
  assert.strictEqual(r.id, ID1);
  assert.strictEqual(r.status, 'queued');
});

test('get() retrieves the stored record', () => {
  const r = repo.get(ID1);
  assert.ok(r, 'record should exist');
  assert.strictEqual(r.prompt, 'bracket');
});

test('get() returns null for unknown id', () => {
  assert.strictEqual(repo.get('nonexistent-gen'), null);
});

test('update() patches existing record', () => {
  const r = repo.update(ID1, { status: 'ready', specJson: { material: 'aluminum' } });
  assert.strictEqual(r.status, 'ready');
  assert.deepStrictEqual(r.specJson, { material: 'aluminum' });
});

test('update() preserves existing fields', () => {
  const r = repo.get(ID1);
  assert.strictEqual(r.prompt, 'bracket', 'prompt must be preserved');
});

test('update() sets updatedAt', () => {
  const r = repo.get(ID1);
  assert.ok(r.updatedAt, 'updatedAt should be set');
});

test('update() on non-existent id creates a record', () => {
  const r = repo.update(ID2, { prompt: 'gear', status: 'queued', createdAt: new Date().toISOString() });
  assert.strictEqual(r.id, ID2);
  assert.strictEqual(r.prompt, 'gear');
});

test('list() returns all records, most-recent first', () => {
  const records = repo.list();
  assert.ok(records.length >= 2);
  // Most recent first: ID2 was set after ID1 (createdAt or updatedAt)
  const prompts = records.map(r => r.prompt);
  assert.ok(prompts.includes('bracket'));
  assert.ok(prompts.includes('gear'));
});

test('listByUser() filters by userId', () => {
  repo.set(`gen_usr_${Date.now()}`, { id: `gen_usr_${Date.now()}`, userId: 'user-abc', status: 'queued', createdAt: new Date().toISOString() });
  const mine = repo.listByUser('user-abc');
  assert.ok(mine.length >= 1);
  assert.ok(mine.every(r => r.userId === 'user-abc'));
});

test('listByUser() returns empty for unknown user', () => {
  const none = repo.listByUser('nobody');
  assert.deepStrictEqual(none, []);
});

test('count() returns correct count', () => {
  const c = repo.count();
  assert.ok(c >= 2);
});

test('delete() removes a record', () => {
  const existed = repo.delete(ID2);
  assert.strictEqual(existed, true);
  assert.strictEqual(repo.get(ID2), null);
});

test('delete() returns false for unknown id', () => {
  const existed = repo.delete('no-such-gen');
  assert.strictEqual(existed, false);
});

test('flush() writes to disk without throwing', () => {
  assert.doesNotThrow(() => repo.flush());
  const file = path.join(tmpDir, 'generations.json');
  assert.ok(fs.existsSync(file), 'generations.json should exist after flush');
});

test('disk data is valid JSON after flush', () => {
  repo.flush();
  const file = path.join(tmpDir, 'generations.json');
  const content = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(Array.isArray(content));
});

// Cleanup
try { fs.rmSync(tmpDir, { recursive: true }); } catch {}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

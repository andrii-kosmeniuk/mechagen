'use strict';

/**
 * Tests for blueprintService — no external deps, runs with node directly.
 * Usage: node test/blueprintService.test.js
 */

const assert = require('assert');
const path   = require('path');
const fs     = require('fs');

// Patch uploads dir to /tmp so tests don't pollute project
process.env.UPLOADS_OVERRIDE = '/tmp/mechagen_test_uploads';
if (!fs.existsSync('/tmp/mechagen_test_uploads')) fs.mkdirSync('/tmp/mechagen_test_uploads', { recursive: true });
if (!fs.existsSync('/tmp/mechagen_test_uploads/exports')) fs.mkdirSync('/tmp/mechagen_test_uploads/exports', { recursive: true });

// Monkey-patch __dirname-relative path in blueprintService
// by using a fresh require with the real module
const {
  validateBlueprint,
  saveBlueprint,
  getBlueprint,
  setBlueprintAnalysis,
  ALLOWED_TYPES,
  MAX_FILE_BYTES,
} = require('../src/services/blueprintService');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

console.log('\n📋 blueprintService tests\n');

// ── validateBlueprint ────────────────────────────────────────────────────────

test('accepts image/png', () => {
  const err = validateBlueprint({ mimeType: 'image/png', sizeBytes: 1024 });
  assert.strictEqual(err, null);
});

test('accepts image/jpeg', () => {
  const err = validateBlueprint({ mimeType: 'image/jpeg', sizeBytes: 1024 });
  assert.strictEqual(err, null);
});

test('accepts image/webp', () => {
  const err = validateBlueprint({ mimeType: 'image/webp', sizeBytes: 2048 });
  assert.strictEqual(err, null);
});

test('accepts application/pdf', () => {
  const err = validateBlueprint({ mimeType: 'application/pdf', sizeBytes: 5000 });
  assert.strictEqual(err, null);
});

test('rejects image/gif', () => {
  const err = validateBlueprint({ mimeType: 'image/gif', sizeBytes: 100 });
  assert.ok(err && err.includes('Unsupported'), `Expected unsupported error, got: ${err}`);
});

test('rejects application/exe', () => {
  const err = validateBlueprint({ mimeType: 'application/octet-stream', sizeBytes: 100 });
  assert.ok(err && err.includes('Unsupported'));
});

test('rejects file over 10 MB', () => {
  const err = validateBlueprint({ mimeType: 'image/png', sizeBytes: MAX_FILE_BYTES + 1 });
  assert.ok(err && err.includes('large'), `Expected size error, got: ${err}`);
});

test('accepts file at exactly 10 MB', () => {
  const err = validateBlueprint({ mimeType: 'image/png', sizeBytes: MAX_FILE_BYTES });
  assert.strictEqual(err, null);
});

// ── saveBlueprint / getBlueprint ─────────────────────────────────────────────

test('saves blueprint and retrieves by id', () => {
  const buf    = Buffer.from('PNG_FAKE_DATA_0123456789');
  const record = saveBlueprint({ buffer: buf, originalName: 'test.png', mimeType: 'image/png', projectId: 'proj_1' });
  assert.ok(record.id, 'should have id');
  assert.strictEqual(record.fileType, 'image/png');
  assert.strictEqual(record.projectId, 'proj_1');
  assert.ok(record.previewable, 'png should be previewable');

  const retrieved = getBlueprint(record.id);
  assert.ok(retrieved, 'should be retrievable');
  assert.strictEqual(retrieved.id, record.id);
});

test('saveBlueprint throws 400 for bad mime', () => {
  let threw = false;
  try {
    saveBlueprint({ buffer: Buffer.from('x'), originalName: 'bad.exe', mimeType: 'application/exe', projectId: 'p' });
  } catch (err) {
    threw = true;
    assert.strictEqual(err.status, 400);
  }
  assert.ok(threw, 'should throw for bad mime');
});

// ── setBlueprintAnalysis ─────────────────────────────────────────────────────

test('setBlueprintAnalysis attaches to record', () => {
  const buf    = Buffer.from('FAKE_IMAGE');
  const record = saveBlueprint({ buffer: buf, originalName: 'plan.png', mimeType: 'image/png', projectId: 'proj_2' });
  const analysis = { detectedPartType: 'bracket', confidence: 0.8 };
  const updated  = setBlueprintAnalysis(record.id, analysis);
  assert.deepStrictEqual(updated.analysisJson, analysis);
  assert.strictEqual(getBlueprint(record.id).analysisJson.detectedPartType, 'bracket');
});

test('setBlueprintAnalysis throws 404 for missing id', () => {
  let threw = false;
  try { setBlueprintAnalysis('nonexistent_id_xyz', {}); }
  catch (err) { threw = true; assert.strictEqual(err.status, 404); }
  assert.ok(threw);
});

// ── ALLOWED_TYPES completeness ────────────────────────────────────────────────
test('ALLOWED_TYPES has 5 entries', () => {
  assert.strictEqual(Object.keys(ALLOWED_TYPES).length, 5);
});

// Summary
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

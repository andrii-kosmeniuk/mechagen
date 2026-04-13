'use strict';

/**
 * Tests for solidValidationService.js
 * Usage: node test/solidValidationService.test.js
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const { validateSolidBuild, checkStlExportReadiness } = require('../src/services/solidValidationService');

const TMP = '/tmp';

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

// Helper: write a minimal valid binary STL to a temp file
function writeFakeStl(triangleCount = 1) {
  const filePath = path.join(TMP, `mechagen_test_${Date.now()}_${Math.random().toString(36).slice(2)}.stl`);
  const size = 84 + triangleCount * 50; // header(80) + count(4) + triangleCount * 50
  const buf  = Buffer.alloc(size, 0);
  buf.fill(0x20, 0, 80);                    // ASCII header (spaces)
  buf.writeUInt32LE(triangleCount, 80);     // triangle count
  fs.writeFileSync(filePath, buf);
  return filePath;
}

console.log('\n📋 solidValidationService tests\n');

// ─── validateSolidBuild ────────────────────────────────────────────────────────

test('returns solidValid: false for null worker result', () => {
  const r = validateSolidBuild(null);
  assert.strictEqual(r.solidValid, false);
});

test('returns solidValid: false for worker success=false', () => {
  const r = validateSolidBuild({ success: false, error: 'timeout', stlPath: null, stlSizeBytes: 0 });
  assert.strictEqual(r.solidValid, false);
  assert.ok(r.reason.includes('Worker failed'));
});

test('returns solidValid: false for missing stl path', () => {
  const r = validateSolidBuild({ success: true, stlPath: null, stlSizeBytes: 0, meshCheck: null });
  assert.strictEqual(r.solidValid, false);
  assert.ok(r.reason.includes('path'));
});

test('returns solidValid: false for non-existent file', () => {
  const r = validateSolidBuild({
    success: true,
    stlPath: '/tmp/does_not_exist_xyz.stl',
    stlSizeBytes: 100,
    meshCheck: null,
  });
  assert.strictEqual(r.solidValid, false);
  assert.ok(r.reason.includes('missing'));
});

test('returns solidValid: false for empty STL file', () => {
  const emptyPath = path.join(TMP, `mechagen_empty_${Date.now()}.stl`);
  fs.writeFileSync(emptyPath, Buffer.alloc(10));
  const r = validateSolidBuild({
    success: true,
    stlPath: emptyPath,
    stlSizeBytes: 10,
    meshCheck: null,
  });
  assert.strictEqual(r.solidValid, false);
  assert.ok(r.reason.includes('small') || r.reason.includes('empty'));
  fs.unlinkSync(emptyPath);
});

test('returns solidValid: false for STL with zero triangle count in header', () => {
  const filePath = path.join(TMP, `mechagen_zerotri_${Date.now()}.stl`);
  const buf = Buffer.alloc(84, 0);
  buf.writeUInt32LE(0, 80); // zero triangles
  fs.writeFileSync(filePath, buf);
  const r = validateSolidBuild({
    success: true,
    stlPath: filePath,
    stlSizeBytes: 84,
    meshCheck: null,
  });
  assert.strictEqual(r.solidValid, false);
  assert.ok(r.reason && r.reason.length > 0, 'should have a reason string');
  fs.unlinkSync(filePath);
});

test('returns solidValid: true for valid binary STL', () => {
  const stlPath = writeFakeStl(4);
  const r = validateSolidBuild({
    success: true,
    stlPath,
    stlSizeBytes: fs.statSync(stlPath).size,
    meshCheck: { triangleCount: 4, valid: true },
  });
  assert.strictEqual(r.solidValid, true);
  assert.strictEqual(r.reason, null);
  assert.ok(r.checks.length > 0, 'should have checks array');
  fs.unlinkSync(stlPath);
});

test('all checks are present in valid report', () => {
  const stlPath = writeFakeStl(8);
  const r = validateSolidBuild({
    success: true,
    stlPath,
    stlSizeBytes: fs.statSync(stlPath).size,
    meshCheck: { triangleCount: 8, valid: true },
  });
  const checkIds = r.checks.map(c => c.id);
  assert.ok(checkIds.includes('worker_succeeded'));
  assert.ok(checkIds.includes('stl_path_present'));
  assert.ok(checkIds.includes('stl_file_exists'));
  assert.ok(checkIds.includes('stl_non_empty'));
  assert.ok(checkIds.includes('stl_header_valid'));
  assert.ok(checkIds.includes('mesh_valid'));
  fs.unlinkSync(stlPath);
});

// ─── checkStlExportReadiness ──────────────────────────────────────────────────

test('checkStlExportReadiness: false for null solid build', () => {
  const r = checkStlExportReadiness(null);
  assert.strictEqual(r.canExport, false);
});

test('checkStlExportReadiness: false for non-solid_ready status', () => {
  const r = checkStlExportReadiness({ status: 'building_solid', stlFilePath: '/tmp/fake.stl' });
  assert.strictEqual(r.canExport, false);
  assert.ok(r.reason.includes('building_solid'));
});

test('checkStlExportReadiness: false for solid_ready but missing file', () => {
  const r = checkStlExportReadiness({ status: 'solid_ready', stlFilePath: '/tmp/no_such_file.stl' });
  assert.strictEqual(r.canExport, false);
  assert.ok(r.reason.includes('missing'));
});

test('checkStlExportReadiness: true for solid_ready with existing file', () => {
  const stlPath = writeFakeStl(2);
  const r = checkStlExportReadiness({ status: 'solid_ready', stlFilePath: stlPath });
  assert.strictEqual(r.canExport, true);
  assert.strictEqual(r.reason, null);
  fs.unlinkSync(stlPath);
});

// Summary
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

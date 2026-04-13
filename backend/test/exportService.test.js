'use strict';

/**
 * Tests for exportService — OBJ/GLB generation and readiness checks.
 * Usage: node test/exportService.test.js
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const {
  checkExportReadiness,
  exportGenerationToObj,
  exportGenerationToGlb,
  buildObjFromParts,
  buildGlbFromParts,
} = require('../src/services/exportService');

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

// Sample preview parts for a simple bracket
const SAMPLE_PARTS = [
  {
    shape: 'box',
    label: 'base_plate',
    params: { width: 80, height: 4, depth: 60 },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    color: '#7eb8f7',
    metalness: 0.8,
    roughness: 0.2,
  },
  {
    shape: 'cylinder',
    label: 'hole_1',
    params: { r: 2.75, h: 4.5 },
    position: { x: 10, y: 0, z: 10 },
    rotation: { x: 0, y: 0, z: 0 },
    color: '#444',
    metalness: 0.5,
    roughness: 0.6,
  },
];

const READY_GEN = {
  id: 'gen_test_1',
  status: 'ready',
  specJson: { partType: 'bracket' },
  previewParts: SAMPLE_PARTS,
  validationReport: { valid: true, severity: 'none', errors: [] },
};

console.log('\n📋 exportService tests\n');

// ── checkExportReadiness ─────────────────────────────────────────────────────

test('ready generation with parts can export', () => {
  const r = checkExportReadiness(READY_GEN);
  assert.ok(r.canExport, `Expected canExport=true, got: ${r.reason}`);
  assert.deepStrictEqual(r.formats, ['obj', 'glb']);
});

test('null generation cannot export', () => {
  const r = checkExportReadiness(null);
  assert.ok(!r.canExport);
});

test('generation with status queued cannot export', () => {
  const r = checkExportReadiness({ ...READY_GEN, status: 'queued' });
  assert.ok(!r.canExport);
  assert.ok(r.reason.includes('queued'));
});

test('generation with no previewParts cannot export', () => {
  const r = checkExportReadiness({ ...READY_GEN, previewParts: [] });
  assert.ok(!r.canExport);
});

test('generation with high severity validation cannot export', () => {
  const gen = {
    ...READY_GEN,
    validationReport: { valid: false, severity: 'high', errors: [] },
  };
  const r = checkExportReadiness(gen);
  assert.ok(!r.canExport);
  assert.ok(r.reason.includes('HIGH'));
});

// ── buildObjFromParts ────────────────────────────────────────────────────────

test('buildObjFromParts produces valid OBJ text', () => {
  const obj = buildObjFromParts(SAMPLE_PARTS, 'test_bracket');
  assert.ok(obj.includes('# MechaGen export'), 'should have header');
  assert.ok(obj.includes('o test_bracket'), 'should have object name');
  assert.ok(obj.includes('v '), 'should have vertices');
  assert.ok(obj.includes('f '), 'should have faces');
});

test('buildObjFromParts produces valid vertex count for box', () => {
  const obj = buildObjFromParts([SAMPLE_PARTS[0]], 'box_only');
  const vertLines = obj.split('\n').filter(l => l.startsWith('v '));
  // box = 8 vertices
  assert.strictEqual(vertLines.length, 8);
});

// ── buildGlbFromParts ────────────────────────────────────────────────────────

test('buildGlbFromParts returns a Buffer', () => {
  const glb = buildGlbFromParts(SAMPLE_PARTS, 'test_bracket');
  assert.ok(Buffer.isBuffer(glb), 'should be a Buffer');
  assert.ok(glb.length > 12, 'should have more than header');
});

test('GLB starts with glTF magic bytes', () => {
  const glb = buildGlbFromParts(SAMPLE_PARTS, 'test_bracket');
  // Magic: 0x46546C67 = 'glTF'
  assert.strictEqual(glb.readUInt32LE(0), 0x46546C67);
  // Version: 2
  assert.strictEqual(glb.readUInt32LE(4), 2);
});

// ── exportGenerationToObj / exportGenerationToGlb ────────────────────────────

test('exportGenerationToObj creates file and returns record', () => {
  const record = exportGenerationToObj(READY_GEN);
  assert.ok(record.id, 'should have export id');
  assert.strictEqual(record.type, 'obj');
  assert.ok(record.fileUrl.endsWith('.obj'));
  assert.ok(record.fileSize > 0);
  assert.ok(fs.existsSync(path.join(__dirname, '../uploads/exports', path.basename(record.fileUrl))));
});

test('exportGenerationToGlb creates file and returns record', () => {
  const record = exportGenerationToGlb(READY_GEN);
  assert.ok(record.id, 'should have export id');
  assert.strictEqual(record.type, 'glb');
  assert.ok(record.fileUrl.endsWith('.glb'));
  assert.ok(record.fileSize > 0);
});

test('exportGenerationToObj throws for non-ready generation', () => {
  let threw = false;
  try {
    exportGenerationToObj({ ...READY_GEN, status: 'queued' });
  } catch (err) {
    threw = true;
    assert.strictEqual(err.status, 400);
  }
  assert.ok(threw, 'should throw for queued generation');
});

// Summary
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

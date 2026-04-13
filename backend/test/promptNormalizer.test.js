'use strict';

/**
 * Prompt Normalizer Tests — MechaGen
 *
 * Tests canonical part detection, expansion, and alias resolution.
 * No AI, no file I/O — pure unit tests.
 */

const assert = require('assert');
const { normalizePrompt, CANONICAL_TEMPLATES, ALIASES } = require('../src/services/promptNormalizer');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 Prompt Normalizer tests\n');

// ── Basic canonical detection ──────────────────────────────────────────────────

test('"bolt" is normalized', () => {
  const r = normalizePrompt('bolt');
  assert.ok(r.normalized, 'should be normalized');
  assert.strictEqual(r.partType, 'bolt');
  assert.ok(r.expandedPrompt.includes('Hex-head'), `expected Hex-head in: ${r.expandedPrompt}`);
  assert.ok(r.expandedPrompt.includes('8'), 'should include default 8mm diameter');
  assert.ok(typeof r.assumedDefaults.diameter === 'number');
});

test('"bracket" is normalized', () => {
  const r = normalizePrompt('bracket');
  assert.ok(r.normalized);
  assert.strictEqual(r.partType, 'bracket');
  assert.ok(r.expandedPrompt.includes('L-bracket'));
  assert.ok(r.assumedDefaults.armLength > 0);
});

test('"bearing" is normalized', () => {
  const r = normalizePrompt('bearing');
  assert.ok(r.normalized);
  assert.strictEqual(r.partType, 'bearing_block');
  assert.ok(r.assumedDefaults.outerDiameter > 0);
});

test('"gear" is normalized', () => {
  const r = normalizePrompt('gear');
  assert.ok(r.normalized);
  assert.strictEqual(r.partType, 'gear_basic');
  assert.ok(r.assumedDefaults.toothCount > 0);
});

test('"pulley" is normalized', () => {
  const r = normalizePrompt('pulley');
  assert.ok(r.normalized);
  assert.strictEqual(r.partType, 'pulley_basic');
  assert.ok(r.assumedDefaults.outerDiameter > 0);
});

test('"spacer" is normalized', () => {
  const r = normalizePrompt('spacer');
  assert.ok(r.normalized);
  assert.strictEqual(r.partType, 'spacer');
});

test('"enclosure" is normalized', () => {
  const r = normalizePrompt('enclosure');
  assert.ok(r.normalized);
  assert.strictEqual(r.partType, 'enclosure');
  assert.ok(r.assumedDefaults.wallThickness > 0);
});

test('"mount_plate" is normalized', () => {
  const r = normalizePrompt('mount_plate');
  assert.ok(r.normalized);
  assert.strictEqual(r.partType, 'mounting_plate');
});

// ── Alias resolution ──────────────────────────────────────────────────────────

test('"l-bracket" alias resolves to bracket', () => {
  const r = normalizePrompt('l-bracket');
  assert.ok(r.normalized);
  assert.strictEqual(r.partType, 'bracket');
});

test('"mounting plate" alias resolves to mounting_plate', () => {
  const r = normalizePrompt('mounting plate');
  assert.ok(r.normalized);
  assert.strictEqual(r.partType, 'mounting_plate');
});

test('"mount plate" alias resolves', () => {
  const r = normalizePrompt('mount plate');
  assert.ok(r.normalized);
  assert.strictEqual(r.partType, 'mounting_plate');
});

test('"spur gear" alias resolves to gear_basic', () => {
  const r = normalizePrompt('spur gear');
  assert.ok(r.normalized);
  assert.strictEqual(r.partType, 'gear_basic');
});

test('"ball bearing" alias resolves to bearing_block', () => {
  const r = normalizePrompt('ball bearing');
  assert.ok(r.normalized);
  assert.strictEqual(r.partType, 'bearing_block');
});

// ── Non-canonical prompts pass through ────────────────────────────────────────

test('detailed prompt is not normalized', () => {
  const r = normalizePrompt('L-bracket for 40×40mm aluminum extrusion with 2 M5 holes');
  assert.ok(!r.normalized, 'detailed prompt should NOT be normalized');
  assert.ok(r.expandedPrompt.includes('L-bracket'));
  assert.deepStrictEqual(r.assumedDefaults, {});
});

test('empty string is not normalized', () => {
  const r = normalizePrompt('');
  assert.ok(!r.normalized);
  assert.strictEqual(r.expandedPrompt, '');
});

test('null is not normalized', () => {
  const r = normalizePrompt(null);
  assert.ok(!r.normalized);
});

// ── Assumed defaults are present ───────────────────────────────────────────────

test('bolt defaults include all required fields', () => {
  const r = normalizePrompt('bolt');
  const d = r.assumedDefaults;
  assert.ok(typeof d.diameter === 'number', 'diameter should be number');
  assert.ok(typeof d.length === 'number', 'length should be number');
  assert.ok(typeof d.threadPitch === 'number', 'threadPitch should be number');
  assert.strictEqual(d.headType, 'hex');
});

test('bracket defaults include arm dimensions', () => {
  const r = normalizePrompt('bracket');
  const d = r.assumedDefaults;
  assert.ok(typeof d.armLength === 'number');
  assert.ok(typeof d.armHeight === 'number');
  assert.ok(typeof d.thickness === 'number');
});

// ── Manufacturing mode ─────────────────────────────────────────────────────────

test('bolt manufacturing mode is 3d_print', () => {
  const r = normalizePrompt('bolt');
  assert.strictEqual(r.manufacturingMode, '3d_print');
});

test('mount_plate manufacturing mode is cnc', () => {
  const r = normalizePrompt('mount_plate');
  assert.strictEqual(r.manufacturingMode, 'cnc');
});

// ── Expanded prompt is substantive ────────────────────────────────────────────

test('expanded prompt is longer than original', () => {
  const r = normalizePrompt('bolt');
  assert.ok(r.expandedPrompt.length > 'bolt'.length * 3, 'expanded prompt should be substantially longer');
});

test('expanded prompt contains dimension numbers', () => {
  const r = normalizePrompt('gear');
  assert.ok(/\d+/.test(r.expandedPrompt), 'expanded prompt should include dimension numbers');
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

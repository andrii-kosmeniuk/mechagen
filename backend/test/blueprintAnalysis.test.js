'use strict';

/**
 * Tests for blueprintAnalysis schema validation and merge helpers.
 * Usage: node test/blueprintAnalysis.test.js
 */

const assert = require('assert');

const {
  validateAnalysis,
  mergeBlueprintHintsIntoContext,
} = require('../src/services/blueprintAnalysis');

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

console.log('\n📋 blueprintAnalysis tests\n');

// ── validateAnalysis ─────────────────────────────────────────────────────────

test('valid full analysis passes', () => {
  const raw = {
    detectedPartType:      'bracket',
    observedDimensions:    { length: 60, width: 40 },
    observedFeatures:      ['mounting holes', 'L-shape'],
    visibleHoleCount:      4,
    symmetryHints:         ['bilateral'],
    manufacturingHints:    ['CNC milling'],
    textReadFromBlueprint: ['60mm', 'M5'],
    confidence:            0.82,
    uncertainties:         [],
  };
  const { value, errors } = validateAnalysis(raw);
  assert.ok(value, 'should produce a value');
  assert.strictEqual(value.detectedPartType, 'bracket');
  assert.strictEqual(value.confidence, 0.82);
  assert.strictEqual(value.visibleHoleCount, 4);
  assert.strictEqual(errors.length, 0);
});

test('normalizes unknown partType to "unknown"', () => {
  const raw = {
    detectedPartType: 'super_rocket_nozzle',
    confidence: 0.5,
  };
  const { value } = validateAnalysis(raw);
  assert.strictEqual(value.detectedPartType, 'unknown');
});

test('clamps confidence to [0, 1]', () => {
  const { value: v1 } = validateAnalysis({ confidence: 1.5 });
  assert.strictEqual(v1.confidence, 1.0);
  const { value: v2 } = validateAnalysis({ confidence: -0.5 });
  assert.strictEqual(v2.confidence, 0.0);
});

test('uses safe defaults for missing fields', () => {
  const { value } = validateAnalysis({});
  assert.deepStrictEqual(value.observedDimensions, {});
  assert.deepStrictEqual(value.observedFeatures, []);
  assert.strictEqual(value.visibleHoleCount, 0);
  assert.strictEqual(value.detectedPartType, 'unknown');
});

test('returns null value for non-object input', () => {
  const { value, errors } = validateAnalysis('bad input');
  assert.strictEqual(value, null);
  assert.ok(errors.length > 0);
});

test('filters non-string items from observedFeatures array', () => {
  const raw = { observedFeatures: ['holes', 42, null, 'ribs'] };
  const { value } = validateAnalysis(raw);
  assert.deepStrictEqual(value.observedFeatures, ['holes', 'ribs']);
});

// ── mergeBlueprintHintsIntoContext ────────────────────────────────────────────

test('returns empty context for null analysis', () => {
  const result = mergeBlueprintHintsIntoContext(null);
  assert.strictEqual(result.blueprintContext, '');
  assert.deepStrictEqual(result.blueprintDerivedDimensions, {});
});

test('returns empty context for very low confidence', () => {
  const result = mergeBlueprintHintsIntoContext({ confidence: 0.1 });
  assert.strictEqual(result.blueprintContext, '');
});

test('includes detected part type in context', () => {
  const analysis = {
    detectedPartType: 'flange',
    confidence: 0.7,
    observedDimensions: { outerDiameter: 80 },
    observedFeatures: ['bolt circle'],
    visibleHoleCount: 4,
    symmetryHints: ['radial'],
    manufacturingHints: [],
    textReadFromBlueprint: ['80mm OD'],
    uncertainties: [],
  };
  const { blueprintContext, blueprintDerivedDimensions } = mergeBlueprintHintsIntoContext(analysis);
  assert.ok(blueprintContext.includes('flange'), 'context should mention part type');
  assert.ok(blueprintContext.includes('80mm OD'), 'context should include text from blueprint');
  // confidence >= 0.6 → dims go into blueprintDerivedDimensions
  assert.strictEqual(blueprintDerivedDimensions.outerDiameter, 80);
});

test('dims not included in blueprintDerived when confidence < 0.6', () => {
  const analysis = {
    detectedPartType: 'bracket',
    confidence: 0.45,
    observedDimensions: { length: 50 },
    observedFeatures: [],
    visibleHoleCount: 0,
    symmetryHints: [],
    manufacturingHints: [],
    textReadFromBlueprint: [],
    uncertainties: [],
  };
  const { blueprintDerivedDimensions } = mergeBlueprintHintsIntoContext(analysis);
  assert.deepStrictEqual(blueprintDerivedDimensions, {});
});

// Summary
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

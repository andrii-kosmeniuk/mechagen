'use strict';

/**
 * Blueprint Analysis Schema + Validation Tests — MechaGen
 *
 * Tests validateAnalysis() and mergeBlueprintHintsIntoContext()
 * without any AI or file I/O calls.
 */

const assert = require('assert');
const { validateAnalysis, mergeBlueprintHintsIntoContext } = require('../src/services/blueprintAnalysis');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

const VALID_ANALYSIS = {
  detectedPartType:      'bracket',
  observedDimensions:    { width: 80, height: 50 },
  observedFeatures:      ['hole pattern', 'fillet'],
  visibleHoleCount:      4,
  symmetryHints:         ['bilateral'],
  manufacturingHints:    ['machined surface visible'],
  textReadFromBlueprint: ['80mm', '50mm'],
  confidence:            0.82,
  uncertainties:         ['scale bar not visible'],
};

console.log('\n📋 Blueprint Analysis tests\n');

// ── validateAnalysis ──────────────────────────────────────────────────────────

test('valid analysis passes with correct values', () => {
  const { value, errors } = validateAnalysis(VALID_ANALYSIS);
  assert.ok(value, 'expected value');
  assert.strictEqual(value.detectedPartType, 'bracket');
  assert.strictEqual(value.confidence, 0.82);
  assert.ok(Array.isArray(value.observedFeatures));
  assert.ok(errors.length === 0 || errors.every(e => typeof e === 'string'));
});

test('null input returns error', () => {
  const { value } = validateAnalysis(null);
  assert.strictEqual(value, null);
});

test('string input returns error', () => {
  const { value } = validateAnalysis('not an object');
  assert.strictEqual(value, null);
});

test('unknown partType is normalized to "unknown"', () => {
  const { value } = validateAnalysis({ ...VALID_ANALYSIS, detectedPartType: 'flying_machine' });
  assert.strictEqual(value.detectedPartType, 'unknown');
});

test('all valid known partTypes are accepted', () => {
  const valid = ['bracket', 'mounting_plate', 'spacer', 'enclosure', 'shaft_coupler',
                 'gear_basic', 'pulley_basic', 'bearing_block', 'flange', 'standoff',
                 'clamp', 'simple_housing', 'unknown'];
  for (const t of valid) {
    const { value } = validateAnalysis({ ...VALID_ANALYSIS, detectedPartType: t });
    assert.strictEqual(value.detectedPartType, t, `partType ${t} not accepted`);
  }
});

test('confidence clamped to [0, 1]', () => {
  const { value: v1 } = validateAnalysis({ ...VALID_ANALYSIS, confidence: 2.5 });
  assert.strictEqual(v1.confidence, 1);
  const { value: v2 } = validateAnalysis({ ...VALID_ANALYSIS, confidence: -0.5 });
  assert.strictEqual(v2.confidence, 0);
});

test('missing confidence defaults to 0.3', () => {
  const { confidence, ...rest } = VALID_ANALYSIS;
  const { value } = validateAnalysis(rest);
  assert.strictEqual(value.confidence, 0.3);
});

test('non-array observedFeatures normalized to []', () => {
  const { value } = validateAnalysis({ ...VALID_ANALYSIS, observedFeatures: 'hole' });
  assert.deepStrictEqual(value.observedFeatures, []);
});

test('non-object observedDimensions normalized to {}', () => {
  const { value } = validateAnalysis({ ...VALID_ANALYSIS, observedDimensions: [1, 2] });
  assert.deepStrictEqual(value.observedDimensions, {});
});

test('float visibleHoleCount is rounded', () => {
  const { value } = validateAnalysis({ ...VALID_ANALYSIS, visibleHoleCount: 3.7 });
  assert.strictEqual(value.visibleHoleCount, 4);
});

test('missing uncertainties gets default advisory', () => {
  const { uncertainties, ...rest } = VALID_ANALYSIS;
  const { value } = validateAnalysis(rest);
  assert.ok(value.uncertainties.length > 0);
  assert.ok(typeof value.uncertainties[0] === 'string');
});

test('version is always set to "1.0"', () => {
  const { value } = validateAnalysis(VALID_ANALYSIS);
  assert.strictEqual(value.version, '1.0');
});

// ── mergeBlueprintHintsIntoContext ─────────────────────────────────────────────

const HIGH_CONF = { ...VALID_ANALYSIS, confidence: 0.82 };
const LOW_CONF  = { ...VALID_ANALYSIS, confidence: 0.15 };
const ZERO_CONF = { ...VALID_ANALYSIS, confidence: 0.1 };

test('high-confidence analysis produces non-empty blueprintContext', () => {
  const { blueprintContext } = mergeBlueprintHintsIntoContext(HIGH_CONF);
  assert.ok(blueprintContext.length > 0);
  assert.ok(blueprintContext.includes('BLUEPRINT ANALYSIS'));
});

test('high-confidence observed dimensions go into blueprintDerivedDimensions', () => {
  const { blueprintDerivedDimensions } = mergeBlueprintHintsIntoContext(HIGH_CONF);
  assert.ok(typeof blueprintDerivedDimensions === 'object');
  assert.ok(Object.keys(blueprintDerivedDimensions).length > 0);
});

test('low-confidence (<0.6) dims excluded from blueprintDerivedDimensions', () => {
  const { blueprintDerivedDimensions } = mergeBlueprintHintsIntoContext(LOW_CONF);
  assert.strictEqual(Object.keys(blueprintDerivedDimensions).length, 0);
});

test('very low confidence (<0.2) returns empty context', () => {
  const { blueprintContext } = mergeBlueprintHintsIntoContext(ZERO_CONF);
  assert.strictEqual(blueprintContext, '');
});

test('null analysis returns empty hints', () => {
  const { blueprintContext, blueprintDerivedDimensions } = mergeBlueprintHintsIntoContext(null);
  assert.strictEqual(blueprintContext, '');
  assert.deepStrictEqual(blueprintDerivedDimensions, {});
});

test('blueprintContext includes confidence percentage', () => {
  const { blueprintContext } = mergeBlueprintHintsIntoContext(HIGH_CONF);
  assert.ok(blueprintContext.includes('82%'), `expected 82% in: ${blueprintContext.slice(0, 100)}`);
});

test('blueprintContext includes observed features', () => {
  const { blueprintContext } = mergeBlueprintHintsIntoContext(HIGH_CONF);
  assert.ok(blueprintContext.includes('hole pattern'));
});

test('blueprintContext includes text from blueprint', () => {
  const { blueprintContext } = mergeBlueprintHintsIntoContext(HIGH_CONF);
  assert.ok(blueprintContext.includes('80mm'));
});

test('blueprintContext includes uncertainty warning', () => {
  const { blueprintContext } = mergeBlueprintHintsIntoContext(HIGH_CONF);
  assert.ok(blueprintContext.toLowerCase().includes('uncertain') || blueprintContext.toLowerCase().includes('approximate'));
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

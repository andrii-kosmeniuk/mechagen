'use strict';

/**
 * Tests for cadqueryTranslator.js — deterministic GeometryPlan → CadQuery source.
 * Usage: node test/cadqueryTranslator.test.js
 */

const assert = require('assert');
const { translateToCadQuery, SUPPORTED_ACTIONS, TRANSLATOR_VERSION } = require('../src/services/cadqueryTranslator');

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

// ─── Test plan builders ────────────────────────────────────────────────────────

function makePlan(partType, steps) {
  return {
    partType,
    version: '1.0',
    coordinateSystem: 'right_handed_z_up',
    buildSteps: steps,
    boundingBox: { x: 80, y: 60, z: 20 },
    criticalDimensions: [],
    expectedManufacturingChecks: [],
  };
}

function step(id, action, params = {}) {
  return { id, action, params };
}

console.log('\n📋 cadqueryTranslator tests\n');

// ─── Translator version ────────────────────────────────────────────────────────

test('TRANSLATOR_VERSION is a semver string', () => {
  assert.ok(typeof TRANSLATOR_VERSION === 'string' && TRANSLATOR_VERSION.match(/\d+\.\d+/));
});

test('SUPPORTED_ACTIONS lists all 18 actions', () => {
  assert.strictEqual(SUPPORTED_ACTIONS.length, 18);
});

// ─── create_box ────────────────────────────────────────────────────────────────

test('create_box produces valid Python box line', () => {
  const plan = makePlan('bracket', [step('base', 'create_box', { width: 80, height: 6, depth: 60 })]);
  const { source } = translateToCadQuery(plan);
  assert.ok(source.includes('cq.Workplane'), 'should import cq');
  assert.ok(source.includes('.box(80'), 'should have box width');
  assert.ok(source.includes('result = base'), 'should assign result');
});

test('create_box throws for width < 0.001', () => {
  const plan = makePlan('bracket', [step('base', 'create_box', { width: 0, height: 6, depth: 60 })]);
  assert.throws(() => translateToCadQuery(plan), /must be >=/);
});

// ─── create_cylinder ──────────────────────────────────────────────────────────

test('create_cylinder produces .cylinder() call', () => {
  const plan = makePlan('spacer', [step('cyl', 'create_cylinder', { diameter: 20, height: 15 })]);
  const { source } = translateToCadQuery(plan);
  assert.ok(source.includes('.cylinder('), 'should have cylinder call');
  assert.ok(source.includes('10'), 'radius 10 (=diameter 20/2) should appear');
});

// ─── create_plate ─────────────────────────────────────────────────────────────

test('create_plate produces box with thickness', () => {
  const plan = makePlan('mounting_plate', [step('plate', 'create_plate', { width: 100, length: 60, thickness: 4 })]);
  const { source } = translateToCadQuery(plan);
  assert.ok(source.includes('.box(100'), 'should use width');
});

// ─── create_shell ─────────────────────────────────────────────────────────────

test('create_shell produces outer minus inner', () => {
  const plan = makePlan('enclosure', [step('box', 'create_shell', { width: 90, height: 25, depth: 60, wallThickness: 3 })]);
  const { source } = translateToCadQuery(plan);
  assert.ok(source.includes('_outer'), 'should have outer solid');
  assert.ok(source.includes('_inner'), 'should have inner solid');
  assert.ok(source.includes('.cut('), 'should subtract inner from outer');
});

// ─── create_flange ────────────────────────────────────────────────────────────

test('create_flange produces cylinder with holes', () => {
  const plan = makePlan('flange', [step('fl', 'create_flange', {
    outerDiameter: 80, innerDiameter: 30, thickness: 10, holeCount: 4, holeDiameter: 6
  })]);
  const { source } = translateToCadQuery(plan);
  assert.ok(source.includes('.cylinder('), 'should have cylinder');
  assert.ok(source.includes('.cutThruAll()'), 'should cut holes');
});

// ─── create_hole_pattern ──────────────────────────────────────────────────────

test('create_hole_pattern with no target creates standalone rod', () => {
  const plan = makePlan('mounting_plate', [step('holes', 'create_hole_pattern', {
    count: 4, diameter: 4,
    positions: [{ x: 10, y: 10 }, { x: -10, y: 10 }, { x: 10, y: -10 }, { x: -10, y: -10 }]
  })]);
  const { source } = translateToCadQuery(plan);
  assert.ok(source.includes('result = holes'), 'should assign result');
});

// ─── fillet_edges / chamfer_edges ─────────────────────────────────────────────

test('fillet_edges wraps in try/except for resilience', () => {
  const plan = makePlan('bracket', [
    step('base', 'create_box', { width: 60, height: 8, depth: 40 }),
    step('fil', 'fillet_edges', { filletRadius: 2 }),
  ]);
  const { source } = translateToCadQuery(plan);
  assert.ok(source.includes('try:'), 'fillet should have try block');
  assert.ok(source.includes('.fillet('), 'fillet call should appear');
});

test('chamfer_edges wraps in try/except', () => {
  const plan = makePlan('bracket', [
    step('base', 'create_box', { width: 60, height: 8, depth: 40 }),
    step('ch', 'chamfer_edges', { chamferDistance: 1 }),
  ]);
  const { source } = translateToCadQuery(plan);
  assert.ok(source.includes('.chamfer('));
});

// ─── Unsupported action rejection ─────────────────────────────────────────────

test('unsupported action throws with clear message', () => {
  const plan = makePlan('bracket', [step('bad', 'lathe_revolution', { degrees: 360 })]);
  assert.throws(() => translateToCadQuery(plan), /Unsupported geometry action "lathe_revolution"/);
});

test('unknown action error message lists allowed actions', () => {
  const plan = makePlan('bracket', [step('bad', 'weld_joint', {})]);
  try {
    translateToCadQuery(plan);
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('Allowed actions:'), 'should list allowed actions');
  }
});

// ─── Empty plan rejection ─────────────────────────────────────────────────────

test('empty buildSteps throws', () => {
  const plan = makePlan('bracket', []);
  assert.throws(() => translateToCadQuery(plan), /no buildSteps/);
});

// ─── Full canonical parts ─────────────────────────────────────────────────────

test('bracket full plan translates cleanly', () => {
  const plan = makePlan('bracket', [
    step('base',  'create_box',          { width: 80, height: 6, depth: 60 }),
    step('wall',  'create_rib',           { width: 80, height: 40, thickness: 6 }),
    step('holes', 'create_hole_pattern',  { count: 2, diameter: 5.5, positions: [{ x: 20, y: 0 }, { x: -20, y: 0 }] }),
    step('fillet','fillet_edges',         { filletRadius: 2 }),
  ]);
  const { source, usedActions } = translateToCadQuery(plan);
  assert.ok(source.length > 100, 'should produce non-trivial source');
  assert.ok(usedActions.includes('create_box'));
  assert.ok(usedActions.includes('create_rib'));
  assert.ok(source.includes('result ='));
});

test('mounting_plate full plan translates cleanly', () => {
  const plan = makePlan('mounting_plate', [
    step('plate', 'create_plate',        { width: 100, length: 60, thickness: 4 }),
    step('holes', 'create_hole_pattern', {
      count: 4, diameter: 4.5,
      positions: [{ x: 45, y: 25 }, { x: -45, y: 25 }, { x: 45, y: -25 }, { x: -45, y: -25 }],
    }),
  ]);
  const { source } = translateToCadQuery(plan);
  assert.ok(source.includes('result ='));
});

test('spacer full plan translates cleanly', () => {
  const plan = makePlan('spacer', [
    step('body', 'create_cylinder', { diameter: 20, height: 30 }),
    step('bore', 'create_hole_pattern', { count: 1, diameter: 10, positions: [{ x: 0, y: 0 }] }),
  ]);
  const { source } = translateToCadQuery(plan);
  assert.ok(source.includes('.cylinder('));
});

test('enclosure full plan translates cleanly', () => {
  const plan = makePlan('enclosure', [
    step('shell', 'create_shell', { width: 90, height: 25, depth: 60, wallThickness: 3 }),
  ]);
  const { source } = translateToCadQuery(plan);
  assert.ok(source.includes('.cut('));
  assert.ok(source.includes('result ='));
});

test('invalid plan — missing step id — throws', () => {
  const plan = makePlan('bracket', [{ action: 'create_box', params: { width: 10, height: 10, depth: 10 } }]);
  assert.throws(() => translateToCadQuery(plan), /missing a valid id/);
});

// ─── Result always includes `import cadquery as cq` ──────────────────────────

test('output always imports cadquery', () => {
  const plan = makePlan('spacer', [step('s', 'create_cylinder', { diameter: 10, height: 20 })]);
  const { source } = translateToCadQuery(plan);
  assert.ok(source.includes('import cadquery as cq'));
});

// Summary
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

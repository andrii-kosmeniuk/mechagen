'use strict';

/**
 * previewBuilder tests — canonical template + generic step builder
 */

const assert = require('assert');
const { buildPreviewFromPlan } = require('../src/services/previewBuilder');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n🔩 previewBuilder tests\n');

// ── Bolt canonical template ────────────────────────────────────────────────────

test('bolt partType emits bolt_template shape', () => {
  const plan = {
    partType: 'bolt',
    buildSteps: [
      { id: 's1', action: 'create_cylinder', params: { diameter: 8, height: 40 } },
      { id: 's2', action: 'create_hex_head', params: { widthAcrossFlats: 13, height: 5.3 } },
      { id: 's3', action: 'apply_thread_visual', params: { pitch: 1.25, length: 26 } },
    ],
    boundingBox: { x: 13, y: 13, z: 45.3 },
  };
  const result = buildPreviewFromPlan(plan);
  assert.strictEqual(result.parts.length, 1);
  assert.strictEqual(result.parts[0].shape, 'bolt_template');
});

test('bolt_template has correct diameter', () => {
  const plan = {
    partType: 'bolt',
    buildSteps: [
      { id: 's1', action: 'create_cylinder', params: { diameter: 10, height: 50 } },
    ],
    boundingBox: {},
  };
  const result = buildPreviewFromPlan(plan);
  assert.strictEqual(result.parts[0].params.diameter, 10);
});

test('bolt_template has correct params structure', () => {
  const plan = {
    partType: 'bolt',
    buildSteps: [
      { id: 's1', action: 'create_cylinder', params: { diameter: 8, height: 40 } },
      { id: 's2', action: 'create_hex_head', params: { widthAcrossFlats: 13, height: 5.3 } },
    ],
    boundingBox: {},
  };
  const result = buildPreviewFromPlan(plan);
  const p = result.parts[0].params;
  assert.ok(typeof p.diameter === 'number', 'diameter required');
  assert.ok(typeof p.headWidthAcrossFlats === 'number', 'headWidthAcrossFlats required');
  assert.ok(typeof p.smoothLen === 'number', 'smoothLen required');
  assert.ok(typeof p.threadLen === 'number', 'threadLen required');
  assert.ok(typeof p.washerOD === 'number', 'washerOD required');
});

test('bolt_template name includes bolt', () => {
  const plan = { partType: 'bolt', buildSteps: [], boundingBox: {} };
  const result = buildPreviewFromPlan(plan);
  assert.ok(result.name.includes('bolt'), `expected bolt in name: ${result.name}`);
});

test('screw partType also emits bolt_template', () => {
  const plan = { partType: 'screw', buildSteps: [], boundingBox: {} };
  const result = buildPreviewFromPlan(plan);
  assert.strictEqual(result.parts[0].shape, 'bolt_template');
});

test('bolt_template defaults are sane for empty buildSteps', () => {
  const plan = { partType: 'bolt', buildSteps: [], boundingBox: {} };
  const result = buildPreviewFromPlan(plan);
  const p = result.parts[0].params;
  assert.strictEqual(p.diameter, 8);
  assert.strictEqual(p.headWidthAcrossFlats, 13);
  assert.strictEqual(p.headHeight, 5.3);
  assert.strictEqual(p.threadPitch, 1.25);
});

// ── Gear canonical template ────────────────────────────────────────────────────

test('gear_basic partType emits gear_template shape', () => {
  const plan = {
    partType: 'gear_basic',
    buildSteps: [
      { id: 's1', action: 'create_basic_gear', params: { toothCount: 20, module: 2, thickness: 10, boreDiameter: 8 } },
    ],
    boundingBox: { x: 44, y: 44, z: 10 },
  };
  const result = buildPreviewFromPlan(plan);
  assert.strictEqual(result.parts.length, 1);
  assert.strictEqual(result.parts[0].shape, 'gear_template');
});

test('gear_template has correct toothCount', () => {
  const plan = {
    partType: 'gear_basic',
    buildSteps: [
      { id: 's1', action: 'create_basic_gear', params: { toothCount: 30, module: 1.5 } },
    ],
    boundingBox: {},
  };
  const result = buildPreviewFromPlan(plan);
  assert.strictEqual(result.parts[0].params.toothCount, 30);
});

test('gear defaults applied when no steps', () => {
  const plan = { partType: 'gear_basic', buildSteps: [], boundingBox: {} };
  const result = buildPreviewFromPlan(plan);
  const p = result.parts[0].params;
  assert.strictEqual(p.toothCount, 20);
  assert.strictEqual(p.module, 2);
});

// ── Generic builder (non-canonical) ───────────────────────────────────────────

test('bracket partType uses generic builder', () => {
  const plan = {
    partType: 'generic_part',
    buildSteps: [
      { id: 's1', action: 'create_plate', params: { width: 50, height: 5, depth: 30 } },
    ],
    boundingBox: { x: 50, y: 30, z: 40 },
  };
  const result = buildPreviewFromPlan(plan);
  assert.ok(result.parts.length > 0, 'should have parts');
  assert.notStrictEqual(result.parts[0].shape, 'bolt_template');
  assert.notStrictEqual(result.parts[0].shape, 'gear_template');
});

test('create_box step produces box shape', () => {
  const plan = {
    partType: 'generic_part',
    buildSteps: [{ id: 's1', action: 'create_box', params: { width: 40, depth: 20, height: 5 } }],
    boundingBox: {},
  };
  const result = buildPreviewFromPlan(plan);
  const box = result.parts.find(p => p.shape === 'box');
  assert.ok(box, 'should have a box part');
});

test('create_cylinder step produces cylinder shape', () => {
  const plan = {
    partType: 'spacer',
    buildSteps: [{ id: 's1', action: 'create_cylinder', params: { outerDiameter: 20, height: 30 } }],
    boundingBox: {},
  };
  const result = buildPreviewFromPlan(plan);
  const cyl = result.parts.find(p => p.shape === 'cylinder');
  assert.ok(cyl, 'should have a cylinder part');
});

test('create_basic_gear step produces multiple parts (body + bore + teeth)', () => {
  const plan = {
    partType: 'generic_part',  // NOT gear_basic — so uses generic builder
    buildSteps: [{ id: 's1', action: 'create_basic_gear', params: { toothCount: 12, module: 2, thickness: 8, boreDiameter: 6 } }],
    boundingBox: {},
  };
  const result = buildPreviewFromPlan(plan);
  assert.ok(result.parts.length > 2, `expected multiple parts, got ${result.parts.length}`);
});

test('empty buildSteps returns 0 parts', () => {
  const plan = { partType: 'generic_part', buildSteps: [], boundingBox: {} };
  const result = buildPreviewFromPlan(plan);
  assert.strictEqual(result.parts.length, 0);
});

test('dimensions taken from boundingBox', () => {
  const plan = {
    partType: 'bracket',
    buildSteps: [],
    boundingBox: { x: 50, y: 40, z: 30 },
  };
  const result = buildPreviewFromPlan(plan);
  assert.strictEqual(result.dimensions.x, 50);
  assert.strictEqual(result.dimensions.y, 40);
  assert.strictEqual(result.dimensions.z, 30);
});

test('name includes partType', () => {
  const plan = { partType: 'mount_plate', buildSteps: [], boundingBox: {} };
  const result = buildPreviewFromPlan(plan);
  assert.ok(result.name.includes('mount'), `expected partType in name: ${result.name}`);
});

test('hole_pattern produces dark cylinders', () => {
  const plan = {
    partType: 'generic_part',
    buildSteps: [{ id: 's1', action: 'create_hole_pattern', params: { count: 4, diameter: 5 } }],
    boundingBox: {},
  };
  const result = buildPreviewFromPlan(plan);
  assert.strictEqual(result.parts.length, 4, 'should have 4 hole cylinders');
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

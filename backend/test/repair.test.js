'use strict';

/**
 * Repair Service Tests — MechaGen
 *
 * Tests deterministic repair of geometry plans:
 *   - WALL_TOO_THIN: thickness raised to recommended value
 *   - EDGE_CLEARANCE_TOO_SMALL: hole positions moved inward
 *   - NON_POSITIVE_DIMENSION: zero/negative params set to sensible defaults
 *   - FILLET_TOO_LARGE: fillet radius capped to safe value
 *   - INVALID_BOUNDING_BOX: recalculated from step params
 *   - No matching fix: changesApplied is empty, resultStatus = 'needs_ai'
 *   - Max attempts: returns without changes when limit exceeded
 */

const assert = require('assert');
const { repairGeometryPlan } = require('../src/services/repairService');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

const BASE_PLAN = {
  version: '1.0',
  partType: 'bracket',
  coordinateSystem: 'right_handed_z_up',
  boundingBox: { x: 80, y: 50, z: 10 },
  buildSteps: [],
};

const SPEC_3DP = { manufacturingMode: '3d_print' };

console.log('\n📋 Repair Service tests\n');

// ── WALL_TOO_THIN ──────────────────────────────────────────────────────────────

test('WALL_TOO_THIN: increases wallThickness to recommended value', () => {
  const plan = {
    ...BASE_PLAN,
    buildSteps: [
      { id: 'step_1', action: 'create_shell', params: { width: 50, height: 40, depth: 30, wallThickness: 0.8 } },
    ],
  };
  const result = repairGeometryPlan({
    geometryPlan: plan,
    spec: SPEC_3DP,
    issues: [{ code: 'WALL_TOO_THIN', stepId: 'step_1' }],
    attemptNumber: 1,
  });
  assert.ok(result.changesApplied.length > 0, 'no changes applied');
  const repairedStep = result.updatedGeometryPlan.buildSteps[0];
  assert.ok(repairedStep.params.wallThickness >= 1.2, `wallThickness still too thin: ${repairedStep.params.wallThickness}`);
});

test('WALL_TOO_THIN: applies to all steps when no stepId given', () => {
  const plan = {
    ...BASE_PLAN,
    buildSteps: [
      { id: 'step_1', action: 'create_shell', params: { wallThickness: 0.5 } },
      { id: 'step_2', action: 'create_rib',   params: { thickness: 0.6 } },
    ],
  };
  const result = repairGeometryPlan({
    geometryPlan: plan,
    spec: SPEC_3DP,
    issues: [{ code: 'WALL_TOO_THIN' }],
    attemptNumber: 1,
  });
  assert.ok(result.changesApplied.length >= 2, `only ${result.changesApplied.length} changes`);
});

// ── EDGE_CLEARANCE_TOO_SMALL ───────────────────────────────────────────────────

test('EDGE_CLEARANCE_TOO_SMALL: moves hole positions inward', () => {
  const plan = {
    ...BASE_PLAN,
    buildSteps: [
      {
        id: 'step_2', action: 'create_hole_pattern',
        params: { diameter: 10, depth: 10, positions: [{ x: 1, y: 25 }] },
      },
    ],
  };
  const result = repairGeometryPlan({
    geometryPlan: plan,
    spec: SPEC_3DP,
    issues: [{ code: 'EDGE_CLEARANCE_TOO_SMALL', stepId: 'step_2' }],
    attemptNumber: 1,
  });
  assert.ok(result.changesApplied.length > 0, 'expected position fix');
  const pos = result.updatedGeometryPlan.buildSteps[0].params.positions[0];
  assert.ok(pos.x > 1, `position not moved: x=${pos.x}`);
});

// ── NON_POSITIVE_DIMENSION ────────────────────────────────────────────────────

test('NON_POSITIVE_DIMENSION: fixes zero height to positive default', () => {
  const plan = {
    ...BASE_PLAN,
    buildSteps: [
      { id: 'step_1', action: 'create_box', params: { width: 50, length: 30, height: 0 } },
    ],
  };
  const result = repairGeometryPlan({
    geometryPlan: plan,
    spec: SPEC_3DP,
    issues: [{ code: 'NON_POSITIVE_DIMENSION', stepId: 'step_1' }],
    attemptNumber: 1,
  });
  assert.ok(result.changesApplied.length > 0);
  const h = result.updatedGeometryPlan.buildSteps[0].params.height;
  assert.ok(h > 0, `height is still non-positive: ${h}`);
});

test('NON_POSITIVE_DIMENSION: fixes negative radius', () => {
  const plan = {
    ...BASE_PLAN,
    buildSteps: [
      { id: 'step_1', action: 'create_cylinder', params: { diameter: -5, height: 20 } },
    ],
  };
  const result = repairGeometryPlan({
    geometryPlan: plan,
    spec: SPEC_3DP,
    issues: [{ code: 'NON_POSITIVE_DIMENSION', stepId: 'step_1' }],
    attemptNumber: 1,
  });
  assert.ok(result.updatedGeometryPlan.buildSteps[0].params.diameter > 0);
});

// ── FILLET_TOO_LARGE ──────────────────────────────────────────────────────────

test('FILLET_TOO_LARGE: reduces filletRadius to safe value', () => {
  const plan = {
    ...BASE_PLAN,
    boundingBox: { x: 20, y: 20, z: 20 },
    buildSteps: [
      { id: 'step_1', action: 'fillet_edges', params: { filletRadius: 15 } },
    ],
  };
  const result = repairGeometryPlan({
    geometryPlan: plan,
    spec: SPEC_3DP,
    issues: [{ code: 'FILLET_TOO_LARGE', stepId: 'step_1' }],
    attemptNumber: 1,
  });
  const fr = result.updatedGeometryPlan.buildSteps[0].params.filletRadius;
  assert.ok(fr < 10, `filletRadius not reduced: ${fr}`);
  assert.ok(result.changesApplied.length > 0);
});

// ── INVALID_BOUNDING_BOX ──────────────────────────────────────────────────────

test('INVALID_BOUNDING_BOX: recalculates from step params', () => {
  const plan = {
    ...BASE_PLAN,
    boundingBox: { x: 0, y: 0, z: 0 },
    buildSteps: [
      { id: 'step_1', action: 'create_box', params: { width: 100, length: 60, height: 15 } },
    ],
  };
  const result = repairGeometryPlan({
    geometryPlan: plan,
    spec: SPEC_3DP,
    issues: [{ code: 'INVALID_BOUNDING_BOX' }],
    attemptNumber: 1,
  });
  assert.ok(result.changesApplied.length > 0);
  const bb = result.updatedGeometryPlan.boundingBox;
  assert.ok(bb.x > 0 || bb.y > 0 || bb.z > 0, 'bounding box not updated');
});

// ── No matching fix ────────────────────────────────────────────────────────────

test('unknown error code: no changes applied, resultStatus=needs_ai', () => {
  const result = repairGeometryPlan({
    geometryPlan: BASE_PLAN,
    spec: SPEC_3DP,
    issues: [{ code: 'SOME_FUTURE_ERROR' }],
    attemptNumber: 1,
  });
  assert.strictEqual(result.changesApplied.length, 0);
  assert.strictEqual(result.resultStatus, 'needs_ai');
});

// ── Max attempts exceeded ──────────────────────────────────────────────────────

test('attemptNumber > MAX returns empty changesApplied and failed', () => {
  const result = repairGeometryPlan({
    geometryPlan: BASE_PLAN,
    spec: SPEC_3DP,
    issues: [{ code: 'WALL_TOO_THIN' }],
    attemptNumber: 99,
  });
  assert.strictEqual(result.changesApplied.length, 0);
  assert.strictEqual(result.resultStatus, 'failed');
});

// ── Deep clone — original plan not mutated ────────────────────────────────────

test('repair does not mutate the original plan', () => {
  const plan = {
    ...BASE_PLAN,
    buildSteps: [
      { id: 'step_1', action: 'create_shell', params: { wallThickness: 0.5 } },
    ],
  };
  const originalThickness = plan.buildSteps[0].params.wallThickness;
  repairGeometryPlan({ geometryPlan: plan, spec: SPEC_3DP, issues: [{ code: 'WALL_TOO_THIN' }], attemptNumber: 1 });
  assert.strictEqual(plan.buildSteps[0].params.wallThickness, originalThickness, 'original plan mutated');
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

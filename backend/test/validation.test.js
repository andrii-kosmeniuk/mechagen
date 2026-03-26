'use strict';

/**
 * Validation Engine Tests — MechaGen
 *
 * Tests each of the 8 rule-checks in validationEngine.js:
 *   1. bounding_box_valid
 *   2. non_negative_dimensions
 *   3. hole_edge_clearance
 *   4. min_wall_thickness
 *   5. fillet_radius_valid
 *   6. self_intersection_estimate
 *   7. manufacturing_mode_rules
 *   8. exportability_check
 */

const assert = require('assert');
const { validateGeometry } = require('../src/services/validationEngine');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

// Baseline valid plan
const BASE_PLAN = {
  version: '1.0',
  partType: 'bracket',
  coordinateSystem: 'right_handed_z_up',
  boundingBox: { x: 80, y: 50, z: 10 },
  buildSteps: [
    {
      id: 'step_1', action: 'create_plate',
      params: { width: 80, length: 50, thickness: 10 },
    },
    {
      id: 'step_2', action: 'create_hole_pattern',
      params: { count: 2, diameter: 6, depth: 10, positions: [{ x: 15, y: 25 }, { x: 65, y: 25 }] },
    },
  ],
};

const SPEC_3DP = { manufacturingMode: '3d_print' };
const SPEC_CNC = { manufacturingMode: 'cnc' };

console.log('\n📋 Validation Engine tests\n');

// ── Basic pass/fail ────────────────────────────────────────────────────────────

test('valid plan passes', () => {
  const r = validateGeometry(BASE_PLAN, SPEC_3DP);
  assert.ok(Array.isArray(r.errors) && r.errors.length === 0, `unexpected errors: ${JSON.stringify(r.errors)}`);
  assert.strictEqual(r.valid, true);
});

test('null plan fails with NO_GEOMETRY_PLAN', () => {
  const r = validateGeometry(null, SPEC_3DP);
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'NO_GEOMETRY_PLAN'));
  assert.strictEqual(r.repairable, false);
});

// ── Check 1: Bounding box ──────────────────────────────────────────────────────

test('invalid bounding box (zero y) produces INVALID_BOUNDING_BOX', () => {
  const plan = { ...BASE_PLAN, boundingBox: { x: 80, y: 0, z: 10 } };
  const r = validateGeometry(plan, SPEC_3DP);
  assert.ok(r.errors.some(e => e.code === 'INVALID_BOUNDING_BOX'), JSON.stringify(r.errors));
});

test('negative bounding box produces INVALID_BOUNDING_BOX', () => {
  const plan = { ...BASE_PLAN, boundingBox: { x: -5, y: 50, z: 10 } };
  const r = validateGeometry(plan, SPEC_3DP);
  assert.ok(r.errors.some(e => e.code === 'INVALID_BOUNDING_BOX'));
});

test('missing bounding box produces INVALID_BOUNDING_BOX', () => {
  const { boundingBox, ...plan } = BASE_PLAN;
  const r = validateGeometry(plan, SPEC_3DP);
  assert.ok(r.errors.some(e => e.code === 'INVALID_BOUNDING_BOX'));
});

// ── Check 2: Non-positive dimensions ──────────────────────────────────────────

test('step with zero param produces NON_POSITIVE_DIMENSION', () => {
  const plan = {
    ...BASE_PLAN,
    buildSteps: [
      { id: 'step_1', action: 'create_plate', params: { width: 80, length: 0, thickness: 5 } },
    ],
  };
  const r = validateGeometry(plan, SPEC_3DP);
  assert.ok(r.errors.some(e => e.code === 'NON_POSITIVE_DIMENSION'), JSON.stringify(r.errors));
});

test('step with negative param produces NON_POSITIVE_DIMENSION', () => {
  const plan = {
    ...BASE_PLAN,
    buildSteps: [
      { id: 'step_1', action: 'create_box', params: { width: 50, length: 30, height: -3 } },
    ],
  };
  const r = validateGeometry(plan, SPEC_3DP);
  assert.ok(r.errors.some(e => e.code === 'NON_POSITIVE_DIMENSION'));
});

// ── Check 3: Hole edge clearance ───────────────────────────────────────────────

test('hole too close to edge produces EDGE_CLEARANCE_TOO_SMALL', () => {
  const plan = {
    ...BASE_PLAN,
    buildSteps: [
      { id: 'step_1', action: 'create_plate', params: { width: 80, length: 50, thickness: 10 } },
      {
        id: 'step_2', action: 'create_hole_pattern',
        params: { count: 1, diameter: 10, depth: 10, positions: [{ x: 1, y: 25 }] }, // x=1 is too close
      },
    ],
  };
  const r = validateGeometry(plan, SPEC_CNC);
  assert.ok(r.errors.some(e => e.code === 'EDGE_CLEARANCE_TOO_SMALL'), JSON.stringify(r.errors));
});

test('hole well inside face has no edge clearance error', () => {
  const r = validateGeometry(BASE_PLAN, SPEC_CNC);
  assert.ok(!r.errors.some(e => e.code === 'EDGE_CLEARANCE_TOO_SMALL'));
});

// ── Check 4: Wall thickness ────────────────────────────────────────────────────

test('3d_print wall below absMin produces WALL_TOO_THIN', () => {
  const plan = {
    ...BASE_PLAN,
    buildSteps: [
      { id: 'step_1', action: 'create_shell', params: { width: 50, height: 40, depth: 30, wallThickness: 0.8 } }, // below 1.2mm
    ],
  };
  const r = validateGeometry(plan, SPEC_3DP);
  assert.ok(r.errors.some(e => e.code === 'WALL_TOO_THIN'), JSON.stringify(r.errors));
});

test('cnc wall below absMin produces WALL_TOO_THIN', () => {
  const plan = {
    ...BASE_PLAN,
    buildSteps: [
      { id: 'step_1', action: 'create_shell', params: { width: 50, height: 40, depth: 30, wallThickness: 0.5 } },
    ],
  };
  const r = validateGeometry(plan, SPEC_CNC);
  assert.ok(r.errors.some(e => e.code === 'WALL_TOO_THIN'));
});

test('thin but above absMin produces LOW_WALL_THICKNESS warning', () => {
  const plan = {
    ...BASE_PLAN,
    buildSteps: [
      { id: 'step_1', action: 'create_shell', params: { width: 50, height: 40, depth: 30, wallThickness: 2.0 } }, // above 1.2, below 4.0
    ],
  };
  const r = validateGeometry(plan, SPEC_3DP);
  assert.ok(r.warnings.some(w => w.code === 'LOW_WALL_THICKNESS'), JSON.stringify(r.warnings));
});

// ── Check 5: Fillet radius ─────────────────────────────────────────────────────

test('fillet larger than half of min bbox dim produces FILLET_TOO_LARGE', () => {
  const plan = {
    ...BASE_PLAN,
    boundingBox: { x: 20, y: 20, z: 20 },
    buildSteps: [
      { id: 'step_1', action: 'fillet_edges', params: { filletRadius: 15 } }, // > 20/2 = 10
    ],
  };
  const r = validateGeometry(plan, SPEC_3DP);
  assert.ok(r.errors.some(e => e.code === 'FILLET_TOO_LARGE'), JSON.stringify(r.errors));
});

// ── Check 8: Exportability ─────────────────────────────────────────────────────

test('empty buildSteps produces NO_BUILD_STEPS', () => {
  const plan = { ...BASE_PLAN, buildSteps: [] };
  const r = validateGeometry(plan, SPEC_3DP);
  assert.ok(r.errors.some(e => e.code === 'NO_BUILD_STEPS'), JSON.stringify(r.errors));
});

// ── Report structure ───────────────────────────────────────────────────────────

test('valid plan has severity=none or low', () => {
  const r = validateGeometry(BASE_PLAN, SPEC_3DP);
  assert.ok(['none', 'low'].includes(r.severity), `unexpected severity: ${r.severity}`);
});

test('plan with errors has repairable flag', () => {
  const plan = { ...BASE_PLAN, buildSteps: [] }; // NO_BUILD_STEPS only
  const r = validateGeometry(plan, SPEC_3DP);
  assert.ok(typeof r.repairable === 'boolean');
});

test('checksRun array is populated', () => {
  const r = validateGeometry(BASE_PLAN, SPEC_3DP);
  assert.ok(Array.isArray(r.checksRun) && r.checksRun.length > 0);
});

test('3d_print plan includes FDM_OVERHANG_ADVISORY warning', () => {
  const r = validateGeometry(BASE_PLAN, SPEC_3DP);
  assert.ok(r.warnings.some(w => w.code === 'FDM_OVERHANG_ADVISORY'));
});

test('sheet_metal plan includes SHEET_METAL_BEND_CHECK warning', () => {
  const r = validateGeometry(BASE_PLAN, { manufacturingMode: 'sheet_metal' });
  assert.ok(r.warnings.some(w => w.code === 'SHEET_METAL_BEND_CHECK'));
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

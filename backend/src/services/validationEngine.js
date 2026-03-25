'use strict';

/**
 * Deterministic rule-based validation engine.
 * Validates a Geometry Plan against engineering and manufacturing rules.
 * Returns a ValidationReport JSON object.
 */

const MIN_EDGE_CLEARANCE = 2.0; // mm
const MIN_FILLET_RATIO   = 0.05; // fillet radius must be < local dim * ratio cutoff

// Manufacturing-mode wall thickness rules (mm)
const WALL_RULES = {
  '3d_print':   { absMin: 1.2, warnBelow: 4.0 },
  cnc:          { absMin: 1.0, warnBelow: 3.0 },
  sheet_metal:  { absMin: 0.4, warnBelow: 1.5 },
  unknown:      { absMin: 1.0, warnBelow: 2.0 },
};

/**
 * @param {object} geometryPlan
 * @param {object} spec
 * @param {string} spec.manufacturingMode
 * @returns {object} ValidationReport
 */
function validateGeometry(geometryPlan, spec = {}) {
  const errors = [];
  const warnings = [];
  const checksRun = [];

  if (!geometryPlan || typeof geometryPlan !== 'object') {
    return {
      valid: false,
      severity: 'high',
      errors: [{ code: 'NO_GEOMETRY_PLAN', message: 'No geometry plan provided', suggestedFix: 'Generate a geometry plan first' }],
      warnings: [],
      checksRun: [],
      repairable: false,
    };
  }

  const steps = Array.isArray(geometryPlan.buildSteps) ? geometryPlan.buildSteps : [];
  const bb = geometryPlan.boundingBox || {};
  const mode = (spec.manufacturingMode || 'unknown');
  const wallRules = WALL_RULES[mode] || WALL_RULES.unknown;

  // ─── Check 1: Bounding box validity ──────────────────────────────────────
  checksRun.push('bounding_box_valid');
  for (const dim of ['x', 'y', 'z']) {
    const v = Number(bb[dim]);
    if (!Number.isFinite(v) || v <= 0) {
      errors.push({
        code: 'INVALID_BOUNDING_BOX',
        message: `Bounding box dimension "${dim}" is ${bb[dim] ?? 'missing'} — must be a positive number`,
        suggestedFix: `Set bounding box ${dim} to the correct external dimension of the part`,
      });
    }
  }

  // ─── Check 2: Non-negative / non-zero dimensions per step ─────────────────
  checksRun.push('non_negative_dimensions');
  for (const step of steps) {
    if (!step.params) continue;
    for (const [key, val] of Object.entries(step.params)) {
      if (typeof val === 'number' && val <= 0) {
        errors.push({
          code: 'NON_POSITIVE_DIMENSION',
          message: `Step "${step.id}" param "${key}" is ${val} — must be positive`,
          stepId: step.id,
          suggestedFix: `Increase "${key}" to a positive value`,
        });
      }
    }
  }

  // ─── Check 3: Hole validations ────────────────────────────────────────────
  checksRun.push('hole_edge_clearance');
  for (const step of steps) {
    if (step.action !== 'create_hole_pattern' && step.action !== 'drill_holes') continue;
    const p = step.params || {};
    const diameter = Number(p.diameter) || Number(p.holeDiameter) || 0;

    // Diameter positive
    if (diameter <= 0) {
      errors.push({
        code: 'INVALID_HOLE_DIAMETER',
        message: `Step "${step.id}": hole diameter must be positive`,
        stepId: step.id,
        suggestedFix: 'Set a valid positive hole diameter (e.g. 5.5mm for M5)',
      });
    }

    // Edge clearance
    const positions = Array.isArray(p.positions) ? p.positions : [];
    const faceWidth  = Number(p.faceWidth)  || Number(bb.x) || 0;
    const faceLength = Number(p.faceLength) || Number(bb.y) || 0;

    for (const pos of positions) {
      const x = Number(pos.x) || 0;
      const y = Number(pos.y) || 0;
      const radius = diameter / 2;
      const requiredClearance = radius + MIN_EDGE_CLEARANCE;

      if (faceWidth > 0 && (x - radius < MIN_EDGE_CLEARANCE || x + requiredClearance > faceWidth)) {
        errors.push({
          code: 'EDGE_CLEARANCE_TOO_SMALL',
          message: `Step "${step.id}": hole at x=${x} is too close to the edge (need ${requiredClearance}mm clearance)`,
          stepId: step.id,
          suggestedFix: `Move hole inward by at least ${Math.ceil(requiredClearance - x + MIN_EDGE_CLEARANCE)}mm`,
        });
      }
      if (faceLength > 0 && (y - radius < MIN_EDGE_CLEARANCE || y + requiredClearance > faceLength)) {
        errors.push({
          code: 'EDGE_CLEARANCE_TOO_SMALL',
          message: `Step "${step.id}": hole at y=${y} is too close to the edge`,
          stepId: step.id,
          suggestedFix: `Move hole inward so there is at least ${requiredClearance}mm from the edge`,
        });
      }
    }
  }

  // ─── Check 4: Wall thickness ──────────────────────────────────────────────
  checksRun.push('min_wall_thickness');
  for (const step of steps) {
    const p = step.params || {};
    const thickness =
      Number(p.thickness) ||
      Number(p.wallThickness) ||
      Number(p.wall) ||
      0;

    if (thickness > 0 && thickness < wallRules.absMin) {
      errors.push({
        code: 'WALL_TOO_THIN',
        message: `Step "${step.id}": wall thickness ${thickness}mm is below the absolute minimum ${wallRules.absMin}mm for ${mode}`,
        stepId: step.id,
        suggestedFix: `Increase wall thickness to at least ${wallRules.absMin}mm`,
      });
    } else if (thickness > 0 && thickness < wallRules.warnBelow) {
      warnings.push({
        code: 'LOW_WALL_THICKNESS',
        message: `Step "${step.id}": wall thickness ${thickness}mm may be marginal for ${mode} (recommend ${wallRules.warnBelow}mm+)`,
        suggestedFix: `Consider increasing wall thickness to ${wallRules.warnBelow}mm for better strength`,
      });
    }
  }

  // ─── Check 5: Fillet radius sanity ────────────────────────────────────────
  checksRun.push('fillet_radius_valid');
  for (const step of steps) {
    if (step.action !== 'fillet_edges' && step.action !== 'chamfer_edges' && !step.params?.filletRadius) continue;
    const p = step.params || {};
    const fr = Number(p.filletRadius) || Number(p.chamferDistance) || 0;
    const localMin = Math.min(Number(bb.x), Number(bb.y), Number(bb.z)) || 999;
    if (fr > 0 && fr > localMin / 2) {
      errors.push({
        code: 'FILLET_TOO_LARGE',
        message: `Step "${step.id}": fillet radius ${fr}mm exceeds half the minimum bounding box dimension (${localMin / 2}mm)`,
        stepId: step.id,
        suggestedFix: `Reduce fillet radius to less than ${Math.floor(localMin / 2)}mm`,
      });
    }
  }

  // ─── Check 6: Self-intersection estimate (basic) ──────────────────────────
  checksRun.push('self_intersection_estimate');
  // Very basic: if create_box/plate dimensions add up to more than bounding box, flag
  let sumX = 0;
  for (const step of steps) {
    if (step.action === 'create_box' || step.action === 'create_plate') {
      const p = step.params || {};
      sumX += Number(p.width) || Number(p.length) || 0;
    }
  }
  if (sumX > (Number(bb.x) || 0) * 3) {
    warnings.push({
      code: 'POSSIBLE_SELF_INTERSECTION',
      message: 'Sum of solid widths greatly exceeds bounding box — possible self-intersection or layout issue',
      suggestedFix: 'Review positions of placed solids to ensure they are correctly offset and do not overlap unexpectedly',
    });
  }

  // ─── Check 7: Manufacturing-mode specific ────────────────────────────────
  checksRun.push('manufacturing_mode_rules');
  if (mode === '3d_print') {
    warnings.push({
      code: 'FDM_OVERHANG_ADVISORY',
      message: 'FDM printing: overhangs >45° may require support structures',
      suggestedFix: 'Orient part for minimum support, or add support-friendly chamfers',
    });
  }
  if (mode === 'cnc') {
    for (const step of steps) {
      if (step.action === 'create_slot' || step.action === 'create_hole_pattern') {
        const p = step.params || {};
        const d = Number(p.diameter) || Number(p.slotWidth) || 0;
        if (d > 0 && d < 1.5) {
          warnings.push({
            code: 'CNC_SMALL_FEATURE',
            message: `Step "${step.id}": feature size ${d}mm may be at the limit of standard CNC tooling`,
            suggestedFix: 'Use minimum 1.5mm tool diameter for practical CNC machining',
          });
        }
      }
    }
  }
  if (mode === 'sheet_metal') {
    warnings.push({
      code: 'SHEET_METAL_BEND_CHECK',
      message: 'Sheet metal: verify bend radii and K-factor are within material limits',
      suggestedFix: 'Ensure bend radius ≥ material thickness',
    });
  }

  // ─── Check 8: Exportability ────────────────────────────────────────────────
  checksRun.push('exportability_check');
  if (steps.length === 0) {
    errors.push({
      code: 'NO_BUILD_STEPS',
      message: 'Geometry plan has no build steps — nothing to export',
      suggestedFix: 'Re-generate the geometry plan with at least one build step',
    });
  }

  // ─── Compute severity ─────────────────────────────────────────────────────
  let severity = 'none';
  if (warnings.length > 0) severity = 'low';
  if (warnings.length > 3) severity = 'medium';
  if (errors.length > 0) severity = errors.length > 2 ? 'high' : 'medium';

  const repairable = errors.length <= 4; // too many errors may need full regen

  return {
    valid: errors.length === 0,
    severity,
    errors,
    warnings,
    checksRun,
    repairable,
  };
}

module.exports = { validateGeometry };

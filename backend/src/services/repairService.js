'use strict';

/**
 * Repair service — attempts to fix validation errors deterministically.
 * If errors are parameter-only, modifies the geometry plan directly.
 * Returns a RepairOutput object.
 */

const MAX_AUTO_REPAIR_ATTEMPTS = 2;
const MIN_EDGE_CLEARANCE = 2.0; // mm

/**
 * Attempt deterministic repair of a geometry plan given validation errors.
 *
 * @param {object} params
 * @param {object} params.geometryPlan - the current geometry plan
 * @param {object} params.spec - the current spec JSON
 * @param {object[]} params.issues - validation errors from ValidationReport
 * @param {number} params.attemptNumber - repair attempt number (1 or 2)
 * @returns {{ repairAttempt: number, changesApplied: string[], resultStatus: string, updatedGeometryPlan: object }}
 */
function repairGeometryPlan({ geometryPlan, spec, issues, attemptNumber = 1 }) {
  if (attemptNumber > MAX_AUTO_REPAIR_ATTEMPTS) {
    return {
      repairAttempt: attemptNumber,
      changesApplied: [],
      resultStatus: 'failed',
      updatedGeometryPlan: geometryPlan,
    };
  }

  const changesApplied = [];
  const plan = JSON.parse(JSON.stringify(geometryPlan)); // deep clone
  const mode = spec?.manufacturingMode || 'unknown';
  const steps = plan.buildSteps || [];
  const bb = plan.boundingBox || { x: 100, y: 100, z: 100 };

  // Wall thickness minimums by mode
  const minWall = { '3d_print': 2.0, cnc: 1.5, sheet_metal: 0.5, unknown: 1.5 };
  const recWall = { '3d_print': 4.0, cnc: 3.0, sheet_metal: 1.5, unknown: 3.0 };
  const minW = minWall[mode] || 1.5;
  const recW = recWall[mode] || 3.0;

  for (const issue of issues) {
    const { code, stepId } = issue;

    // ─── Fix: WALL_TOO_THIN ───────────────────────────────────────────────
    if (code === 'WALL_TOO_THIN') {
      const step = stepId ? steps.find((s) => s.id === stepId) : null;
      if (step && step.params) {
        const keys = ['thickness', 'wallThickness', 'wall'];
        for (const k of keys) {
          if (typeof step.params[k] === 'number' && step.params[k] < minW) {
            const old = step.params[k];
            step.params[k] = recW;
            changesApplied.push(
              `Step ${stepId}: increased ${k} from ${old}mm to ${recW}mm (min ${minW}mm for ${mode})`
            );
          }
        }
      } else {
        // Apply to all steps with thin walls
        for (const s of steps) {
          if (!s.params) continue;
          for (const k of ['thickness', 'wallThickness', 'wall']) {
            if (typeof s.params[k] === 'number' && s.params[k] < minW) {
              const old = s.params[k];
              s.params[k] = recW;
              changesApplied.push(
                `Step ${s.id}: increased ${k} from ${old}mm to ${recW}mm`
              );
            }
          }
        }
      }
    }

    // ─── Fix: EDGE_CLEARANCE_TOO_SMALL ────────────────────────────────────
    if (code === 'EDGE_CLEARANCE_TOO_SMALL') {
      const step = stepId ? steps.find((s) => s.id === stepId) : null;
      if (step && step.params) {
        const diameter = Number(step.params.diameter) || Number(step.params.holeDiameter) || 6;
        const faceW = Number(step.params.faceWidth) || Number(bb.x) || 100;
        const faceL = Number(step.params.faceLength) || Number(bb.y) || 100;
        const minClearance = diameter / 2 + MIN_EDGE_CLEARANCE;

        if (Array.isArray(step.params.positions)) {
          let moved = false;
          for (const pos of step.params.positions) {
            const ox = pos.x;
            const oy = pos.y;
            pos.x = Math.max(minClearance, Math.min(pos.x, faceW - minClearance));
            pos.y = Math.max(minClearance, Math.min(pos.y, faceL - minClearance));
            if (pos.x !== ox || pos.y !== oy) moved = true;
          }
          if (moved) {
            changesApplied.push(
              `Step ${stepId}: moved hole positions inward to maintain ${MIN_EDGE_CLEARANCE}mm edge clearance`
            );
          }
        }
      }
    }

    // ─── Fix: NON_POSITIVE_DIMENSION ──────────────────────────────────────
    if (code === 'NON_POSITIVE_DIMENSION') {
      const step = stepId ? steps.find((s) => s.id === stepId) : null;
      if (step && step.params) {
        for (const [k, v] of Object.entries(step.params)) {
          if (typeof v === 'number' && v <= 0) {
            const defaultVal = k.toLowerCase().includes('radius')  ? 2.5 :
                               k.toLowerCase().includes('diameter') ? 5.0 :
                               k.toLowerCase().includes('count')    ? 1   :
                               k.toLowerCase().includes('height') || k.toLowerCase().includes('length') ? 20 :
                               k.toLowerCase().includes('width')    ? 40  :
                               k.toLowerCase().includes('thickness') ? recW : 10;
            step.params[k] = defaultVal;
            changesApplied.push(
              `Step ${stepId}: set ${k} to ${defaultVal} (was ${v})`
            );
          }
        }
      }
    }

    // ─── Fix: FILLET_TOO_LARGE ────────────────────────────────────────────
    if (code === 'FILLET_TOO_LARGE') {
      const step = stepId ? steps.find((s) => s.id === stepId) : null;
      if (step && step.params) {
        const minBb = Math.min(Number(bb.x), Number(bb.y), Number(bb.z)) || 10;
        const maxFillet = Math.floor(minBb / 4);
        if (step.params.filletRadius > maxFillet) {
          const old = step.params.filletRadius;
          step.params.filletRadius = maxFillet;
          changesApplied.push(
            `Step ${stepId}: reduced filletRadius from ${old}mm to ${maxFillet}mm`
          );
        }
      }
    }

    // ─── Fix: INVALID_BOUNDING_BOX ────────────────────────────────────────
    if (code === 'INVALID_BOUNDING_BOX') {
      // Recalculate bounding box from steps
      let maxX = 0, maxY = 0, maxZ = 0;
      for (const s of steps) {
        const p = s.params || {};
        maxX = Math.max(maxX, Number(p.width) || Number(p.length) || Number(p.outerDiameter) || 0);
        maxY = Math.max(maxY, Number(p.height) || Number(p.length) || Number(p.outerDiameter) || 0);
        maxZ = Math.max(maxZ, Number(p.depth) || Number(p.height) || Number(p.thickness) || 0);
      }
      if (maxX > 0) { plan.boundingBox.x = maxX; }
      if (maxY > 0) { plan.boundingBox.y = maxY; }
      if (maxZ > 0) { plan.boundingBox.z = maxZ; }
      if (maxX > 0 || maxY > 0 || maxZ > 0) {
        changesApplied.push(
          `Recalculated bounding box from build steps: ${plan.boundingBox.x}×${plan.boundingBox.y}×${plan.boundingBox.z}mm`
        );
      }
    }
  }

  const resultStatus = changesApplied.length > 0 ? 'revalidated' : 'needs_ai';

  return {
    repairAttempt: attemptNumber,
    changesApplied,
    resultStatus,
    updatedGeometryPlan: plan,
  };
}

module.exports = { repairGeometryPlan, MAX_AUTO_REPAIR_ATTEMPTS };

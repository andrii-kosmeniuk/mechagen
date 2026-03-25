'use strict';

const CANONICAL_PART_TYPES = [
  'bracket',
  'mounting_plate',
  'spacer',
  'enclosure',
  'shaft_coupler',
  'gear_basic',
  'pulley_basic',
  'bearing_block',
  'flange',
  'standoff',
  'clamp',
  'simple_housing',
];

const MANUFACTURING_MODES = ['3d_print', 'cnc', 'sheet_metal', 'unknown'];

const ALLOWED_GEOMETRY_ACTIONS = [
  'create_box',
  'create_cylinder',
  'create_plate',
  'create_shell',
  'create_rib',
  'create_flange',
  'create_hole_pattern',
  'create_slot',
  'extrude_profile',
  'subtract_feature',
  'fillet_edges',
  'chamfer_edges',
  'mirror_feature',
  'join_perpendicular',
  'add_mounting_points',
  'add_standoff',
  'create_basic_gear',
  'create_basic_pulley',
];

/**
 * Validates and normalises an AI-returned Spec JSON object.
 * @param {unknown} raw
 * @returns {{ value: object, errors: string[] }}
 */
function validateSpecJson(raw) {
  const errors = [];

  if (!raw || typeof raw !== 'object') {
    return { value: null, errors: ['Spec must be a JSON object'] };
  }

  const spec = /** @type {Record<string, unknown>} */ (raw);

  // partType
  if (!CANONICAL_PART_TYPES.includes(spec.partType)) {
    errors.push(
      `partType "${spec.partType}" is not a supported canonical part type. Supported: ${CANONICAL_PART_TYPES.join(', ')}`
    );
  }

  // units
  if (spec.units !== 'mm') {
    spec.units = 'mm'; // normalise
  }

  // manufacturingMode
  if (!MANUFACTURING_MODES.includes(spec.manufacturingMode)) {
    spec.manufacturingMode = 'unknown';
  }

  // knownDimensions / assumedDimensions must be objects
  if (!spec.knownDimensions || typeof spec.knownDimensions !== 'object') {
    spec.knownDimensions = {};
  }
  if (!spec.assumedDimensions || typeof spec.assumedDimensions !== 'object') {
    spec.assumedDimensions = {};
  }

  // riskFlags must be array
  if (!Array.isArray(spec.riskFlags)) spec.riskFlags = [];

  // missingInformation must be array
  if (!Array.isArray(spec.missingInformation)) spec.missingInformation = [];

  // constraints must be array
  if (!Array.isArray(spec.constraints)) spec.constraints = [];

  // features must be array
  if (!Array.isArray(spec.features)) spec.features = [];

  // confidence 0–1
  const conf = Number(spec.confidence);
  if (!Number.isFinite(conf) || conf < 0 || conf > 1) {
    spec.confidence = 0.5;
  }

  // version
  spec.version = '1.0';

  // intentSummary
  if (typeof spec.intentSummary !== 'string' || !spec.intentSummary.trim()) {
    spec.intentSummary = `${spec.partType || 'part'} specification`;
  }

  // materialPreference
  if (typeof spec.materialPreference !== 'string') {
    spec.materialPreference = 'unspecified';
  }

  // targetUse
  if (typeof spec.targetUse !== 'string') {
    spec.targetUse = 'general purpose';
  }

  return { value: spec, errors };
}

/**
 * Validates a Geometry Plan JSON object.
 * @param {unknown} raw
 * @returns {{ value: object|null, errors: string[] }}
 */
function validateGeometryPlan(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') {
    return { value: null, errors: ['Geometry plan must be a JSON object'] };
  }

  const plan = /** @type {Record<string, unknown>} */ (raw);
  plan.version = '1.0';
  plan.coordinateSystem = 'right_handed_z_up';

  // partType
  if (!CANONICAL_PART_TYPES.includes(plan.partType)) {
    errors.push(`Geometry plan has invalid partType: "${plan.partType}"`);
  }

  // buildSteps
  if (!Array.isArray(plan.buildSteps) || plan.buildSteps.length === 0) {
    errors.push('Geometry plan must have a non-empty buildSteps array');
    return { value: plan, errors };
  }

  for (const step of plan.buildSteps) {
    if (!step || typeof step !== 'object') {
      errors.push('Each build step must be an object');
      continue;
    }
    if (!step.id || typeof step.id !== 'string') {
      errors.push('Each build step must have a string id');
    }
    if (!ALLOWED_GEOMETRY_ACTIONS.includes(step.action)) {
      errors.push(
        `Step "${step.id}" has unsupported action "${step.action}". Allowed: ${ALLOWED_GEOMETRY_ACTIONS.join(', ')}`
      );
    }
    if (!step.params || typeof step.params !== 'object') {
      errors.push(`Step "${step.id}" must have a params object`);
    }
  }

  // boundingBox
  if (!plan.boundingBox || typeof plan.boundingBox !== 'object') {
    errors.push('Geometry plan must have a boundingBox');
  } else {
    const bb = plan.boundingBox;
    for (const dim of ['x', 'y', 'z']) {
      const v = Number(bb[dim]);
      if (!Number.isFinite(v) || v <= 0) {
        errors.push(`boundingBox.${dim} must be a positive number`);
      }
    }
  }

  if (!Array.isArray(plan.criticalDimensions)) plan.criticalDimensions = [];
  if (!Array.isArray(plan.expectedManufacturingChecks)) plan.expectedManufacturingChecks = [];

  return { value: plan, errors };
}

module.exports = {
  CANONICAL_PART_TYPES,
  MANUFACTURING_MODES,
  ALLOWED_GEOMETRY_ACTIONS,
  validateSpecJson,
  validateGeometryPlan,
};

'use strict';

const { CANONICAL_PART_TYPES, MANUFACTURING_MODES } = require('../schemas/specSchema');

/**
 * Minimum wall thickness by manufacturing mode (mm).
 */
const MIN_WALL_THICKNESS = {
  '3d_print': 2.0,
  cnc: 1.5,
  sheet_metal: 0.5,
  unknown: 1.5,
};

/**
 * Recommended wall thickness for load-bearing parts by mode (mm).
 */
const RECOMMENDED_WALL_THICKNESS = {
  '3d_print': 4.0,
  cnc: 3.0,
  sheet_metal: 1.5,
  unknown: 3.0,
};

const MIN_HOLE_EDGE_CLEARANCE = 2.0; // mm — hole edge to part edge
const MIN_HOLE_DIAMETER = 0.5; // mm

/**
 * Check constraint rules against a validated Spec JSON.
 *
 * @param {object} spec - validated Spec JSON object
 * @param {object} options
 * @param {string} options.prompt - original user prompt (for fallback checks)
 * @param {boolean} options.hasImage - whether an image was provided
 * @returns {{ isBuildable: boolean, severity: string, errors: string[], warnings: string[], assumptionsUsed: string[], missingRequiredFields: string[], recommendedQuestions: string[], normalizedSpec: object }}
 */
function checkConstraints(spec, options = {}) {
  const errors = [];
  const warnings = [];
  const assumptionsUsed = [];
  const missingRequiredFields = [];
  const recommendedQuestions = [];

  const prompt = (options.prompt || '').trim();
  const hasImage = !!options.hasImage;

  // ─── 1. Basic input check ──────────────────────────────────────────────────
  if (!prompt && !hasImage) {
    errors.push('No prompt and no reference image provided. Cannot build specification.');
    return {
      isBuildable: false,
      severity: 'high',
      errors,
      warnings,
      assumptionsUsed,
      missingRequiredFields,
      recommendedQuestions,
      normalizedSpec: {},
    };
  }

  // ─── 2. Part type check ────────────────────────────────────────────────────
  if (!CANONICAL_PART_TYPES.includes(spec.partType)) {
    errors.push(
      `Part type "${spec.partType}" is not supported in MVP. Supported types: ${CANONICAL_PART_TYPES.join(', ')}.`
    );
  }

  // ─── 3. Manufacturing mode warning ────────────────────────────────────────
  const mode = spec.manufacturingMode || 'unknown';
  if (!MANUFACTURING_MODES.includes(mode) || mode === 'unknown') {
    warnings.push(
      'Manufacturing mode not specified or unknown. Defaulting to general tolerances.'
    );
    recommendedQuestions.push(
      'What manufacturing process will be used? (e.g. 3D printing, CNC machining, sheet metal)'
    );
  }

  // ─── 4. Material warning ───────────────────────────────────────────────────
  if (
    !spec.materialPreference ||
    spec.materialPreference === 'unspecified' ||
    spec.materialPreference === ''
  ) {
    warnings.push('Material preference not specified. Assuming general-purpose structural material.');
    recommendedQuestions.push('What material should be used? (e.g. PETG, aluminum 6061, steel)');
  }

  // ─── 5. Dimensions check ──────────────────────────────────────────────────
  const assumed = spec.assumedDimensions || {};
  const known = spec.knownDimensions || {};
  const allDimensions = { ...assumed, ...known };

  // Wall thickness
  const wallThickness =
    Number(allDimensions.wallThickness) ||
    Number(allDimensions.thickness) ||
    Number(allDimensions.wall) ||
    0;

  const minWall = MIN_WALL_THICKNESS[mode] || 1.5;
  const recWall = RECOMMENDED_WALL_THICKNESS[mode] || 3.0;

  if (wallThickness > 0) {
    if (wallThickness < minWall) {
      errors.push(
        `Wall thickness ${wallThickness}mm is below the minimum of ${minWall}mm for ${mode || 'unknown'} manufacturing.`
      );
    } else if (wallThickness < recWall) {
      warnings.push(
        `Wall thickness ${wallThickness}mm is below the recommended ${recWall}mm for load-bearing ${mode} parts.`
      );
    }
  } else {
    // No wall thickness — if it's a type that needs one, assume a default
    const typesNeedingWall = [
      'bracket',
      'mounting_plate',
      'enclosure',
      'bearing_block',
      'simple_housing',
      'flange',
      'clamp',
    ];
    if (typesNeedingWall.includes(spec.partType)) {
      assumed.wallThickness = recWall;
      assumptionsUsed.push(`wallThickness=${recWall}mm (default recommended)`);
    }
  }

  // Hole diameter check
  const holeDiameter =
    Number(allDimensions.holeDiameter) ||
    Number(allDimensions.boreDiameter) ||
    Number(allDimensions.innerDiameter) ||
    0;

  if (holeDiameter > 0 && holeDiameter < MIN_HOLE_DIAMETER) {
    errors.push(
      `Hole diameter ${holeDiameter}mm is unrealistically small (minimum ${MIN_HOLE_DIAMETER}mm).`
    );
  }

  // ─── 6. FDM-specific checks ────────────────────────────────────────────────
  if (mode === '3d_print') {
    if (wallThickness > 0 && wallThickness < 1.2) {
      errors.push('Wall too thin for FDM: minimum 1.2mm for any printed wall, 2mm+ recommended.');
    }
    warnings.push('Verify overhangs and support requirements for FDM printing.');
    assumptionsUsed.push('FDM printing assumed — support may be needed for overhangs >45°');
  }

  // ─── 7. CNC-specific checks ────────────────────────────────────────────────
  if (mode === 'cnc') {
    if (holeDiameter > 0 && holeDiameter < 0.8) {
      warnings.push(
        `Hole diameter ${holeDiameter}mm may be too small for standard CNC tooling (min ~0.8mm drill).`
      );
    }
    warnings.push('Verify internal corner radii match available tooling');
    assumptionsUsed.push('CNC: internal radii ≥ tool radius assumed');
  }

  // ─── 8. Sheet metal checks ────────────────────────────────────────────────
  if (mode === 'sheet_metal') {
    const solidTypes = [
      'spacer',
      'shaft_coupler',
      'gear_basic',
      'pulley_basic',
      'bearing_block',
    ];
    if (solidTypes.includes(spec.partType)) {
      errors.push(
        `Part type "${spec.partType}" is a solid part and cannot be manufactured as sheet metal.`
      );
    }
  }

  // ─── 9. Dimension consistency ─────────────────────────────────────────────
  const outerD = Number(allDimensions.outerDiameter) || Number(allDimensions.od) || 0;
  const innerD = Number(allDimensions.innerDiameter) || Number(allDimensions.id) || Number(holeDiameter) || 0;
  if (outerD > 0 && innerD > 0 && innerD >= outerD) {
    errors.push(
      `Inner diameter (${innerD}mm) must be less than outer diameter (${outerD}mm).`
    );
  }

  // ─── 10. Record assumptions ───────────────────────────────────────────────
  for (const [k, v] of Object.entries(assumed)) {
    if (!assumptionsUsed.some((a) => a.startsWith(k + '='))) {
      assumptionsUsed.push(`${k}=${v}${typeof v === 'number' ? 'mm' : ''}`);
    }
  }

  // ─── 11. Risk flags from spec ─────────────────────────────────────────────
  if (Array.isArray(spec.riskFlags)) {
    for (const flag of spec.riskFlags) {
      warnings.push(`[Risk] ${flag}`);
    }
  }

  // ─── 12. Missing required fields by part type ──────────────────────────────
  const requiredByType = {
    bracket: ['width', 'height', 'thickness', 'holeCount', 'holeDiameter'],
    mounting_plate: ['width', 'height', 'thickness'],
    spacer: ['outerDiameter', 'innerDiameter', 'length'],
    enclosure: ['width', 'height', 'depth', 'wallThickness'],
    shaft_coupler: ['shaftDiameterA', 'shaftDiameterB', 'length'],
    gear_basic: ['toothCount', 'thickness', 'boreDiameter'],
    pulley_basic: ['outerDiameter', 'beltWidth', 'boreDiameter'],
    bearing_block: ['bearingOuterDiameter', 'bearingWidth', 'mountHoleCount'],
    flange: ['outerDiameter', 'thickness', 'holeCount'],
    standoff: ['outerDiameter', 'innerDiameter', 'length'],
    clamp: ['innerDiameter', 'width', 'thickness'],
    simple_housing: ['width', 'height', 'depth', 'wallThickness'],
  };

  const reqFields = requiredByType[spec.partType] || [];
  for (const field of reqFields) {
    const v = Number(allDimensions[field]);
    if (!Number.isFinite(v) || v <= 0) {
      // Check if AI flagged this as missing too
      if (Array.isArray(spec.missingInformation) && spec.missingInformation.some((m) => m.toLowerCase().includes(field.toLowerCase()))) {
        missingRequiredFields.push(field);
        recommendedQuestions.push(`What is the ${field} for this part?`);
      }
      // Not necessarily an error if the AI assumed a safe default
    }
  }

  // ─── Severity calculation ──────────────────────────────────────────────────
  let severity = 'none';
  if (warnings.length > 0) severity = 'low';
  if (warnings.length > 3 || missingRequiredFields.length > 0) severity = 'medium';
  if (errors.length > 0) severity = 'high';

  const isBuildable = errors.length === 0;

  const normalizedSpec = {
    partType: spec.partType,
    units: 'mm',
    manufacturingMode: mode,
    materialPreference: spec.materialPreference || 'unspecified',
  };

  return {
    isBuildable,
    severity,
    errors,
    warnings,
    assumptionsUsed,
    missingRequiredFields,
    recommendedQuestions,
    normalizedSpec,
  };
}

module.exports = { checkConstraints, MIN_WALL_THICKNESS, RECOMMENDED_WALL_THICKNESS };

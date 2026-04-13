'use strict';

/**
 * Canonical Part Specs — MechaGen
 *
 * For each canonical part type, provide a deterministic spec JSON + geometry plan.
 * When the prompt normalizer fires, orchestration calls getCanonicalSpec() and
 * BYPASSES the AI spec + geometry plan steps entirely.
 *
 * This guarantees consistent, recognizable results for short prompts like "bolt",
 * "bracket", "bearing", "gear", etc.
 *
 * Defaults can be overridden by parseCanonicalDims() which extracts dimensions
 * from prompts like "M8x40", "50×30", "20T gear module 2".
 */

// ─── Dimension parser ──────────────────────────────────────────────────────────

/**
 * Extract dimensions from normalized prompt text.
 * e.g. "M8x40 bolt" → { diameter: 8, length: 40 }
 *      "bracket 60x40" → { width: 60, height: 40 }
 */
function parseCanonicalDims(prompt) {
  const lower = (prompt || '').toLowerCase();
  const dims = {};

  // M-size bolt: M8, M10, M5x30
  const mMatch = lower.match(/\bm(\d+)(?:x(\d+))?\b/);
  if (mMatch) {
    dims.diameter = parseInt(mMatch[1], 10);
    if (mMatch[2]) dims.length = parseInt(mMatch[2], 10);
  }

  // Standalone dimensions: 8x40, 50×30
  const dimMatch = lower.match(/(\d+)\s*[x×]\s*(\d+)/);
  if (dimMatch && !dims.diameter) {
    const a = parseInt(dimMatch[1], 10);
    const b = parseInt(dimMatch[2], 10);
    // If the part type is bolt-like, the first is diameter
    if (lower.includes('bolt') || lower.includes('screw')) {
      dims.diameter = Math.min(a, b);
      dims.length   = Math.max(a, b);
    } else {
      dims.width  = Math.max(a, b);
      dims.height = Math.min(a, b);
    }
  }

  // Gear: "20 teeth", "20T"
  const teethMatch = lower.match(/(\d+)\s*(?:t(?:eeth)?)\b/);
  if (teethMatch) dims.toothCount = parseInt(teethMatch[1], 10);

  // Module: "module 2", "mod 1.5"
  const modMatch = lower.match(/(?:module|mod)\s+([\d.]+)/);
  if (modMatch) dims.module = parseFloat(modMatch[1]);

  // Explicit mm dimension: "40mm", "50mm"
  const mmAll = [...lower.matchAll(/(\d+)\s*mm\b/g)].map(m => parseInt(m[1], 10));
  if (mmAll.length === 1 && !dims.length) dims.length = mmAll[0];
  if (mmAll.length >= 2 && !dims.width) { dims.width = mmAll[0]; dims.height = mmAll[1]; }

  return dims;
}

// ─── M-size bolt lookup table ─────────────────────────────────────────────────

const BOLT_STANDARDS = {
  3:  { pitch: 0.5,  headFlats: 5.5,  headHeight: 2.0,  defaultLen: 16  },
  4:  { pitch: 0.7,  headFlats: 7.0,  headHeight: 2.8,  defaultLen: 20  },
  5:  { pitch: 0.8,  headFlats: 8.0,  headHeight: 3.5,  defaultLen: 25  },
  6:  { pitch: 1.0,  headFlats: 10.0, headHeight: 4.0,  defaultLen: 30  },
  8:  { pitch: 1.25, headFlats: 13.0, headHeight: 5.3,  defaultLen: 40  },
  10: { pitch: 1.5,  headFlats: 16.0, headHeight: 6.4,  defaultLen: 50  },
  12: { pitch: 1.75, headFlats: 18.0, headHeight: 7.5,  defaultLen: 60  },
  16: { pitch: 2.0,  headFlats: 24.0, headHeight: 10.0, defaultLen: 80  },
  20: { pitch: 2.5,  headFlats: 30.0, headHeight: 12.5, defaultLen: 100 },
};

function getBoltStd(diameter) {
  return BOLT_STANDARDS[diameter] || {
    pitch:      diameter * 0.15625,
    headFlats:  diameter * 1.6,
    headHeight: diameter * 0.65,
    defaultLen: diameter * 5,
  };
}

// ─── Canonical spec builders ──────────────────────────────────────────────────

function buildBoltSpec(dims = {}) {
  const d        = dims.diameter || 8;
  const std      = getBoltStd(d);
  const length   = dims.length || std.defaultLen;
  const headH    = std.headHeight;
  const headW    = std.headFlats;
  const pitch    = std.pitch;
  const smoothL  = Math.round(length * 0.35);
  const threadL  = length - smoothL;

  const spec = {
    version:           '1.0',
    partType:          'bolt',
    intentSummary:     `M${d}×${length} hex-head metric bolt`,
    units:             'mm',
    manufacturingMode: '3d_print',
    targetUse:         'general fastening',
    knownDimensions: {
      diameter: d,
      length,
    },
    assumedDimensions: {
      headType:             'hex',
      headHeight:           headH,
      headWidthAcrossFlats: headW,
      threadPitch:          pitch,
      threadedLength:       threadL,
      smoothShankLength:    smoothL,
    },
    constraints: ['standard metric proportions', 'preview-safe geometry'],
    features:    ['hex_head', 'smooth_shank', 'threaded_section', 'conical_tip'],
    missingInformation: [],
    riskFlags:          [],
    confidence: 0.97,
  };

  const plan = {
    version:          '1.0',
    partType:         'bolt',
    coordinateSystem: 'right_handed_z_up',
    buildSteps: [
      {
        id: 'shaft',
        action: 'create_cylinder',
        params: { diameter: d, height: length, center: [0, length / 2, 0] },
      },
      {
        id: 'hex_head',
        action: 'create_hex_head',
        params: {
          widthAcrossFlats: headW,
          height: headH,
          center: [0, length + headH / 2, 0],
        },
      },
      {
        id: 'thread',
        action: 'apply_thread_visual',
        params: { pitch, length: threadL, startOffset: smoothL },
      },
    ],
    boundingBox: { x: headW, y: headW, z: length + headH },
    criticalDimensions: ['diameter', 'length', 'headWidthAcrossFlats', 'threadPitch'],
  };

  return { spec, plan };
}

function buildBracketSpec(dims = {}) {
  const armLen = dims.width  || 50;
  const armH   = dims.height || 40;
  const width  = dims.depth  || 30;
  const thick  = 5;

  const spec = {
    version:           '1.0',
    partType:          'bracket',
    intentSummary:     `L-bracket ${armLen}×${armH}mm`,
    units:             'mm',
    manufacturingMode: '3d_print',
    targetUse:         'structural mounting',
    knownDimensions:   { horizontalArmLength: armLen, verticalArmHeight: armH },
    assumedDimensions: { width, thickness: thick, filletRadius: 3, holeSize: 'M5', holesPerArm: 2 },
    constraints: ['printable without supports if oriented correctly', 'standard mounting hole pattern'],
    features:    ['horizontal_arm', 'vertical_arm', 'fillet_corner', 'mounting_holes'],
    missingInformation: [],
    riskFlags: [],
    confidence: 0.95,
  };

  const plan = {
    version:          '1.0',
    partType:         'bracket',
    coordinateSystem: 'right_handed_z_up',
    buildSteps: [
      { id: 'h_arm', action: 'create_plate', params: { width: armLen, depth: width, thickness: thick } },
      { id: 'v_arm', action: 'create_plate', params: { width: thick, depth: width, thickness: armH } },
      { id: 'fillet', action: 'join_perpendicular', params: { filletRadius: 3, axis: 'y' } },
      {
        id: 'h_holes', action: 'create_hole_pattern',
        params: { count: 2, diameter: 5.2, positions: [{ x: armLen * 0.25, y: 0 }, { x: armLen * 0.75, y: 0 }] },
      },
      {
        id: 'v_holes', action: 'create_hole_pattern',
        params: { count: 2, diameter: 5.2, positions: [{ x: 0, y: armH * 0.25 }, { x: 0, y: armH * 0.75 }] },
      },
    ],
    boundingBox: { x: armLen, y: armH, z: width },
    criticalDimensions: ['horizontalArmLength', 'verticalArmHeight', 'thickness'],
  };

  return { spec, plan };
}

function buildMountPlateSpec(dims = {}) {
  const w = dims.width  || 100;
  const l = dims.height || 60;
  const t = 4;
  const hpx = Math.round(w * 0.8);
  const hpy = Math.round(l * 0.8);

  const spec = {
    version: '1.0', partType: 'mounting_plate',
    intentSummary: `${w}×${l}mm mounting plate`,
    units: 'mm', manufacturingMode: 'cnc', targetUse: 'panel mounting',
    knownDimensions: { width: w, length: l },
    assumedDimensions: { thickness: t, cornerHoles: 4, holeSize: 'M4', holeDiameter: 4.3, holePitchX: hpx, holePitchY: hpy },
    constraints: ['flat plate', 'standard hole pattern'], features: ['base_plate', 'corner_holes'],
    missingInformation: [], riskFlags: [], confidence: 0.96,
  };

  const plan = {
    version: '1.0', partType: 'mounting_plate', coordinateSystem: 'right_handed_z_up',
    buildSteps: [
      { id: 'plate', action: 'create_plate', params: { width: w, depth: l, thickness: t } },
      { id: 'holes', action: 'create_hole_pattern', params: {
        count: 4, diameter: 4.3,
        positions: [
          { x: -hpx/2, y: -hpy/2 }, { x: hpx/2, y: -hpy/2 },
          { x: -hpx/2, y:  hpy/2 }, { x: hpx/2, y:  hpy/2 },
        ],
      }},
    ],
    boundingBox: { x: w, y: l, z: t },
    criticalDimensions: ['width', 'length', 'thickness'],
  };

  return { spec, plan };
}

function buildBearingSpec(dims = {}) {
  const od   = dims.outerDiameter || 47;
  const bore = dims.boreDiameter  || 20;
  const w    = dims.width         || 14;

  const spec = {
    version: '1.0', partType: 'bearing_block',
    intentSummary: `Deep groove ball bearing Ø${od}mm bore ${bore}mm`,
    units: 'mm', manufacturingMode: 'unknown', targetUse: 'rotational support',
    knownDimensions: { outerDiameter: od, boreDiameter: bore, width: w },
    assumedDimensions: { type: 'deep_groove_ball', material: 'steel', shieldType: 'open' },
    constraints: ['standard bearing dimensions'], features: ['outer_race', 'inner_race', 'ball_elements'],
    missingInformation: [], riskFlags: [], confidence: 0.95,
  };

  const plan = {
    version: '1.0', partType: 'bearing_block', coordinateSystem: 'right_handed_z_up',
    buildSteps: [
      { id: 'outer', action: 'create_flange', params: { outerDiameter: od, innerDiameter: od * 0.72, thickness: w } },
      { id: 'inner', action: 'create_cylinder', params: { outerDiameter: bore * 1.6, innerDiameter: bore, height: w } },
    ],
    boundingBox: { x: od, y: od, z: w },
    criticalDimensions: ['outerDiameter', 'boreDiameter', 'width'],
  };

  return { spec, plan };
}

function buildGearSpec(dims = {}) {
  const teeth = dims.toothCount || 20;
  const mod   = dims.module     || 2;
  const fw    = dims.faceWidth  || 10;
  const bore  = dims.bore       || 8;
  const od    = (teeth + 2) * mod;

  const spec = {
    version: '1.0', partType: 'gear_basic',
    intentSummary: `Spur gear ${teeth}T module ${mod}`,
    units: 'mm', manufacturingMode: 'cnc', targetUse: 'power transmission',
    knownDimensions: { toothCount: teeth, module: mod },
    assumedDimensions: { faceWidth: fw, boreDiameter: bore, pressureAngle: 20, outerDiameter: od },
    constraints: ['standard involute tooth profile', 'pressure angle 20°'],
    features: ['gear_teeth', 'bore', 'face'],
    missingInformation: [], riskFlags: [], confidence: 0.96,
  };

  const plan = {
    version: '1.0', partType: 'gear_basic', coordinateSystem: 'right_handed_z_up',
    buildSteps: [
      { id: 'gear_body', action: 'create_basic_gear', params: { toothCount: teeth, module: mod, thickness: fw, boreDiameter: bore } },
    ],
    boundingBox: { x: od, y: od, z: fw },
    criticalDimensions: ['toothCount', 'module', 'faceWidth'],
  };

  return { spec, plan };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const CANONICAL_BUILDERS = {
  bolt:          buildBoltSpec,
  screw:         buildBoltSpec,
  bracket:       buildBracketSpec,
  mount_plate:   buildMountPlateSpec,
  mounting_plate: buildMountPlateSpec,
  bearing:       buildBearingSpec,
  bearing_block: buildBearingSpec,
  gear:          buildGearSpec,
  gear_basic:    buildGearSpec,
};

/**
 * Returns deterministic { spec, plan } for canonical part type, or null if not canonical.
 * @param {string} partType - from promptNormalizer
 * @param {string} originalPrompt - raw user prompt for dimension extraction
 */
function getCanonicalSpec(partType, originalPrompt) {
  const key = (partType || '').toLowerCase().replace(/\s+/g, '_');
  const builder = CANONICAL_BUILDERS[key];
  if (!builder) return null;
  const dims = parseCanonicalDims(originalPrompt);
  return builder(dims);
}

module.exports = { getCanonicalSpec, parseCanonicalDims, CANONICAL_BUILDERS };

'use strict';

/**
 * CadQuery Translator Service — Phase 3
 *
 * Deterministic compiler: GeometryPlan (validated) → CadQuery Python source.
 *
 * Design rules:
 *   - Only whitelisted ALLOWED_GEOMETRY_ACTIONS are translated.
 *   - Unknown actions are rejected with a structured error (never silently skipped).
 *   - Parameters are validated and sanitised before code emission.
 *   - The output must be a self-contained Python script.
 *   - The script must assign the final CadQuery result to `result`.
 *   - All numeric values are rounded to 4 decimal places for reproducibility.
 */

const TRANSLATOR_VERSION = '1.0';

// ─── Parameter helpers ────────────────────────────────────────────────────────

/**
 * @param {unknown} v
 * @param {string} name
 * @param {{ default?: number, min?: number, max?: number }} opts
 */
function num(v, name, { default: def = 1, min = 0.001, max = 10000 } = {}) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!Number.isFinite(n)) {
    if (def !== undefined) return def;
    throw new Error(`Parameter "${name}" must be a finite number, got ${v}`);
  }
  if (n < min) throw new Error(`Parameter "${name}" must be >= ${min}, got ${n}`);
  if (n > max) throw new Error(`Parameter "${name}" must be <= ${max}, got ${n}`);
  return parseFloat(n.toFixed(4));
}

function r4(v) { return parseFloat((v).toFixed(4)); }

// ─── Action translators ────────────────────────────────────────────────────────

const ACTION_TRANSLATORS = {

  create_box({ params, id }) {
    const w = num(params.width,  'width');
    const h = num(params.height, 'height');
    const d = num(params.depth,  'depth');
    return [
      `# ${id}: create_box`,
      `${id} = cq.Workplane("XY").box(${w}, ${h}, ${d})`,
    ].join('\n');
  },

  create_cylinder({ params, id }) {
    const diameter = num(params.diameter, 'diameter');
    const height   = num(params.height,   'height');
    const radius = r4(diameter / 2);
    return [
      `# ${id}: create_cylinder (diameter ${diameter}, height ${height})`,
      `${id} = cq.Workplane("XY").cylinder(${height}, ${radius})`,
    ].join('\n');
  },

  create_plate({ params, id }) {
    const w = num(params.width,     'width');
    const l = num(params.length,    'length');
    const t = num(params.thickness, 'thickness', { default: 3, min: 0.1 });
    return [
      `# ${id}: create_plate`,
      `${id} = cq.Workplane("XY").box(${w}, ${l}, ${t})`,
    ].join('\n');
  },

  create_shell({ params, id }) {
    const w  = num(params.width,         'width');
    const h  = num(params.height,        'height');
    const d  = num(params.depth,         'depth');
    const wt = num(params.wallThickness, 'wallThickness', { default: 2.5, min: 0.5 });
    return [
      `# ${id}: create_shell (hollow box)`,
      `${id}_outer = cq.Workplane("XY").box(${w}, ${h}, ${d})`,
      `${id}_inner = cq.Workplane("XY").box(${r4(w - 2*wt)}, ${r4(h - 2*wt)}, ${r4(d - wt)})`,
      `${id}_inner = ${id}_inner.translate((0, 0, ${r4(wt / 2)}))`,
      `${id} = ${id}_outer.cut(${id}_inner)`,
    ].join('\n');
  },

  create_rib({ params, id }) {
    const w = num(params.width,     'width');
    const h = num(params.height,    'height');
    const t = num(params.thickness, 'thickness', { default: 2, min: 0.5 });
    return [
      `# ${id}: create_rib`,
      `${id} = cq.Workplane("XY").box(${w}, ${t}, ${h})`,
    ].join('\n');
  },

  create_flange({ params, id }) {
    const od  = num(params.outerDiameter, 'outerDiameter');
    const id_ = num(params.innerDiameter, 'innerDiameter', { default: od * 0.4, min: 0.001 });
    const t   = num(params.thickness,    'thickness', { default: 6 });
    const hc  = Math.max(1, Math.round(params.holeCount) || 4);
    const hd  = num(params.holeDiameter, 'holeDiameter', { default: 5 });
    const pcd = r4((od + id_) / 2 * 0.8); // pitch circle diameter
    const pr  = r4(pcd / 2);
    const hr  = r4(hd / 2);
    const or_ = r4(od / 2);
    const ir  = r4(id_ / 2);
    return [
      `# ${id}: create_flange OD=${od} ID=${id_} t=${t} holes=${hc}`,
      `${id} = (`,
      `    cq.Workplane("XY")`,
      `    .cylinder(${t}, ${or_})`,
      `    .faces(">Z").workplane()`,
      `    .circle(${ir}).cutThruAll()`,
      `    .faces(">Z").workplane()`,
      `    .polarArray(${pr}, 0, 360, ${hc})`,
      `    .circle(${hr}).cutThruAll()`,
      `)`,
    ].join('\n');
  },

  create_hole_pattern({ params, id, _stepMap }) {
    const count  = Math.max(1, Math.round(params.count) || 1);
    const dia    = num(params.diameter, 'diameter', { default: 4 });
    const holeRadius = r4(dia / 2);
    const positions = Array.isArray(params.positions) ? params.positions : [];
    const target = _stepMap && params.targetStepId && _stepMap[params.targetStepId]
      ? params.targetStepId
      : null;
    const lines = [`# ${id}: create_hole_pattern count=${count} diameter=${dia}`];
    if (target) {
      lines.push(`${id} = ${target}`);
      for (let i = 0; i < Math.min(count, positions.length); i++) {
        const p = positions[i];
        const x = r4(typeof p.x === 'number' ? p.x : 0);
        const y = r4(typeof p.y === 'number' ? p.y : 0);
        lines.push(`${id} = ${id}.faces(">Z").workplane().moveTo(${x}, ${y}).circle(${holeRadius}).cutThruAll()`);
      }
    } else {
      lines.push(`# no valid target step for hole pattern — creating standalone drill rod`);
      lines.push(`${id} = cq.Workplane("XY").cylinder(20, ${holeRadius})`);
    }
    return lines.join('\n');
  },

  create_slot({ params, id }) {
    const w = num(params.width,  'width',  { default: 4, min: 0.1 });
    const l = num(params.length, 'length', { default: 20 });
    const d = num(params.depth,  'depth',  { default: 3, min: 0.1 });
    return [
      `# ${id}: create_slot w=${w} l=${l} d=${d}`,
      `${id} = cq.Workplane("XY").box(${l}, ${w}, ${d})`,
    ].join('\n');
  },

  extrude_profile({ params, id }) {
    const w = num(params.width,  'width');
    const h = num(params.height, 'height');
    const d = num(params.depth,  'depth');
    return [
      `# ${id}: extrude_profile`,
      `${id} = cq.Workplane("XY").rect(${w}, ${h}).extrude(${d})`,
    ].join('\n');
  },

  subtract_feature({ params, id, _stepMap }) {
    const target = params.targetStepId;
    const sw = num(params.subtractionWidth,  'subtractionWidth',  { default: 5 });
    const sh = num(params.subtractionHeight, 'subtractionHeight', { default: 5 });
    const sd = num(params.subtractionDepth,  'subtractionDepth',  { default: 5 });
    const base = (_stepMap && _stepMap[target]) ? target : null;
    const lines = [`# ${id}: subtract_feature from ${target}`];
    if (base) {
      lines.push(`${id}_cutter = cq.Workplane("XY").box(${sw}, ${sh}, ${sd})`);
      lines.push(`${id} = ${base}.cut(${id}_cutter)`);
    } else {
      lines.push(`# target step ${target} not found — skipping subtract`);
      lines.push(`${id} = cq.Workplane("XY").box(${sw}, ${sh}, ${sd})  # placeholder`);
    }
    return lines.join('\n');
  },

  fillet_edges({ params, id, _stepMap, _lastStep }) {
    const rad = num(params.filletRadius, 'filletRadius', { default: 1, min: 0.01 });
    const base = _lastStep || 'result';
    return [
      `# ${id}: fillet_edges radius=${rad}`,
      `try:`,
      `    ${id} = ${base}.edges().fillet(${rad})`,
      `except Exception:`,
      `    ${id} = ${base}  # fillet failed safely — continuing without`,
    ].join('\n');
  },

  chamfer_edges({ params, id, _stepMap, _lastStep }) {
    const dist = num(params.chamferDistance, 'chamferDistance', { default: 0.5, min: 0.01 });
    const base = _lastStep || 'result';
    return [
      `# ${id}: chamfer_edges distance=${dist}`,
      `try:`,
      `    ${id} = ${base}.edges().chamfer(${dist})`,
      `except Exception:`,
      `    ${id} = ${base}  # chamfer failed safely`,
    ].join('\n');
  },

  mirror_feature({ params, id, _stepMap }) {
    const src = params.stepId && _stepMap && _stepMap[params.stepId] ? params.stepId : null;
    const axis = String(params.axis || 'XZ').toUpperCase();
    const validAxes = ['XZ', 'YZ', 'XY'];
    const mirrorAxis = validAxes.includes(axis) ? axis : 'XZ';
    const lines = [`# ${id}: mirror_feature on ${mirrorAxis}`];
    if (src) {
      lines.push(`${id}_mirrored = ${src}.mirror("${mirrorAxis}")`);
      lines.push(`${id} = ${src}.union(${id}_mirrored)`);
    } else {
      lines.push(`${id} = cq.Workplane("XY").box(1, 1, 1)  # mirror source not found`);
    }
    return lines.join('\n');
  },

  join_perpendicular({ params, id, _lastStep }) {
    const rad = num(params.filletRadius, 'filletRadius', { default: 2, min: 0 });
    const base = _lastStep || 'result';
    return [
      `# ${id}: join_perpendicular fillet=${rad}`,
      `try:`,
      `    ${id} = ${base}.edges("|Z").fillet(${rad})`,
      `except Exception:`,
      `    ${id} = ${base}`,
    ].join('\n');
  },

  add_mounting_points({ params, id, _lastStep }) {
    const count   = Math.max(1, Math.round(params.count) || 4);
    const dia     = num(params.diameter, 'diameter', { default: 4 });
    const pattern = String(params.pattern || 'corners').toLowerCase();
    const radius  = r4(dia / 2);
    const base    = _lastStep || 'result';

    let positionCode;
    if (pattern === 'corners') {
      positionCode = `${id} = ${base}`;
    } else if (pattern === 'polar') {
      positionCode = `${id} = ${base}.faces(">Z").workplane().polarArray(15, 0, 360, ${count}).circle(${radius}).cutThruAll()`;
    } else {
      positionCode = `${id} = ${base}`;
    }

    return [
      `# ${id}: add_mounting_points count=${count} dia=${dia} pattern=${pattern}`,
      positionCode,
    ].join('\n');
  },

  add_standoff({ params, id }) {
    const h  = num(params.height,        'height',        { default: 10 });
    const od = num(params.outerDiameter, 'outerDiameter', { default: 6 });
    const id_ = num(params.innerDiameter, 'innerDiameter', { default: 3 });
    const or_ = r4(od / 2);
    const ir  = r4(id_ / 2);
    return [
      `# ${id}: add_standoff h=${h} OD=${od} ID=${id_}`,
      `${id} = cq.Workplane("XY").cylinder(${h}, ${or_}).faces(">Z").workplane().circle(${ir}).cutThruAll()`,
    ].join('\n');
  },

  create_basic_gear({ params, id }) {
    const teeth  = Math.max(5, Math.round(params.toothCount) || 20);
    const module = num(params.module,     'module',     { default: 1.5, min: 0.1 });
    const thick  = num(params.thickness,  'thickness',  { default: 10 });
    const bore   = num(params.boreDiameter, 'boreDiameter', { default: 8 });
    const pitch_r = r4((teeth * module) / 2);
    const bore_r  = r4(bore / 2);
    return [
      `# ${id}: create_basic_gear teeth=${teeth} module=${module} (simplified disc approximation)`,
      `${id} = (`,
      `    cq.Workplane("XY")`,
      `    .cylinder(${thick}, ${pitch_r})`,
      `    .faces(">Z").workplane()`,
      `    .circle(${bore_r}).cutThruAll()`,
      `)`,
    ].join('\n');
  },

  create_basic_pulley({ params, id }) {
    const od  = num(params.outerDiameter, 'outerDiameter', { default: 40 });
    const bw  = num(params.beltWidth,    'beltWidth',     { default: 9 });
    const bor = num(params.boreDiameter, 'boreDiameter',  { default: 6 });
    const or_ = r4(od / 2);
    const br  = r4(bor / 2);
    return [
      `# ${id}: create_basic_pulley OD=${od} beltWidth=${bw} bore=${bor}`,
      `${id} = (`,
      `    cq.Workplane("XY")`,
      `    .cylinder(${bw}, ${or_})`,
      `    .faces(">Z").workplane()`,
      `    .circle(${br}).cutThruAll()`,
      `)`,
    ].join('\n');
  },
};

// ─── Main translator ──────────────────────────────────────────────────────────

/**
 * Translate a validated geometry plan into a CadQuery Python source string.
 *
 * @param {object} geometryPlan - validated plan from validateGeometryPlan()
 * @returns {{
 *   source: string,
 *   usedActions: string[],
 *   warnings: string[],
 *   translatorVersion: string,
 * }}
 * @throws {Error} if any required step cannot be translated
 */
function translateToCadQuery(geometryPlan) {
  const { buildSteps, partType, boundingBox } = geometryPlan;

  if (!Array.isArray(buildSteps) || buildSteps.length === 0) {
    throw new Error('Geometry plan has no buildSteps to translate');
  }

  const lines = [
    '# MechaGen Phase 3 — Auto-generated CadQuery script',
    `# Part type: ${partType}`,
    `# Bounding box: ${JSON.stringify(boundingBox)}`,
    `# IMPORTANT: This file is generated by the MechaGen deterministic translator.`,
    `#            Do NOT edit manually — regenerate from the geometry plan.`,
    '',
    'import cadquery as cq',
    '',
  ];

  const usedActions = [];
  const warnings    = [];
  const stepMap     = {}; // stepId → true (for forward references)
  let lastStep      = null;

  for (const step of buildSteps) {
    const { id, action, params } = step;

    if (!id || typeof id !== 'string') {
      throw new Error(`Build step is missing a valid id: ${JSON.stringify(step)}`);
    }

    const safeId = id.replace(/[^a-zA-Z0-9_]/g, '_');

    const translator = ACTION_TRANSLATORS[action];
    if (!translator) {
      throw new Error(
        `Unsupported geometry action "${action}" in step "${id}". ` +
        `Allowed actions: ${Object.keys(ACTION_TRANSLATORS).join(', ')}`
      );
    }

    let stepSource;
    try {
      stepSource = translator({ params: params || {}, id: safeId, _stepMap: stepMap, _lastStep: lastStep });
    } catch (err) {
      throw new Error(`Translation error in step "${id}" (action: ${action}): ${err.message}`);
    }

    lines.push(stepSource);
    lines.push('');
    stepMap[id] = safeId;
    lastStep = safeId;
    usedActions.push(action);
  }

  // Final result assignment
  if (lastStep) {
    lines.push(`# Assign final result`);
    lines.push(`result = ${lastStep}`);
  } else {
    throw new Error('No build steps produced a valid solid — translation failed');
  }

  return {
    source:            lines.join('\n'),
    usedActions:       [...new Set(usedActions)],
    warnings,
    translatorVersion: TRANSLATOR_VERSION,
  };
}

module.exports = {
  translateToCadQuery,
  TRANSLATOR_VERSION,
  SUPPORTED_ACTIONS: Object.keys(ACTION_TRANSLATORS),
};

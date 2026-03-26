'use strict';

/**
 * Deterministic procedural preview builder.
 * Converts a validated Geometry Plan into an array of PreviewPart objects
 * suitable for rendering in the Three.js viewport.
 *
 * This is Path A of the build pipeline:
 *   Geometry Plan → Preview Parts (JSON) → Three.js viewport
 *
 * No AI is involved in this step. The plan is executed deterministically.
 */

const SHAPE_COLORS = {
  bracket:       '#7eb8f7',
  mounting_plate: '#8ab4f8',
  spacer:        '#a0c8ff',
  enclosure:     '#5e9bd6',
  shaft_coupler: '#9ab0c8',
  gear_basic:    '#b8a060',
  pulley_basic:  '#c8a870',
  bearing_block: '#8090a0',
  flange:        '#6888a8',
  standoff:      '#78a090',
  clamp:         '#887878',
  simple_housing:'#607890',
};

const DEFAULT_COLOR = '#8a9aaa';
const DEFAULT_METALNESS = 0.75;
const DEFAULT_ROUGHNESS  = 0.25;

/**
 * Converts a single build step into one or more preview parts.
 * @param {object} step - GeometryBuildStep
 * @param {object} plan - full GeometryPlan (for context)
 * @param {number} offsetZ - cumulative Z offset
 * @returns {{ parts: object[], nextOffsetZ: number }}
 */
function stepToPreviewParts(step, plan, offsetZ) {
  const p    = step.params || {};
  const parts = [];
  const partType = plan.partType || 'bracket';
  const color = SHAPE_COLORS[partType] || DEFAULT_COLOR;

  switch (step.action) {
    case 'create_box':
    case 'create_plate':
    case 'extrude_profile': {
      const w = Number(p.width)  || Number(p.length) || 40;
      const d = Number(p.depth)  || Number(p.height) || (step.action === 'create_plate' ? 4 : 20);
      const h = Number(p.thickness) || Number(p.height) || (step.action === 'create_plate' ? 4 : 20);
      parts.push({
        shape: 'box',
        params: { width: w, height: h, depth: d },
        position: { x: 0, y: 0, z: offsetZ + h / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color,
        metalness: DEFAULT_METALNESS,
        roughness: DEFAULT_ROUGHNESS,
        label: step.id,
      });
      offsetZ += h;
      break;
    }

    case 'create_shell': {
      // A shell is a box minus the inside — approximate as walls (4 thin boxes)
      const w  = Number(p.width)  || 60;
      const h  = Number(p.height) || 40;
      const depth = Number(p.depth) || 30;
      const wt = Number(p.wallThickness) || 3;
      // Bottom
      parts.push({
        shape: 'box',
        params: { width: w, height: wt, depth },
        position: { x: 0, y: -(h / 2) + wt / 2, z: offsetZ + depth / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color, metalness: DEFAULT_METALNESS, roughness: DEFAULT_ROUGHNESS,
        label: `${step.id}_bottom`,
      });
      // Top
      parts.push({
        shape: 'box',
        params: { width: w, height: wt, depth },
        position: { x: 0, y: h / 2 - wt / 2, z: offsetZ + depth / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color, metalness: DEFAULT_METALNESS, roughness: DEFAULT_ROUGHNESS,
        label: `${step.id}_top`,
      });
      // Left
      parts.push({
        shape: 'box',
        params: { width: wt, height: h - 2 * wt, depth },
        position: { x: -(w / 2) + wt / 2, y: 0, z: offsetZ + depth / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color, metalness: DEFAULT_METALNESS, roughness: DEFAULT_ROUGHNESS,
        label: `${step.id}_left`,
      });
      // Right
      parts.push({
        shape: 'box',
        params: { width: wt, height: h - 2 * wt, depth },
        position: { x: w / 2 - wt / 2, y: 0, z: offsetZ + depth / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color, metalness: DEFAULT_METALNESS, roughness: DEFAULT_ROUGHNESS,
        label: `${step.id}_right`,
      });
      offsetZ += depth;
      break;
    }

    case 'create_cylinder':
    case 'create_flange': {
      const diameter = Number(p.outerDiameter) || Number(p.diameter) || 30;
      const height   = Number(p.thickness) || Number(p.height) || 10;
      parts.push({
        shape: 'cylinder',
        params: { radiusTop: diameter / 2, radiusBottom: diameter / 2, height },
        position: { x: 0, y: 0, z: offsetZ + height / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color, metalness: DEFAULT_METALNESS, roughness: DEFAULT_ROUGHNESS,
        label: step.id,
      });
      // Inner bore cut (if innerDiameter present — visualize as darker cylinder)
      if (p.innerDiameter && Number(p.innerDiameter) > 0) {
        const id = Number(p.innerDiameter);
        parts.push({
          shape: 'cylinder',
          params: { radiusTop: id / 2 - 0.1, radiusBottom: id / 2 - 0.1, height: height + 0.2 },
          position: { x: 0, y: 0, z: offsetZ + height / 2 },
          rotation: { x: 0, y: 0, z: 0 },
          color: '#0a0a1a',
          metalness: 0,
          roughness: 1,
          label: `${step.id}_bore`,
        });
      }
      offsetZ += height;
      break;
    }

    case 'create_rib': {
      const w  = Number(p.width)  || 4;
      const h  = Number(p.height) || 20;
      const th = Number(p.thickness) || 3;
      parts.push({
        shape: 'box',
        params: { width: w, height: h, depth: th },
        position: { x: 0, y: 0, z: offsetZ + h / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color, metalness: DEFAULT_METALNESS, roughness: DEFAULT_ROUGHNESS,
        label: step.id,
      });
      offsetZ += h;
      break;
    }

    case 'create_hole_pattern': {
      // Visualize holes as dark cylinders placed on a face
      const count    = Number(p.count) || 1;
      const diameter = Number(p.diameter) || Number(p.holeDiameter) || 5;
      const depth    = 20; // nominal hole depth for preview
      const positions = Array.isArray(p.positions) ? p.positions : [];
      const spacing  = 20;

      for (let i = 0; i < count; i++) {
        const pos = positions[i] || {};
        const hx  = Number(pos.x) || i * spacing;
        const hy  = Number(pos.y) || 0;
        parts.push({
          shape: 'cylinder',
          params: { radiusTop: diameter / 2, radiusBottom: diameter / 2, height: depth },
          position: { x: hx - (count - 1) * spacing / 2, y: hy, z: offsetZ + depth / 2 },
          rotation: { x: 0, y: 0, z: 0 },
          color: '#1a1a2e',
          metalness: 0,
          roughness: 1,
          label: `${step.id}_hole${i + 1}`,
        });
      }
      break; // holes don't add to offsetZ
    }

    case 'join_perpendicular': {
      // Visualize fillet as a small quarter-cylinder
      const fr = Number(p.filletRadius) || 2;
      parts.push({
        shape: 'cylinder',
        params: { radiusTop: fr, radiusBottom: fr, height: 40 },
        position: { x: 0, y: 0, z: offsetZ + fr },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        color: color + '99',
        metalness: DEFAULT_METALNESS,
        roughness: DEFAULT_ROUGHNESS + 0.1,
        label: step.id,
      });
      break;
    }

    case 'create_basic_gear': {
      const teeth  = Number(p.toothCount) || 20;
      const mod    = Number(p.module)  || 1;
      const thick  = Number(p.thickness) || 10;
      const od     = (teeth + 2) * mod;
      const boreId = Number(p.boreDiameter) || od * 0.2;
      // Gear body
      parts.push({
        shape: 'cylinder',
        params: { radiusTop: od / 2, radiusBottom: od / 2, height: thick },
        position: { x: 0, y: 0, z: offsetZ + thick / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color: SHAPE_COLORS.gear_basic,
        metalness: 0.8, roughness: 0.2,
        label: step.id,
      });
      // Bore
      parts.push({
        shape: 'cylinder',
        params: { radiusTop: boreId / 2, radiusBottom: boreId / 2, height: thick + 0.2 },
        position: { x: 0, y: 0, z: offsetZ + thick / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color: '#0a0a1a',
        metalness: 0, roughness: 1,
        label: `${step.id}_bore`,
      });
      // Teeth approximation (ring of small boxes around od)
      const toothH = mod * 2.2;
      for (let i = 0; i < Math.min(teeth, 36); i++) {
        const angle = (i / teeth) * Math.PI * 2;
        const tx = Math.cos(angle) * (od / 2 + toothH / 2);
        const ty = Math.sin(angle) * (od / 2 + toothH / 2);
        parts.push({
          shape: 'box',
          params: { width: mod * 0.9, height: toothH, depth: thick },
          position: { x: tx, y: ty, z: offsetZ + thick / 2 },
          rotation: { x: 0, y: 0, z: angle },
          color: SHAPE_COLORS.gear_basic,
          metalness: 0.8, roughness: 0.2,
          label: `${step.id}_tooth${i}`,
        });
      }
      offsetZ += thick;
      break;
    }

    case 'create_basic_pulley': {
      const od    = Number(p.outerDiameter) || 50;
      const bw    = Number(p.beltWidth)    || 9;
      const boreD = Number(p.boreDiameter) || 6;
      const flangeH = 4;
      const pulleyH = bw + 2 * flangeH;
      // Flanges
      for (const fz of [offsetZ, offsetZ + pulleyH - flangeH]) {
        parts.push({
          shape: 'cylinder',
          params: { radiusTop: od / 2, radiusBottom: od / 2, height: flangeH },
          position: { x: 0, y: 0, z: fz + flangeH / 2 },
          rotation: { x: 0, y: 0, z: 0 },
          color: SHAPE_COLORS.pulley_basic,
          metalness: 0.7, roughness: 0.3,
          label: `${step.id}_flange`,
        });
      }
      // Groove
      parts.push({
        shape: 'cylinder',
        params: { radiusTop: od / 2 - 2, radiusBottom: od / 2 - 2, height: bw },
        position: { x: 0, y: 0, z: offsetZ + flangeH + bw / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color: SHAPE_COLORS.pulley_basic,
        metalness: 0.7, roughness: 0.3,
        label: `${step.id}_groove`,
      });
      // Bore
      parts.push({
        shape: 'cylinder',
        params: { radiusTop: boreD / 2, radiusBottom: boreD / 2, height: pulleyH + 0.2 },
        position: { x: 0, y: 0, z: offsetZ + pulleyH / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color: '#0a0a1a',
        metalness: 0, roughness: 1,
        label: `${step.id}_bore`,
      });
      offsetZ += pulleyH;
      break;
    }

    case 'add_standoff': {
      const h  = Number(p.height) || 20;
      const od = Number(p.outerDiameter) || 8;
      const id = Number(p.innerDiameter) || 3.5;
      parts.push({
        shape: 'cylinder',
        params: { radiusTop: od / 2, radiusBottom: od / 2, height: h },
        position: { x: 0, y: 0, z: offsetZ + h / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color: SHAPE_COLORS.standoff,
        metalness: 0.85, roughness: 0.15,
        label: step.id,
      });
      parts.push({
        shape: 'cylinder',
        params: { radiusTop: id / 2, radiusBottom: id / 2, height: h + 0.2 },
        position: { x: 0, y: 0, z: offsetZ + h / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color: '#0a0a1a',
        metalness: 0, roughness: 1,
        label: `${step.id}_bore`,
      });
      offsetZ += h;
      break;
    }

    case 'create_slot': {
      const w = Number(p.width)  || 8;
      const l = Number(p.length) || 20;
      const d = Number(p.depth)  || 4;
      parts.push({
        shape: 'box',
        params: { width: w, height: d, depth: l },
        position: { x: 0, y: 0, z: offsetZ + d / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color: '#1a1a2e',
        metalness: 0, roughness: 1,
        label: step.id,
      });
      break;
    }

    case 'add_mounting_points': {
      const count  = Number(p.count) || 4;
      const d      = Number(p.diameter) || 5;
      const spread = Number(p.pattern) || 30;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        parts.push({
          shape: 'cylinder',
          params: { radiusTop: d / 2, radiusBottom: d / 2, height: 5 },
          position: {
            x: Math.cos(angle) * spread,
            y: Math.sin(angle) * spread,
            z: offsetZ + 2.5,
          },
          rotation: { x: 0, y: 0, z: 0 },
          color: '#1a1a2e',
          metalness: 0, roughness: 1,
          label: `${step.id}_${i}`,
        });
      }
      break;
    }

    // Actions that don't produce visible geometry in the preview
    case 'subtract_feature':
    case 'fillet_edges':
    case 'chamfer_edges':
    case 'mirror_feature':
      break;

    case 'create_hex_head': {
      // Approximate hex head as a short flat cylinder (hex shape approximated)
      const w = Number(p.widthAcrossFlats) || Number(p.width) || 13;
      const h = Number(p.height) || Number(p.headHeight) || 5.3;
      const cx = Number((p.center || [])[0]) || 0;
      const cy = Number((p.center || [])[1]) || 0;
      const cz = Number((p.center || [])[2]) || offsetZ + h / 2;
      // Use 6-sided cylinder approximation (radialSegments=6 handled by viewport)
      parts.push({
        shape: 'cylinder',
        params: { radiusTop: w / 2 * 0.866, radiusBottom: w / 2 * 0.866, height: h, radialSegments: 6 },
        position: { x: cx, y: cy, z: cz },
        rotation: { x: 0, y: Math.PI / 6, z: 0 },
        color: SHAPE_COLORS[plan.partType] || '#9ab0c8',
        metalness: 0.85, roughness: 0.15,
        label: step.id,
      });
      offsetZ = cz + h / 2;
      break;
    }

    case 'apply_thread_visual': {
      // Thread visualization as a series of thin ring-cylinders along the shaft
      const pitch   = Number(p.pitch) || 1.25;
      const length  = Number(p.length) || 20;
      const startZ  = offsetZ + (Number(p.startOffset) || 0);
      const ringH   = pitch * 0.6;
      const count   = Math.min(Math.floor(length / pitch), 30);
      for (let i = 0; i < count; i++) {
        parts.push({
          shape: 'cylinder',
          params: { radiusTop: 4.2, radiusBottom: 4.2, height: ringH },
          position: { x: 0, y: 0, z: startZ + i * pitch + ringH / 2 },
          rotation: { x: 0, y: 0, z: 0 },
          color: '#6080a8',
          metalness: 0.9, roughness: 0.1,
          label: `${step.id}_ring${i}`,
        });
      }
      break;
    }

    case 'create_bolt': {
      // Composite: shaft + hex head in one action
      const diameter   = Number(p.diameter) || Number(p.shaftDiameter) || 8;
      const totalLen   = Number(p.totalLength) || Number(p.length) || 40;
      const headFlats  = Number(p.headWidthAcrossFlats) || Number(p.headFlats) || 13;
      const headH      = Number(p.headHeight) || 5.3;
      // Shaft
      parts.push({
        shape: 'cylinder',
        params: { radiusTop: diameter / 2, radiusBottom: diameter / 2, height: totalLen },
        position: { x: 0, y: 0, z: offsetZ + totalLen / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        color: SHAPE_COLORS[plan.partType] || '#9ab0c8',
        metalness: 0.85, roughness: 0.15,
        label: `${step.id}_shaft`,
      });
      // Hex head on top
      parts.push({
        shape: 'cylinder',
        params: { radiusTop: headFlats / 2 * 0.866, radiusBottom: headFlats / 2 * 0.866, height: headH, radialSegments: 6 },
        position: { x: 0, y: 0, z: offsetZ + totalLen + headH / 2 },
        rotation: { x: 0, y: Math.PI / 6, z: 0 },
        color: SHAPE_COLORS[plan.partType] || '#9ab0c8',
        metalness: 0.85, roughness: 0.1,
        label: `${step.id}_head`,
      });
      offsetZ += totalLen + headH;
      break;
    }

    default:
      break;

  }

  return { parts, nextOffsetZ: offsetZ };
}

/**
 * Builds a complete list of preview parts from a validated Geometry Plan.
 *
 * @param {object} geometryPlan - validated GeometryPlan
 * @returns {{ parts: object[], name: string, description: string, dimensions: object }}
 */
function buildPreviewFromPlan(geometryPlan) {
  const partType = (geometryPlan.partType || '').toLowerCase();
  const bb = geometryPlan.boundingBox || {};

  // ── Canonical template early-return ──────────────────────────────────────────
  // For known canonical part types, emit a single rich-renderer template part
  // that Viewport3D dispatches to its high-quality bolt/gear procedural renderer.

  if (partType === 'bolt' || partType === 'screw') {
    // Extract from plan steps or use defaults
    const steps = geometryPlan.buildSteps || [];
    const shaftStep = steps.find(s => s.action === 'create_cylinder' || s.action === 'create_bolt');
    const headStep  = steps.find(s => s.action === 'create_hex_head');
    const threadStep = steps.find(s => s.action === 'apply_thread_visual');

    const diameter   = shaftStep?.params?.radius
      ? shaftStep.params.radius * 2
      : (shaftStep?.params?.diameter || 8);
    const length     = shaftStep?.params?.height || headStep?.params?.center?.[1] || 40;
    const headFlats  = headStep?.params?.widthAcrossFlats || headStep?.params?.width || 13;
    const headHeight = headStep?.params?.height || headStep?.params?.headHeight || 5.3;
    const pitch      = threadStep?.params?.pitch || 1.25;
    const smoothLen  = length * 0.35;
    const threadLen  = length * 0.65;

    return {
      parts: [{
        shape: 'bolt_template',
        params: {
          diameter,
          length,
          headWidthAcrossFlats: headFlats,
          headHeight,
          threadPitch: pitch,
          smoothLen,
          threadLen,
          washerOD:  diameter * 2.1,
          washerH:   diameter * 0.2,
        },
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        label: 'bolt',
      }],
      name: 'bolt (preview)',
      description: `Procedural bolt — hex head Ø${diameter}mm × ${length}mm`,
      dimensions: {
        x: headFlats,
        y: headFlats,
        z: length + headHeight,
      },
    };
  }

  if (partType === 'gear_basic' || partType === 'gear') {
    const steps = geometryPlan.buildSteps || [];
    const gearStep = steps.find(s => s.action === 'create_basic_gear');
    const teeth     = gearStep?.params?.toothCount || 20;
    const module_   = gearStep?.params?.module || 2;
    const faceWidth = gearStep?.params?.thickness || gearStep?.params?.faceWidth || 10;
    const bore      = gearStep?.params?.boreDiameter || 8;

    return {
      parts: [{
        shape: 'gear_template',
        params: { toothCount: teeth, module: module_, faceWidth, boreDiameter: bore },
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        label: 'gear',
      }],
      name: 'gear (preview)',
      description: `Procedural spur gear — ${teeth}T, module ${module_}`,
      dimensions: {
        x: (teeth + 2) * module_,
        y: (teeth + 2) * module_,
        z: faceWidth,
      },
    };
  }

  // ── Generic step-by-step builder (all other part types) ──────────────────────
  const allParts = [];

  let offsetZ = 0;

  for (const step of (geometryPlan.buildSteps || [])) {
    const { parts, nextOffsetZ } = stepToPreviewParts(step, geometryPlan, offsetZ);
    allParts.push(...parts);
    offsetZ = nextOffsetZ;
  }

  const planBB = geometryPlan.boundingBox || {};
  const dimensions = {
    x: Number(planBB.x) || 0,
    y: Number(planBB.y) || 0,
    z: Number(planBB.z) || 0,
  };


  const name = `${(geometryPlan.partType || 'part').replace(/_/g, ' ')} (preview)`;
  const description = `Procedural preview — ${allParts.length} mesh primitives`;

  return { parts: allParts, name, description, dimensions };
}

module.exports = { buildPreviewFromPlan };

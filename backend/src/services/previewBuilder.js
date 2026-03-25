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
  const allParts = [];
  let offsetZ = 0;

  for (const step of (geometryPlan.buildSteps || [])) {
    const { parts, nextOffsetZ } = stepToPreviewParts(step, geometryPlan, offsetZ);
    allParts.push(...parts);
    offsetZ = nextOffsetZ;
  }

  const bb = geometryPlan.boundingBox || {};
  const dimensions = {
    x: Number(bb.x) || 0,
    y: Number(bb.y) || 0,
    z: Number(bb.z) || 0,
  };

  const name = `${(geometryPlan.partType || 'part').replace(/_/g, ' ')} (preview)`;
  const description = `Procedural preview — ${allParts.length} mesh primitives`;

  return { parts: allParts, name, description, dimensions };
}

module.exports = { buildPreviewFromPlan };

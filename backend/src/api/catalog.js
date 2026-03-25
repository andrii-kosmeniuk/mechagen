'use strict';

/**
 * GET /api/catalog/part-types
 * Returns all supported canonical part types with their required parameter definitions.
 */

const PART_CATALOG = {
  bracket: {
    description: 'L-shaped structural bracket for mounting or joining',
    requiredOrDefaultable: ['width', 'height', 'thickness', 'holeCount', 'holeDiameter', 'edgeClearance'],
    optional: ['filletRadius', 'ribCount'],
    examplePrompt: 'Create a printable L-bracket for a 40x40 aluminum extrusion with two M5 mounting holes',
  },
  mounting_plate: {
    description: 'Flat plate with hole pattern for general mounting',
    requiredOrDefaultable: ['width', 'height', 'thickness', 'holePattern'],
    optional: ['counterboreDiameter', 'counterboreDepth'],
    examplePrompt: 'Design a flat mounting plate 100x60mm with four corner holes for CNC machining',
  },
  spacer: {
    description: 'Cylindrical spacer / standoff for axial separation',
    requiredOrDefaultable: ['outerDiameter', 'innerDiameter', 'length'],
    optional: ['chamfer'],
    examplePrompt: 'Create a spacer with 10mm inner diameter, 20mm outer diameter, and 30mm length',
  },
  enclosure: {
    description: 'Rectangular electronics or component enclosure box',
    requiredOrDefaultable: ['width', 'height', 'depth', 'wallThickness'],
    optional: ['lidThickness', 'ventSlots'],
    examplePrompt: 'Design a simple electronics enclosure for a 90x60x25mm PCB with 3mm walls',
  },
  shaft_coupler: {
    description: 'Rigid or flexible coupling between two shafts',
    requiredOrDefaultable: ['shaftDiameterA', 'shaftDiameterB', 'length'],
    optional: ['outerDiameter', 'setScrew'],
    examplePrompt: 'Design a rigid shaft coupler for 6mm and 8mm shafts, 25mm long',
  },
  gear_basic: {
    description: 'Basic spur gear with bore and optional keyway',
    requiredOrDefaultable: ['toothCount', 'thickness', 'boreDiameter'],
    optional: ['module', 'keyway', 'helix'],
    examplePrompt: 'Create a 20-tooth spur gear, module 1.5, 10mm wide, bore 8mm',
  },
  pulley_basic: {
    description: 'V-belt or flat belt pulley with flanges',
    requiredOrDefaultable: ['outerDiameter', 'beltWidth', 'boreDiameter'],
    optional: ['flangeThickness', 'grooveDepth'],
    examplePrompt: 'Create a basic pulley for a 6mm shaft and 9mm belt width',
  },
  bearing_block: {
    description: 'Housing block for a radial bearing',
    requiredOrDefaultable: ['bearingOuterDiameter', 'bearingWidth', 'mountHoleCount'],
    optional: ['wallThickness', 'flangeWidth'],
    examplePrompt: 'Design a bearing block for a 22mm OD bearing, 7mm wide, with 4 mounting holes',
  },
  flange: {
    description: 'Circular disc flange with bolt circle pattern',
    requiredOrDefaultable: ['outerDiameter', 'thickness', 'holeCount'],
    optional: ['innerDiameter', 'boltCircleDiameter', 'holeDiameter'],
    examplePrompt: 'Create a 60mm flange with 4 M4 bolt holes on a 48mm PCD, 5mm thick',
  },
  standoff: {
    description: 'Threaded standoff / hex pillar for PCB or panel mounting',
    requiredOrDefaultable: ['outerDiameter', 'innerDiameter', 'length'],
    optional: ['threadPitch', 'hexAcrossFlats'],
    examplePrompt: 'Design a 20mm M3 standoff with 5mm outer diameter',
  },
  clamp: {
    description: 'Split tube clamp or bar clamp',
    requiredOrDefaultable: ['innerDiameter', 'width', 'thickness'],
    optional: ['splitWidth', 'boltDiameter'],
    examplePrompt: 'Create a 25mm tube clamp, 15mm wide, for 3mm sheet metal',
  },
  simple_housing: {
    description: 'Generic mechanical housing or gearbox shell',
    requiredOrDefaultable: ['width', 'height', 'depth', 'wallThickness'],
    optional: ['shaftHoleDiameter', 'mountingFlangeThickness'],
    examplePrompt: 'Design a simple motor housing 60x60x80mm with 4mm walls and a 22mm shaft hole',
  },
};

const GOLDEN_PROMPTS = [
  { partType: 'bracket',         prompt: 'Create a printable L-bracket for a 40x40 aluminum extrusion with two M5 mounting holes.' },
  { partType: 'mounting_plate',  prompt: 'Design a flat mounting plate 100x60mm with four corner holes for CNC machining.' },
  { partType: 'spacer',          prompt: 'Create a spacer with 10mm inner diameter, 20mm outer diameter, and 30mm length.' },
  { partType: 'enclosure',       prompt: 'Design a simple electronics enclosure for a 90x60x25mm PCB with 3mm walls.' },
  { partType: 'pulley_basic',    prompt: 'Create a basic pulley for a 6mm shaft and 9mm belt width.' },
  { partType: 'gear_basic',      prompt: 'Design a 20-tooth spur gear, module 1.5, 10mm wide, 8mm bore diameter.' },
  { partType: 'shaft_coupler',   prompt: 'Rigid shaft coupler for 6mm to 8mm shaft, 25mm length.' },
  { partType: 'bearing_block',   prompt: 'Bearing block for a 6202 bearing (22mm OD, 7mm wide), with 4 M3 mounting holes.' },
  { partType: 'flange',          prompt: 'Standard pipe flange 80mm OD, 5mm thick, 4 bolt holes on 60mm PCD.' },
  { partType: 'standoff',        prompt: 'M3 brass standoff 15mm tall, 5.5mm OD for PCB mounting.' },
  { partType: 'clamp',           prompt: '25mm tube clamp, 15mm wide, printable in PETG.' },
  { partType: 'simple_housing',  prompt: 'Motor housing for a NEMA 17, 46x46mm face, 30mm deep, 3mm walls.' },
];

module.exports = async function catalogHandler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }
  return res.status(200).json({
    partTypes: PART_CATALOG,
    goldenPrompts: GOLDEN_PROMPTS,
    totalSupported: Object.keys(PART_CATALOG).length,
  });
};

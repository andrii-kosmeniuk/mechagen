'use strict';

/**
 * Prompt Normalizer — MechaGen
 *
 * Detects short/vague canonical part prompts ("bolt", "bracket", etc.)
 * and expands them into a structured spec-ready prompt with safe defaults.
 *
 * This runs BEFORE the AI spec generation step.
 * It does NOT replace the AI — it ensures the AI gets a useful, specific prompt.
 *
 * All defaults applied are stored in `assumedDefaults` for UI display.
 */

// ─── Canonical part templates ──────────────────────────────────────────────────

const CANONICAL_TEMPLATES = {
  bolt: {
    partType: 'bolt',
    expandedPrompt: (p = {}) => [
      `Hex-head metric bolt`,
      `Shaft diameter: ${p.diameter || 8}mm`,
      `Total length: ${p.length || 40}mm`,
      `Head type: hex`,
      `Head across flats: ${p.headFlats || 13}mm`,
      `Head height: ${p.headHeight || 5.3}mm`,
      `Thread pitch: ${p.pitch || 1.25}mm`,
      `Threaded length: ${p.threadedLength || 26}mm`,
      `Manufacturing: 3D print preview`,
    ].join(', '),
    assumedDefaults: (p = {}) => ({
      diameter:       p.diameter || 8,
      length:         p.length || 40,
      headType:       'hex',
      headFlats:      p.headFlats || 13,
      headHeight:     p.headHeight || 5.3,
      threadPitch:    p.pitch || 1.25,
      threadedLength: p.threadedLength || 26,
    }),
    manufacturingMode: '3d_print',
  },

  screw: {
    partType: 'bolt',
    expandedPrompt: (p = {}) => [
      `Hex-head metric machine screw`,
      `Shaft diameter: ${p.diameter || 5}mm`,
      `Total length: ${p.length || 20}mm`,
      `Head type: hex`,
      `Thread pitch: ${p.pitch || 0.8}mm`,
      `Fully threaded`,
    ].join(', '),
    assumedDefaults: (p = {}) => ({
      diameter:    p.diameter || 5,
      length:      p.length || 20,
      headType:    'hex',
      threadPitch: p.pitch || 0.8,
    }),
    manufacturingMode: '3d_print',
  },

  bracket: {
    partType: 'bracket',
    expandedPrompt: (p = {}) => [
      `L-bracket structural brace`,
      `Horizontal arm: ${p.armLength || 50}mm × ${p.thickness || 5}mm`,
      `Vertical arm: ${p.armHeight || 40}mm × ${p.thickness || 5}mm`,
      `Width: ${p.width || 30}mm`,
      `Mounting holes: 2× M5 on each arm`,
      `Fillet radius: ${p.fillet || 3}mm at inner corner`,
      `Manufacturing: 3D print PETG`,
    ].join(', '),
    assumedDefaults: (p = {}) => ({
      armLength:  p.armLength || 50,
      armHeight:  p.armHeight || 40,
      width:      p.width || 30,
      thickness:  p.thickness || 5,
      fillet:     p.fillet || 3,
      holeSize:   'M5',
      holesPerArm: 2,
    }),
    manufacturingMode: '3d_print',
  },

  bearing: {
    partType: 'bearing_block',
    expandedPrompt: (p = {}) => [
      `Deep groove ball bearing preview housing`,
      `Outer diameter: ${p.od || 47}mm`,
      `Inner bore: ${p.bore || 20}mm`,
      `Width: ${p.width || 14}mm`,
      `Simple cylindrical preview shape`,
    ].join(', '),
    assumedDefaults: (p = {}) => ({
      outerDiameter: p.od || 47,
      boreDiameter:  p.bore || 20,
      width:         p.width || 14,
    }),
    manufacturingMode: 'unknown',
  },

  mount_plate: {
    partType: 'mounting_plate',
    expandedPrompt: (p = {}) => [
      `Rectangular mounting plate`,
      `Width: ${p.width || 100}mm`,
      `Length: ${p.length || 60}mm`,
      `Thickness: ${p.thickness || 4}mm`,
      `4× M4 corner holes on ${p.holePitch || 80}×${p.holePitchY || 40}mm pattern`,
      `Material: CNC aluminum`,
    ].join(', '),
    assumedDefaults: (p = {}) => ({
      width:     p.width || 100,
      length:    p.length || 60,
      thickness: p.thickness || 4,
      holeSize:  'M4',
      holes:     4,
      holePitch: p.holePitch || 80,
    }),
    manufacturingMode: 'cnc',
  },

  gear: {
    partType: 'gear_basic',
    expandedPrompt: (p = {}) => [
      `Spur gear`,
      `Tooth count: ${p.teeth || 20}`,
      `Module: ${p.module || 2}mm`,
      `Face width: ${p.faceWidth || 10}mm`,
      `Bore diameter: ${p.bore || 8}mm`,
      `Pressure angle: 20°`,
    ].join(', '),
    assumedDefaults: (p = {}) => ({
      toothCount: p.teeth || 20,
      module:     p.module || 2,
      faceWidth:  p.faceWidth || 10,
      bore:       p.bore || 8,
    }),
    manufacturingMode: 'cnc',
  },

  pulley: {
    partType: 'pulley_basic',
    expandedPrompt: (p = {}) => [
      `Belt pulley`,
      `Outer diameter: ${p.od || 50}mm`,
      `Belt width: ${p.beltWidth || 9}mm`,
      `Bore: ${p.bore || 6}mm`,
      `FDM printable`,
    ].join(', '),
    assumedDefaults: (p = {}) => ({
      outerDiameter: p.od || 50,
      beltWidth:     p.beltWidth || 9,
      bore:          p.bore || 6,
    }),
    manufacturingMode: '3d_print',
  },

  spacer: {
    partType: 'spacer',
    expandedPrompt: (p = {}) => [
      `Cylindrical spacer`,
      `Outer diameter: ${p.od || 20}mm`,
      `Inner bore: ${p.bore || 10}mm`,
      `Length: ${p.length || 30}mm`,
    ].join(', '),
    assumedDefaults: (p = {}) => ({
      outerDiameter: p.od || 20,
      boreDiameter:  p.bore || 10,
      length:        p.length || 30,
    }),
    manufacturingMode: '3d_print',
  },

  enclosure: {
    partType: 'enclosure',
    expandedPrompt: (p = {}) => [
      `Electronics enclosure box`,
      `Width: ${p.width || 90}mm`,
      `Depth: ${p.depth || 60}mm`,
      `Height: ${p.height || 25}mm`,
      `Wall thickness: ${p.wall || 3}mm`,
      `PCB clearance inside`,
    ].join(', '),
    assumedDefaults: (p = {}) => ({
      width:     p.width || 90,
      depth:     p.depth || 60,
      height:    p.height || 25,
      wallThickness: p.wall || 3,
    }),
    manufacturingMode: '3d_print',
  },
};

// Alias map for common shorthand
const ALIASES = {
  'hex bolt':        'bolt',
  'hex screw':       'screw',
  'm8 bolt':         'bolt',
  'm5 bolt':         'bolt',
  'l bracket':       'bracket',
  'l-bracket':       'bracket',
  'mount plate':     'mount_plate',
  'mounting plate':  'mount_plate',
  'spur gear':       'gear',
  'ball bearing':    'bearing',
  'cylindrical bearing': 'bearing',
  'arm joint':       'bracket',  // close enough for canonical defaults
  'standoff':        'spacer',
};

// ─── Normalizer ────────────────────────────────────────────────────────────────

/**
 * @param {string} prompt - raw user prompt
 * @returns {{ normalized: boolean, expandedPrompt: string, partType: string|null, assumedDefaults: object, manufacturingMode: string }}
 */
function normalizePrompt(prompt) {
  const raw = (prompt || '').trim();
  const lower = raw.toLowerCase().replace(/[^\w\s-]/g, '').trim();

  // Resolve alias first
  const canonicalKey = ALIASES[lower] || lower.replace(/\s+/g, '_');

  // Direct match in CANONICAL_TEMPLATES
  const tpl = CANONICAL_TEMPLATES[canonicalKey] || CANONICAL_TEMPLATES[lower.replace(/\s+/g, '_')];

  if (tpl) {
    return {
      normalized:        true,
      expandedPrompt:    tpl.expandedPrompt(),
      partType:          tpl.partType,
      assumedDefaults:   tpl.assumedDefaults(),
      manufacturingMode: tpl.manufacturingMode,
    };
  }

  // Not a canonical short prompt — pass through unchanged
  return {
    normalized:        false,
    expandedPrompt:    raw,
    partType:          null,
    assumedDefaults:   {},
    manufacturingMode: null,
  };
}

module.exports = { normalizePrompt, CANONICAL_TEMPLATES, ALIASES };

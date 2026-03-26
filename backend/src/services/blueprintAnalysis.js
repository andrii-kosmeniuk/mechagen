'use strict';

/**
 * Blueprint Analysis Service — Phase 2 (hardened)
 *
 * Sends a blueprint image to the NVIDIA vision-capable model
 * and returns a structured, schema-validated JSON analysis record.
 *
 * Only operates on previewable images (png/jpg/webp).
 * PDFs and unpreviewable files return a low-confidence stub record.
 */

const { callNemotron } = require('../../lib/ai');    // kept for image path (aiClient wraps text only)
const { getBlueprint, readBlueprintFile, setBlueprintAnalysis } = require('./blueprintService');

// ── Schema ─────────────────────────────────────────────────────────────────────

const BLUEPRINT_ANALYSIS_VERSION = '1.0';

const ALLOWED_PART_TYPES = [
  'bracket','mounting_plate','spacer','enclosure','shaft_coupler',
  'gear_basic','pulley_basic','bearing_block','flange','standoff','clamp',
  'simple_housing','unknown',
];

/**
 * Validate and normalize a raw blueprint analysis object.
 * Fills missing fields with safe defaults.
 */
function validateAnalysis(raw) {
  if (!raw || typeof raw !== 'object') {
    return { value: null, errors: ['Analysis must be a JSON object'] };
  }

  const errors = [];

  const value = {
    version:              BLUEPRINT_ANALYSIS_VERSION,
    detectedPartType:     ALLOWED_PART_TYPES.includes(raw.detectedPartType)
                            ? raw.detectedPartType : 'unknown',
    observedDimensions:   typeof raw.observedDimensions === 'object' && !Array.isArray(raw.observedDimensions)
                            ? raw.observedDimensions : {},
    observedFeatures:     Array.isArray(raw.observedFeatures)
                            ? raw.observedFeatures.filter(f => typeof f === 'string')
                            : [],
    visibleHoleCount:     typeof raw.visibleHoleCount === 'number' ? Math.round(raw.visibleHoleCount) : 0,
    symmetryHints:        Array.isArray(raw.symmetryHints)
                            ? raw.symmetryHints.filter(s => typeof s === 'string')
                            : [],
    manufacturingHints:   Array.isArray(raw.manufacturingHints)
                            ? raw.manufacturingHints.filter(h => typeof h === 'string')
                            : [],
    textReadFromBlueprint:Array.isArray(raw.textReadFromBlueprint)
                            ? raw.textReadFromBlueprint.filter(t => typeof t === 'string')
                            : [],
    confidence:           typeof raw.confidence === 'number'
                            ? Math.max(0, Math.min(1, raw.confidence)) : 0.3,
    uncertainties:        Array.isArray(raw.uncertainties)
                            ? raw.uncertainties.filter(u => typeof u === 'string')
                            : ['Blueprint analysis is approximate — verify dimensions manually.'],
  };

  if (raw.detectedPartType && !ALLOWED_PART_TYPES.includes(raw.detectedPartType)) {
    errors.push(`detectedPartType "${raw.detectedPartType}" normalized to "unknown"`);
  }

  return { value, errors };
}

/**
 * System prompt for blueprint analysis.
 */
function getBlueprintAnalysisSystemPrompt() {
  return `You are a mechanical engineering vision AI.
Your task is to analyze an uploaded blueprint, sketch, technical drawing, or reference image
and return a SINGLE JSON object with ONLY the following fields:

{
  "detectedPartType": one of: bracket|mounting_plate|spacer|enclosure|shaft_coupler|gear_basic|pulley_basic|bearing_block|flange|standoff|clamp|simple_housing|unknown,
  "observedDimensions": { "fieldName": numericValueInMm },
  "observedFeatures": ["list of visible geometric features"],
  "visibleHoleCount": integer,
  "symmetryHints": ["e.g. bilateral symmetry", "radial 4-fold"],
  "manufacturingHints": ["e.g. CNC chamfer visible", "3D print overhang"],
  "textReadFromBlueprint": ["any dimension text or labels visible as strings"],
  "confidence": float between 0 and 1,
  "uncertainties": ["any caveats, ambiguous areas, or unclear dimensions"]
}

CRITICAL RULES:
- Output ONLY the JSON object. No prose, no markdown, no code fences.
- If you cannot confidently extract a dimension, DO NOT include it in observedDimensions.
- Use confidence < 0.5 if the image is low quality, hand-drawn, or ambiguous.
- ALL extracted values are OBSERVATIONS, not guaranteed facts.
- Never assume units — only report textReadFromBlueprint if mm/cm/in is visible.`;
}

/**
 * Build the user message for blueprint analysis.
 */
function buildBlueprintAnalysisMessage(fileType) {
  return `Analyze this ${fileType} blueprint/technical drawing. Return only the structured JSON analysis object as described.`;
}

/**
 * Extract JSON from AI response string.
 */
function extractJson(raw) {
  let s = (raw || '').trim();
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object found in AI response');
  s = s.slice(start, end + 1);
  return JSON.parse(s);
}

/**
 * Stub analysis for non-previewable files (e.g. PDF).
 */
function stubAnalysis() {
  return {
    version:               BLUEPRINT_ANALYSIS_VERSION,
    detectedPartType:      'unknown',
    observedDimensions:    {},
    observedFeatures:      [],
    visibleHoleCount:      0,
    symmetryHints:         [],
    manufacturingHints:    [],
    textReadFromBlueprint: [],
    confidence:            0.1,
    uncertainties:         [
      'File is not an image — AI visual analysis was skipped.',
      'Please use PNG, JPG, or WEBP for blueprint analysis.',
    ],
    analysisSource:        'stub_no_image',
  };
}

/**
 * Run blueprint analysis on a stored blueprint.
 *
 * @param {string} blueprintId
 * @returns {Promise<object>} validated analysis JSON
 */
async function analyzeBlueprintById(blueprintId) {
  const blueprint = getBlueprint(blueprintId);
  if (!blueprint) {
    throw Object.assign(new Error(`Blueprint ${blueprintId} not found`), { status: 404 });
  }

  // PDFs — return stub immediately
  if (!blueprint.previewable) {
    const stub = stubAnalysis();
    setBlueprintAnalysis(blueprintId, stub);
    return stub;
  }

  // Base64 encode the image
  const fileBuffer = readBlueprintFile(blueprintId);
  const base64     = fileBuffer.toString('base64');

  // Build combined prompt (system embedded in user message for compatibility)
  const systemPrompt = getBlueprintAnalysisSystemPrompt();
  const userMessage  = buildBlueprintAnalysisMessage(blueprint.fileType);
  const fullPrompt   = `SYSTEM:\n${systemPrompt}\n\nUSER:\n${userMessage}`;

  let raw;
  try {
    raw = await callNemotron(fullPrompt, base64, { highDetail: true, geometryParts: true });
  } catch (err) {
    throw new Error(`Blueprint AI call failed: ${err.message}`);
  }

  let parsed;
  try {
    parsed = extractJson(raw);
  } catch {
    // Retry once
    const retry = `${fullPrompt}\n\nCRITICAL: Return ONLY the JSON object. No prose, no markdown.`;
    const raw2 = await callNemotron(retry, base64, { geometryParts: true });
    try {
      parsed = extractJson(raw2);
    } catch {
      // Return low-confidence stub if AI cannot produce valid JSON
      console.warn(`[blueprintAnalysis] AI returned invalid JSON for ${blueprintId} — using stub`);
      const stub = { ...stubAnalysis(), analysisSource: 'ai_json_parse_failed' };
      setBlueprintAnalysis(blueprintId, stub);
      return stub;
    }
  }

  const { value, errors } = validateAnalysis(parsed);
  if (!value) {
    const stub = { ...stubAnalysis(), analysisSource: 'ai_invalid_schema' };
    setBlueprintAnalysis(blueprintId, stub);
    return stub;
  }

  if (errors.length > 0) {
    console.warn(`[blueprintAnalysis] schema warnings for ${blueprintId}:`, errors);
  }

  const result = { ...value, analysisSource: 'ai_vision' };
  setBlueprintAnalysis(blueprintId, result);
  console.log(`[blueprintAnalysis] complete for ${blueprintId} — confidence ${result.confidence}, partType: ${result.detectedPartType}`);
  return result;
}

/**
 * Merge blueprint analysis hints into a spec user message context string.
 * Returns an object with two parts:
 *   - blueprintContext: a formatted string to prepend to the spec user message
 *   - blueprintDerivedDimensions: extracted knownDimensions (low-confidence → assumed)
 */
function mergeBlueprintHintsIntoContext(analysisJson) {
  if (!analysisJson || analysisJson.confidence < 0.2) {
    return { blueprintContext: '', blueprintDerivedDimensions: {} };
  }

  const lines = [];
  lines.push(`=== BLUEPRINT ANALYSIS (confidence: ${Math.round(analysisJson.confidence * 100)}%) ===`);
  lines.push(`Likely part type: ${analysisJson.detectedPartType}`);

  if (Object.keys(analysisJson.observedDimensions).length > 0) {
    lines.push('Observed dimensions (from blueprint image):');
    for (const [k, v] of Object.entries(analysisJson.observedDimensions)) {
      lines.push(`  • ${k}: ${v} mm (blueprint-derived)`);
    }
  }

  if (analysisJson.observedFeatures.length > 0) {
    lines.push(`Visible features: ${analysisJson.observedFeatures.join(', ')}`);
  }
  if (analysisJson.visibleHoleCount > 0) {
    lines.push(`Visible holes: ${analysisJson.visibleHoleCount}`);
  }
  if (analysisJson.symmetryHints.length > 0) {
    lines.push(`Symmetry hints: ${analysisJson.symmetryHints.join(', ')}`);
  }
  if (analysisJson.manufacturingHints.length > 0) {
    lines.push(`Manufacturing hints: ${analysisJson.manufacturingHints.join(', ')}`);
  }
  if (analysisJson.textReadFromBlueprint.length > 0) {
    lines.push(`Text visible in blueprint: ${analysisJson.textReadFromBlueprint.join(' | ')}`);
  }
  if (analysisJson.uncertainties.length > 0) {
    lines.push(`Uncertainties: ${analysisJson.uncertainties.join('; ')}`);
  }

  lines.push('IMPORTANT: These observations come from a blueprint image and may be approximate.');
  lines.push('Treat low-confidence dimensions as assumptions, not guaranteed facts.');

  // High-confidence dims go in knownDimensions, lower-confidence go in assumed
  const blueprintDerivedDimensions = {};
  if (analysisJson.confidence >= 0.6) {
    for (const [k, v] of Object.entries(analysisJson.observedDimensions)) {
      blueprintDerivedDimensions[k] = v;
    }
  }

  return {
    blueprintContext: lines.join('\n'),
    blueprintDerivedDimensions,
  };
}

module.exports = {
  analyzeBlueprintById,
  validateAnalysis,
  mergeBlueprintHintsIntoContext,
  getBlueprintAnalysisSystemPrompt,
};

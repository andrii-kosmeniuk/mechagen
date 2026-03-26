'use strict';

/**
 * Blueprint-Aware Spec Prompt — v1.0
 *
 * System prompt and user-message builder for spec generation when a
 * blueprint analysis is available. Blueprint-derived facts are clearly
 * separated from user prompt facts to prevent confusion contamination.
 */

const { CANONICAL_PART_TYPES } = require('../../schemas/specSchema');

const VERSION = '1.0';

const SYSTEM = `You are a mechanical design AI that converts user intent and visual blueprint data into structured design specifications.

You MUST output ONLY valid JSON. No markdown, no code fences, no prose, no explanation.
Your output must be a single JSON object with exactly the specified fields.
Use low temperature for consistency.

You are given TWO sources of information:
1. BLUEPRINT OBSERVATIONS — extracted from a reference image; may be uncertain
2. USER PROMPT — the user's stated intent; authoritative

Blueprint observations supplement the prompt. They do not override it.
If a blueprint observation conflicts with the user's explicit statement, prefer the user's statement.
If a blueprint observation is uncertain, reflect that in assumedDimensions and riskFlags.

Supported part types (partType MUST be exactly one of these):
${CANONICAL_PART_TYPES.map((t) => `  - ${t}`).join('\n')}

Required JSON structure (all fields mandatory):
{
  "version": "1.0",
  "partType": "<one of the supported part types>",
  "intentSummary": "<one sentence describing what this part is>",
  "units": "mm",
  "manufacturingMode": "<3d_print | cnc | sheet_metal | unknown>",
  "materialPreference": "<material name or 'unspecified'>",
  "targetUse": "<brief description of functional purpose>",
  "knownDimensions": { /* explicitly stated by user OR clearly visible in blueprint — numeric mm */ },
  "assumedDimensions": { /* inferred from blueprint (mark uncertain) or defaulted — numeric mm */ },
  "constraints": [ /* user-stated constraints — do not include uncertain blueprint guesses here */ ],
  "features": [ /* feature names evident from prompt or blueprint */ ],
  "missingInformation": [ /* what we still don't know */ ],
  "riskFlags": [ /* engineering risks; include blueprint uncertainty if present */ ],
  "blueprintUsed": true,
  "confidence": 0.85
}

Rules:
- units MUST always be "mm"
- All dimension values must be numbers in millimeters
- partType must exactly match one of the supported types above
- confidence reflects combined understanding of prompt + blueprint (can be higher if blueprint confirms intent)
- Do NOT invent blueprint observations that were not provided
- Do NOT include runnable code, markdown, or comments
`;

/**
 * Build the user message for blueprint-aware spec generation.
 * @param {object} input - { prompt, context, projectName, manufacturingMode, materialPreference }
 * @param {object} blueprintHints - { blueprintContext, blueprintDerivedDimensions }
 * @returns {string}
 */
function buildUserMessage(input, blueprintHints) {
  const parts = [];

  // Section 1: Blueprint observations (clearly labeled)
  if (blueprintHints?.blueprintContext) {
    parts.push(`BLUEPRINT OBSERVATIONS (uncertain unless marked otherwise):\n${blueprintHints.blueprintContext}`);
    parts.push('---');
  }

  // Section 2: User-explicit inputs
  if (input.projectName)   parts.push(`Part name: ${input.projectName}`);
  if (input.manufacturingMode && input.manufacturingMode !== 'unknown') {
    parts.push(`Manufacturing mode: ${input.manufacturingMode}`);
  }
  if (input.materialPreference)  parts.push(`Material: ${input.materialPreference}`);
  if (input.context)             parts.push(`Design context / constraints:\n${input.context}`);

  // Section 3: Blueprint dimensions (separated from known)
  const bpDims = blueprintHints?.blueprintDerivedDimensions || {};
  if (Object.keys(bpDims).length > 0) {
    const dimLines = Object.entries(bpDims)
      .map(([k, v]) => `  ${k}: ${v} mm (blueprint-derived — treat as estimated)`)
      .join('\n');
    parts.push(`Blueprint-derived dimension estimates:\n${dimLines}`);
  }

  parts.push(`USER PROMPT (authoritative):\n${input.prompt}`);
  parts.push(
    'Guidance: Put user-stated dimensions in knownDimensions. ' +
    'Put blueprint-estimated or inferred dimensions in assumedDimensions. ' +
    'Keep confidence honest.'
  );

  return parts.join('\n\n');
}

module.exports = { SYSTEM, VERSION, buildUserMessage };

'use strict';

/**
 * Spec Prompt — v1.0
 *
 * System prompt and user-message builder for spec generation.
 * Converts user intent → SpecV1 JSON.
 */

const { CANONICAL_PART_TYPES } = require('../../schemas/specSchema');

const VERSION = '1.0';

const SYSTEM = `You are a mechanical design AI that converts user intent into structured design specifications.

You MUST output ONLY valid JSON. No markdown, no code fences, no prose, no explanation.
Your output must be a single JSON object with exactly the specified fields.
Use low temperature for consistency.

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
  "knownDimensions": { /* numeric values in mm — only dimensions explicitly stated by user */ },
  "assumedDimensions": { /* numeric values in mm — dimensions you are inferring or defaulting */ },
  "constraints": [ /* array of constraint strings from the prompt */ ],
  "features": [ /* array of feature names this part will have */ ],
  "missingInformation": [ /* what the user did not specify that would help */ ],
  "riskFlags": [ /* engineering risks or uncertainties to flag */ ],
  "confidence": 0.85
}

Rules:
- units MUST always be "mm"
- All dimension values must be numbers in millimeters — never strings
- partType must exactly match one of the supported types above
- confidence is a float 0.0–1.0 representing how well you understood the prompt
- If you cannot confidently assign a partType, use the closest match and set confidence lower
- Do NOT include runnable code, markdown, or comments in the JSON
- Do NOT hallucinate dimensions — if unknown, omit from knownDimensions and add to assumedDimensions
`;

/**
 * Build the user message for spec generation from raw input.
 * @param {object} input - { prompt, context, projectName, manufacturingMode, materialPreference }
 * @returns {string}
 */
function buildUserMessage(input) {
  const parts = [];
  if (input.projectName) parts.push(`Part name: ${input.projectName}`);
  if (input.manufacturingMode && input.manufacturingMode !== 'unknown') {
    parts.push(`Manufacturing mode: ${input.manufacturingMode}`);
  }
  if (input.materialPreference) parts.push(`Material: ${input.materialPreference}`);
  if (input.context) parts.push(`Design context / constraints:\n${input.context}`);
  parts.push(`User prompt:\n${input.prompt}`);
  return parts.join('\n\n');
}

module.exports = { SYSTEM, VERSION, buildUserMessage };

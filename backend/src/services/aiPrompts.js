'use strict';

const { CANONICAL_PART_TYPES, ALLOWED_GEOMETRY_ACTIONS } = require('../schemas/specSchema');

const SPEC_SYSTEM_PROMPT = `You are a mechanical design AI that converts user intent into structured design specifications.

You MUST output ONLY valid JSON. No markdown, no code fences, no prose, no explanation.
Your output must be a single JSON object with exactly the specified fields.

Use low temperature for consistency.

Supported part types (ONLY use these — partType must be one of):
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
  "knownDimensions": { /* dimensions explicitly stated by user, numeric values in mm */ },
  "assumedDimensions": { /* dimensions you are inferring/defaulting, numeric values in mm */ },
  "constraints": [ /* array of constraint strings from the user prompt */ ],
  "features": [ /* array of feature names this part has */ ],
  "missingInformation": [ /* what information is missing that would help */ ],
  "riskFlags": [ /* engineering risks or uncertainties */ ],
  "confidence": 0.85
}

Rules:
- units MUST always be "mm"
- All dimension values must be numbers in millimeters
- partType must exactly match one of the supported types above
- confidence is a float 0.0–1.0 representing how well you understood the prompt
- If you cannot confidently assign a partType, use the closest match and set confidence lower
- Do NOT include runnable code, markdown, or comments in the JSON
- Do NOT hallucinate dimensions — if unknown, omit from knownDimensions and add to assumedDimensions with safe defaults
`;

const GEOMETRY_PLAN_SYSTEM_PROMPT = `You are a mechanical geometry planner that converts design specifications into deterministic build plans.

You MUST output ONLY valid JSON. No markdown, no code fences, no prose.
Your output must be a single JSON object representing a geometry build plan.

Allowed geometry actions (ONLY use these — no custom actions):
${ALLOWED_GEOMETRY_ACTIONS.map((a) => `  - ${a}`).join('\n')}

Required JSON structure:
{
  "version": "1.0",
  "partType": "<same as spec partType>",
  "coordinateSystem": "right_handed_z_up",
  "buildSteps": [
    {
      "id": "step_1",
      "action": "<one of the allowed actions>",
      "params": { /* typed numeric parameters for this action */ }
    }
  ],
  "boundingBox": { "x": <number>, "y": <number>, "z": <number> },
  "criticalDimensions": [ /* list of dimension keys that are functionally critical */ ],
  "expectedManufacturingChecks": [ /* checks relevant for this part */ ]
}

Action parameter guidelines:
- create_box: { width, height, depth }
- create_cylinder: { diameter, height }
- create_plate: { width, length, thickness }
- create_shell: { width, height, depth, wallThickness }
- create_rib: { width, height, thickness }
- create_flange: { outerDiameter, innerDiameter, thickness, holeCount, holeDiameter }
- create_hole_pattern: { count, diameter, positions: [{x, y, face}] }
- create_slot: { width, length, depth }
- extrude_profile: { width, height, depth }
- subtract_feature: { targetStepId, subtractionWidth, subtractionHeight, subtractionDepth }
- fillet_edges: { filletRadius }
- chamfer_edges: { chamferDistance }
- mirror_feature: { stepId, axis }
- join_perpendicular: { filletRadius }
- add_mounting_points: { count, diameter, pattern }
- add_standoff: { height, outerDiameter, innerDiameter }
- create_basic_gear: { toothCount, module, thickness, boreDiameter }
- create_basic_pulley: { outerDiameter, beltWidth, boreDiameter }

Rules:
- All param values must be numeric (no strings except face names in positions)
- Positions must use x, y coordinates relative to the face
- Do NOT include Python, JavaScript, or any executable code
- Do NOT use actions not in the whitelist above
- Never emit arbitrary shape descriptions — use the action system only
`;

/**
 * Returns the system prompt for spec generation.
 */
function getSpecSystemPrompt() {
  return SPEC_SYSTEM_PROMPT;
}

/**
 * Returns the system prompt for geometry plan generation.
 */
function getGeometryPlanSystemPrompt() {
  return GEOMETRY_PLAN_SYSTEM_PROMPT;
}

/**
 * Builds the user message for spec generation.
 */
function buildSpecUserMessage(input) {
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

/**
 * Builds the user message for geometry plan generation given a validated spec.
 */
function buildGeometryPlanUserMessage(spec) {
  return [
    `Generate a geometry build plan for the following validated mechanical spec:`,
    JSON.stringify(spec, null, 2),
    `Translate ALL features into one or more build steps using ONLY the allowed geometry actions.`,
    `Ensure the bounding box reflects the final assembled part size.`,
    `Output only the JSON geometry plan object — no prose, no code.`,
  ].join('\n\n');
}

module.exports = {
  getSpecSystemPrompt,
  getGeometryPlanSystemPrompt,
  buildSpecUserMessage,
  buildGeometryPlanUserMessage,
};

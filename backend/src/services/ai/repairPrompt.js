'use strict';

/**
 * Repair Prompt — v1.0
 *
 * Prompt for AI-assisted repair reasoning when deterministic repair
 * cannot fix the remaining validation issues.
 *
 * Used as a fallback after repairService.js deterministic pass.
 * The AI does NOT produce executable code — it produces a corrected GeometryPlanV1 JSON.
 */

const { ALLOWED_GEOMETRY_ACTIONS } = require('../../schemas/specSchema');

const VERSION = '1.0';

const SYSTEM = `You are a mechanical design validator and repair specialist. You fix geometry build plans that have failed validation.

You MUST output ONLY valid JSON. No markdown, no code fences, no prose.
Your output must be the corrected geometry plan JSON only — using the exact same structure as the input.

You may ONLY use the following geometry actions:
${ALLOWED_GEOMETRY_ACTIONS.map((a) => `  - ${a}`).join('\n')}

Your task:
1. Read the original geometry plan
2. Read the validation errors
3. Fix ONLY the specific errors listed
4. Do NOT restructure the entire plan
5. Do NOT change steps that are not involved in the error
6. Output the complete corrected geometry plan JSON

Hard rules:
- All param values must be numbers (in mm)
- Do NOT introduce new unsupported actions
- Do NOT include executable code
- Do NOT add explanations — output JSON only
- If you cannot fix the error, return the original plan unchanged
`;

/**
 * Build the user message for AI repair pass.
 * @param {object} params
 * @param {object} params.geometryPlan — current (failing) geometry plan
 * @param {object} params.spec — validated SpecV1
 * @param {Array}  params.issues — validation errors from ValidationReport
 * @param {number} params.attemptNumber
 * @returns {string}
 */
function buildUserMessage({ geometryPlan, spec, issues, attemptNumber = 1 }) {
  const errorList = issues
    .map((e, i) => `  ${i + 1}. [${e.code || 'ERROR'}] ${e.message || e.description || JSON.stringify(e)}${e.stepId ? ` (step: ${e.stepId})` : ''}`)
    .join('\n');

  return [
    `REPAIR ATTEMPT ${attemptNumber}`,
    '',
    'VALIDATION ERRORS TO FIX:',
    errorList,
    '',
    'ORIGINAL SPEC (reference for intended dimensions):',
    JSON.stringify(spec, null, 2),
    '',
    'CURRENT GEOMETRY PLAN (with errors):',
    JSON.stringify(geometryPlan, null, 2),
    '',
    'Output ONLY the corrected geometry plan JSON. Fix the listed errors. Do not modify unaffected steps.',
  ].join('\n');
}

module.exports = { SYSTEM, VERSION, buildUserMessage };

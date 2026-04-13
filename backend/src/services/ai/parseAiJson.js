'use strict';

/**
 * AI JSON Parser — MechaGen
 *
 * Extracts and validates JSON from raw AI output.
 * Three-stage process:
 *   1. Extract the JSON object substring from the raw string
 *   2. Parse JSON (throw if unparseable)
 *   3. Validate against a schema predicate (throw if invalid)
 *
 * All functions are pure — no side effects, no AI calls.
 */

// ── JSON extraction ────────────────────────────────────────────────────────────

/**
 * Extract the outermost JSON object from a raw string.
 * Handles markdown code fences, leading prose, trailing text.
 * @param {string} raw
 * @returns {string} Extracted JSON string (may still be invalid)
 */
function extractJson(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim();

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  // Find the outermost { ... }
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start >= 0 && end > start) return s.slice(start, end + 1);

  return s;
}

/**
 * Parse raw AI output as JSON, with extraction pre-processing.
 * @param {string} raw
 * @returns {{ ok: boolean, value: object|null, raw: string }}
 */
function parseRaw(raw) {
  const extracted = extractJson(raw);
  try {
    const value = JSON.parse(extracted);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { ok: true, value, raw: extracted };
    }
    return { ok: false, value: null, raw: extracted };
  } catch {
    return { ok: false, value: null, raw: extracted };
  }
}

// ── Schema validation ──────────────────────────────────────────────────────────

/**
 * Validate a parsed SpecV1 JSON object.
 * Returns { valid, errors } (same interface as specSchema.validateSpecJson).
 * Delegates to the canonical schema validator.
 * @param {unknown} raw
 * @returns {{ valid: boolean, value: object|null, errors: string[] }}
 */
function validateSpec(raw) {
  const { validateSpecJson } = require('../../schemas/specSchema');
  if (!raw || typeof raw !== 'object') return { valid: false, value: null, errors: ['Not an object'] };
  const { value, errors } = validateSpecJson(raw);
  return { valid: !!value && errors.length === 0, value, errors: errors || [] };
}

/**
 * Validate a parsed GeometryPlanV1 JSON object.
 * @param {unknown} raw
 * @returns {{ valid: boolean, value: object|null, errors: string[] }}
 */
function validateGeometryPlan(raw) {
  const { validateGeometryPlan: schemaValidate } = require('../../schemas/specSchema');
  if (!raw || typeof raw !== 'object') return { valid: false, value: null, errors: ['Not an object'] };
  const { value, errors } = schemaValidate(raw);
  return { valid: !!value && (errors || []).length <= 2, value, errors: errors || [] };
}

// ── Combined parse + validate ──────────────────────────────────────────────────

/**
 * Parse a raw AI string and validate it as a SpecV1 JSON.
 * @param {string} raw
 * @returns {{ ok: boolean, value: object|null, errors: string[] }}
 */
function parseAndValidateSpec(raw) {
  const parsed = parseRaw(raw);
  if (!parsed.ok) return { ok: false, value: null, errors: [`JSON parse failed: ${parsed.raw.slice(0, 100)}`] };
  const { valid, value, errors } = validateSpec(parsed.value);
  return { ok: valid, value: valid ? value : null, errors };
}

/**
 * Parse a raw AI string and validate it as a GeometryPlanV1 JSON.
 * @param {string} raw
 * @returns {{ ok: boolean, value: object|null, errors: string[] }}
 */
function parseAndValidatePlan(raw) {
  const parsed = parseRaw(raw);
  if (!parsed.ok) return { ok: false, value: null, errors: [`JSON parse failed: ${parsed.raw.slice(0, 100)}`] };
  const { valid, value, errors } = validateGeometryPlan(parsed.value);
  return { ok: valid, value: valid ? value : null, errors };
}

module.exports = {
  extractJson,
  parseRaw,
  validateSpec,
  validateGeometryPlan,
  parseAndValidateSpec,
  parseAndValidatePlan,
};

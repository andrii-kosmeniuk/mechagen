'use strict';

/**
 * AI Client — MechaGen
 *
 * Clean abstraction over the underlying AI provider (NVIDIA / OpenAI).
 * Handles: JSON extraction, single retry on bad JSON, structured error.
 *
 * Usage:
 *   const { callAiForJson } = require('./aiClient');
 *   const result = await callAiForJson(systemPrompt, userMessage, options);
 */

const { callNemotron } = require('../../../lib/ai');
const { AppError } = require('../../errors/AppError');
const { E }        = require('../../errors/errorCodes');

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractJson(raw) {
  const s = (raw || '').trim();
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}

function isConfigured() {
  return !!(
    process.env.NVIDIA_API_KEY || process.env.NIM_API_KEY ||
    process.env.OPENAI_API_KEY || process.env.FEATHERLESS_API_KEY
  );
}

// ── Core ───────────────────────────────────────────────────────────────────────

/**
 * Call the AI provider and return a parsed JSON object.
 *
 * @param {string} systemPrompt  Full system prompt (versioned)
 * @param {string} userMessage   User message
 * @param {object} [options]
 * @param {string} [options.image]      Image URL or base64
 * @param {boolean} [options.highDetail]
 * @returns {Promise<object>}           Parsed JSON object
 * @throws {AppError}                   On AI unavailable or JSON parse failure
 */
async function callAiForJson(systemPrompt, userMessage, options = {}) {
  // Fast-fail if no AI key is configured
  if (!isConfigured()) {
    throw new AppError(
      'AI provider not configured. Set NVIDIA_API_KEY (or OPENAI_API_KEY) in your .env.local file.',
      503,
      E.WORKER_UNAVAILABLE
    );
  }

  const combined = `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\n---\n\n${userMessage}`;

  // ── Attempt 1 ──
  let raw;
  try {
    raw = await callNemotron(combined, options.image || null, {
      highDetail:    !!options.highDetail,
      geometryParts: true,
    });
  } catch (err) {
    throw new AppError(`AI provider error: ${err.message}`, 502, E.PIPELINE_FAILED);
  }

  let jsonStr = extractJson(raw);
  try {
    return JSON.parse(jsonStr);
  } catch { /* fall through to retry */ }

  // ── Attempt 2: explicit retry ──
  const retryPrompt = `${combined}\n\nCRITICAL: Your previous response was not valid JSON.\nOutput ONLY the JSON object — no markdown, no code fences, no prose, no explanation.`;
  let raw2;
  try {
    raw2 = await callNemotron(retryPrompt, null, { geometryParts: true });
  } catch (err) {
    throw new AppError(`AI provider error on retry: ${err.message}`, 502, E.PIPELINE_FAILED);
  }

  const jsonStr2 = extractJson(raw2);
  try {
    return JSON.parse(jsonStr2);
  } catch (err) {
    throw new AppError(
      `AI returned invalid JSON (after retry). Raw: ${jsonStr2.slice(0, 200)}`,
      422,
      E.SPEC_INVALID
    );
  }
}

/**
 * Check whether an AI provider is configured.
 * Used for health checks and informational responses.
 */
function getAiProviderStatus() {
  if (!isConfigured()) return { configured: false, provider: null };
  if (process.env.NVIDIA_API_KEY || process.env.NIM_API_KEY) return { configured: true, provider: 'nvidia' };
  if (process.env.OPENAI_API_KEY)  return { configured: true, provider: 'openai' };
  return { configured: true, provider: 'featherless' };
}

module.exports = { callAiForJson, getAiProviderStatus, isConfigured };

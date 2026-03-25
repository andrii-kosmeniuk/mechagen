'use strict';

/**
 * Config Module — MechaGen Backend
 *
 * Centralizes env loading and validation.
 * Import this module once at startup; it throws immediately on missing required vars.
 *
 * Usage:
 *   const config = require('./src/config');
 *   config.PORT  // → number
 *   config.AI_KEY // → string
 */

const fs   = require('fs');
const path = require('path');

// ── Load .env files ────────────────────────────────────────────────────────────

function loadEnvFile(filePath) {
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch { /* file may not exist */ }
}

function loadEnv(root = path.join(__dirname, '..', '..')) {
  loadEnvFile(path.join(root, '.env.local'));
  loadEnvFile(path.join(root, '.env'));
}

// ── Validation ─────────────────────────────────────────────────────────────────

const WARNINGS = [
  // These are warnings not hard failures (app still runs in dev without them)
  'NVIDIA_API_KEY',
  'OPENAI_API_KEY',
];

function validate() {
  const missing = [];
  for (const key of WARNINGS) {
    if (!process.env[key]) missing.push(key);
  }
  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(`[config] Missing required environment variables: ${missing.join(', ')}`);
  } else if (missing.length > 0) {
    console.warn(`[config] Warning: ${missing.join(', ')} not set — AI features will be unavailable`);
  }
}

// ── Typed config exports ───────────────────────────────────────────────────────

function build() {
  return {
    // Server
    PORT:     parseInt(process.env.PORT || '3001', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    IS_DEV:   (process.env.NODE_ENV || 'development') !== 'production',

    // AI
    NVIDIA_API_KEY:   process.env.NVIDIA_API_KEY || process.env.NIM_API_KEY || '',
    OPENAI_API_KEY:   process.env.OPENAI_API_KEY || '',
    AI_BASE_URL:      process.env.AI_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    AI_MODEL:         process.env.AI_MODEL || 'nvidia/llama-3.1-nemotron-ultra-253b-v1',

    // Auth
    API_KEY_REQUIRED: process.env.API_KEY_REQUIRED === 'true',
    API_KEYS:         process.env.API_KEYS || '',   // "key1:userId1,key2:userId2"
    ADMIN_KEY:        process.env.ADMIN_KEY || '',
    DEV_USER_ID:      process.env.DEV_USER_ID || 'dev-user',
    DEV_PLAN:         process.env.DEV_PLAN || 'free',

    // Worker
    WORKER_URL:     process.env.WORKER_URL || 'http://127.0.0.1:5001',
    WORKER_TIMEOUT: parseInt(process.env.WORKER_TIMEOUT || '120000', 10),

    // Rate limits
    RL_GENERATION:  parseInt(process.env.RL_GENERATION || '5', 10),
    RL_BLUEPRINT:   parseInt(process.env.RL_BLUEPRINT || '10', 10),
    RL_SOLID_BUILD: parseInt(process.env.RL_SOLID_BUILD || '3', 10),
    RL_EXPORT:      parseInt(process.env.RL_EXPORT || '20', 10),
    RL_WINDOW_MS:   parseInt(process.env.RL_WINDOW_MS || '60000', 10),

    // Analytics providers (optional)
    POSTHOG_API_KEY:   process.env.POSTHOG_API_KEY || '',
    SEGMENT_WRITE_KEY: process.env.SEGMENT_WRITE_KEY || '',

    // Storage
    DATA_DIR: process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data'),
    UPLOADS_DIR: process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads'),
  };
}

// Export a singleton — call loadEnv() then build() once
let _config = null;

function getConfig() {
  if (!_config) {
    loadEnv();
    validate();
    _config = build();
  }
  return _config;
}

// Proxy: access config.PORT etc. directly, lazy-loaded
const config = new Proxy({}, {
  get(_, key) {
    if (key === 'loadEnv') return loadEnv;
    if (key === 'reload')  return () => { _config = null; return getConfig(); };
    return getConfig()[key];
  },
});

module.exports = config;

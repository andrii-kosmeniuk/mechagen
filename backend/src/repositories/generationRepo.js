'use strict';

/**
 * Generation Repository — Phase Refactor
 *
 * Drop-in replacement for the in-memory `jobStore` Map in orchestration.js.
 * Provides the exact same interface (get, set, update, list, delete) plus
 * JSON-file persistence so generation state survives process restarts.
 *
 * File location: data/generations.json  (created automatically)
 *
 * This is a simple file-based store — production systems would swap in
 * SQLite or Postgres here by replacing the I/O calls below while keeping
 * the same public interface.
 */

const fs   = require('fs');
const path = require('path');

// ── Storage path ───────────────────────────────────────────────────────────────

const DATA_DIR  = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', '..', '..', 'data');

const STORE_PATH = path.join(DATA_DIR, 'generations.json');

// ── Internal store (in-memory cache + file backend) ────────────────────────────

/** @type {Map<string, object>} */
const cache = new Map();
let _loaded = false;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadFromDisk() {
  if (_loaded) return;
  ensureDir();
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const entries = JSON.parse(raw);
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (entry?.id) cache.set(entry.id, entry);
      }
    }
    console.log(`[generationRepo] loaded ${cache.size} generation(s) from disk`);
  } catch { /* file doesn't exist yet — start fresh */ }
  _loaded = true;
}

function flushToDisk() {
  try {
    ensureDir();
    fs.writeFileSync(STORE_PATH, JSON.stringify(Array.from(cache.values()), null, 2), 'utf8');
  } catch (err) {
    console.error('[generationRepo] flush error:', err.message);
  }
}

// Debounced flush — avoids writing on every update during a fast pipeline run
let _flushTimer = null;
function scheduledFlush() {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(flushToDisk, 500);
}

function _ensureLoaded() {
  if (!_loaded) loadFromDisk();
}

// ── Public API (identical to the old jobStore Map interface) ───────────────────

/**
 * Get a generation by ID.
 * @param {string} id
 * @returns {object|null}
 */
function get(id) {
  _ensureLoaded();
  return cache.get(id) ?? null;
}

/**
 * Set (create or replace) a generation record.
 * @param {string} id
 * @param {object} record
 * @returns {object}
 */
function set(id, record) {
  _ensureLoaded();
  const entry = { ...record, id };
  cache.set(id, entry);
  scheduledFlush();
  return entry;
}

/**
 * Patch an existing generation record.
 * @param {string} id
 * @param {object} patch
 * @returns {object|null}
 */
function update(id, patch) {
  _ensureLoaded();
  const existing = cache.get(id) || {};
  const updated  = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
  cache.set(id, updated);
  scheduledFlush();
  return updated;
}

/**
 * Delete a generation record.
 * @param {string} id
 * @returns {boolean}
 */
function del(id) {
  _ensureLoaded();
  const existed = cache.has(id);
  cache.delete(id);
  if (existed) scheduledFlush();
  return existed;
}

/**
 * List all generations, most-recent first.
 * @returns {object[]}
 */
function list() {
  _ensureLoaded();
  return Array.from(cache.values()).sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
}

/**
 * List generations for a specific user, most-recent first.
 * @param {string} userId
 * @returns {object[]}
 */
function listByUser(userId) {
  return list().filter(g => g.userId === userId);
}

/**
 * Count of all stored generations.
 * @returns {number}
 */
function count() {
  _ensureLoaded();
  return cache.size;
}

/**
 * Force write to disk immediately (useful for graceful shutdown).
 */
function flush() {
  flushToDisk();
}

module.exports = { get, set, update, delete: del, list, listByUser, count, flush };

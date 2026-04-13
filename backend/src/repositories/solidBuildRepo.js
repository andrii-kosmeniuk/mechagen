'use strict';

/**
 * Solid Build Repository — Phase Refactor
 * Persists solid build state to data/solid_builds.json.
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR   = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', '..', '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'solid_builds.json');

const cache = new Map();
let _loaded = false;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadFromDisk() {
  if (_loaded) return;
  ensureDir();
  try {
    const entries = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    if (Array.isArray(entries)) for (const e of entries) { if (e?.id) cache.set(e.id, e); }
  } catch { /* start fresh */ }
  _loaded = true;
}

let _timer = null;
function scheduledFlush() {
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => {
    try { ensureDir(); fs.writeFileSync(STORE_PATH, JSON.stringify(Array.from(cache.values()), null, 2), 'utf8'); }
    catch (err) { console.error('[solidBuildRepo] flush error:', err.message); }
  }, 500);
}

function _e() { if (!_loaded) loadFromDisk(); }

function get(id)          { _e(); return cache.get(id) ?? null; }
function set(id, record)  { _e(); const e = { ...record, id }; cache.set(id, e); scheduledFlush(); return e; }
function update(id, pat)  { _e(); const e = { ...(cache.get(id)||{}), ...pat, id, updatedAt: new Date().toISOString() }; cache.set(id, e); scheduledFlush(); return e; }
function del(id)          { _e(); const ok = cache.has(id); cache.delete(id); if (ok) scheduledFlush(); return ok; }
function list()           { _e(); return Array.from(cache.values()).sort((a,b)=> new Date(b.createdAt||0) - new Date(a.createdAt||0)); }
function listByGeneration(genId) { return list().filter(b => b.generationId === genId); }

module.exports = { get, set, update, delete: del, list, listByGeneration };

'use strict';

/**
 * Removes Vite / build caches so dev picks up fresh bundles (fixes “stuck” old UI).
 * Run: npm run clean:cache   (from repo root)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const toRemove = [
  'frontend/node_modules/.vite',
  'frontend/dist',
  'frontend/.vite',
  'node_modules/.cache',
  'backend/python/__pycache__',
];

for (const rel of toRemove) {
  const p = path.join(root, rel);
  try {
    fs.rmSync(p, { recursive: true, force: true });
    console.log('[clean-cache] removed', rel);
  } catch (e) {
    console.warn('[clean-cache] skip', rel, '-', e.message);
  }
}

console.log('[clean-cache] done. Restart `vite` / dev server. Hard-refresh browser (Cmd+Shift+R).');

'use strict';

/**
 * server.js — MechaGen API Server (Refactored)
 *
 * Loads config → creates app → listens.
 * All route logic lives in src/routes/*.js
 * All middleware logic lives in src/middleware/
 * All business logic lives in src/services/
 * All persistence lives in src/repositories/
 */

// ── 1. Load env files (.env.local takes precedence) ───────────────────────────
const config = require('./src/config');

// ── 2. Seed initial data ───────────────────────────────────────────────────────
require('./seed/plans')();
require('./seed/workspaces')();
require('./seed/demo')();

// ── 3. Create application server ──────────────────────────────────────────────
const { createApp } = require('./src/app');
const { server }    = createApp(config.PORT);

// ── 4. Graceful shutdown — flush repositories before exit ─────────────────────
const { flush: flushGenerations } = require('./src/repositories/generationRepo');

function shutdown(signal) {
  console.log(`\n[server] ${signal} received — flushing data stores…`);
  flushGenerations();
  server.close(() => {
    console.log('[server] clean shutdown');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000); // force-exit after 5s
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── 5. Listen ─────────────────────────────────────────────────────────────────
server.listen(config.PORT, '127.0.0.1', () => {
  console.log(`[server] MechaGen API listening on http://127.0.0.1:${config.PORT}`);
  console.log(`[server] NODE_ENV=${config.NODE_ENV} | version=phase5-refactored`);
  console.log('[server] GET /api/health to verify');
});

'use strict';

/**
 * Seed — Demo Workspace
 *
 * Creates a sample workspace with dev-user as owner for development.
 */

const { createWorkspace, addMember, getWorkspace } = require('../src/services/workspaceService');

module.exports = function seedWorkspaces() {
  if (process.env.NODE_ENV === 'production') return;

  try {
    const ws = createWorkspace({
      name:        'MechaGen Demo Team',
      description: 'Shared workspace for development and demos',
      ownerUserId: process.env.DEV_USER_ID || 'dev-user',
    });
    // Add demo members at different roles
    addMember(ws.id, 'pro-user',  'admin');
    addMember(ws.id, 'team-user', 'member');

    console.log(`[seed] demo workspace created: "${ws.name}" (${ws.id})`);
  } catch (err) {
    // Ignore if already seeded
    if (!err.message?.includes('already')) console.error('[seed] workspace seed error:', err.message);
  }
};

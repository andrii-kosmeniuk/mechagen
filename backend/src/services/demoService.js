'use strict';

/**
 * Demo Service — Phase 5
 *
 * Provides isolated pre-seeded demo data for product demos, marketing,
 * and first-time user experience. Completely isolated from real user data.
 *
 * Demo data is seeded at startup from seed/demo.js.
 */

let _demoProject    = null;
let _demoGenerations = [];
let _demoBlueprint  = null;
let _loadCount = 0;

/**
 * Seed demo data (called from seed/demo.js at startup).
 */
function seedDemoData({ project, generations, blueprint }) {
  _demoProject     = project;
  _demoGenerations = generations;
  _demoBlueprint   = blueprint;
}

function getDemoProject() {
  _loadCount++;
  if (!_demoProject) return _getDefaultDemoProject();
  return { ..._demoProject, _isDemo: true };
}

function getDemoGenerations() {
  if (!_demoGenerations.length) return _getDefaultDemoGenerations();
  return _demoGenerations.map(g => ({ ...g, _isDemo: true }));
}

function getDemoBlueprint() {
  if (!_demoBlueprint) return _getDefaultDemoBlueprint();
  return { ..._demoBlueprint, _isDemo: true };
}

function getDemoLoadCount() { return _loadCount; }

function resetDemo() {
  _loadCount = 0;
  // Re-seed from seed/demo.js
  try { require('../../seed/demo')(); } catch { /* ignore if not available */ }
}

// ─── Defaults (always available without seed) ─────────────────────────────────

function _getDefaultDemoProject() {
  return {
    id:          'demo-project-001',
    name:        'Mounting Bracket Demo',
    description: 'A sample aluminum mounting bracket — generated with MechaGen.',
    userId:      'demo-user',
    workspaceId: null,
    createdAt:   '2026-03-01T10:00:00.000Z',
    updatedAt:   '2026-03-01T10:05:00.000Z',
    _isDemo:     true,
  };
}

function _getDefaultDemoGenerations() {
  return [
    {
      id:          'demo-gen-001',
      projectId:   'demo-project-001',
      prompt:      'Design a lightweight aluminum mounting bracket for a 50mm diameter motor with M4 bolt pattern',
      status:      'ready',
      specJson: {
        partType:      'bracket',
        material:      'aluminum_6061',
        manufacturing: '3d_print',
        dimensions:    { x: 80, y: 60, z: 6 },
        features:      ['mounting_holes', 'weight_reduction_cuts'],
      },
      geometryPlan: {
        partType:   'bracket',
        buildSteps: [
          { id: 'base',   action: 'create_box',      params: { width: 80, height: 60, depth: 6 } },
          { id: 'motor',  action: 'subtract_cylinder', params: { diameter: 50, height: 8, x: 40, y: 30, z: 0 } },
          { id: 'bolt1',  action: 'subtract_cylinder', params: { diameter: 4.2, height: 8, x: 10, y: 10, z: 0 } },
          { id: 'bolt2',  action: 'subtract_cylinder', params: { diameter: 4.2, height: 8, x: 70, y: 10, z: 0 } },
          { id: 'bolt3',  action: 'subtract_cylinder', params: { diameter: 4.2, height: 8, x: 10, y: 50, z: 0 } },
          { id: 'bolt4',  action: 'subtract_cylinder', params: { diameter: 4.2, height: 8, x: 70, y: 50, z: 0 } },
        ],
        boundingBox: { x: 80, y: 60, z: 6 },
      },
      buildMetadata: {
        totalDurationMs:  4200,
        previewPartCount: 6,
        repairAttempts:   0,
        hadBlueprint:     false,
      },
      createdAt: '2026-03-01T10:03:00.000Z',
      _isDemo:   true,
    },
  ];
}

function _getDefaultDemoBlueprint() {
  return {
    id:          'demo-blueprint-001',
    projectId:   'demo-project-001',
    filename:    'bracket_drawing.png',
    extractedDimensions: { x: 80, y: 60, z: 6, unit: 'mm' },
    extractedFeatures:   ['rectangular_base', 'circular_cutouts', 'bolt_pattern'],
    analysisStatus:      'complete',
    createdAt:           '2026-03-01T10:01:00.000Z',
    _isDemo:             true,
  };
}

module.exports = {
  seedDemoData,
  getDemoProject,
  getDemoGenerations,
  getDemoBlueprint,
  getDemoLoadCount,
  resetDemo,
};

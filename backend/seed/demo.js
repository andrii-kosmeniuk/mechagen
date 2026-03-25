'use strict';

/**
 * Seed — Demo Data
 *
 * Seeds the demoService with realistic bracket project data.
 * Run at server startup. Safe to re-run.
 */

const { seedDemoData } = require('../src/services/demoService');

module.exports = function seedDemo() {
  seedDemoData({
    project: {
      id:          'demo-project-001',
      name:        'Mounting Bracket — Demo',
      description: 'Sample aluminum mounting bracket generated with a single prompt. Fully validated, export-ready.',
      userId:      'demo-user',
      workspaceId: null,
      tags:        ['demo', 'bracket', 'aluminum'],
      createdAt:   '2026-03-01T10:00:00.000Z',
      updatedAt:   '2026-03-01T10:05:00.000Z',
    },
    generations: [
      {
        id:        'demo-gen-001',
        projectId: 'demo-project-001',
        prompt:    'Design a lightweight aluminum mounting bracket for a 50mm diameter motor with M4 bolt pattern, 80×60mm base',
        status:    'ready',
        specJson: {
          partType:      'bracket',
          material:      'aluminum_6061',
          manufacturing: '3d_print',
          thickness:     6,
          dimensions:    { x: 80, y: 60, z: 6 },
          features:      ['motor_mount_hole', 'bolt_pattern_m4', 'weight_reduction'],
          constraints:   ['fit_50mm_motor', 'm4_clearance_holes'],
        },
        geometryPlan: {
          partType: 'bracket',
          buildSteps: [
            { id: 's1', action: 'create_box',         params: { width: 80, height: 60, depth: 6 } },
            { id: 's2', action: 'subtract_cylinder',   params: { diameter: 50, height: 8, x: 40, y: 30, z: 0 } },
            { id: 's3', action: 'subtract_cylinder',   params: { diameter: 4.5, height: 8, x: 10, y: 10, z: 0 } },
            { id: 's4', action: 'subtract_cylinder',   params: { diameter: 4.5, height: 8, x: 70, y: 10, z: 0 } },
            { id: 's5', action: 'subtract_cylinder',   params: { diameter: 4.5, height: 8, x: 10, y: 50, z: 0 } },
            { id: 's6', action: 'subtract_cylinder',   params: { diameter: 4.5, height: 8, x: 70, y: 50, z: 0 } },
          ],
          boundingBox: { x: 80, y: 60, z: 6, unit: 'mm' },
          estimatedMassGrams: 47,
        },
        validationResult: { passed: true, checks: 8, repairApplied: false },
        buildMetadata: { totalDurationMs: 4250, previewPartCount: 6, repairAttempts: 0, hadBlueprint: false },
        exportUrls: { obj: '/uploads/demo/bracket.obj', glb: '/uploads/demo/bracket.glb' },
        createdAt: '2026-03-01T10:03:00.000Z',
      },
    ],
    blueprint: {
      id:          'demo-blueprint-001',
      projectId:   'demo-project-001',
      filename:    'bracket_engineering_drawing.png',
      fileUrl:     '/uploads/demo/blueprint.png',
      extractedDimensions: { x: 80, y: 60, z: 6, unit: 'mm' },
      extractedFeatures:   ['rectangular_base', 'circular_motor_cutout', 'm4_bolt_pattern'],
      extractedNotes:      ['Material: Al 6061-T6', 'Surface finish: Ra 3.2', 'Tolerances: ±0.1mm on holes'],
      analysisStatus:      'complete',
      createdAt:           '2026-03-01T10:01:00.000Z',
    },
  });
  console.log('[seed] demo data seeded: mounting bracket project');
};

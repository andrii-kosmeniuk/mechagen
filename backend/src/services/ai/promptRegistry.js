'use strict';

/**
 * Prompt Registry — MechaGen AI Layer
 *
 * Central registry for all versioned AI prompts.
 * Orchestration code imports prompts from here rather than requiring
 * individual prompt files directly.
 *
 * Versioning:
 *   Each prompt module exports VERSION, SYSTEM, and buildUserMessage().
 *   The registry exposes them grouped by role for easy orchestration use.
 */

const spec          = require('./specPrompt');
const blueprintSpec = require('./blueprintSpecPrompt');
const geometryPlan  = require('./geometryPlanPrompt');
const repair        = require('./repairPrompt');

const registry = {
  spec: {
    version:          spec.VERSION,
    system:           spec.SYSTEM,
    buildUserMessage: spec.buildUserMessage,
  },
  blueprintSpec: {
    version:          blueprintSpec.VERSION,
    system:           blueprintSpec.SYSTEM,
    buildUserMessage: blueprintSpec.buildUserMessage,
  },
  geometryPlan: {
    version:          geometryPlan.VERSION,
    system:           geometryPlan.SYSTEM,
    buildUserMessage: geometryPlan.buildUserMessage,
  },
  repair: {
    version:          repair.VERSION,
    system:           repair.SYSTEM,
    buildUserMessage: repair.buildUserMessage,
  },
};

module.exports = { registry };

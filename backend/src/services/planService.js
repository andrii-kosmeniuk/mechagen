'use strict';

/**
 * Plan Service — Phase 4
 *
 * Defines all subscription plans and their capability limits.
 * This is the single source of truth for what each plan allows.
 * Stripe or billing provider integration is kept modular here.
 */

const PLAN_DEFINITIONS = {
  free: {
    code:                    'free',
    name:                    'Free',
    monthlyGenerationLimit:  10,
    monthlyBlueprintLimit:   3,
    monthlySolidBuildLimit:  2,
    monthlyExportLimit:      5,
    creditsPerMonth:         20,
    maxProjectsPerWorkspace: 3,
    workspaceMembers:        1,  // personal only
    features: {
      blueprintUpload:     true,
      solidBuild:          true,
      exportObj:           true,
      exportGlb:           true,
      exportStl:           false,  // gated on Pro+
      prioritySolidBuild:  false,
      teamWorkspace:       false,
      adminAccess:         false,
    },
  },

  pro: {
    code:                    'pro',
    name:                    'Pro',
    monthlyGenerationLimit:  100,
    monthlyBlueprintLimit:   30,
    monthlySolidBuildLimit:  20,
    monthlyExportLimit:      100,
    creditsPerMonth:         500,
    maxProjectsPerWorkspace: 50,
    workspaceMembers:        1,  // personal, no team
    features: {
      blueprintUpload:     true,
      solidBuild:          true,
      exportObj:           true,
      exportGlb:           true,
      exportStl:           true,
      prioritySolidBuild:  true,
      teamWorkspace:       false,
      adminAccess:         false,
    },
  },

  team: {
    code:                    'team',
    name:                    'Team',
    monthlyGenerationLimit:  500,
    monthlyBlueprintLimit:   150,
    monthlySolidBuildLimit:  100,
    monthlyExportLimit:      500,
    creditsPerMonth:         2000,
    maxProjectsPerWorkspace: 500,
    workspaceMembers:        25,
    features: {
      blueprintUpload:     true,
      solidBuild:          true,
      exportObj:           true,
      exportGlb:           true,
      exportStl:           true,
      prioritySolidBuild:  true,
      teamWorkspace:       true,
      adminAccess:         false,
    },
  },

  admin: {
    code:                    'admin',
    name:                    'Admin',
    monthlyGenerationLimit:  Infinity,
    monthlyBlueprintLimit:   Infinity,
    monthlySolidBuildLimit:  Infinity,
    monthlyExportLimit:      Infinity,
    creditsPerMonth:         Infinity,
    maxProjectsPerWorkspace: Infinity,
    workspaceMembers:        Infinity,
    features: {
      blueprintUpload:     true,
      solidBuild:          true,
      exportObj:           true,
      exportGlb:           true,
      exportStl:           true,
      prioritySolidBuild:  true,
      teamWorkspace:       true,
      adminAccess:         true,
    },
  },
};

const DEFAULT_PLAN = 'free';

/**
 * Get a plan definition by code. Falls back to 'free' for unknown codes.
 */
function getPlanDefinition(planCode) {
  return PLAN_DEFINITIONS[planCode] || PLAN_DEFINITIONS[DEFAULT_PLAN];
}

/**
 * Check whether a plan has a specific feature enabled.
 */
function canPlanDo(planCode, featureKey) {
  const plan = getPlanDefinition(planCode);
  return plan.features[featureKey] === true;
}

/**
 * Get the monthly limit for a specific usage counter.
 */
function getPlanLimit(planCode, limitKey) {
  const plan = getPlanDefinition(planCode);
  return plan[limitKey] ?? Infinity;
}

/**
 * Get all plan codes.
 */
function getAllPlanCodes() {
  return Object.keys(PLAN_DEFINITIONS);
}

/**
 * Get all plans as an array (for API display).
 */
function getAllPlans() {
  return Object.values(PLAN_DEFINITIONS);
}

module.exports = {
  getPlanDefinition,
  canPlanDo,
  getPlanLimit,
  getAllPlanCodes,
  getAllPlans,
  PLAN_DEFINITIONS,
  DEFAULT_PLAN,
};

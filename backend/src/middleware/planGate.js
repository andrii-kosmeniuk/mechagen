'use strict';

/**
 * Plan Gate Middleware — Phase 4
 *
 * Checks quota and credits before allowing expensive operations.
 * Must be used AFTER authMiddleware (needs req.user.id).
 *
 * Usage:
 *   router.post('/generate', authMiddleware, planGate('generation'), handler)
 *
 * On success: attaches req.quotaCheck and req.creditCheck to req.
 * On failure: returns 402 (credits) or 429 (quota).
 */

const { getUserPlanCode, getUserPlan } = require('../services/subscriptionService');
const { getPlanLimit, canPlanDo }      = require('../services/planService');
const { checkQuota }                   = require('../services/usageService');
const { checkCredits }                 = require('../services/creditService');

// Maps opType → plan quota limit key
const QUOTA_KEY_MAP = {
  generation:         'monthlyGenerationLimit',
  blueprint_upload:   'monthlyBlueprintLimit',
  blueprint_analysis: 'monthlyBlueprintLimit',
  solid_build:        'monthlySolidBuildLimit',
  export_obj:         'monthlyExportLimit',
  export_glb:         'monthlyExportLimit',
  export_stl:         'monthlyExportLimit',
};

// Maps opType → feature flag key (if feature-gated)
const FEATURE_FLAG_MAP = {
  export_stl:  'exportStl',
  solid_build: 'solidBuild',
  teamWorkspace: 'teamWorkspace',
};

/**
 * Create a plan gate middleware for a given operation type.
 *
 * @param {string} opType  e.g. 'generation' | 'solid_build' | 'export_stl'
 * @param {{ skipCredits?: boolean }} opts
 */
function planGate(opType, opts = {}) {
  return function planGateMiddleware(req, res, next) {
    const userId   = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required', code: 'AUTH_REQUIRED' });

    const planCode = getUserPlanCode(userId);

    // 1. Check feature flag (e.g. STL export gated to Pro+)
    const featureKey = FEATURE_FLAG_MAP[opType];
    if (featureKey && !canPlanDo(planCode, featureKey)) {
      return res.status(403).json({
        error:       `Your ${planCode} plan does not include ${opType}. Upgrade to access this feature.`,
        code:        'FEATURE_NOT_IN_PLAN',
        opType,
        planCode,
        upgradeRequired: true,
      });
    }

    // 2. Check monthly quota
    const quotaKey = QUOTA_KEY_MAP[opType];
    if (quotaKey) {
      const limit  = getPlanLimit(planCode, quotaKey);
      // For blueprint_analysis, use blueprint_upload count as the quota gauge
      const usageKey = opType === 'blueprint_analysis' ? 'blueprint_upload' : opType;
      const quota  = checkQuota(userId, usageKey, limit);
      if (!quota.allowed) {
        return res.status(429).json({
          error:     `Monthly ${opType} limit reached (${quota.used}/${quota.limit}). Resets next month or upgrade your plan.`,
          code:      'QUOTA_EXCEEDED',
          opType,
          planCode,
          used:      quota.used,
          limit:     quota.limit,
          upgradeRequired: true,
        });
      }
      req.quotaCheck = quota;
    }

    // 3. Check credits (skip if opted out)
    if (!opts.skipCredits) {
      const creditResult = checkCredits(userId, opType);
      if (!creditResult.allowed) {
        return res.status(402).json({
          error:         creditResult.reason,
          code:          'INSUFFICIENT_CREDITS',
          opType,
          cost:          creditResult.cost,
          remaining:     creditResult.remaining,
          upgradeRequired: true,
        });
      }
      req.creditCheck = creditResult;
    }

    next();
  };
}

module.exports = { planGate };

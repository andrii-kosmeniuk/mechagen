'use strict';

/**
 * Seed — Plans and Dev User Bootstrap
 *
 * Run automatically at server startup.
 * Sets dev-user to the plan defined by DEV_PLAN env var (default: 'free').
 *
 * Usage from server.js:
 *   require('./seed/plans')();
 */

const { setUserPlan } = require('../src/services/subscriptionService');

module.exports = function seedPlans() {
  const devPlan    = process.env.DEV_PLAN    || 'free';
  const devUserId  = process.env.DEV_USER_ID || 'dev-user';

  setUserPlan(devUserId, devPlan);
  console.log(`[seed] dev-user (${devUserId}) seeded with plan: ${devPlan}`);

  // Seed extra demo users if in development
  if (process.env.NODE_ENV !== 'production') {
    setUserPlan('pro-user',  'pro');
    setUserPlan('team-user', 'team');
    setUserPlan('admin-user','admin');
    console.log('[seed] demo users seeded: pro-user, team-user, admin-user');
  }
};

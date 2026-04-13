'use strict';

/**
 * Waitlist Handler — Phase 5
 *
 * POST /api/waitlist             — submit waitlist entry (public)
 * GET  /api/waitlist/status      — check if email is on waitlist (public)
 * GET  /api/admin/waitlist       — admin: full list
 */

const { addToWaitlist, isOnWaitlist, getWaitlist, getWaitlistCount } = require('../services/waitlistService');
const { track } = require('../services/analyticsService');

// Spam protection: max 3 submissions per IP per hour
const ipSubmitCount = new Map();
setInterval(() => ipSubmitCount.clear(), 60 * 60 * 1000);

function submitWaitlist(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  const count = (ipSubmitCount.get(ip) || 0) + 1;
  ipSubmitCount.set(ip, count);
  if (count > 3) {
    return res.status(429).json({ error: 'Too many submissions. Please try again later.', code: 'RATE_LIMITED' });
  }

  const { email, name, company, useCase, source } = req.body || {};
  try {
    const { entry, alreadyRegistered } = addToWaitlist({ email, name, company, useCase, source });
    if (!alreadyRegistered) {
      track({ eventName: 'waitlist_submit', metadata: { source: source || 'direct' } });
    }
    return res.status(alreadyRegistered ? 200 : 201).json({
      ok: true,
      alreadyRegistered,
      message: alreadyRegistered
        ? "You're already on the waitlist — we'll be in touch soon!"
        : "You're on the list! We'll notify you when MechaGen opens.",
    });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message, code: err.code });
  }
}

function checkWaitlistStatus(req, res) {
  const email = req.query?.email;
  if (!email) return res.status(400).json({ error: 'email query param required' });
  return res.json({ onWaitlist: isOnWaitlist(email) });
}

function getAdminWaitlist(req, res) {
  const limit  = Math.min(parseInt(req.query?.limit || '100', 10), 500);
  const offset = parseInt(req.query?.offset || '0', 10);
  const result = getWaitlist({ limit, offset });
  return res.json({ ...result, count: getWaitlistCount() });
}

module.exports = { submitWaitlist, checkWaitlistStatus, getAdminWaitlist };

'use strict';

/**
 * Waitlist Service — Phase 5
 *
 * Lead capture with email-based deduplication.
 * Entries are stored in-memory and admin-queryable.
 */

const { randomUUID } = require('crypto');

/** email → waitlist entry */
const waitlistStore = new Map();

function _normalizeEmail(email) {
  return (email || '').toLowerCase().trim();
}

function _validate(email) {
  if (!email) throw Object.assign(new Error('Email is required'), { status: 400, code: 'MISSING_EMAIL' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(_normalizeEmail(email))) {
    throw Object.assign(new Error('Invalid email address'), { status: 400, code: 'INVALID_EMAIL' });
  }
}

/**
 * Add a new waitlist entry. Deduplicates by email.
 *
 * @returns {{ entry, alreadyRegistered }}
 */
function addToWaitlist({ email, name = null, company = null, useCase = null, source = null }) {
  _validate(email);
  const normalized = _normalizeEmail(email);

  if (waitlistStore.has(normalized)) {
    return { entry: waitlistStore.get(normalized), alreadyRegistered: true };
  }

  const entry = {
    id:        randomUUID(),
    email:     normalized,
    name:      name?.trim() || null,
    company:   company?.trim() || null,
    useCase:   useCase?.trim() || null,
    source:    source?.trim() || null,
    status:    'pending',
    createdAt: new Date().toISOString(),
  };
  waitlistStore.set(normalized, entry);
  return { entry, alreadyRegistered: false };
}

function isOnWaitlist(email) {
  return waitlistStore.has(_normalizeEmail(email));
}

function getWaitlistEntry(email) {
  return waitlistStore.get(_normalizeEmail(email)) || null;
}

function getWaitlist({ limit = 100, offset = 0 } = {}) {
  const all = Array.from(waitlistStore.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { entries: all.slice(offset, offset + limit), total: all.length };
}

function getWaitlistCount() {
  return waitlistStore.size;
}

module.exports = {
  addToWaitlist,
  isOnWaitlist,
  getWaitlistEntry,
  getWaitlist,
  getWaitlistCount,
};

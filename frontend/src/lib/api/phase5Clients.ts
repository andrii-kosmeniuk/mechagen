import type { SupabaseClient } from '@supabase/supabase-js';
import { createApi } from '../api';
import type { OnboardingState, WaitlistEntry, FeedbackEntry, LaunchSummary, AnalyticsEvent } from '../../types';

/**
 * Typed API clients for Phase 5 domain endpoints.
 * All functions use the shared createApi client for auth and error handling.
 */

// ── Onboarding ─────────────────────────────────────────────────────────────────

export function createOnboardingClient(supabase: SupabaseClient | null) {
  const api = createApi(supabase);
  return {
    get:      ()  => api.get<{ onboarding: OnboardingState }>('/api/me/onboarding'),
    advance:  ()  => api.post('/api/me/onboarding/advance'),
    complete: ()  => api.post('/api/me/onboarding/complete'),
    skip:     ()  => api.post('/api/me/onboarding/skip'),
  };
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export function createAnalyticsClient(supabase: SupabaseClient | null) {
  const api = createApi(supabase);
  return {
    track: (eventName: string, page?: string, metadata?: Record<string, unknown>) =>
      api.post('/api/analytics/track', { eventName, page, metadata }),
    summary: () => api.get('/api/analytics/summary'),
    recent:  () => api.get<{ events: AnalyticsEvent[] }>('/api/analytics/recent'),
  };
}

// ── Waitlist ──────────────────────────────────────────────────────────────────

export function createWaitlistClient(_supabase?: SupabaseClient | null) {
  const api = createApi(null);  // waitlist is public
  return {
    submit: (payload: { email: string; name?: string; company?: string; useCase?: string }) =>
      api.post<{ message: string; entry: WaitlistEntry }>('/api/waitlist', { ...payload, source: 'app' }),
    status: (email: string) =>
      api.get<{ registered: boolean; entry?: WaitlistEntry }>(`/api/waitlist/status?email=${encodeURIComponent(email)}`),
  };
}

// ── Feedback ──────────────────────────────────────────────────────────────────

export function createFeedbackClient(supabase: SupabaseClient | null) {
  const api = createApi(supabase);
  return {
    submit: (payload: { category: string; message: string; projectId?: string; generationId?: string }) =>
      api.post<{ entry: FeedbackEntry }>('/api/feedback', payload),
  };
}

// ── Demo ──────────────────────────────────────────────────────────────────────

export function createDemoClient() {
  const api = createApi(null);
  return {
    getProject:     () => api.get('/api/demo/project'),
    getGenerations: () => api.get('/api/demo/generations'),
    getBlueprint:   () => api.get('/api/demo/blueprint'),
  };
}

// ── Launch Admin ──────────────────────────────────────────────────────────────

export function createLaunchAdminClient(supabase: SupabaseClient | null) {
  const api = createApi(supabase);
  return {
    summary:    () => api.get<LaunchSummary>('/api/admin/launch'),
    onboarding: () => api.get('/api/admin/onboarding'),
    analytics:  () => api.get('/api/admin/analytics'),
    waitlist:   (page = 1, limit = 50) => api.get(`/api/admin/waitlist?page=${page}&limit=${limit}`),
    feedback:   (status?: string, category?: string) => {
      const q = new URLSearchParams();
      if (status)   q.set('status', status);
      if (category) q.set('category', category);
      return api.get(`/api/admin/feedback?${q.toString()}`);
    },
    updateFeedbackStatus: (id: string, newStatus: string) =>
      api.put(`/api/admin/feedback/${id}/status`, { status: newStatus }),
  };
}

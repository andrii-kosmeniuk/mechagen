import type { SupabaseClient } from '@supabase/supabase-js';
import { createApi } from '../api';
import type { GeomData, HistoryPart } from '../../types';

/**
 * Typed API clients for generation, blueprint, and export endpoints.
 * Separates fetch logic from UI components — use these in hooks, not components directly.
 */

// ── Generation ─────────────────────────────────────────────────────────────────

export function createGenerationClient(supabase: SupabaseClient | null) {
  const api = createApi(supabase);
  return {
    /** GET /api/generations/:id */
    get: (id: string) =>
      api.get<{ generation: GeomData }>(`/api/generations/${id}`),

    /** POST /api/pipeline/generate */
    create: (body: {
      prompt: string;
      projectId?: string;
      blueprintId?: string;
      solidRequested?: boolean;
      highDetail?: boolean;
      manufacturingMode?: string;
      materialPreference?: string;
    }) => api.post<{ jobId: string; status: string }>('/api/pipeline/generate', body),

    /** POST /api/generations/:id/repair */
    repair: (id: string) =>
      api.post<{ repaired: boolean }>(`/api/generations/${id}/repair`),

    /** GET /api/generations/:id/timeline */
    timeline: (id: string) =>
      api.get<{ events: HistoryPart[] }>(`/api/generations/${id}/timeline`),

    /** GET /api/projects/:projectId/history */
    projectHistory: (projectId: string) =>
      api.get(`/api/projects/${projectId}/history`),
  };
}

// ── Blueprint ─────────────────────────────────────────────────────────────────

export function createBlueprintClient(supabase: SupabaseClient | null) {
  const api = createApi(supabase);
  return {
    /** GET /api/blueprints/:id */
    get: (id: string) => api.get(`/api/blueprints/${id}`),

    /** POST /api/blueprints/:id/analyze */
    analyze: (id: string) => api.post(`/api/blueprints/${id}/analyze`),
  };
}

// ── Export ────────────────────────────────────────────────────────────────────

export function createExportClient(supabase: SupabaseClient | null) {
  const api = createApi(supabase);
  return {
    /** GET /api/generations/:id/export/status */
    status: (id: string) =>
      api.get<{ ready: boolean; formats: string[] }>(`/api/generations/${id}/export/status`),

    /** Download OBJ — returns URL to navigate to */
    objUrl:  (id: string) => `/api/generations/${id}/export/obj`,
    glbUrl:  (id: string) => `/api/generations/${id}/export/glb`,
    stlUrl:  (id: string) => `/api/generations/${id}/export/stl`,
  };
}

// ── Solid Build ───────────────────────────────────────────────────────────────

export function createSolidBuildClient(supabase: SupabaseClient | null) {
  const api = createApi(supabase);
  return {
    /** POST /api/generations/:id/solid/start */
    start: (id: string, opts?: { highDetail?: boolean }) =>
      api.post<{ buildId: string; status: string }>(`/api/generations/${id}/solid/start`, opts),

    /** GET /api/generations/:id/solid/status */
    status: (id: string) =>
      api.get<{ status: string; stlBase64?: string; error?: string }>(`/api/generations/${id}/solid/status`),
  };
}

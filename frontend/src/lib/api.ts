import type { SupabaseClient } from '@supabase/supabase-js';

const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';

export function createApi(supabase: SupabaseClient | null) {
  async function call<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T | null | undefined> {
    // Get optional auth token — don't block if supabase is null or no session
    let idToken: string | undefined;
    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        idToken = session?.access_token;
      } catch { /* no session, continue without token */ }
    }

    try {
      const res = await fetch(API_BASE + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401) return null;
      if (res.status === 404) return null;
      if (res.status === 429) throw new Error('AI quota exceeded');

      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!res.ok) {
        if (!isJson) return null;
        const errData = (await res.json()) as { message?: string; error?: string };
        throw new Error(errData?.message || errData?.error || `Request failed (${res.status})`);
      }

      if (!isJson) return null;
      return (await res.json()) as T;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  return {
    get: <T = unknown>(path: string) => call<T>('GET', path),
    post: <T = unknown>(path: string, body?: unknown) =>
      call<T>('POST', path, body),
    put: <T = unknown>(path: string, body?: unknown) =>
      call<T>('PUT', path, body),
    delete: <T = unknown>(path: string) => call<T>('DELETE', path),
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Generation } from '../types';

const BACKEND = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:3001';
const HISTORY_PAGE_SIZE = 20;

export interface UseHistoryReturn {
  generations:   Generation[];
  loading:       boolean;
  error:         string | null;
  hasMore:       boolean;
  reload:        () => Promise<void>;
  loadMore:      () => Promise<void>;
  loadById:      (id: string) => Promise<Generation | null>;
}

/**
 * useHistory — load and browse past generations from persistence.
 *
 * Usage:
 *   const { generations, loading, reload } = useHistory();
 */
export function useHistory(projectId?: string): UseHistoryReturn {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [offset, setOffset]           = useState(0);
  const [hasMore, setHasMore]         = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const buildUrl = useCallback((off: number) => {
    const base = projectId
      ? `${BACKEND}/api/projects/${encodeURIComponent(projectId)}/history`
      : `${BACKEND}/api/history`;
    return `${base}?limit=${HISTORY_PAGE_SIZE}&offset=${off}`;
  }, [projectId]);

  const reload = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl(0), { signal: abortRef.current.signal });
      if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
      const data = await res.json() as { generations?: Generation[]; items?: Generation[]; history?: Generation[] };
      const items = data.generations ?? data.items ?? data.history ?? (Array.isArray(data) ? data : []);
      setGenerations(items);
      setOffset(items.length);
      setHasMore(items.length >= HISTORY_PAGE_SIZE);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError((err as Error).message || 'History load failed');
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetch(buildUrl(offset));
      if (!res.ok) throw new Error(`Failed to load more (${res.status})`);
      const data = await res.json() as { generations?: Generation[]; items?: Generation[]; history?: Generation[] };
      const items = data.generations ?? data.items ?? data.history ?? (Array.isArray(data) ? data : []);
      setGenerations(prev => [...prev, ...items]);
      setOffset(prev => prev + items.length);
      setHasMore(items.length >= HISTORY_PAGE_SIZE);
    } catch (err: unknown) {
      setError((err as Error).message || 'Load more failed');
    } finally {
      setLoading(false);
    }
  }, [buildUrl, loading, hasMore, offset]);

  const loadById = useCallback(async (id: string): Promise<Generation | null> => {
    try {
      const res = await fetch(`${BACKEND}/api/generations/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      return await res.json() as Generation;
    } catch {
      return null;
    }
  }, []);

  // Auto-load on mount
  useEffect(() => { void reload(); }, [reload]);

  // Cleanup pending requests
  useEffect(() => () => abortRef.current?.abort(), []);

  return { generations, loading, error, hasMore, reload, loadMore, loadById };
}

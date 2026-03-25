import { useCallback, useEffect, useRef, useState } from 'react';
import type { Generation, GenerationStatus, ManufacturingMode, ExportReadiness } from '../types';

const POLL_INTERVAL_MS = 1500;
const TERMINAL_STATES = new Set<GenerationStatus>(['ready', 'failed']);
const BACKEND = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:3001';

interface GenerateParams {
  prompt: string;
  context?: string;
  manufacturingMode?: ManufacturingMode;
  materialPreference?: string;
  highDetail?: boolean;
  projectName?: string;
  blueprintId?: string;   // Phase 2
  solidRequested?: boolean; // Phase 3
}

interface UsePipelineReturn {
  generation:   Generation | null;
  generating:   boolean;
  repairing:    boolean;
  error:        string | null;
  generate:     (params: GenerateParams) => Promise<void>;
  repair:       () => Promise<void>;
  reset:        () => void;
  exportStatus: () => Promise<ExportReadiness | null>;
  downloadObj:  () => void;
  downloadGlb:  () => void;
  downloadStl:  () => void; // Phase 3
}

export function usePipeline(): UsePipelineReturn {
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [generating, setGenerating] = useState(false);
  const [repairing,  setRepairing]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef     = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  }, []);

  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND}/api/generations/${jobId}`);
        if (!res.ok) { console.warn('[pipeline] poll failed', res.status); return; }
        const gen: Generation = await res.json();
        setGeneration(gen);
        if (TERMINAL_STATES.has(gen.status)) {
          stopPolling();
          setGenerating(false);
          if (gen.status === 'failed') setError(gen.errorContext || 'Pipeline failed');
        }
      } catch (err) { console.warn('[pipeline] poll error', err); }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const generate = useCallback(async (params: GenerateParams) => {
    setError(null);
    setGeneration(null);
    setGenerating(true);
    try {
      const res = await fetch(`${BACKEND}/api/pipeline/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Server error ${res.status}`);
      }
      const { jobId } = (await res.json()) as { jobId: string; status: string };
      jobIdRef.current = jobId;
      startPolling(jobId);
    } catch (err) {
      setError((err as Error).message || 'Request failed');
      setGenerating(false);
    }
  }, [startPolling]);

  const repair = useCallback(async () => {
    const id = jobIdRef.current || generation?.id;
    if (!id) return;
    setRepairing(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/generations/${id}/repair`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || 'Repair failed');
      }
      const updated: Generation = await res.json();
      setGeneration(updated);
    } catch (err) {
      setError((err as Error).message || 'Repair failed');
    } finally {
      setRepairing(false);
    }
  }, [generation?.id]);

  const reset = useCallback(() => {
    stopPolling();
    setGeneration(null); setGenerating(false); setRepairing(false); setError(null);
    jobIdRef.current = null;
  }, [stopPolling]);

  // ─── Phase 2: Export helpers ─────────────────────────────────────────────

  const exportStatus = useCallback(async (): Promise<ExportReadiness | null> => {
    const id = jobIdRef.current || generation?.id;
    if (!id) return null;
    try {
      const res = await fetch(`${BACKEND}/api/generations/${id}/export/status`);
      if (!res.ok) return null;
      return await res.json() as ExportReadiness;
    } catch { return null; }
  }, [generation?.id]);

  const downloadObj = useCallback(() => {
    const id = jobIdRef.current || generation?.id;
    if (!id) return;
    window.open(`${BACKEND}/api/generations/${id}/export/obj`, '_blank');
  }, [generation?.id]);

  const downloadGlb = useCallback(() => {
    const id = jobIdRef.current || generation?.id;
    if (!id) return;
    window.open(`${BACKEND}/api/generations/${id}/export/glb`, '_blank');
  }, [generation?.id]);

  const downloadStl = useCallback(() => {
    const id = jobIdRef.current || generation?.id;
    if (!id) return;
    window.open(`${BACKEND}/api/generations/${id}/export/stl`, '_blank');
  }, [generation?.id]);

  return { generation, generating, repairing, error, generate, repair, reset, exportStatus, downloadObj, downloadGlb, downloadStl };
}

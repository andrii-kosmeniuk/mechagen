import React, { useCallback, useEffect, useRef, useState } from 'react';

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) || 'http://127.0.0.1:3001';

const SOLID_STATUSES = ['translating_solid', 'building_solid', 'solid_validating', 'solid_ready', 'solid_failed'] as const;
type SolidStatusEnum = typeof SOLID_STATUSES[number];

interface MeshCheck { triangleCount: number; valid: boolean; }

interface SolidBuildRecord {
  id: string;
  status: SolidStatusEnum | 'not_started';
  generationId: string;
  executionTimeMs: number | null;
  stlFileUrl: string | null;
  stlFileSizeBytes: number | null;
  meshCheck: MeshCheck | null;
  errorReason: string | null;
  validationJson: { solidValid: boolean; checks: { id: string; passed: boolean; detail: string }[] } | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  generationId: string | null;
  generationStatus: string;
  onSolidBuilt?: () => void;
}

const STATUS_CONFIG: Record<string, { icon: string; label: string; color: string; pulse?: boolean }> = {
  not_started:       { icon: '🔷', label: 'Solid not built yet',    color: 'var(--text-muted)'     },
  translating_solid: { icon: '⚙',  label: 'Translating geometry…',  color: '#fbbf24', pulse: true  },
  building_solid:    { icon: '🏗',  label: 'CadQuery building…',     color: '#60a5fa', pulse: true  },
  solid_validating:  { icon: '🔬', label: 'Validating solid…',      color: '#a78bfa', pulse: true  },
  solid_ready:       { icon: '✅', label: 'Solid ready',            color: '#4ade80'               },
  solid_failed:      { icon: '❌', label: 'Solid build failed',     color: '#f87171'               },
};

const ACTIVE_STATUSES = new Set(['translating_solid', 'building_solid', 'solid_validating']);

export function SolidStatusPanel({ generationId, generationStatus, onSolidBuilt }: Props) {
  const [solidBuild, setSolidBuild] = useState<SolidBuildRecord | null>(null);
  const [solidStatus, setSolidStatus] = useState<string>('not_started');
  const [starting, setStarting]       = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [showChecks, setShowChecks]   = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const poll = useCallback(async () => {
    if (!generationId) return;
    try {
      const r = await fetch(`${BACKEND}/api/generations/${generationId}/solid/status`);
      if (!r.ok) return;
      const data = await r.json();
      setSolidStatus(data.solidStatus ?? 'not_started');
      setSolidBuild(data.solidBuild ?? null);
      if (!ACTIVE_STATUSES.has(data.solidStatus)) {
        stopPolling();
        if (data.solidStatus === 'solid_ready') onSolidBuilt?.();
      }
    } catch {}
  }, [generationId, stopPolling, onSolidBuilt]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(poll, 1500);
  }, [poll, stopPolling]);

  useEffect(() => {
    void poll();
    return stopPolling;
  }, [poll, stopPolling]);

  const requestSolidBuild = async () => {
    if (!generationId) return;
    setStarting(true);
    setError(null);
    try {
      const r = await fetch(`${BACKEND}/api/generations/${generationId}/solid/start`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to start solid build');
      setSolidStatus(data.status);
      startPolling();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const downloadStl = () => {
    if (!generationId) return;
    window.open(`${BACKEND}/api/generations/${generationId}/export/stl`, '_blank');
  };

  const cfg = STATUS_CONFIG[solidStatus] || STATUS_CONFIG['not_started'];
  const isActive   = ACTIVE_STATUSES.has(solidStatus);
  const isReady    = solidStatus === 'solid_ready';
  const isFailed   = solidStatus === 'solid_failed';
  const canStart   = generationStatus === 'ready' && (solidStatus === 'not_started' || solidStatus === 'solid_failed');
  const checks     = solidBuild?.validationJson?.checks ?? [];
  const execSec    = solidBuild?.executionTimeMs ? (solidBuild.executionTimeMs / 1000).toFixed(1) : null;
  const stlKb      = solidBuild?.stlFileSizeBytes ? (solidBuild.stlFileSizeBytes / 1024).toFixed(0) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Status card */}
      <div style={{
        padding: '10px 12px', borderRadius: 9,
        background: `${cfg.color}09`,
        border: `1px solid ${cfg.color}30`,
        transition: 'all 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: 14,
            animation: isActive ? 'spin 1.5s linear infinite' : 'none',
          }}>{cfg.icon}</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: cfg.color }}>{cfg.label}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
              SOLID PATH — CadQuery + Python Worker
            </div>
          </div>
        </div>

        {/* Metadata row */}
        {(execSec || stlKb || solidBuild?.meshCheck) && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            {execSec && <span>⏱ {execSec}s</span>}
            {stlKb && <span>📦 {stlKb} KB STL</span>}
            {solidBuild?.meshCheck && (
              <span>🔺 {solidBuild.meshCheck.triangleCount} triangles</span>
            )}
          </div>
        )}

        {/* Progress bar for active states */}
        {isActive && (
          <div style={{
            height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden', marginTop: 4,
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
              animation: 'shimmer 1.4s ease-in-out infinite',
              width: '60%',
            }} />
          </div>
        )}
      </div>

      {/* Error */}
      {isFailed && solidBuild?.errorReason && (
        <div style={{
          padding: '7px 10px', borderRadius: 7, fontSize: 10,
          background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)',
          color: '#f87171', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {solidBuild.errorReason.slice(0, 500)}
        </div>
      )}

      {/* Validation checks */}
      {checks.length > 0 && (
        <div>
          <button
            onClick={() => setShowChecks(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em',
              padding: '2px 0', marginBottom: showChecks ? 6 : 0,
            }}
          >
            <span style={{ transform: showChecks ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
            SOLID VALIDATION ({checks.filter(c => c.passed).length}/{checks.length} checks passed)
          </button>
          {showChecks && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {checks.map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                  padding: '4px 8px', borderRadius: 5, fontSize: 10,
                  background: c.passed ? 'rgba(74,222,128,0.05)' : 'rgba(248,113,113,0.05)',
                  border: `1px solid ${c.passed ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'}`,
                }}>
                  <span>{c.passed ? '✓' : '✗'}</span>
                  <span style={{ color: 'var(--text-muted)', flex: 1 }}>{c.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        {canStart && (
          <button
            onClick={requestSolidBuild}
            disabled={starting}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 7, border: 'none',
              cursor: starting ? 'not-allowed' : 'pointer',
              fontSize: 10, fontWeight: 700,
              background: starting ? 'rgba(99,102,241,0.1)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: starting ? 'var(--text-muted)' : '#fff',
              boxShadow: starting ? 'none' : '0 3px 12px rgba(99,102,241,0.3)',
            }}
          >
            {starting ? '⏳ Starting…' : '🏗 Build Solid (STL)'}
          </button>
        )}
        {isReady && (
          <button
            onClick={downloadStl}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 7, border: 'none',
              cursor: 'pointer', fontSize: 10, fontWeight: 700,
              background: 'rgba(74,222,128,0.15)', color: '#4ade80',
            }}
          >
            ↓ Download STL
          </button>
        )}
      </div>

      {/* api error */}
      {error && (
        <div style={{
          padding: '5px 8px', borderRadius: 5, fontSize: 10,
          background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)',
          color: '#f87171',
        }}>❌ {error}</div>
      )}

      {/* Trust label */}
      <div style={{ fontSize: 9, color: 'rgba(126,184,247,0.4)', textAlign: 'center', lineHeight: 1.4 }}>
        {isReady
          ? '✅ Solid-backed geometry — produced by CadQuery from deterministic geometry plan'
          : '🔷 Preview path (fast) and solid path (trusted) are separate — both shown clearly'
        }
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%,100% { transform: translateX(-100%); } 50% { transform: translateX(200%); } }
      `}</style>
    </div>
  );
}

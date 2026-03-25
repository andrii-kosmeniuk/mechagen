import React, { useCallback, useEffect, useState } from 'react';
import type { ProjectHistory, Generation, BlueprintRecord, ExportRecord } from '../types';

interface Props {
  projectId?: string;
  onSelectGeneration?: (gen: Generation) => void;
}

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) || 'http://127.0.0.1:3001';

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'ready'          ? '#4ade80' :
    status === 'failed'         ? '#f87171' :
    status === 'repairing'      ? '#a78bfa' : '#fbbf24';
  return (
    <span style={{
      width: 7, height: 7, borderRadius: '50%',
      background: color, display: 'inline-block', flexShrink: 0,
    }} />
  );
}

function ExportBadge({ record }: { record: ExportRecord }) {
  const label = record.type.toUpperCase();
  const color = record.type === 'obj' ? '#34d399' : '#60a5fa';
  return (
    <a
      href={`${BACKEND}${record.fileUrl}`}
      download={record.fileName}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 8,
        fontSize: 10, fontWeight: 700, textDecoration: 'none',
        background: `${color}15`, border: `1px solid ${color}35`, color,
        cursor: 'pointer',
      }}
    >
      ↓ {label}
    </a>
  );
}

function SolidBadge({ solidStatus }: { solidStatus?: string | null }) {
  if (solidStatus === 'solid_ready') {
    return (
      <span style={{
        padding: '1px 7px', borderRadius: 7, fontSize: 9, fontWeight: 800,
        background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)',
        color: '#4ade80', letterSpacing: '0.04em',
      }}>SOLID ✓</span>
    );
  }
  if (solidStatus === 'solid_failed') {
    return (
      <span style={{
        padding: '1px 7px', borderRadius: 7, fontSize: 9, fontWeight: 800,
        background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
        color: '#f87171', letterSpacing: '0.04em',
      }}>SOLID ✗</span>
    );
  }
  if (solidStatus && solidStatus !== 'not_started') {
    return (
      <span style={{
        padding: '1px 7px', borderRadius: 7, fontSize: 9, fontWeight: 800,
        background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)',
        color: '#a78bfa', letterSpacing: '0.04em',
      }}>BUILDING…</span>
    );
  }
  return null;
}

function BlueprintThumb({ blueprint }: { blueprint: BlueprintRecord }) {
  if (!blueprint.previewable) {
    return (
      <div style={{
        width: 36, height: 36, borderRadius: 5, flexShrink: 0,
        background: 'rgba(126,184,247,0.08)', border: '1px solid rgba(126,184,247,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
      }}>📄</div>
    );
  }
  return (
    <img
      src={`${BACKEND}${blueprint.fileUrl}`}
      alt={blueprint.fileName}
      style={{
        width: 36, height: 36, objectFit: 'cover', borderRadius: 5, flexShrink: 0,
        border: '1px solid rgba(126,184,247,0.2)',
        background: 'rgba(0,0,0,0.2)',
      }}
    />
  );
}

function GenCard({
  gen,
  blueprint,
  exports,
  onSelect,
}: {
  gen: Generation;
  blueprint?: BlueprintRecord;
  exports: ExportRecord[];
  onSelect?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const promptSnippet = (gen.prompt || '').slice(0, 80) + ((gen.prompt || '').length > 80 ? '…' : '');
  const bpAnalysis = blueprint?.analysisJson;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(126,184,247,0.12)',
        borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
        transition: 'border-color 0.15s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(126,184,247,0.3)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(126,184,247,0.12)')}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {/* Blueprint thumb or icon */}
        {blueprint ? (
          <BlueprintThumb blueprint={blueprint} />
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: 5, flexShrink: 0,
            background: 'rgba(126,184,247,0.06)', border: '1px solid rgba(126,184,247,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>🔬</div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Status + part type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <StatusDot status={gen.status} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#7eb8f7' }}>
              {gen.specJson?.partType?.replace(/_/g, ' ').toUpperCase() || gen.status.toUpperCase()}
            </span>
            <SolidBadge solidStatus={(gen as Generation & { solidStatus?: string }).solidStatus} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {new Date(gen.createdAt).toLocaleString()}
            </span>
          </div>

          {/* Prompt snippet */}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 6 }}>
            {promptSnippet || <em>No prompt</em>}
          </div>

          {/* Export badges */}
          {exports.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
              {exports.map(e => <ExportBadge key={e.id} record={e} />)}
            </div>
          )}

          {/* Actions row */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {gen.status === 'ready' && onSelect && (
              <button
                onClick={e => { e.stopPropagation(); onSelect(); }}
                style={{
                  padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: 10, fontWeight: 700,
                  background: 'rgba(126,184,247,0.15)', color: '#7eb8f7',
                }}
              >
                ↩ Load
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
              style={{
                padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontSize: 10, fontWeight: 700,
                background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)',
              }}
            >
              {expanded ? '▲ Less' : '▼ Details'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid rgba(126,184,247,0.1)', paddingTop: 10 }}>
          {/* Blueprint analysis snippet */}
          {bpAnalysis && (
            <div style={{
              background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)',
              borderRadius: 6, padding: '7px 10px', marginBottom: 8,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>
                BLUEPRINT: {bpAnalysis.detectedPartType.replace(/_/g, ' ').toUpperCase()}
                {' '}({Math.round(bpAnalysis.confidence * 100)}% confidence)
              </div>
              {Object.keys(bpAnalysis.observedDimensions).length > 0 && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Dims: {Object.entries(bpAnalysis.observedDimensions)
                    .slice(0, 4)
                    .map(([k, v]) => `${k}: ${v}mm`)
                    .join(' · ')}
                </div>
              )}
            </div>
          )}

          {/* Validation summary */}
          {gen.validationReport && (
            <div style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 10, marginBottom: 6,
              background: gen.validationReport.valid
                ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)',
              border: `1px solid ${gen.validationReport.valid
                ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
              color: gen.validationReport.valid ? '#4ade80' : '#f87171',
            }}>
              {gen.validationReport.valid ? '✅ Validation passed' : `⚠ ${gen.validationReport.severity?.toUpperCase()} severity`}
              {!gen.validationReport.valid && gen.validationReport.errors?.length > 0 && (
                <span style={{ color: 'var(--text-muted)' }}> — {gen.validationReport.errors.length} error(s)</span>
              )}
            </div>
          )}

          {/* Repair history */}
          {gen.repairHistory && gen.repairHistory.length > 0 && (
            <div style={{ fontSize: 10, color: '#c4b5fd' }}>
              🔧 {gen.repairHistory.length} repair attempt(s)
            </div>
          )}

          {/* Build metadata */}
          {gen.buildMetadata && Object.keys(gen.buildMetadata).length > 0 && (() => {
            const m = gen.buildMetadata as Record<string, unknown>;
            return (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                {Boolean(m.totalDurationMs) && <span>⏱ {Math.round(Number(m.totalDurationMs) / 1000)}s · </span>}
                {m.previewPartCount !== undefined && <span>🔷 {Number(m.previewPartCount)} primitives · </span>}
                {m.specConfidence !== undefined && <span>🎯 {Math.round(Number(m.specConfidence) * 100)}% spec conf</span>}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export function HistoryPanel({ projectId = 'default-project', onSelectGeneration }: Props) {
  const [history, setHistory] = useState<ProjectHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${BACKEND}/api/projects/${projectId}/history`);
      if (!resp.ok) throw new Error('Failed to load history');
      const data = await resp.json();
      setHistory(data as ProjectHistory);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 11, padding: '20px 0', textAlign: 'center' }}>⏳ Loading history…</div>;
  }
  if (error) {
    return (
      <div style={{ padding: '10px 12px', borderRadius: 8, fontSize: 11,
        background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
        ❌ {error}
        <button onClick={load} style={{ marginLeft: 8, fontSize: 10, color: '#7eb8f7', background: 'none', border: 'none', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }
  if (!history || history.totalGenerations === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No generations yet</div>
        <div style={{ fontSize: 10, color: 'rgba(126,184,247,0.5)', marginTop: 4 }}>
          Use the Pipeline tab to generate your first part
        </div>
      </div>
    );
  }

  // Build lookup maps
  const bpById = new Map(history.blueprints.map(b => [b.id, b]));
  const exportsByGenId = new Map<string, ExportRecord[]>();
  for (const e of history.exports) {
    if (!exportsByGenId.has(e.generationId)) exportsByGenId.set(e.generationId, []);
    exportsByGenId.get(e.generationId)!.push(e);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        {[
          { label: 'Generations', value: history.totalGenerations, color: '#7eb8f7' },
          { label: 'Blueprints',  value: history.totalBlueprints,  color: '#60a5fa' },
          { label: 'Exports',     value: history.totalExports,     color: '#34d399' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 7,
            background: `${s.color}08`, border: `1px solid ${s.color}20`,
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Refresh */}
      <button
        onClick={load}
        style={{
          alignSelf: 'flex-end', padding: '3px 10px', borderRadius: 5,
          border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
          background: 'rgba(126,184,247,0.1)', color: '#7eb8f7', marginBottom: 4,
        }}
      >
        ↻ Refresh
      </button>

      {/* Generation cards */}
      {history.generations.map(gen => (
        <GenCard
          key={gen.id}
          gen={gen}
          blueprint={gen.blueprintId ? bpById.get(gen.blueprintId) : undefined}
          exports={exportsByGenId.get(gen.id) ?? []}
          onSelect={onSelectGeneration ? () => onSelectGeneration(gen) : undefined}
        />
      ))}
    </div>
  );
}

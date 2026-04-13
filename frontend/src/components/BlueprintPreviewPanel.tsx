import React, { useState } from 'react';
import type { BlueprintRecord, BlueprintAnalysis } from '../types';

interface Props {
  blueprint: BlueprintRecord | null;
  onAnalyze?: () => void;
  analyzing?: boolean;
}

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) || 'http://127.0.0.1:3001';

function ConfidencePill({ value }: { value: number }) {
  const pct   = Math.round(value * 100);
  const color = value >= 0.7 ? '#4ade80' : value >= 0.45 ? '#fbbf24' : '#f87171';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
      background: `${color}18`, border: `1px solid ${color}40`, color,
    }}>
      {pct}% confidence
    </span>
  );
}

function Tag({ text, color = '#7eb8f7' }: { text: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 10,
      fontSize: 10, fontWeight: 600,
      background: `${color}15`, border: `1px solid ${color}35`, color,
      marginRight: 4, marginBottom: 4,
    }}>{text}</span>
  );
}

function Row({ label, value, source }: { label: string; value: string; source?: 'blueprint' | 'assumed' }) {
  const color = source === 'blueprint' ? '#60a5fa' : '#fbbf24';
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '3px 10px', borderRadius: 6,
      background: `${color}08`, border: `1px solid ${color}18`,
      marginBottom: 3,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {label.replace(/([A-Z])/g, ' $1').trim()}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</span>
        {source && (
          <span style={{ fontSize: 9, color, opacity: 0.7, fontWeight: 600 }}>
            {source === 'blueprint' ? 'BLUEPRINT' : 'ASSUMED'}
          </span>
        )}
      </div>
    </div>
  );
}

export function BlueprintPreviewPanel({ blueprint, onAnalyze, analyzing }: Props) {
  const [analyzing_, setAnalyzing_] = useState(analyzing ?? false);
  const [analysis,   setAnalysis]   = useState<BlueprintAnalysis | null>(blueprint?.analysisJson ?? null);
  const [error,      setError]      = useState<string | null>(null);

  if (!blueprint) return null;

  const runAnalysis = async () => {
    setAnalyzing_(true);
    setError(null);
    try {
      const resp = await fetch(`${BACKEND}/api/blueprints/${blueprint.id}/analyze`, { method: 'POST' });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Analysis failed');
      setAnalysis(data.analysis);
      onAnalyze?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAnalyzing_(false);
    }
  };

  const a = analysis;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Blueprint file card */}
      <div style={{
        background: 'rgba(126,184,247,0.05)', border: '1px solid rgba(126,184,247,0.15)',
        borderRadius: 8, padding: '10px 12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.07em', marginBottom: 3 }}>
              BLUEPRINT REFERENCE
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              {blueprint.fileName}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {blueprint.previewable ? '🖼️ Image' : '📄 PDF'} · {(blueprint.fileSize / 1024).toFixed(0)} KB
            </div>
          </div>

          {!a && blueprint.previewable && (
            <button
              onClick={runAnalysis}
              disabled={analyzing_}
              style={{
                padding: '5px 11px', borderRadius: 6, border: 'none',
                cursor: analyzing_ ? 'not-allowed' : 'pointer',
                fontSize: 10, fontWeight: 700,
                background: analyzing_ ? 'rgba(126,184,247,0.1)' : 'rgba(126,184,247,0.2)',
                color: analyzing_ ? 'var(--text-muted)' : '#7eb8f7',
              }}
            >
              {analyzing_ ? '⏳ Analysing…' : '🔍 Analyse'}
            </button>
          )}
        </div>

        {/* Image preview */}
        {blueprint.previewable && (
          <div style={{
            marginTop: 8, borderRadius: 6, overflow: 'hidden',
            border: '1px solid rgba(126,184,247,0.15)',
            maxHeight: 120,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.2)',
          }}>
            <img
              src={`${BACKEND}${blueprint.fileUrl}`}
              alt="Blueprint"
              style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }}
            />
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: '6px 10px', borderRadius: 6, fontSize: 10,
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
          color: '#f87171',
        }}>❌ {error}</div>
      )}

      {/* Analysis results */}
      {a && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 12px', borderRadius: 8,
            background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.18)',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 2 }}>
                AI Blueprint Analysis
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Detected: <strong style={{ color: '#60a5fa' }}>
                  {a.detectedPartType.replace(/_/g, ' ').toUpperCase()}
                </strong>
              </div>
            </div>
            <ConfidencePill value={a.confidence} />
          </div>

          {/* Observed dimensions */}
          {Object.keys(a.observedDimensions).length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 5 }}>
                OBSERVED DIMENSIONS <span style={{ color: '#60a5fa', fontSize: 9 }}>FROM BLUEPRINT</span>
              </div>
              {Object.entries(a.observedDimensions).map(([k, v]) => (
                <Row key={k} label={k} value={`${v} mm`} source="blueprint" />
              ))}
            </div>
          )}

          {/* Features */}
          {a.observedFeatures.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 5 }}>
                VISIBLE FEATURES
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {a.observedFeatures.map(f => <Tag key={f} text={f} color="#60a5fa" />)}
                {a.visibleHoleCount > 0 && (
                  <Tag text={`${a.visibleHoleCount} hole(s)`} color="#a78bfa" />
                )}
              </div>
            </div>
          )}

          {/* Symmetry + manufacturing */}
          {(a.symmetryHints.length > 0 || a.manufacturingHints.length > 0) && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 5 }}>
                HINTS
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {a.symmetryHints.map(s => <Tag key={s} text={s} color="#34d399" />)}
                {a.manufacturingHints.map(h => <Tag key={h} text={h} color="#fbbf24" />)}
              </div>
            </div>
          )}

          {/* Text read */}
          {a.textReadFromBlueprint.length > 0 && (
            <div style={{
              padding: '6px 10px', borderRadius: 6, fontSize: 10,
              background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)',
              color: '#60a5fa', fontFamily: 'monospace',
            }}>
              📝 {a.textReadFromBlueprint.join(' · ')}
            </div>
          )}

          {/* Uncertainties */}
          {a.uncertainties.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 4 }}>
                UNCERTAINTIES
              </div>
              {a.uncertainties.map((u, i) => (
                <div key={i} style={{
                  padding: '4px 8px', borderRadius: 5, fontSize: 10, marginBottom: 3,
                  background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
                  color: '#fbbf24',
                }}>⚠ {u}</div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

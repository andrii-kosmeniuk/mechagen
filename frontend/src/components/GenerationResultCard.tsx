import React, { useState } from 'react';
import type { Generation } from '../types';

/**
 * GenerationResultCard
 *
 * At-a-glance engineering summary displayed prominently when a
 * generation reaches "ready" status. Shows:
 *   - Status + part type
 *   - Confidence, duration, plan complexity
 *   - Preview-only vs solid-ready indicator
 *   - Blueprint-assisted badge
 *   - Repair attempts indicator
 *   - Expandable spec JSON inspector
 */

interface Props {
  generation: Generation;
}

function MetaChip({
  icon, label, value, color,
}: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '6px 10px', borderRadius: 7, flex: '1 1 0',
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      gap: 2, minWidth: 56,
    }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontSize: 9, fontWeight: 800, color: color || 'var(--text-muted)', letterSpacing: '0.05em' }}>
        {value}
      </span>
      <span style={{ fontSize: 8, color: 'rgba(148,163,184,0.6)' }}>{label}</span>
    </div>
  );
}

function TrustIndicator({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? '#4ade80' : pct >= 60 ? '#fbbf24' : '#f87171';
  const label = pct >= 80 ? 'High Trust' : pct >= 60 ? 'Moderate' : 'Low Trust';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.06em' }}>
          AI CONFIDENCE — {label}
        </span>
        <span style={{ fontSize: 10, fontWeight: 800, color, fontFamily: 'monospace' }}>{pct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
}

export function GenerationResultCard({ generation }: Props) {
  const [showSpec, setShowSpec] = useState(false);

  const { specJson, geometryPlan, buildMetadata, validationReport, repairHistory, solidStatus } = generation;

  if (generation.status !== 'ready') return null;

  const partType     = specJson?.partType?.replace(/_/g, ' ').toUpperCase() ?? '—';
  const confidence   = specJson?.confidence ?? 0;
  const durationSec  = buildMetadata?.totalDurationMs
    ? (Number(buildMetadata.totalDurationMs) / 1000).toFixed(1)
    : null;
  const planSteps    = Array.isArray(geometryPlan?.buildSteps) ? geometryPlan.buildSteps.length : 0;
  const repairCount  = repairHistory?.length ?? 0;
  const validPassed  = validationReport?.valid ?? true;
  const hadBlueprint = Boolean(buildMetadata?.hadBlueprint);
  const isSolidReady = solidStatus === 'solid_ready';
  const mode         = specJson?.manufacturingMode?.replace(/_/g, ' ') ?? 'unknown';

  const statusColor = validPassed ? '#4ade80' : '#fbbf24';

  return (
    <div style={{
      border: `1px solid ${statusColor}28`,
      borderRadius: 10,
      background: `${statusColor}07`,
      overflow: 'hidden',
    }}>

      {/* Header bar */}
      <div style={{
        padding: '10px 12px',
        borderBottom: `1px solid ${statusColor}18`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 15 }}>{validPassed ? '✅' : '⚠️'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: statusColor, letterSpacing: '0.03em' }}>
            {partType}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
            {specJson?.intentSummary}
          </div>
        </div>
        {/* Badges */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {hadBlueprint && (
            <span style={{
              padding: '2px 6px', borderRadius: 5, fontSize: 8, fontWeight: 800,
              background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
              color: '#a78bfa', letterSpacing: '0.04em',
            }}>📐 BLUEPRINT</span>
          )}
          {isSolidReady ? (
            <span style={{
              padding: '2px 6px', borderRadius: 5, fontSize: 8, fontWeight: 800,
              background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
              color: '#4ade80', letterSpacing: '0.04em',
            }}>SOLID ✓</span>
          ) : (
            <span style={{
              padding: '2px 6px', borderRadius: 5, fontSize: 8, fontWeight: 800,
              background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)',
              color: '#60a5fa', letterSpacing: '0.04em',
            }}>PREVIEW</span>
          )}
        </div>
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Confidence bar */}
        <TrustIndicator confidence={confidence} />

        {/* Meta chips row */}
        <div style={{ display: 'flex', gap: 5 }}>
          {durationSec && <MetaChip icon="⏱" label="Duration" value={`${durationSec}s`} color="#7eb8f7" />}
          <MetaChip icon="🔩" label="Steps" value={planSteps} color="#a78bfa" />
          {repairCount > 0 && (
            <MetaChip icon="🔧" label="Repairs" value={repairCount} color={repairCount > 1 ? '#f59e0b' : '#fbbf24'} />
          )}
          <MetaChip icon="🏭" label="Mode" value={mode} color="#60a5fa" />
        </div>

        {/* Validation line */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 8px', borderRadius: 6, fontSize: 9,
          background: validPassed ? 'rgba(74,222,128,0.06)' : 'rgba(251,191,36,0.07)',
          border: `1px solid ${validPassed ? 'rgba(74,222,128,0.2)' : 'rgba(251,191,36,0.25)'}`,
        }}>
          <span style={{ color: validPassed ? '#4ade80' : '#fbbf24', fontWeight: 700 }}>
            {validPassed ? '✓ Validation passed' : `⚠ ${validationReport?.errors?.length ?? 0} validation issue(s), repaired`}
          </span>
          {validationReport?.checksRun?.length && (
            <span style={{ color: 'var(--text-muted)' }}>
              {validationReport.checksRun.length} checks
            </span>
          )}
        </div>

        {/* Source path */}
        <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)', letterSpacing: '0.03em' }}>
          {isSolidReady
            ? '🔷 CadQuery solid — deterministic geometry plan → Python worker → STL'
            : '🔷 Preview mesh — deterministic geometry plan → Three.js preview (solid path available)'}
        </div>

        {/* Spec JSON inspector toggle */}
        {specJson && (
          <div>
            <button
              onClick={() => setShowSpec(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, background: 'none',
                border: 'none', cursor: 'pointer', padding: '2px 0',
                fontSize: 9, fontWeight: 700, color: 'rgba(126,184,247,0.6)',
                letterSpacing: '0.06em',
              }}
            >
              <span style={{ transform: showSpec ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
              SPEC JSON
            </button>
            {showSpec && (
              <pre style={{
                margin: '6px 0 0 0', padding: '8px', borderRadius: 6,
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 9, color: '#94a3b8', overflow: 'auto', maxHeight: 200,
                fontFamily: 'ui-monospace, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {JSON.stringify(specJson, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

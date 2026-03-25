import React from 'react';
import type { ValidationReport, ConstraintReport, SpecJSON, RepairOutput } from '../types';

// ─── Shared helpers ────────────────────────────────────────────────────────────

function SectionHead({ label, count, color }: { label: string; count?: number; color?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
      color: color || 'var(--text-muted)',
      textTransform: 'uppercase',
    }}>
      {label}
      {count !== undefined && (
        <span style={{
          background: `${color || '#7eb8f7'}25`,
          border: `1px solid ${color || '#7eb8f7'}44`,
          color: color || '#7eb8f7',
          borderRadius: 10, padding: '0 6px', fontSize: 9,
        }}>{count}</span>
      )}
    </div>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 12,
      fontSize: 10, fontWeight: 600,
      background: `${color}18`, border: `1px solid ${color}40`,
      color, marginBottom: 2, marginRight: 4,
    }}>{text}</span>
  );
}

// ─── Assumptions Panel ────────────────────────────────────────────────────────

interface AssumptionsPanelProps {
  spec?: SpecJSON;
  constraintReport?: ConstraintReport;
}

export function AssumptionsPanel({ spec, constraintReport }: AssumptionsPanelProps) {
  if (!spec && !constraintReport) return null;

  const assumed = spec?.assumedDimensions ?? {};
  const known   = spec?.knownDimensions ?? {};
  const assumptionsUsed = constraintReport?.assumptionsUsed ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Part type + intent */}
      {spec && (
        <div style={{
          background: 'rgba(126,184,247,0.06)', border: '1px solid rgba(126,184,247,0.14)',
          borderRadius: 8, padding: '10px 12px',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.07em', marginBottom: 4 }}>
            PART TYPE
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 6 }}>
            {spec.partType?.replace(/_/g, ' ').toUpperCase()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {spec.intentSummary}
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <Pill text={`Units: ${spec.units}`} color="#7eb8f7" />
            <Pill text={spec.manufacturingMode?.replace(/_/g, ' ') || 'unknown'} color="#a78bfa" />
            {spec.materialPreference && spec.materialPreference !== 'unspecified' && (
              <Pill text={spec.materialPreference} color="#34d399" />
            )}
            <Pill text={`Confidence: ${Math.round((spec.confidence ?? 0) * 100)}%`}
              color={spec.confidence >= 0.8 ? '#4ade80' : spec.confidence >= 0.6 ? '#fbbf24' : '#f87171'} />
          </div>
        </div>
      )}

      {/* Known dimensions */}
      {Object.keys(known).length > 0 && (
        <div>
          <SectionHead label="Known Dimensions" count={Object.keys(known).length} color="#4ade80" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {Object.entries(known).map(([k, v]) => (
              <div key={k} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 10px', borderRadius: 6,
                background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)',
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', fontFamily: 'monospace' }}>{v} mm</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assumed dimensions */}
      {Object.keys(assumed).length > 0 && (
        <div>
          <SectionHead label="Assumed Dimensions" count={Object.keys(assumed).length} color="#fbbf24" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {Object.entries(assumed).map(([k, v]) => (
              <div key={k} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 10px', borderRadius: 6,
                background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.12)',
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>{v} mm</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assumptions used (from constraint check) */}
      {assumptionsUsed.length > 0 && (
        <div>
          <SectionHead label="Defaults Applied" count={assumptionsUsed.length} color="#c4b5fd" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {assumptionsUsed.map((a, i) => (
              <div key={i} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 10,
                background: 'rgba(196,181,253,0.06)', border: '1px solid rgba(196,181,253,0.12)',
                color: '#c4b5fd',
              }}>{a}</div>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      {spec?.features && spec.features.length > 0 && (
        <div>
          <SectionHead label="Features" color="#60a5fa" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {spec.features.map((f) => <Pill key={f} text={f.replace(/_/g, ' ')} color="#60a5fa" />)}
          </div>
        </div>
      )}

      {/* Risk flags */}
      {spec?.riskFlags && spec.riskFlags.length > 0 && (
        <div>
          <SectionHead label="Risk Flags" count={spec.riskFlags.length} color="#f87171" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {spec.riskFlags.map((r, i) => (
              <div key={i} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 10,
                background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)',
                color: '#f87171',
              }}>⚠ {r}</div>
            ))}
          </div>
        </div>
      )}

      {/* Missing info */}
      {spec?.missingInformation && spec.missingInformation.length > 0 && (
        <div>
          <SectionHead label="Missing Information" count={spec.missingInformation.length} color="#f59e0b" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {spec.missingInformation.map((m, i) => (
              <div key={i} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 10,
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
                color: '#f59e0b',
              }}>? {m}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Validation Panel ─────────────────────────────────────────────────────────

interface ValidationPanelProps {
  validationReport?: ValidationReport;
  constraintReport?: ConstraintReport;
  repairHistory?: RepairOutput[];
  onRepair?: () => void;
  repairing?: boolean;
}

export function ValidationPanel({
  validationReport,
  constraintReport,
  repairHistory,
  onRepair,
  repairing,
}: ValidationPanelProps) {
  const hasContent = validationReport || constraintReport;
  if (!hasContent) return null;

  const severity = validationReport?.severity ?? constraintReport?.severity ?? 'none';
  const isValid  = validationReport?.valid ?? constraintReport?.isBuildable ?? true;

  const severityColor = {
    none:   '#4ade80',
    low:    '#fbbf24',
    medium: '#f59e0b',
    high:   '#f87171',
  }[severity] || '#7eb8f7';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderRadius: 8,
        background: `${severityColor}10`, border: `1px solid ${severityColor}30`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>
            {isValid ? '✅' : severity === 'high' ? '❌' : '⚠️'}
          </span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: severityColor }}>
              {isValid ? 'Validation Passed' : `Validation ${severity.toUpperCase()} Severity`}
            </div>
            {validationReport && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {validationReport.checksRun?.length ?? 0} checks run
              </div>
            )}
          </div>
        </div>
        {!isValid && validationReport?.repairable && onRepair && (
          <button
            onClick={onRepair}
            disabled={repairing}
            style={{
              padding: '5px 12px', borderRadius: 6, border: 'none', cursor: repairing ? 'not-allowed' : 'pointer',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              background: repairing ? 'rgba(126,184,247,0.1)' : '#7eb8f740',
              color: repairing ? 'var(--text-muted)' : '#7eb8f7',
            }}>
            {repairing ? '⚙ Repairing…' : '🔧 Auto-Repair'}
          </button>
        )}
      </div>

      {/* Constraint errors (non-buildable) */}
      {constraintReport?.errors && constraintReport.errors.length > 0 && (
        <div>
          <SectionHead label="Constraint Errors" count={constraintReport.errors.length} color="#f87171" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {constraintReport.errors.map((e, i) => (
              <div key={i} style={{
                padding: '7px 10px', borderRadius: 7, fontSize: 10, lineHeight: 1.5,
                background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)',
                color: '#f87171',
              }}>❌ {e}</div>
            ))}
          </div>
        </div>
      )}

      {/* Validation errors */}
      {validationReport?.errors && validationReport.errors.length > 0 && (
        <div>
          <SectionHead label="Validation Errors" count={validationReport.errors.length} color="#f87171" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {validationReport.errors.map((e, i) => (
              <div key={i} style={{
                padding: '7px 10px', borderRadius: 7, fontSize: 10, lineHeight: 1.5,
                background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)',
              }}>
                <div style={{ color: '#f87171', fontWeight: 700, marginBottom: 2 }}>
                  [{e.code}] {e.stepId ? `(${e.stepId})` : ''}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>{e.message}</div>
                {e.suggestedFix && (
                  <div style={{ color: '#a5d6a7', marginTop: 2 }}>💡 {e.suggestedFix}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings (both) */}
      {(() => {
        type WarnItem = { message: string; code?: string; fix?: string };
        const warns: WarnItem[] = [
          ...(constraintReport?.warnings ?? []).map((w) => ({ message: w })),
          ...(validationReport?.warnings ?? []).map((w) => ({
            message: w.message,
            code: w.code,
            fix: w.suggestedFix,
          })),
        ];
        if (!warns.length) return null;
        return (
          <div>
            <SectionHead label="Warnings" count={warns.length} color="#fbbf24" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {warns.map((w, i) => (
                <div key={i} style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 10, lineHeight: 1.5,
                  background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)',
                }}>
                  {w.code && <span style={{ fontWeight: 700, color: '#fbbf24', marginRight: 4 }}>[{w.code}]</span>}
                  <span style={{ color: '#fbbf24' }}>{w.message}</span>
                  {w.fix && (
                    <div style={{ color: '#a5d6a7', marginTop: 2 }}>💡 {w.fix}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}


      {/* Constraint questions */}
      {constraintReport?.recommendedQuestions && constraintReport.recommendedQuestions.length > 0 && (
        <div>
          <SectionHead label="Clarifying Questions" color="#60a5fa" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {constraintReport.recommendedQuestions.map((q, i) => (
              <div key={i} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 10,
                background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)',
                color: '#60a5fa',
              }}>? {q}</div>
            ))}
          </div>
        </div>
      )}

      {/* Repair history */}
      {repairHistory && repairHistory.length > 0 && (
        <div>
          <SectionHead label="Repair History" count={repairHistory.length} color="#c4b5fd" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {repairHistory.map((r, i) => (
              <div key={i} style={{
                padding: '7px 10px', borderRadius: 7, fontSize: 10,
                background: 'rgba(196,181,253,0.06)', border: '1px solid rgba(196,181,253,0.15)',
              }}>
                <div style={{ fontWeight: 700, color: '#c4b5fd', marginBottom: 4 }}>
                  Repair #{r.repairAttempt} — {r.resultStatus}
                </div>
                {r.changesApplied.map((c, j) => (
                  <div key={j} style={{ color: 'var(--text-muted)', marginBottom: 2 }}>• {c}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

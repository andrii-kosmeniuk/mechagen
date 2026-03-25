import React, { useRef, useState } from 'react';
import type { GeomData, HistoryPart, Generation } from '../types';
import { PipelineForm }  from './PipelineForm';
import { AssumptionsPanel, ValidationPanel } from './PipelinePanels';
import { PipelineStatusBadge } from './PipelineStatusBadge';
import { HistoryPanel } from './HistoryPanel';
import { SolidStatusPanel } from './SolidStatusPanel';
import { BillingPanel } from './BillingPanel';
import { UsageDashboard } from './UsageDashboard';
import { WorkspacePanel } from './WorkspacePanel';
import { QuotaWarning } from './QuotaWarning';
import { usePlan } from '../lib/usePlan';
import type { ManufacturingMode } from '../types';

const QUICK_TEMPLATES = [
  'Gear',
  'Bolt',
  'Bearing',
  'Bracket',
  'Arm Joint',
  'Mount Plate',
];

type AgentMode = 'single' | 'multi' | 'adversarial' | 'swarm';
type PanelPage = 'design' | 'pipeline' | 'export' | 'history' | 'billing' | 'workspace';

export type LeftPanelProps = {
  projectName: string;
  setProjectName: (v: string) => void;
  projectDesc: string;
  setProjectDesc: (v: string) => void;
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  multiAgent: boolean;
  setMultiAgent: (v: boolean) => void;
  highDetail: boolean;
  setHighDetail: (v: boolean) => void;
  proceduralParts: boolean;
  setProceduralParts: (v: boolean) => void;
  polishBeforeGenerate: boolean;
  setPolishBeforeGenerate: (v: boolean) => void;
  wireframe: boolean;
  setWireframe: (v: boolean) => void;
  modelOpacity: number;
  setModelOpacity: (v: number) => void;
  generating: boolean;
  onGenerate: () => void;
  onImprovePrompt: () => void;
  analysisText: string;
  onAnalyzePart: () => void;
  onShare: () => void;
  qrDataUrl: string | null;
  historyParts: HistoryPart[];
  onSelectHistoryPart: (p: HistoryPart) => void;
  geomData: GeomData | null;
  onExportFormat: (format: 'STL' | 'STEP' | 'OBJ' | 'GLTF') => void | Promise<void>;
  // Pipeline props
  pipelineGeneration?: Generation | null;
  pipelineGenerating?: boolean;
  pipelineRepairing?: boolean;
  pipelineError?: string | null;
  onPipelineGenerate?: (params: {
    prompt: string;
    context: string;
    manufacturingMode: ManufacturingMode;
    materialPreference: string;
    highDetail: boolean;
    blueprintId?: string;
    solidRequested?: boolean;
  }) => void;
  onPipelineRepair?: () => void;
  onPipelineExportObj?: () => void;
  onPipelineExportGlb?: () => void;
  onDownloadStl?: () => void;
  projectId?: string;
};

export function LeftPanel(props: LeftPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [agentMode, setAgentMode] = useState<AgentMode>('single');
  const [page, setPage] = useState<PanelPage>('design');

  const s: Record<string, React.CSSProperties> = {
    panel: {
      width: 280,
      minWidth: 280,
      height: '100%',
      background: 'var(--panel-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
    header: {
      flexShrink: 0,
      padding: '10px 12px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    brand: {
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '0.12em',
      color: 'var(--text)',
    },
    navLink: {
      border: 'none',
      background: 'transparent',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.08em',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      fontFamily: 'inherit',
      padding: '4px 6px',
      borderRadius: 4,
    },
    navLinkOn: {
      color: 'var(--accent-blue)',
      background: 'rgba(126,184,247,0.1)',
    },
    scroll: {
      flex: 1,
      overflowY: 'auto',
      padding: '12px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    },
    sectionTitle: {
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.1em',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    input: {
      width: '100%',
      padding: '8px 10px',
      background: 'var(--input-bg)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      color: 'var(--text)',
      fontSize: 12,
      fontFamily: 'inherit',
      boxSizing: 'border-box',
    },
    textarea: {
      width: '100%',
      padding: '8px 10px',
      background: 'var(--input-bg)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      color: 'var(--text)',
      fontSize: 12,
      fontFamily: 'inherit',
      resize: 'vertical',
      boxSizing: 'border-box',
    },
    uploadBox: {
      border: '1px dashed var(--border)',
      borderRadius: 8,
      padding: '12px 10px',
      textAlign: 'center',
      fontSize: 10,
      color: 'var(--text-muted)',
      cursor: 'pointer',
    },
    chip: {
      padding: '5px 8px',
      borderRadius: 4,
      fontSize: 9,
      fontWeight: 700,
      border: '1px solid var(--border)',
      background: 'var(--input-bg)',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      fontFamily: 'inherit',
      letterSpacing: '0.04em',
    },
    chipActive: {
      background: 'rgba(126,184,247,0.12)',
      borderColor: 'var(--accent-blue)',
      color: 'var(--accent-blue)',
    },
    btnPrimary: {
      width: '100%',
      padding: '11px 10px',
      background: 'var(--accent-blue)',
      border: 'none',
      borderRadius: 8,
      color: '#fff',
      fontWeight: 700,
      fontSize: 11,
      letterSpacing: '0.06em',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      fontFamily: 'inherit',
    },
    btnGhost: {
      width: '100%',
      padding: '8px 10px',
      background: 'transparent',
      border: '1px solid var(--border)',
      borderRadius: 6,
      color: 'var(--text-muted)',
      fontWeight: 600,
      fontSize: 11,
      cursor: 'pointer',
      fontFamily: 'inherit',
    },
    templatesRow: { display: 'flex', flexWrap: 'wrap', gap: 5 },
    agentGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
    agentBtn: {
      padding: '7px 6px',
      borderRadius: 6,
      fontSize: 9,
      fontWeight: 600,
      border: '1px solid var(--border)',
      background: 'var(--input-bg)',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      textAlign: 'center',
      fontFamily: 'inherit',
      lineHeight: 1.25,
    },
    agentBtnA: {
      background: 'rgba(126,184,247,0.12)',
      borderColor: 'var(--accent-blue)',
      color: 'var(--accent-blue)',
    },
    divider: { height: 1, background: 'var(--border)', margin: '2px 0' },
    iconRow: { display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' },
    iconBtn: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '7px 8px',
      borderRadius: 6,
      border: '1px solid var(--border)',
      background: 'var(--input-bg)',
      color: 'var(--text-muted)',
      fontSize: 10,
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'inherit',
    },
    iconBtnOn: {
      borderColor: 'var(--accent-blue)',
      color: 'var(--accent-blue)',
      background: 'rgba(126,184,247,0.1)',
    },
    rangeLabel: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.08em',
      color: 'var(--text-muted)',
      marginBottom: 4,
    },
  };

  const planState = usePlan();

  return (
    <aside style={s.panel}>
      <div style={s.header}>
        <span style={s.brand}>⬡ MECHAGEN</span>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {(['design', 'pipeline', 'export', 'history', 'billing', 'workspace'] as const).map((id) => (
            <button
              key={id}
              type="button"
              style={{
                ...s.navLink,
                ...(page === id ? s.navLinkOn : {}),
              }}
              onClick={() => setPage(id)}
            >
              {id === 'pipeline' ? '🔬' : id.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={s.scroll}>
        {page === 'design' && (
          <>
            <div>
              <div style={s.sectionTitle}>Project name</div>
              <input
                style={s.input}
                placeholder="e.g. Spindle gear hub"
                value={props.projectName}
                onChange={(e) => props.setProjectName(e.target.value)}
              />
            </div>

            <div>
              <div style={s.sectionTitle}>Project description / goals</div>
              <textarea
                style={{ ...s.textarea, minHeight: 56 }}
                placeholder="Constraints sent with Generate — single solid, material, fit…"
                rows={2}
                value={props.projectDesc}
                onChange={(e) => props.setProjectDesc(e.target.value)}
              />
            </div>

            <div>
              <div style={s.sectionTitle}>Upload blueprints, specs, references</div>
              <div style={s.uploadBox} onClick={() => fileRef.current?.click()}>
                Drop files or click · PDF, JPG, STEP…
              </div>
              <input ref={fileRef} type="file" style={{ display: 'none' }} multiple />
            </div>

            <div>
              <div style={s.sectionTitle}>Describe the part</div>
              <textarea
                style={{ ...s.textarea, minHeight: 72 }}
                placeholder="Teeth, bore, keyway, chamfers…"
                rows={3}
                value={props.prompt}
                onChange={(e) => props.setPrompt(e.target.value)}
              />
              <div style={s.iconRow}>
                <button
                  type="button"
                  title="High detail — finer mesh, slower"
                  style={{
                    ...s.iconBtn,
                    ...(props.highDetail ? s.iconBtnOn : {}),
                  }}
                  onClick={() => props.setHighDetail(!props.highDetail)}
                  disabled={props.generating}
                >
                  <span aria-hidden>⚡</span> High detail
                </button>
                <button
                  type="button"
                  title="Polish prompt with AI"
                  style={s.iconBtn}
                  onClick={props.onImprovePrompt}
                  disabled={props.generating}
                >
                  <span aria-hidden>✨</span> Polish
                </button>
              </div>
            </div>

            <div>
              <div style={s.templatesRow}>
                {QUICK_TEMPLATES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    style={s.chip}
                    onClick={() =>
                      props.setPrompt((p) => (p ? `${p}\n` : '') + `a ${t.toLowerCase()}`)
                    }
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div style={s.divider} />

            <div>
              <div style={s.sectionTitle}>Agent mode</div>
              <div style={s.agentGrid}>
                {(
                  [
                    ['single', 'Single agent'],
                    ['multi', 'Multi-agent'],
                    ['adversarial', 'Adversarial (GAN)'],
                    ['swarm', 'Swarm design'],
                  ] as [AgentMode, string][]
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    style={{
                      ...s.agentBtn,
                      ...(agentMode === mode ? s.agentBtnA : {}),
                    }}
                    onClick={() => {
                      setAgentMode(mode);
                      props.setMultiAgent(mode !== 'single');
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={s.divider} />

            <div>
              <div style={s.rangeLabel}>
                <span>WIREFRAME</span>
                <span style={{ color: 'var(--text)' }}>
                  {props.wireframe ? 'ON' : 'OFF'}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={1}
                value={props.wireframe ? 1 : 0}
                onChange={(e) => props.setWireframe(Number(e.target.value) > 0)}
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
              />
            </div>

            <div>
              <div style={s.rangeLabel}>
                <span>OPACITY</span>
                <span style={{ color: 'var(--text)' }}>
                  {Math.round(props.modelOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.15}
                max={1}
                step={0.05}
                value={props.modelOpacity}
                onChange={(e) => props.setModelOpacity(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
              />
            </div>

            <button
              type="button"
              style={{ ...s.btnPrimary, opacity: props.generating ? 0.75 : 1 }}
              onClick={props.onGenerate}
              disabled={props.generating}
            >
              <span aria-hidden>⚡</span>
              {props.generating ? 'GENERATING…' : 'GENERATE PART'}
            </button>
          </>
        )}

        {page === 'pipeline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header */}
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#818cf8', letterSpacing: '0.07em', marginBottom: 4 }}>
                🔬 STRUCTURED PIPELINE
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                AI → Spec JSON → Constraint Check → Geometry Plan → Validate → Repair
              </div>
            </div>

            {/* Status badge if active */}
            {props.pipelineGeneration && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PipelineStatusBadge status={props.pipelineGeneration.status} />
                {props.pipelineGeneration.specJson && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {props.pipelineGeneration.specJson.partType?.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            )}

            {/* Error */}
            {props.pipelineError && (
              <div style={{
                padding: '8px 10px', borderRadius: 7, fontSize: 10,
                background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
                color: '#f87171',
              }}>
                ❌ {props.pipelineError}
              </div>
            )}

            {/* Pipeline form */}
            {props.onPipelineGenerate && (
              <PipelineForm
                generating={!!props.pipelineGenerating}
                onGenerate={props.onPipelineGenerate}
                projectId={props.projectId}
              />
            )}

            {/* Divider */}
            {props.pipelineGeneration && <div style={s.divider} />}

            {/* Assumptions */}
            {(props.pipelineGeneration?.specJson || props.pipelineGeneration?.constraintReport) && (
              <div>
                <div style={{ ...s.sectionTitle, marginBottom: 8 }}>📐 ASSUMPTIONS</div>
                <AssumptionsPanel
                  spec={props.pipelineGeneration?.specJson}
                  constraintReport={props.pipelineGeneration?.constraintReport}
                />
              </div>
            )}

            {/* Validation */}
            {(props.pipelineGeneration?.validationReport || props.pipelineGeneration?.constraintReport) && (
              <div>
                <div style={{ ...s.sectionTitle, marginBottom: 8 }}>✅ VALIDATION</div>
                <ValidationPanel
                  validationReport={props.pipelineGeneration?.validationReport}
                  constraintReport={props.pipelineGeneration?.constraintReport}
                  repairHistory={props.pipelineGeneration?.repairHistory}
                  onRepair={props.onPipelineRepair}
                  repairing={props.pipelineRepairing}
                />
              </div>
            )}

            {/* Build metadata */}
            {props.pipelineGeneration?.buildMetadata && props.pipelineGeneration.status === 'ready' && (
              <div style={{
                padding: '8px 10px', borderRadius: 8, fontSize: 10,
                background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.14)',
              }}>
                <div style={{ fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>✅ Pipeline Complete</div>
                {(() => {
                  const m = props.pipelineGeneration.buildMetadata as Record<string, unknown>;
                  return (
                    <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {Boolean(m.totalDurationMs) && <span>⏱ {Math.round(Number(m.totalDurationMs) / 1000)}s total</span>}
                      {m.previewPartCount !== undefined && <span>🔷 {Number(m.previewPartCount)} mesh primitives</span>}
                      {m.repairAttempts !== undefined && Number(m.repairAttempts) > 0 && (
                        <span>🔧 {Number(m.repairAttempts)} repair attempt(s)</span>
                      )}
                      {Boolean(m.hadBlueprint) && <span>📐 Blueprint-assisted</span>}
                    </div>
                  );
                })()}

                {/* Phase 2: Export buttons */}
                {(props.onPipelineExportObj || props.onPipelineExportGlb) && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 4, width: '100%' }}>EXPORT</div>
                    {props.onPipelineExportObj && (
                      <button
                        onClick={props.onPipelineExportObj}
                        style={{
                          flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                          fontSize: 10, fontWeight: 700,
                          background: 'rgba(52,211,153,0.15)', color: '#34d399',
                        }}
                      >↓ OBJ</button>
                    )}
                    {props.onPipelineExportGlb && (
                      <button
                        onClick={props.onPipelineExportGlb}
                        style={{
                          flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                          fontSize: 10, fontWeight: 700,
                          background: 'rgba(96,165,250,0.15)', color: '#60a5fa',
                        }}
                      >↓ GLB</button>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Phase 3: Solid build panel */}
            {props.pipelineGeneration?.status === 'ready' && (
              <SolidStatusPanel
                generationId={props.pipelineGeneration.id}
                generationStatus={props.pipelineGeneration.status}
                onSolidBuilt={() => { /* STL is now downloadable */ }}
              />
            )}
          </div>
        )}

        {page === 'export' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={s.sectionTitle}>Export</div>
            {!props.geomData && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Generate a part first, then download.
              </div>
            )}
            {(['STL', 'STEP', 'OBJ', 'GLTF'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                style={{
                  ...s.btnGhost,
                  opacity: props.geomData ? 1 : 0.45,
                  cursor: 'pointer',
                }}
                aria-disabled={!props.geomData}
                title={
                  !props.geomData
                    ? 'Generate a part in Design first'
                    : fmt === 'STEP'
                      ? 'Browser cannot write STEP — see message after click'
                      : `Download ${fmt}`
                }
                onClick={() => void props.onExportFormat(fmt)}
              >
                ↓ {fmt}
              </button>
            ))}
            <div style={s.divider} />
            <div style={s.sectionTitle}>Analysis</div>
            <button type="button" style={s.btnGhost} onClick={props.onAnalyzePart}>
              Run analysis
            </button>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                marginTop: 6,
              }}
            >
              {props.analysisText}
            </div>
            <div style={s.divider} />
            <div style={s.sectionTitle}>Share</div>
            <button type="button" style={s.btnPrimary} onClick={props.onShare}>
              Link + QR
            </button>
            {props.qrDataUrl && (
              <img
                src={props.qrDataUrl}
                alt="Share QR"
                style={{ width: '100%', borderRadius: 8 }}
              />
            )}
          </div>
        )}

        {page === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={s.sectionTitle}>Project History</div>
            <HistoryPanel
              projectId={props.projectId || 'default-project'}
            />
          </div>
        )}

        {page === 'billing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={s.sectionTitle}>💳 PLAN & BILLING</div>
            {planState.loading && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Loading…</div>
            )}
            {!planState.loading && planState.usage && (
              <QuotaWarning usage={planState.usage} threshold={80} />
            )}
            {!planState.loading && (
              <BillingPanel
                plan={planState.plan}
                subscription={planState.subscription}
                usage={planState.usage}
                onUpgrade={() => window.open('https://mechagen.io/pricing', '_blank')}
                devMode={import.meta.env.DEV}
                onSetPlan={planState.setUserPlan}
              />
            )}
            {!planState.loading && planState.usage && (
              <>
                <div style={{ ...s.sectionTitle, marginTop: 4 }}>📊 USAGE THIS MONTH</div>
                <UsageDashboard usage={planState.usage} />
              </>
            )}
          </div>
        )}

        {page === 'workspace' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={s.sectionTitle}>🏢 WORKSPACES</div>
            {planState.loading && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Loading…</div>
            )}
            {!planState.loading && (
              <WorkspacePanel
                workspaces={planState.workspaces}
                onRefresh={planState.refresh}
              />
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

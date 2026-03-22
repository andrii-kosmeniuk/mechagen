import React, { useRef, useState } from 'react';
import type { GeomData, HistoryPart } from '../types';

const QUICK_TEMPLATES = [
  'Gear',
  'Bolt',
  'Bearing',
  'Bracket',
  'Arm Joint',
  'Mount Plate',
];

type AgentMode = 'single' | 'multi' | 'adversarial' | 'swarm';
type PanelPage = 'design' | 'export' | 'history';

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

  return (
    <aside style={s.panel}>
      <div style={s.header}>
        <span style={s.brand}>⬡ MECHAGEN</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {(['design', 'export', 'history'] as const).map((id) => (
            <button
              key={id}
              type="button"
              style={{
                ...s.navLink,
                ...(page === id ? s.navLinkOn : {}),
              }}
              onClick={() => setPage(id)}
            >
              {id.toUpperCase()}
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
          <div>
            <div style={s.sectionTitle}>History</div>
            {props.historyParts.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                No parts yet. Generate one from Design.
              </div>
            ) : (
              props.historyParts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  style={{
                    ...s.chip,
                    width: '100%',
                    textAlign: 'left',
                    marginBottom: 6,
                  }}
                  onClick={() => {
                    props.onSelectHistoryPart(p);
                    setPage('design');
                  }}
                >
                  {p.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

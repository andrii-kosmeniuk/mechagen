import React, { useRef } from 'react';
import type { HistoryPart } from '../types';
import { WORKFLOW_COLORS } from '../lib/constants';

const TABS = [
  { id: 'design', icon: '✏️', label: 'Design' },
  { id: 'engineer', icon: '📐', label: 'Engineer' },
  { id: 'analyze', icon: '🔬', label: 'Analyze' },
  { id: 'export', icon: '📦', label: 'Export' },
  { id: 'history', icon: '🕐', label: 'History' },
] as const;

export type LeftPanelProps = {
  activeTab: string;
  setActiveTab: (id: string) => void;
  projectName: string;
  setProjectName: (v: string) => void;
  projectDesc: string;
  setProjectDesc: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  multiAgent: boolean;
  setMultiAgent: (v: boolean) => void;
  generating: boolean;
  onGenerate: () => void;
  onImprovePrompt: () => void;
  onVoiceInput: () => void;
  materialKey: string;
  setMaterialKey: (v: string) => void;
  costLabel: string;
  onRecommendMaterial: () => void;
  scale: { x: number; y: number; z: number };
  setScale: (s: { x: number; y: number; z: number }) => void;
  analysisText: string;
  onAnalyzePart: () => void;
  onShare: () => void;
  qrDataUrl: string | null;
  historyParts: HistoryPart[];
  onSelectHistoryPart: (p: HistoryPart) => void;
};

export function LeftPanel(props: LeftPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="left-panel">
      <div className="tabs-header">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab-btn ${props.activeTab === t.id ? 'active' : ''}`}
            onClick={() => props.setActiveTab(t.id)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="tab-content">
        <div
          className={`tab-pane ${props.activeTab === 'design' ? 'active' : ''}`}
        >
          <div className="input-group">
            <label className="section-title">Project Info</label>
            <input
              type="text"
              placeholder="Project Name"
              value={props.projectName}
              onChange={(e) => props.setProjectName(e.target.value)}
            />
            <textarea
              placeholder="Description..."
              rows={2}
              value={props.projectDesc}
              onChange={(e) => props.setProjectDesc(e.target.value)}
            />
          </div>
          <div
            className="card drop-zone"
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fileRef.current?.click();
            }}
            role="button"
            tabIndex={0}
          >
            <p className="muted small">
              Drag & drop reference files or click to upload
            </p>
            <input ref={fileRef} type="file" className="hidden-input" />
          </div>
          <div className="input-group">
            <label className="section-title">AI Generation</label>
            <textarea
              placeholder="Describe the part you want to generate..."
              rows={4}
              value={props.prompt}
              onChange={(e) => props.setPrompt(e.target.value)}
            />
            <div className="flex-between mt-4">
              <button
                type="button"
                className="chip"
                onClick={props.onImprovePrompt}
              >
                ✨ Improve
              </button>
              <button
                type="button"
                className="chip"
                onClick={props.onVoiceInput}
              >
                🎤 Voice
              </button>
            </div>
          </div>
          <div className="section-title">Quick Templates</div>
          <div className="chip-grid">
            {['Gear', 'Bolt', 'Bearing', 'Bracket', 'Arm Joint', 'Mount Plate'].map(
              (label) => (
                <button
                  key={label}
                  type="button"
                  className="chip template-chip"
                  onClick={() =>
                    props.setPrompt(`Design a mechanical ${label.toLowerCase()}`)
                  }
                >
                  {label}
                </button>
              )
            )}
          </div>
          <div className="mt-4 flex-between gap-2">
            <button
              type="button"
              className={`btn-primary w-full ${props.generating ? 'loading' : ''}`}
              onClick={props.onGenerate}
              disabled={props.generating}
            >
              <span className="btn-text">Generate</span>
              <span className="spinner" aria-hidden />
            </button>
            <button type="button" className="chip">
              Variants
            </button>
          </div>
          <div className="mt-4 card">
            <div className="flex-between">
              <span className="small">Multi-Agent Mode</span>
              <input
                type="checkbox"
                checked={props.multiAgent}
                onChange={(e) => props.setMultiAgent(e.target.checked)}
              />
            </div>
          </div>
        </div>

        <div
          className={`tab-pane ${props.activeTab === 'engineer' ? 'active' : ''}`}
        >
          <label className="section-title">Material Selection</label>
          <select
            className="w-full"
            value={props.materialKey}
            onChange={(e) => props.setMaterialKey(e.target.value)}
          >
            <option value="steel">Stainless Steel 316L</option>
            <option value="aluminum">Aluminum 6061-T6</option>
            <option value="titanium">Titanium Grade 5</option>
            <option value="abs">ABS Plastic</option>
            <option value="carbon">Carbon Fiber Reinforced</option>
          </select>
          <button
            type="button"
            className="chip mt-4 w-full"
            onClick={props.onRecommendMaterial}
          >
            AI Recommend Material
          </button>
          <div className="card mt-4">
            <div className="flex-between">
              <span className="small">Estimated Cost</span>
              <span className="cost-display">{props.costLabel}</span>
            </div>
          </div>
          <label className="section-title">Parametric Controls</label>
          <div className="input-group">
            {(['x', 'y', 'z'] as const).map((axis) => (
              <React.Fragment key={axis}>
                <span className="tiny">Scale {axis.toUpperCase()}</span>
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={props.scale[axis]}
                  onChange={(e) =>
                    props.setScale({
                      ...props.scale,
                      [axis]: parseFloat(e.target.value),
                    })
                  }
                />
              </React.Fragment>
            ))}
          </div>
        </div>

        <div
          className={`tab-pane ${props.activeTab === 'analyze' ? 'active' : ''}`}
        >
          <button
            type="button"
            className="btn-primary w-full"
            onClick={props.onAnalyzePart}
          >
            Analyze Part
          </button>
          <div className="chip-grid mt-4">
            {['FMEA', 'Predict Failure', 'Assembly Check', 'Manufacturing'].map(
              (l) => (
                <button key={l} type="button" className="chip">
                  {l}
                </button>
              )
            )}
          </div>
          <div className="card mt-4 analysis-results">{props.analysisText}</div>
          <label className="section-title">Simulations</label>
          <div className="flex-between gap-2">
            <button type="button" className="chip w-full">
              Kinematics
            </button>
            <button type="button" className="chip w-full">
              Load Path
            </button>
          </div>
        </div>

        <div
          className={`tab-pane ${props.activeTab === 'export' ? 'active' : ''}`}
        >
          <div className="chip-grid">
            <button type="button" className="chip">
              OBJ Export
            </button>
            <button type="button" className="chip">
              STL Export
            </button>
            <button type="button" className="chip">
              Screenshot
            </button>
            <button type="button" className="chip" onClick={props.onShare}>
              Share Link
            </button>
          </div>
          <button type="button" className="btn-primary w-full mt-4">
            Generate Documentation
          </button>
          <button type="button" className="chip w-full mt-2">
            Code Generator
          </button>
          {props.qrDataUrl ? (
            <div className="qrcode-wrap mt-4">
              <img src={props.qrDataUrl} alt="Share QR" width={128} height={128} />
            </div>
          ) : null}
        </div>

        <div
          className={`tab-pane ${props.activeTab === 'history' ? 'active' : ''}`}
        >
          <label className="section-title">Recent Parts</label>
          <div id="history-list">
            {props.historyParts.length === 0 ? (
              <p className="muted small">No history yet.</p>
            ) : (
              props.historyParts.map((part) => (
                <button
                  key={part.id}
                  type="button"
                  className="card history-card w-full text-left"
                  onClick={() => props.onSelectHistoryPart(part)}
                >
                  <div className="flex-between">
                    <span className="part-name">{part.name}</span>
                    <span
                      className="status-badge"
                      style={{
                        background:
                          WORKFLOW_COLORS[
                            part.status as keyof typeof WORKFLOW_COLORS
                          ] || '#888',
                      }}
                    >
                      {part.status}
                    </span>
                  </div>
                  <div className="muted tiny mt-4">
                    {new Date(part.createdAt).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

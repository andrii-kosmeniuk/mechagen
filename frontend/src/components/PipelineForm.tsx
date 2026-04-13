import React, { useState } from 'react';
import type { ManufacturingMode, BlueprintRecord } from '../types';
import { BlueprintUpload } from './BlueprintUpload';
import { BlueprintPreviewPanel } from './BlueprintPreviewPanel';

const MANUFACTURING_MODES: { value: ManufacturingMode; label: string; icon: string }[] = [
  { value: 'unknown',     label: 'Any / Unknown', icon: '🔧' },
  { value: '3d_print',    label: '3D Print (FDM)', icon: '🖨️' },
  { value: 'cnc',         label: 'CNC Machining',  icon: '⚙️' },
  { value: 'sheet_metal', label: 'Sheet Metal',    icon: '🔩' },
];

const MATERIAL_PRESETS = [
  'PETG', 'PLA', 'ABS', 'ASA',
  'Aluminum 6061', 'Steel A36', 'Stainless 316',
  'Nylon PA12', 'PEEK', 'Polycarbonate',
];

const EXAMPLE_PROMPTS = [
  'L-bracket for 40×40mm extrusion with 2 M5 holes — 3D print PETG',
  'Flat mounting plate 100×60mm, 4 corner M4 holes — CNC aluminum',
  'Spacer: 10mm bore, 20mm OD, 30mm long',
  'Electronics enclosure 90×60×25mm PCB, 3mm walls, snap-fit lid',
  'Basic pulley for 6mm shaft, 9mm belt — FDM printable',
  'Spur gear 20 teeth, module 1.5, 10mm wide, 8mm bore',
];

interface Props {
  generating: boolean;
  onGenerate: (params: {
    prompt: string;
    context: string;
    manufacturingMode: ManufacturingMode;
    materialPreference: string;
    highDetail: boolean;
    blueprintId?: string;
    solidRequested?: boolean;
  }) => void;
  projectId?: string;
}

export function PipelineForm({ generating, onGenerate, projectId = 'default-project' }: Props) {
  const [prompt,       setPrompt]       = useState('');
  const [context,      setContext]      = useState('');
  const [mfgMode,      setMfgMode]      = useState<ManufacturingMode>('unknown');
  const [material,     setMaterial]     = useState('');
  const [highDetail,   setHighDetail]   = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [showBlueprint,setShowBlueprint]= useState(false);
  const [blueprint,    setBlueprint]    = useState<BlueprintRecord | null>(null);
  const [solidRequested, setSolidRequested] = useState(false);

  const canGenerate = !generating && (!!prompt.trim() || !!blueprint);

  const handleSubmit = () => {
    if (!canGenerate) return;
    onGenerate({
      prompt:             prompt.trim(),
      context:            context.trim(),
      manufacturingMode:  mfgMode,
      materialPreference: material.trim(),
      highDetail,
      blueprintId:        blueprint?.id,
      solidRequested,
    });
  };

  const handleBlueprintUpload = (record: BlueprintRecord) => {
    setBlueprint(record);
    // Auto-suggest mfg mode from blueprint's analysis (filled later by analysis)
  };

  const clearBlueprint = () => setBlueprint(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Blueprint toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => setShowBlueprint(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, flex: 1,
            padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
            border: `1px solid ${showBlueprint || blueprint ? 'rgba(96,165,250,0.45)' : 'rgba(126,184,247,0.18)'}`,
            background: showBlueprint || blueprint ? 'rgba(96,165,250,0.08)' : 'rgba(255,255,255,0.03)',
            color: showBlueprint || blueprint ? '#60a5fa' : 'var(--text-muted)',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            transition: 'all 0.15s',
          }}
        >
          <span>📐</span>
          <span>BLUEPRINT</span>
          {blueprint && <span style={{ marginLeft: 'auto', fontSize: 9, color: '#4ade80' }}>✓ Attached</span>}
        </button>
        {blueprint && (
          <button
            onClick={clearBlueprint}
            title="Remove blueprint"
            style={{
              padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
              border: '1px solid rgba(248,113,113,0.25)',
              background: 'rgba(248,113,113,0.06)', color: '#f87171',
              fontSize: 10, fontWeight: 700,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Blueprint panel */}
      {showBlueprint && (
        <div style={{
          padding: '10px 12px', borderRadius: 9,
          background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.18)',
        }}>
          {!blueprint ? (
            <BlueprintUpload onUpload={handleBlueprintUpload} projectId={projectId} />
          ) : (
            <BlueprintPreviewPanel blueprint={blueprint} />
          )}
        </div>
      )}

      {/* Prompt */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em' }}>
            {blueprint ? 'DESCRIBE WHAT TO BUILD (OPTIONAL WITH BLUEPRINT)' : 'DESCRIBE YOUR PART'}
          </label>
          <button
            onClick={() => setShowExamples(!showExamples)}
            style={{ fontSize: 9, fontWeight: 600, color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {showExamples ? 'Hide examples' : 'Show examples →'}
          </button>
        </div>

        {showExamples && (
          <div style={{ marginBottom: 8 }}>
            {EXAMPLE_PROMPTS.map((ex, i) => (
              <div key={i}
                onClick={() => { setPrompt(ex); setShowExamples(false); }}
                style={{
                  padding: '5px 10px', marginBottom: 3, borderRadius: 6, cursor: 'pointer',
                  fontSize: 10, color: 'var(--accent-blue)',
                  background: 'rgba(126,184,247,0.06)', border: '1px solid rgba(126,184,247,0.14)',
                  transition: 'background 0.15s',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(126,184,247,0.12)')}
                onMouseOut={e => (e.currentTarget.style.background = 'rgba(126,184,247,0.06)')}
              >
                {ex}
              </div>
            ))}
          </div>
        )}

        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
          placeholder={
            blueprint
              ? 'Add extra requirements, constraints, or refinements… (optional — blueprint is the primary reference)'
              : 'e.g. L-bracket for 40×40mm aluminum extrusion, 2 M5 holes, 3D print PETG'
          }
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical',
            padding: '9px 12px', borderRadius: 8, lineHeight: 1.5,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(126,184,247,0.2)',
            color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
            outline: 'none', transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(126,184,247,0.5)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(126,184,247,0.2)')}
        />
        <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
          {prompt.length}/2000 · Ctrl+Enter to generate
        </div>
      </div>

      {/* Manufacturing mode */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
          MANUFACTURING MODE
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {MANUFACTURING_MODES.map(m => (
            <button key={m.value} onClick={() => setMfgMode(m.value)}
              style={{
                padding: '7px 8px', borderRadius: 7, cursor: 'pointer',
                border: `1px solid ${mfgMode === m.value ? 'rgba(126,184,247,0.6)' : 'rgba(126,184,247,0.15)'}`,
                background: mfgMode === m.value ? 'rgba(126,184,247,0.12)' : 'rgba(255,255,255,0.03)',
                color: mfgMode === m.value ? '#7eb8f7' : 'var(--text-muted)',
                fontSize: 10, fontWeight: 600, textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
              }}
            >
              <span>{m.icon}</span><span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Material */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>
          MATERIAL (OPTIONAL)
        </label>
        <input
          list="material-presets"
          value={material}
          onChange={e => setMaterial(e.target.value)}
          placeholder="e.g. PETG, Aluminum 6061…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '7px 10px', borderRadius: 7,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(126,184,247,0.18)',
            color: 'var(--text)', fontSize: 11, fontFamily: 'inherit',
          }}
        />
        <datalist id="material-presets">
          {MATERIAL_PRESETS.map(m => <option key={m} value={m} />)}
        </datalist>
      </div>

      {/* Advanced */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', padding: '2px 0',
        }}
      >
        <span style={{ transform: showAdvanced ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
        ADVANCED OPTIONS
      </button>

      {showAdvanced && (
        <div style={{
          padding: '10px 12px', borderRadius: 8,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(126,184,247,0.1)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', display: 'block', marginBottom: 4 }}>
              DESIGN CONTEXT / CONSTRAINTS
            </label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Load requirements, mating parts, tolerances, special constraints…"
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical',
                padding: '7px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(126,184,247,0.14)',
                color: 'var(--text)', fontSize: 11, fontFamily: 'inherit',
              }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={highDetail}
              onChange={e => setHighDetail(e.target.checked)}
              style={{ accentColor: '#7eb8f7' }}
            />
            <span style={{ fontSize: 10, fontWeight: 700, color: highDetail ? '#7eb8f7' : 'var(--text-muted)', letterSpacing: '0.05em' }}>
              HIGH DETAIL (slower — better geometry)
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={solidRequested}
              onChange={e => setSolidRequested(e.target.checked)}
              style={{ accentColor: '#a78bfa' }}
            />
            <span style={{ fontSize: 10, fontWeight: 700, color: solidRequested ? '#a78bfa' : 'var(--text-muted)', letterSpacing: '0.05em' }}>
              🏗 ALSO BUILD SOLID (STL via CadQuery)
            </span>
          </label>
        </div>
      )}

      {/* Trust note */}
      <div style={{
        padding: '8px 10px', borderRadius: 7, fontSize: 9, lineHeight: 1.6,
        background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.12)',
        color: 'var(--text-muted)',
      }}>
        {blueprint
          ? '📐 <strong style="color:#60a5fa">Blueprint mode:</strong> AI will analyse your sketch first, then build on top of it.'
          : '🔬 <strong style="color:#60a5fa">Structured pipeline:</strong> Prompt → Spec → Constraints → Geometry → Validation → Repair.'
        }
        {' '}Assumptions and warnings are always shown.
      </div>

      {/* Generate button */}
      <button
        onClick={handleSubmit}
        disabled={!canGenerate}
        id="pipeline-generate-btn"
        style={{
          width: '100%', padding: '11px 0', borderRadius: 9,
          border: 'none', cursor: canGenerate ? 'pointer' : 'not-allowed',
          fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
          background: canGenerate
            ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
            : 'rgba(126,184,247,0.1)',
          color: canGenerate ? '#fff' : 'var(--text-muted)',
          transition: 'all 0.2s',
          boxShadow: canGenerate ? '0 4px 16px rgba(99,102,241,0.35)' : 'none',
        }}
      >
        {generating ? '⚙ Generating…' : blueprint ? '📐⚡ Generate from Blueprint' : '⚡ Generate Part'}
      </button>
    </div>
  );
}

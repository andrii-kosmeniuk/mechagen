import React, { useState } from 'react';

export function RoboticsPanel({ onGenerateAssembly, onImportGltf }: { 
  onGenerateAssembly?: (params: { architecture: string, payload: string, actuation: string, name: string }) => void;
  onImportGltf?: (url: string, filename: string) => void;
}) {
  const [robotType, setRobotType] = useState('6dof_arm');
  const [actuation, setActuation] = useState('stepper_nema17');
  const [payload, setPayload] = useState('500g');
  const [assemblyName, setAssemblyName] = useState('New Robot Assembly');
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onImportGltf?.(url, file.name);
    e.target.value = '';
  };

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
    },
    scroll: {
      flex: 1,
      overflowY: 'auto',
      padding: '12px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.1em',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      marginBottom: 8,
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
    select: {
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
    btnPrimary: {
      width: '100%',
      padding: '10px',
      background: 'var(--accent-blue)',
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
  };

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
          ROBOTICS LABORATORY
        </div>
      </div>
      <div style={s.scroll}>
        <div>
          <div style={s.sectionTitle}>ASSEMBLY NAME</div>
          <input
            style={s.input}
            value={assemblyName}
            onChange={(e) => setAssemblyName(e.target.value)}
          />
        </div>

        <div>
          <div style={s.sectionTitle}>ROBOT ARCHITECTURE</div>
          <select
            style={s.select}
            value={robotType}
            onChange={(e) => setRobotType(e.target.value)}
          >
            <option value="6dof_arm">6-axis Articulated Arm</option>
            <option value="scara">SCARA Arm</option>
            <option value="delta">Delta Robot</option>
            <option value="rover">AMR / Rover Base</option>
            <option value="quadruped">Quadruped Chassis</option>
          </select>
        </div>

        <div>
          <div style={s.sectionTitle}>ACTUATION TARGET</div>
          <select
            style={s.select}
            value={actuation}
            onChange={(e) => setActuation(e.target.value)}
          >
            <option value="stepper_nema17">NEMA 17 Steppers</option>
            <option value="stepper_nema23">NEMA 23 Steppers</option>
            <option value="servo_mg996r">MG996R Servos</option>
            <option value="bldc_hoverboard">Hoverboard BLDC</option>
          </select>
        </div>

        <div>
          <div style={s.sectionTitle}>TARGET PAYLOAD</div>
          <select
            style={s.select}
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          >
            <option value="250g">Lightweight (250g)</option>
            <option value="500g">Standard (500g)</option>
            <option value="1kg">Heavy Duty (1kg)</option>
            <option value="5kg">Industrial (5kg+)</option>
          </select>
        </div>

        {/* Import Robot Model */}
        <div>
          <div style={s.sectionTitle}>IMPORT ROBOT MODEL</div>
          <input
            ref={fileRef}
            type="file"
            accept=".glb,.gltf"
            style={{ display: 'none' }}
            onChange={handleFileImport}
          />
          <button
            style={{ ...s.btnPrimary, background: 'rgba(126,184,247,0.15)', border: '1px solid rgba(126,184,247,0.3)', color: '#7eb8f7', marginBottom: 8 }}
            onClick={() => fileRef.current?.click()}
          >
            <span>📂</span>
            Import GLTF / GLB
          </button>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Upload any <strong>.glb</strong> robot model from ROS, Sketchfab, or your URDF pipeline to display it directly in the viewport.
          </div>
        </div>

        <button style={s.btnPrimary} onClick={() => {
          if (onGenerateAssembly) {
            onGenerateAssembly({ architecture: robotType, payload, actuation, name: assemblyName });
          } else {
            alert("Assembly generation coming soon!");
          }
        }}>
          <span>🤖</span>
          Generate Assembly
        </button>

        <div style={{ marginTop: 'auto', padding: 12, background: 'rgba(126,184,247,0.1)', borderRadius: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <strong>Note:</strong> Robotics Design is in early preview. Full multi-part kinematic assembly generation will connect securely with the MechaGen pipeline.
        </div>
      </div>
    </div>
  );
}

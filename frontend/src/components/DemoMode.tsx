import React, { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3001';

interface DemoGeneration {
  id: string;
  prompt: string;
  status: string;
  specJson?: Record<string, unknown>;
  _isDemo: boolean;
}

interface DemoProject {
  id: string;
  name: string;
  description: string;
  _isDemo: boolean;
}

interface Props {
  onLoadProject?: (project: DemoProject, generations: DemoGeneration[]) => void;
  onDismiss?: () => void;
}

export function DemoMode({ onLoadProject, onDismiss }: Props) {
  const [visible, setVisible]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [project, setProject]       = useState<DemoProject | null>(null);
  const [gens, setGens]             = useState<DemoGeneration[]>([]);

  // Detect ?demo=true in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true') {
      setVisible(true);
      loadDemoData();
    }
  }, []);

  async function loadDemoData() {
    setLoading(true);
    try {
      const [projRes, gensRes] = await Promise.all([
        fetch(`${API}/api/demo/project`).then(r => r.json()),
        fetch(`${API}/api/demo/generations`).then(r => r.json()),
      ]);
      setProject(projRes.project ?? null);
      setGens(gensRes.generations ?? []);
    } catch {
      /* fail silently — demo mode is non-critical */
    }
    setLoading(false);
  }

  const handleLoad = () => {
    if (project) onLoadProject?.(project, gens);
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 800,
      background: 'linear-gradient(90deg, rgba(124,58,237,0.18), rgba(79,70,229,0.18))',
      borderBottom: '1px solid rgba(124,58,237,0.3)',
      backdropFilter: 'blur(12px)',
      padding: '12px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18 }}>🎮</span>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>Demo Mode</span>
          <span style={{ fontSize: 12, color: 'rgba(241,245,249,0.6)', marginLeft: 8 }}>
            {loading ? 'Loading demo project…' : project
              ? `"${project.name}" ready to explore`
              : 'Explore MechaGen with sample data — no account needed'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {project && !loading && (
          <button
            onClick={handleLoad}
            style={{
              padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
              background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff',
            }}
          >
            Load Demo Project →
          </button>
        )}
        <button
          onClick={() => { setVisible(false); onDismiss?.(); }}
          style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: 'rgba(241,245,249,0.5)' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

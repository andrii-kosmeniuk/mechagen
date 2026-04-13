import React, { useState } from 'react';
import type { Workspace, WorkspaceMember } from '../types';

const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3001';

interface Props {
  workspaces: Workspace[];
  onRefresh:  () => void;
}

const ROLE_COLORS: Record<string, string> = {
  owner:  '#f59e0b',
  admin:  '#a78bfa',
  member: '#34d399',
  viewer: '#64748b',
};

const s = {
  card: {
    padding: '10px 12px', borderRadius: 8,
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
  } as React.CSSProperties,
  label: {
    fontSize: 9, fontWeight: 800, letterSpacing: '0.09em', color: 'var(--text-muted)',
  } as React.CSSProperties,
  roleBadge: (role: string): React.CSSProperties => ({
    padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
    background: `${ROLE_COLORS[role] ?? '#64748b'}22`,
    color: ROLE_COLORS[role] ?? '#64748b',
    border: `1px solid ${ROLE_COLORS[role] ?? '#64748b'}33`,
    textTransform: 'uppercase' as const,
  }),
  createBtn: {
    width: '100%', padding: '7px 0', borderRadius: 7, border: 'none',
    cursor: 'pointer', fontSize: 10, fontWeight: 700,
    background: 'rgba(99,102,241,0.15)', color: '#818cf8',
  } as React.CSSProperties,
};

function WorkspaceCard({ ws, onRefresh }: { ws: Workspace; onRefresh: () => void }) {
  const [expanded, setExpanded]  = useState(false);
  const [members, setMembers]    = useState<WorkspaceMember[]>([]);
  const [loadingM, setLoadingM]  = useState(false);

  const loadMembers = async () => {
    if (expanded) { setExpanded(false); return; }
    setLoadingM(true);
    try {
      const r = await fetch(`${API}/api/workspaces/${ws.id}/members`);
      const data = await r.json();
      setMembers(data.members ?? []);
    } catch { /* ignore */ }
    setLoadingM(false);
    setExpanded(true);
  };

  return (
    <div style={s.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{ws.name}</div>
          {ws.description && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>{ws.description}</div>
          )}
        </div>
        <button
          onClick={loadMembers}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)' }}
        >
          {loadingM ? '…' : expanded ? '▲' : '▼ Members'}
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {members.length === 0
            ? <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>No members found</div>
            : members.map(m => (
                <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 9 }}>{m.userId}</span>
                  <span style={s.roleBadge(m.role)}>{m.role}</span>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}

export function WorkspacePanel({ workspaces, onRefresh }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [error, setError]       = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const r = await fetch(`${API}/api/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: desc.trim() }),
      });
      if (!r.ok) {
        const d = await r.json();
        setError(d.error ?? 'Failed to create workspace');
        return;
      }
      setName(''); setDesc(''); setCreating(false); setError(null);
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={s.label}>🏢 WORKSPACES</div>
      {workspaces.length === 0 && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          No workspaces yet. Create one to collaborate with your team.
        </div>
      )}
      {workspaces.map(ws => (
        <WorkspaceCard key={ws.id} ws={ws} onRefresh={onRefresh} />
      ))}
      {creating ? (
        <div style={s.card}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              placeholder="Workspace name"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', color: 'var(--text-primary)', fontSize: 11 }}
            />
            <input
              placeholder="Description (optional)"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', color: 'var(--text-primary)', fontSize: 11 }}
            />
            {error && <div style={{ fontSize: 10, color: '#f87171' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleCreate} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.25)', color: '#818cf8' }}>
                Create
              </button>
              <button onClick={() => { setCreating(false); setError(null); }} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button style={s.createBtn} onClick={() => setCreating(true)}>+ New Workspace</button>
      )}
    </div>
  );
}

import React, { useState } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3001';

const CATEGORIES = [
  { value: 'bug',                label: '🐛 Bug Report' },
  { value: 'feature_request',    label: '💡 Feature Request' },
  { value: 'usability',          label: '🎨 Usability' },
  { value: 'generation_quality', label: '🔬 Generation Quality' },
  { value: 'export_issue',       label: '📦 Export Issue' },
  { value: 'billing_issue',      label: '💳 Billing Issue' },
  { value: 'other',              label: '📝 Other' },
];

interface Props {
  projectId?:   string;
  generationId?: string;
}

type State = 'idle' | 'open' | 'submitting' | 'success' | 'error';

export function FeedbackWidget({ projectId, generationId }: Props) {
  const [state, setState]     = useState<State>('idle');
  const [category, setCat]    = useState('');
  const [message, setMessage] = useState('');
  const [error, setError]     = useState<string | null>(null);

  const open  = () => setState('open');
  const close = () => { setState('idle'); setCat(''); setMessage(''); setError(null); };

  const submit = async () => {
    if (!category) { setError('Please select a category'); return; }
    if (message.trim().length < 3) { setError('Please enter a message (min 3 chars)'); return; }
    setState('submitting');
    try {
      const r = await fetch(`${API}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message: message.trim(), projectId, generationId }),
      });
      if (!r.ok) {
        const d = await r.json();
        setError(d.error || 'Failed to submit');
        setState('open');
        return;
      }
      setState('success');
      setTimeout(close, 3000);
    } catch {
      setError('Network error — please try again');
      setState('open');
    }
  };

  const buttonStyle: React.CSSProperties = {
    position: 'fixed', bottom: 20, right: 20, zIndex: 900,
    background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
    color: '#fff', border: 'none', borderRadius: 50,
    width: 48, height: 48, fontSize: 20, cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform .2s',
  };

  const panelStyle: React.CSSProperties = {
    position: 'fixed', bottom: 78, right: 20, zIndex: 900,
    background: '#0d1424', border: '1px solid rgba(124,58,237,0.25)',
    borderRadius: 14, padding: 20, width: 300,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  };

  if (state === 'idle') {
    return (
      <button style={buttonStyle} onClick={open} title="Send feedback">
        💬
      </button>
    );
  }

  return (
    <>
      <button style={{ ...buttonStyle, transform: 'scale(0.9)' }} onClick={close} title="Close">✕</button>
      <div style={panelStyle}>
        {state === 'success' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Thanks for your feedback!</div>
            <div style={{ fontSize: 12, color: 'rgba(241,245,249,0.5)', marginTop: 6 }}>We read every submission.</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Send Feedback</div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(241,245,249,0.5)', marginBottom: 5 }}>CATEGORY</div>
              <select
                value={category}
                onChange={e => setCat(e.target.value)}
                style={{ width:'100%', padding:'8px 10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'#f1f5f9', fontFamily:'inherit', fontSize:12, outline:'none' }}
              >
                <option value="">Select…</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(241,245,249,0.5)', marginBottom: 5 }}>MESSAGE</div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Describe the issue or idea…"
                rows={4}
                style={{ width:'100%', padding:'8px 10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'#f1f5f9', fontFamily:'inherit', fontSize:12, outline:'none', resize:'vertical' }}
              />
            </div>

            {error && <div style={{ fontSize: 11, color: '#f87171', marginBottom: 10 }}>{error}</div>}
            {(projectId || generationId) && (
              <div style={{ fontSize: 10, color: 'rgba(241,245,249,0.35)', marginBottom: 10 }}>
                Context: {projectId ? `project ${projectId.slice(0,8)}` : ''}{generationId ? ` · gen ${generationId.slice(0,8)}` : ''}
              </div>
            )}

            <button
              onClick={submit}
              disabled={state === 'submitting'}
              style={{ width:'100%', padding:'9px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700, background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', opacity: state === 'submitting' ? 0.7 : 1 }}
            >
              {state === 'submitting' ? 'Sending…' : 'Send Feedback'}
            </button>
          </>
        )}
      </div>
    </>
  );
}

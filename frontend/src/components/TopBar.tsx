import React, { useState, useRef, useEffect } from 'react';
import type { AppUser } from '../types';
import { useTheme } from '../context/ThemeContext';

const ANALYSIS_TABS = [
  { id: 'explode',    icon: '💥', label: 'EXPLODE' },
  { id: 'dims',       icon: '📐', label: 'DIMS' },
  { id: 'simulate',   icon: '⚡', label: 'SIMULATE' },
  { id: 'ar',         icon: '📱', label: 'AR' },
  { id: 'kinematics', icon: '⚙️', label: 'KINEMATICS' },
  { id: 'loadpath',   icon: '🔗', label: 'LOAD PATH' },
  { id: 'parametric', icon: '🔢', label: 'PARAMETRIC' },
];

type Props = {
  user: AppUser;
  onSignOut: () => void;
  appMode: 'mechagen' | 'robotics';
  setAppMode: (mode: 'mechagen' | 'robotics') => void;
};

export function TopBar({ user, onSignOut, appMode, setAppMode }: Props) {
  const { theme, toggleTheme } = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState('');
  const topbarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (topbarRef.current && !topbarRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const initial = user.name?.[0]?.toUpperCase() || 'U';

  return (
    <header className="topbar" ref={topbarRef} style={{ flexDirection: 'column', height: 'auto', padding: 0, gap: 0 }}>
      {/* Top row: logo + nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 44, borderBottom: '1px solid var(--border)', width: '100%', boxSizing: 'border-box' }}>
        <div className="logo" style={{ width: 140 }}>
          <span style={{ color: 'var(--accent-blue)' }}>⬡</span>
          <span className="logo-text">MECHAGEN</span>
        </div>

        {/* Mode Switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--panel-bg)',
          borderRadius: 6,
          padding: 2,
          border: '1px solid var(--border)'
        }}>
          <button
            type="button"
            onClick={() => setAppMode('mechagen')}
            style={{
              padding: '4px 16px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 4,
              border: 'none',
              background: appMode === 'mechagen' ? 'var(--accent-blue)' : 'transparent',
              color: appMode === 'mechagen' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            MechaGen
          </button>
          <button
            type="button"
            onClick={() => setAppMode('robotics')}
            style={{
              padding: '4px 16px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 4,
              border: 'none',
              background: appMode === 'robotics' ? 'var(--accent-blue)' : 'transparent',
              color: appMode === 'robotics' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Robotics Design
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 140, justifyContent: 'flex-end' }}>
          <button type="button" className="chip" title="Remix" style={{ fontSize: 11 }}>⚡ Remix</button>
          <button type="button" className="chip" title="Preview device" style={{ fontSize: 11 }}>📱 Device</button>
          <button type="button" className="chip" title="AI Chat" style={{ fontSize: 11 }}>🤖 AI Chat</button>
          <button
            type="button"
            className="chip"
            onClick={toggleTheme}
            title="Toggle theme"
            style={{ fontSize: 11 }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className="user-avatar-wrap" onClick={e => { e.stopPropagation(); setUserMenuOpen(o => !o); }}>
            <span className="user-avatar-initial">{initial}</span>
            <div className="user-dropdown" style={{ display: userMenuOpen ? 'block' : 'none' }} onClick={e => e.stopPropagation()}>
              <div className="user-info-block">
                <div className="user-dropdown-name">{user.name}</div>
                <div className="user-dropdown-email">{user.email}</div>
              </div>
              <button type="button" className="btn-primary w-full signout-btn" onClick={onSignOut}>Sign Out</button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: analysis mode tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 16px', height: 36, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {ANALYSIS_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveAnalysis(s => s === tab.id ? '' : tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 12px', borderRadius: 5, fontSize: 11, fontWeight: 500,
              fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              border: activeAnalysis === tab.id ? '1px solid var(--accent-blue)' : '1px solid transparent',
              background: activeAnalysis === tab.id ? 'rgba(126,184,247,0.1)' : 'transparent',
              color: activeAnalysis === tab.id ? 'var(--accent-blue)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 12 }}>{tab.icon}</span>
            {tab.label.toUpperCase()}
          </button>
        ))}
      </div>
    </header>
  );
}

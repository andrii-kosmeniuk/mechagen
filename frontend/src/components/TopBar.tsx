import React, { useState, useRef, useEffect } from 'react';
import type { AppUser } from '../types';
import { useTheme } from '../context/ThemeContext';

type Props = {
  user: AppUser;
  onSignOut: () => void;
};

export function TopBar({ user, onSignOut }: Props) {
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close() {
      setOpen(false);
    }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const initial = user.name?.[0]?.toUpperCase() || 'U';

  return (
    <header className="topbar">
      <div className="logo">
        <span style={{ color: 'var(--accent-blue)' }}>⬡</span> MECHAGEN PRO
      </div>
      <div className="topbar-actions">
        <button type="button" className="chip">
          📊 Dashboard
        </button>
        <button type="button" className="chip">
          🧠 Memory
        </button>
        <button type="button" className="chip">
          📋 Versions
        </button>
        <button
          type="button"
          className="chip"
          onClick={(e) => {
            e.stopPropagation();
            toggleTheme();
          }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '🌙 Light' : '☀️ Dark'}
        </button>
        <div
          ref={wrapRef}
          className="user-avatar-wrap"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          <span className="user-avatar-initial">{initial}</span>
          <div
            className="user-dropdown"
            style={{ display: open ? 'block' : 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="user-info-block">
              <div className="user-dropdown-name">{user.name}</div>
              <div className="user-dropdown-email">{user.email}</div>
              <div className="status-badge inline-badge user-dropdown-role">
                {user.role}
              </div>
            </div>
            <button type="button" className="chip w-full text-left mb-4">
              My Profile
            </button>
            <button type="button" className="chip w-full text-left mb-4">
              Team Settings
            </button>
            <button type="button" className="chip w-full text-left mb-1">
              Usage
            </button>
            <button
              type="button"
              className="btn-primary w-full signout-btn"
              onClick={onSignOut}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

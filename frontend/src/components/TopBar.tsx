import React, { useState, useRef, useEffect } from 'react';
import type { AppUser } from '../types';
import { useTheme } from '../context/ThemeContext';

type Props = {
  user: AppUser;
  onSignOut: () => void;
};

export function TopBar({ user, onSignOut }: Props) {
  const { theme, toggleTheme } = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const topbarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (topbarRef.current && !topbarRef.current.contains(t)) {
        setUserMenuOpen(false);
        setNavOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
        setNavOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 901px)');
    const closeNavIfDesktop = () => {
      if (mq.matches) setNavOpen(false);
    };
    mq.addEventListener('change', closeNavIfDesktop);
    return () => mq.removeEventListener('change', closeNavIfDesktop);
  }, []);

  const initial = user.name?.[0]?.toUpperCase() || 'U';

  return (
    <header className="topbar" ref={topbarRef}>
      <div className="logo">
        <span style={{ color: 'var(--accent-blue)' }}>⬡</span>
        <span className="logo-text">MECHAGEN PRO</span>
      </div>

      <div className="topbar-end">
        <button
          type="button"
          className="topbar-burger chip"
          aria-expanded={navOpen}
          aria-controls="topbar-nav"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          onClick={(e) => {
            e.stopPropagation();
            setNavOpen((o) => !o);
            setUserMenuOpen(false);
          }}
        >
          {navOpen ? '✕' : '☰'}
        </button>

        <nav
          id="topbar-nav"
          className={`topbar-nav${navOpen ? ' topbar-nav--open' : ''}`}
        >
          <button type="button" className="chip" onClick={() => setNavOpen(false)}>
            📊 Dashboard
          </button>
          <button type="button" className="chip" onClick={() => setNavOpen(false)}>
            🧠 Memory
          </button>
          <button type="button" className="chip" onClick={() => setNavOpen(false)}>
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
        </nav>

        <div
          className="user-avatar-wrap"
          onClick={(e) => {
            e.stopPropagation();
            setUserMenuOpen((o) => !o);
            setNavOpen(false);
          }}
        >
          <span className="user-avatar-initial">{initial}</span>
          <div
            className="user-dropdown"
            style={{ display: userMenuOpen ? 'block' : 'none' }}
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

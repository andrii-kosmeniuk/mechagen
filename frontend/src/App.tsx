import React, { Component, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthScreen } from './components/AuthScreen';
import { LandingPage } from './components/LandingPage';
import { MainLayout } from './components/MainLayout';

type AuthStep = 'landing' | 'auth';

/** Avoid blank screen when a child throws — show the error text instead. */
class RootErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            minHeight: '100vh',
            fontFamily: 'system-ui, sans-serif',
            background: '#0a0a0f',
            color: '#f77a7a',
          }}
        >
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>Something broke</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function MechaGenApp() {
  const [session, setSession] = useState<Session | null>(null);
  // In dev mode start ready immediately — no Supabase needed
  const [ready, setReady] = useState(import.meta.env.DEV ? true : false);
  const [authStep, setAuthStep] = useState<AuthStep>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const prevSessionRef = useRef<Session | null>(null);

  useEffect(() => {
    // DEV BYPASS — skip Supabase in development so we can test without valid keys
    if (import.meta.env.DEV) return;
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session ?? null);
        setReady(true);
      })
      .catch(() => {
        setReady(true);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (prevSessionRef.current && !session) {
      setAuthStep('landing');
    }
    prevSessionRef.current = session;
  }, [session]);

  if (!ready) {
    return (
      <div className="config-missing">
        <p>Loading…</p>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="config-missing">
        <p>
          Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> in <code>frontend/.env</code>,
          then restart the dev server.
        </p>
      </div>
    );
  }

  // DEV BYPASS — skip Supabase in development
  if (import.meta.env.DEV) {
    const devSession = {
      user: {
        id: 'dev-user',
        email: 'dev@mechagen.local',
        user_metadata: { role: 'engineer', full_name: 'Dev User' },
      },
    } as unknown as import('@supabase/supabase-js').Session;
    return (
      <MainLayout
        session={devSession}
        supabase={supabase as any}
        onSignOut={() => {}}
      />
    );
  }

  if (!session) {
    if (authStep === 'landing') {
      return (
        <LandingPage
          onSignIn={() => {
            setAuthMode('login');
            setAuthStep('auth');
          }}
          onGetStarted={() => {
            setAuthMode('register');
            setAuthStep('auth');
          }}
        />
      );
    }
    return (
      <AuthScreen
        supabase={supabase}
        initialMode={authMode}
        variant="modal"
        onClose={() => setAuthStep('landing')}
      />
    );
  }

  const client = supabase;
  return (
    <MainLayout
      session={session}
      supabase={client}
      onSignOut={() => client.auth.signOut()}
    />
  );
}

export default function App() {
  return (
    <RootErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <MechaGenApp />
        </ToastProvider>
      </ThemeProvider>
    </RootErrorBoundary>
  );
}

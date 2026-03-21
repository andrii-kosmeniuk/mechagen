import React, { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthScreen } from './components/AuthScreen';
import { LandingPage } from './components/LandingPage';
import { MainLayout } from './components/MainLayout';

type AuthStep = 'landing' | 'auth';

function MechaGenApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const prevSessionRef = useRef<Session | null>(null);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
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
    <ThemeProvider>
      <ToastProvider>
        <MechaGenApp />
      </ToastProvider>
    </ThemeProvider>
  );
}

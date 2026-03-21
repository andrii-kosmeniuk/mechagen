import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthScreen } from './components/AuthScreen';
import { MainLayout } from './components/MainLayout';

function MechaGenApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

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
    return <AuthScreen supabase={supabase} />;
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

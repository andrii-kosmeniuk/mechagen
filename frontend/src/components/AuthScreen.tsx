import React, { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useTheme } from '../context/ThemeContext';

type Props = {
  supabase: SupabaseClient;
};

export function AuthScreen({ supabase }: Props) {
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');

  return (
    <div className="auth-screen">
      <button
        type="button"
        className="auth-theme-toggle chip"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark' ? '🌙 Light' : '☀️ Dark'}
      </button>
      <div className="auth-card">
        <h2>
          {mode === 'login'
            ? 'Sign In to MechaGen Pro'
            : 'Create MechaGen Account'}
        </h2>
        {error ? (
          <div className="auth-error" style={{ display: 'block' }}>
            {error}
          </div>
        ) : null}

        {mode === 'login' ? (
          <form
            className="auth-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              const fd = new FormData(e.currentTarget);
              const email = String(fd.get('email') || '');
              const password = String(fd.get('password') || '');
              const { data, error: err } = await supabase.auth.signInWithPassword(
                { email, password }
              );
              if (err) {
                setError(err.message);
                return;
              }
              if (!data.session) {
                setError(
                  'No active session. Disable email confirmation in Supabase for dev or confirm your email.'
                );
                return;
              }
              setError('');
            }}
          >
            <input name="email" type="email" placeholder="Email" required />
            <input
              name="password"
              type="password"
              placeholder="Password"
              required
            />
            <button type="submit" className="btn-primary">
              Sign In
            </button>
          </form>
        ) : (
          <form
            className="auth-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              const fd = new FormData(e.currentTarget);
              const name = String(fd.get('name') || '');
              const email = String(fd.get('email') || '');
              const password = String(fd.get('password') || '');
              const role = String(fd.get('role') || 'engineer');
              const { data, error: err } = await supabase.auth.signUp({
                email,
                password,
                options: {
                  data: { full_name: name || 'User', role },
                },
              });
              if (err) {
                setError(err.message);
                return;
              }
              if (data.session) {
                setError('');
                return;
              }
              const signIn = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              if (signIn.error) {
                setError(signIn.error.message);
                return;
              }
              if (signIn.data.session) {
                setError('');
              } else {
                setError(
                  'Account created. Turn off email confirmation in Supabase for instant login, or confirm your email.'
                );
              }
            }}
          >
            <input name="name" type="text" placeholder="Full Name" required />
            <input name="email" type="email" placeholder="Email" required />
            <input
              name="password"
              type="password"
              placeholder="Password"
              required
            />
            <select name="role" defaultValue="engineer">
              <option value="engineer">Engineer</option>
              <option value="student">Student</option>
              <option value="researcher">Researcher</option>
            </select>
            <button type="submit" className="btn-primary">
              Create Account
            </button>
          </form>
        )}

        <div className="auth-toggle">
          <span
            role="button"
            tabIndex={0}
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }
            }}
          >
            {mode === 'login'
              ? "Don't have an account? Register"
              : 'Already have an account? Sign In'}
          </span>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

type Props = {
  supabase: SupabaseClient;
  /** Synced when opening from landing (Sign In vs Get Started). */
  initialMode?: 'login' | 'register';
  /** `modal` = backdrop + close; `page` = full-screen auth (legacy). */
  variant?: 'page' | 'modal';
  /** Close modal and return to landing. */
  onClose?: () => void;
};

export function AuthScreen({
  supabase,
  initialMode = 'login',
  variant = 'page',
  onClose,
}: Props) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [error, setError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const isModal = variant === 'modal';

  return (
    <div
      className={`auth-screen${isModal ? ' auth-screen--modal' : ''}`}
      role={isModal ? 'dialog' : undefined}
      aria-modal={isModal ? true : undefined}
      aria-labelledby="auth-heading"
    >
      <div className="auth-card">
        {isModal && onClose ? (
          <button
            type="button"
            className="close-auth"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        ) : null}

        <h2 id="auth-heading">
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
              setLoginSubmitting(true);
              const fd = new FormData(e.currentTarget);
              const email = String(fd.get('email') || '');
              const password = String(fd.get('password') || '');
              try {
                const { data, error: err } =
                  await supabase.auth.signInWithPassword({ email, password });
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
              } finally {
                setLoginSubmitting(false);
              }
            }}
          >
            <input name="email" type="email" placeholder="Email" required />
            <input
              name="password"
              type="password"
              placeholder="Password"
              required
            />
            <button
              type="submit"
              className={`btn-primary${loginSubmitting ? ' loading' : ''}`}
              disabled={loginSubmitting}
            >
              <span className="btn-text">Sign In</span>
              <span className="spinner" aria-hidden />
            </button>
          </form>
        ) : (
          <form
            className="auth-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              setRegisterSubmitting(true);
              const fd = new FormData(e.currentTarget);
              const name = String(fd.get('name') || '');
              const email = String(fd.get('email') || '');
              const password = String(fd.get('password') || '');
              const role = String(fd.get('role') || 'engineer');
              try {
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
              } finally {
                setRegisterSubmitting(false);
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
            <button
              type="submit"
              className={`btn-primary${registerSubmitting ? ' loading' : ''}`}
              disabled={registerSubmitting}
            >
              <span className="btn-text">Create Account</span>
              <span className="spinner" aria-hidden />
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
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
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

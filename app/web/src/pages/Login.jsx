import React, { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import AuthLayout from '../components/AuthLayout.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const formRef = useRef(null);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    // Read the live field values: password managers can fill the DOM without
    // firing change events, so React state alone would submit empty credentials.
    const form = formRef.current;
    const enteredEmail = String(form?.email?.value ?? email).trim();
    const enteredPassword = String(form?.password?.value ?? password);
    if (!enteredEmail || !enteredPassword) {
      setError('Enter your email and password to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(enteredEmail, enteredPassword);
      const next = location.state?.from;
      navigate(next && next !== '/login' ? next : '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not sign in');
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Continue to your Redfox workspace."
      footer={(
        <>
          New here?{' '}
          <Link to="/signup" className="font-medium text-accentInk hover:text-accent">Create an account</Link>
        </>
      )}
    >
      <form ref={formRef} onSubmit={submit} className="space-y-3.5" noValidate>
        {error ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.07] px-3 py-2 text-[12px] text-danger">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <label className="block">
          <span className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-[0.1em] text-dim">Work email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            autoFocus
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className="field focus-ring h-10 w-full rounded-lg border border-line bg-panel px-3 text-[13.5px] text-fg placeholder:text-dim hover:border-line-strong"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-dim">Password</span>
          </span>
          <span className="relative block">
            <input
              type={visible ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyUp={(event) => setCapsLock(event.getModifierState?.('CapsLock') || false)}
              placeholder="Your password"
              className="field focus-ring h-10 w-full rounded-lg border border-line bg-panel pl-3 pr-9 text-[13.5px] text-fg placeholder:text-dim hover:border-line-strong"
            />
            <button
              type="button"
              onClick={() => setVisible((value) => !value)}
              aria-label={visible ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-dim transition-colors hover:text-fg"
            >
              {visible ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </span>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[color:var(--ink)] text-[13.5px] font-medium text-[color:var(--bg)] transition-colors hover:bg-accent hover:text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {busy ? 'Signing in' : 'Sign in'}
        </button>

        {capsLock ? (
          <p className="flex items-center gap-1.5 text-[11px] text-warn">
            <AlertCircle size={12} /> Caps Lock is on
          </p>
        ) : null}

        <p className="pt-1 text-[11px] leading-5 text-dim">
          Sessions last 14 days and can be revoked from Account settings.{' '}
          <Link to="/docs#recovery" className="text-accentInk hover:text-accent">Locked out?</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

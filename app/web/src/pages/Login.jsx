import React, { useState } from 'react';
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

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
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
          <Link to="/signup" className="font-medium text-accent hover:text-accent-hover">Create an account</Link>
        </>
      )}
    >
      <form onSubmit={submit} className="space-y-3.5" noValidate>
        {error ? (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/[0.07] px-3 py-2 text-[12px] text-[#ffb4ae]">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <label className="block">
          <span className="mb-1.5 block text-[11.5px] font-medium text-muted">Work email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className="field focus-ring h-9 w-full rounded-md border border-line bg-panel px-3 text-[13px] text-fg placeholder:text-dim hover:border-line-strong"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[11.5px] font-medium text-muted">Password</span>
          </span>
          <span className="relative block">
            <input
              type={visible ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              className="field focus-ring h-9 w-full rounded-md border border-line bg-panel pl-3 pr-9 text-[13px] text-fg placeholder:text-dim hover:border-line-strong"
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
          disabled={busy || !email.trim() || !password}
          className="focus-ring inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-accent text-[13px] font-medium text-[#180b07] transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {busy ? 'Signing in' : 'Sign in'}
        </button>

        <p className="pt-1 text-[11px] leading-5 text-dim">
          Sessions last 14 days and can be revoked from Account settings. Forgotten passwords are reset by
          an instance administrator, since this deployment has no outbound mail configured.
        </p>
      </form>
    </AuthLayout>
  );
}

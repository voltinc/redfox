import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, Loader2, Users } from 'lucide-react';
import { ApiError, post } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { cx } from '../lib/format.js';
import AuthLayout from '../components/AuthLayout.jsx';

const STRENGTH = [
  { label: 'Too short', tone: 'bg-danger', text: 'text-danger' },
  { label: 'Weak', tone: 'bg-danger', text: 'text-danger' },
  { label: 'Fair', tone: 'bg-warn', text: 'text-warn' },
  { label: 'Good', tone: 'bg-warn', text: 'text-warn' },
  { label: 'Strong', tone: 'bg-success', text: 'text-success' },
];

function scorePassword(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 10) score += 1;
  if (value.length >= 14) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  if (value.length < 10) return Math.min(score, 1);
  return Math.min(score, 4);
}

function FieldError({ children }) {
  if (!children) return null;
  return <span className="mt-1 block text-[11px] text-danger">{children}</span>;
}

export default function Signup() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('invite');

  const [invite, setInvite] = useState(null);
  const [inviteState, setInviteState] = useState(token ? 'loading' : 'none');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});

  useEffect(() => {
    if (!token) return;
    let alive = true;
    fetch(`/api/invites/${encodeURIComponent(token)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!alive) return;
        setInvite(data);
        setInviteState(data.valid ? 'valid' : data.reason || 'invalid');
        if (data.email) setEmail(data.email);
      })
      .catch(() => alive && setInviteState('error'));
    return () => { alive = false; };
  }, [token]);

  const strength = useMemo(() => scorePassword(password), [password]);
  const strengthMeta = STRENGTH[strength];

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await post('/api/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
        workspace: workspace.trim(),
        ...(token ? { invite_token: token } : {}),
      });
      await refresh();
      navigate(invite?.valid ? '/' : '/projects/new', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.details && typeof err.details === 'object') {
        setFields(err.details);
        setError(err.message);
      } else {
        setError(err.message || 'Could not create the account');
      }
      setBusy(false);
    }
  };

  const invited = inviteState === 'valid' && invite?.valid;
  const inviteBlocked = token && !['loading', 'valid'].includes(inviteState);

  return (
    <AuthLayout
      wide
      title={invited ? `Join ${invite.workspace?.name}` : 'Create your workspace'}
      subtitle={invited
        ? `${invite.inviter?.name || 'A teammate'} invited you as ${invite.role}. Your projects and deployments will be shared.`
        : 'One account for repositories, deploys, databases and infrastructure.'}
      footer={(
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accentInk hover:text-accent">Sign in</Link>
        </>
      )}
    >
      {inviteState === 'loading' ? (
        <p className="flex items-center gap-2 text-[12px] text-dim"><Loader2 size={13} className="animate-spin" /> Checking invitation</p>
      ) : null}

      {invited ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-info/30 bg-info/[0.07] px-3 py-2 text-[11.5px] leading-5 text-info">
          <Users size={13} className="mt-0.5 shrink-0" />
          <span>
            You are joining <strong className="font-medium">{invite.workspace?.name}</strong> ({invite.workspace?.region}) as {invite.role}.
          </span>
        </div>
      ) : null}

      {inviteBlocked ? (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-md border border-warn/30 bg-warn/[0.07] px-3 py-2 text-[11.5px] leading-5 text-warn">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>
            {inviteState === 'expired' ? 'This invitation has expired. Ask for a new link, or create a workspace of your own.'
              : inviteState === 'accepted' ? 'This invitation was already used. Sign in instead.'
                : 'This invitation link is not valid. You can still create your own workspace.'}
          </span>
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-3.5" noValidate>
        {error && !Object.keys(fields).length ? (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/[0.07] px-3 py-2 text-[12px] text-danger">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <label className="block">
          <span className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-[0.1em] text-dim">Full name</span>
          <input
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Alex Moreau"
            aria-invalid={Boolean(fields.name)}
            className={cx('focus-ring h-10 w-full rounded-lg border bg-panel px-3 text-[13.5px] text-fg placeholder:text-dim', fields.name ? 'border-danger/60' : 'border-line hover:border-line-strong')}
          />
          <FieldError>{fields.name}</FieldError>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-[0.1em] text-dim">Work email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            readOnly={invited && Boolean(invite?.email)}
            aria-invalid={Boolean(fields.email)}
            className={cx('focus-ring h-10 w-full rounded-lg border bg-panel px-3 text-[13.5px] text-fg placeholder:text-dim', fields.email ? 'border-danger/60' : 'border-line hover:border-line-strong', invited && invite?.email && 'text-muted')}
          />
          <FieldError>{fields.email}</FieldError>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-[0.1em] text-dim">Password</span>
          <span className="relative block">
            <input
              type={visible ? 'text' : 'password'}
              name="new-password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 10 characters"
              aria-invalid={Boolean(fields.password)}
              className={cx('focus-ring h-10 w-full rounded-lg border bg-panel pl-3 pr-9 text-[13.5px] text-fg placeholder:text-dim', fields.password ? 'border-danger/60' : 'border-line hover:border-line-strong')}
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
          {password ? (
            <span className="mt-2 flex items-center gap-2">
              <span className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((segment) => (
                  <span key={segment} className={cx('h-0.5 flex-1 rounded-full', segment < Math.max(strength, 1) ? strengthMeta.tone : 'bg-line')} />
                ))}
              </span>
              <span className={cx('text-[10.5px]', strengthMeta.text)}>{strengthMeta.label}</span>
            </span>
          ) : null}
          <FieldError>{fields.password}</FieldError>
        </label>

        {!invited ? (
          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-dim">Workspace name</span>
              <span className="text-[10.5px] text-dim">optional</span>
            </span>
            <input
              name="workspace"
              value={workspace}
              onChange={(event) => setWorkspace(event.target.value)}
              placeholder="Acme Engineering"
              aria-invalid={Boolean(fields.workspace)}
              className={cx('focus-ring h-10 w-full rounded-lg border bg-panel px-3 text-[13.5px] text-fg placeholder:text-dim', fields.workspace ? 'border-danger/60' : 'border-line hover:border-line-strong')}
            />
            <span className="mt-1 block text-[10.5px] text-dim">Defaults to your name. You can invite teammates afterwards.</span>
            <FieldError>{fields.workspace}</FieldError>
          </label>
        ) : null}

        <button
          type="submit"
          disabled={busy || !name.trim() || !email.trim() || password.length < 10 || Boolean(inviteBlocked)}
          className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[color:var(--ink)] text-[13.5px] font-medium text-[color:var(--bg)] transition-colors hover:bg-accent hover:text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {busy ? 'Creating account' : invited ? `Join ${invite.workspace?.name}` : 'Create account'}
          {!busy ? <ArrowRight size={13} /> : null}
        </button>

        <ul className="space-y-1 pt-1">
          {['Your workspace starts empty, with no sample data', 'No card, no trial timer, no lock-in'].map((item) => (
            <li key={item} className="flex items-center gap-1.5 text-[10.5px] text-dim">
              <Check size={11} className="text-success" /> {item}
            </li>
          ))}
        </ul>
      </form>
    </AuthLayout>
  );
}

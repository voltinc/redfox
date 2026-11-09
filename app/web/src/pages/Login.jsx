import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Database, GitBranch, Rocket, Server, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { Logo } from '../components/Shell.jsx';
import { Button, Field, Input } from '../ui/index.jsx';

const FEATURES = [
  { icon: GitBranch, label: 'Git hosting', detail: 'Repositories, branches and commits' },
  { icon: Rocket, label: 'Deployments', detail: 'Build logs, previews and rollbacks' },
  { icon: Database, label: 'Databases', detail: 'Isolated Postgres per project' },
  { icon: Server, label: 'Infrastructure', detail: 'Servers, containers and metrics' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('demo@redfox.dev');
  const [password, setPassword] = useState('redfox-demo');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-base lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="relative hidden flex-col justify-between border-r border-line px-10 py-8 lg:flex">
        <div className="flex items-center gap-2">
          <Logo size={22} />
          <span className="rounded border border-line px-1.5 py-0.5 text-2xs text-dim">0.9.0</span>
        </div>

        <div className="max-w-[460px]">
          <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-fg">
            Your entire development lifecycle, in one place.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Redfox brings git hosting, deployments, databases, storage and infrastructure into a single
            control plane. Bring your own cloud when you are ready.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4">
            {FEATURES.map((feature) => (
              <div key={feature.label} className="flex gap-2.5">
                <feature.icon size={14} className="mt-[2px] shrink-0 text-accent" strokeWidth={1.9} />
                <div>
                  <p className="text-sm font-medium leading-5 text-fg">{feature.label}</p>
                  <p className="text-xs leading-4 text-dim">{feature.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-9 overflow-hidden rounded-md border border-line bg-[#08080a]">
            <div className="flex items-center gap-1.5 border-b border-line bg-panel px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2f2f36]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#2f2f36]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#2f2f36]" />
              <span className="ml-1.5 font-mono text-2xs text-dim">redfox · deploy atlas-web</span>
            </div>
            <pre className="px-3 py-2 font-mono text-[11px] leading-[1.75] text-muted">
<span className="text-dim">$</span> redfox deploy --prod{'\n'}
<span className="text-[#4d4d55]">11:24:02</span> <span className="text-[#79c0ff]">queue</span>   resolved 9c1f8a2 on main{'\n'}
<span className="text-[#4d4d55]">11:24:03</span> <span className="text-[#79c0ff]">build</span>   running node build.mjs{'\n'}
<span className="text-[#4d4d55]">11:24:04</span> <span className="text-[#79c0ff]">build</span>   built 4 files, 5.8 kB{'\n'}
<span className="text-[#4d4d55]">11:24:05</span> <span className="text-[#79c0ff]">routing</span> registered atlas.redfox.app{'\n'}
<span className="text-[#4d4d55]">11:24:05</span> <span className="text-success">ready</span>   deployment ready in 3.1s
            </pre>
          </div>
        </div>

        <p className="flex items-center gap-1.5 text-2xs text-dim">
          <Sparkles size={11} /> Solene, your AI development assistant, is included.
        </p>
      </div>

      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[340px]">
          <div className="mb-7 flex items-center gap-2 lg:hidden">
            <Logo size={22} />
          </div>
          <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-fg">Sign in to Redfox</h2>
          <p className="mt-1 text-sm text-muted">Use your workspace account to continue.</p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.dev"
                required
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </Field>

            {error ? (
              <div className="rounded border border-[#3d2222] bg-[#180f10] px-2.5 py-2 text-xs text-danger">{error}</div>
            ) : null}

            <Button type="submit" variant="primary" size="md" className="w-full justify-center" loading={loading} iconRight={<ArrowRight size={13} />}>
              Sign in
            </Button>
          </form>

          <div className="mt-5 rounded-md border border-line bg-panel p-2.5">
            <p className="text-2xs font-medium uppercase tracking-[0.08em] text-dim">Demo workspace</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              <span className="font-mono text-fg">demo@redfox.dev</span> · <span className="font-mono text-fg">redfox-demo</span>
            </p>
            <p className="mt-1 text-2xs leading-4 text-dim">
              Seeded with four projects, repositories, deployment history and demonstration infrastructure.
              Sign in as other members from Workspace Settings to test roles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

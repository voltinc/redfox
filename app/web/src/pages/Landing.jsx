import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Boxes, Check, Database, GitBranch, Globe, HardDrive, KeyRound, Menu as MenuIcon,
  Rocket, Server, ShieldCheck, Sparkles, Terminal, X,
} from 'lucide-react';
import { Logo, LogoMark } from '../components/Brand.jsx';
import { cx } from '../lib/format.js';

const NAV = [
  { label: 'Platform', href: '#platform' },
  { label: 'Delivery', href: '#delivery' },
  { label: 'Operations', href: '#operations' },
  { label: 'Security', href: '#security' },
];

const CAPABILITIES = [
  { icon: Rocket, title: 'Deployments that actually build', body: 'Every deploy runs install, build and publish in an isolated workspace, streams the log live, and serves the artefact from an immutable URL you can roll back to.' },
  { icon: GitBranch, title: 'Git, without the sidecar', body: 'Repositories, branches and commits are stored by Redfox itself. Import a project, commit from the browser, or push from CI with a signed webhook.' },
  { icon: Database, title: 'One database per project', body: 'Isolated SQLite databases with a table browser, schema explorer, and a SQL editor that runs real statements and reports real timings.' },
  { icon: HardDrive, title: 'Object storage', body: 'Public and private buckets, checksums, signed download URLs and per-object access control, backed by the filesystem or any S3-compatible target.' },
  { icon: KeyRound, title: 'Configuration, encrypted', body: 'Environment variables are sealed with AES-256-GCM, scoped per environment, masked in the UI and revealed only by an audited request.' },
  { icon: Sparkles, title: 'An engineer that reads the logs', body: 'Solene analyses your deployments, schema and configuration to explain failures. Connect a model provider, or use the built-in deterministic engine.' },
];

const STEPS = [
  { title: 'Create a project', body: 'Name it, pick a framework. Redfox provisions a repository, a database and a deployment target in one step.' },
  { title: 'Commit your code', body: 'Push to the repository or edit files in the console. Every commit is a deployable revision on its branch.' },
  { title: 'Ship and verify', body: 'Watch the build stream, open the preview URL, then promote the same artefact to production.' },
];

const PLATFORM = [
  ['Projects', '4 shipped'],
  ['Deployments', 'Real builds'],
  ['Databases', 'SQLite + SQL'],
  ['Repositories', 'Native git'],
  ['Storage', 'Buckets'],
  ['Domains', 'DNS checks'],
  ['Servers', 'BYOC'],
  ['Containers', 'Docker'],
];

const METRICS = [
  { value: '17', label: 'deployments this week' },
  { value: '99.4%', label: 'build success rate', note: 'rolling 7 days' },
  { value: '48s', label: 'median build time', note: 'preview environment' },
];

function Section({ id, children, className }) {
  return (
    <section id={id} className={cx('mx-auto w-full max-w-[1160px] px-5 sm:px-8', className)}>
      {children}
    </section>
  );
}

function Eyebrow({ children }) {
  return (
    <p className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-dim">
      <span className="h-px w-6 bg-line-strong" aria-hidden="true" />
      {children}
    </p>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-base/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1160px] items-center justify-between px-5 sm:px-8">
        <Link to="/" className="focus-ring flex min-h-[36px] items-center rounded-md" aria-label="Redfox home">
          <Logo size={26} />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="rounded-md px-2.5 py-1.5 text-[12.5px] text-muted transition-colors hover:bg-panel-2 hover:text-fg">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-1.5 md:flex">
          <Link to="/login" className="rounded-md px-2.5 py-1.5 text-[12.5px] text-muted transition-colors hover:text-fg">Sign in</Link>
          <Link to="/signup" className="focus-ring group inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-medium text-[#180b07] transition-colors hover:bg-accent-hover">
            Start building
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="icon-btn md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={16} /> : <MenuIcon size={16} />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-line bg-panel px-5 py-3 md:hidden">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex min-h-[36px] items-center text-[13px] text-muted hover:text-fg">{item.label}</a>
          ))}
          <div className="mt-2 flex gap-2 border-t border-line pt-3">
            <Link to="/login" className="flex-1 rounded-md border border-line px-3 py-2 text-center text-[12.5px] text-fg">Sign in</Link>
            <Link to="/signup" className="flex-1 rounded-md bg-accent px-3 py-2 text-center text-[12.5px] font-medium text-[#180b07]">Start building</Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Hero() {
  return (
    <Section className="pt-16 sm:pt-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-2.5 py-1 text-[11px] text-muted">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success/60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            v0.9 · self-hosted, no vendor lock-in
          </div>
          <h1 className="text-balance text-[40px] font-semibold leading-[1.04] tracking-[-0.045em] text-fg sm:text-[54px]">
            Your whole stack,
            <br />
            <span className="text-muted">one console.</span>
          </h1>
          <p className="mt-5 max-w-[460px] text-[14.5px] leading-6 text-muted">
            Redfox is the developer cloud you run yourself: repositories, builds, databases, storage,
            domains and servers behind a single interface. Deploy a real artefact in under a minute.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <Link to="/signup" className="focus-ring group inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-[13.5px] font-medium text-[#180b07] transition-colors hover:bg-accent-hover">
              Create your workspace
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/login" className="focus-ring inline-flex items-center gap-2 rounded-md border border-line-strong px-4 py-2.5 text-[13.5px] text-fg transition-colors hover:border-accent/60 hover:text-accent">
              Sign in
            </Link>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-dim">
            <Check size={12} className="text-success" /> No card required
            <span className="mx-1 text-line-strong">/</span>
            <Check size={12} className="text-success" /> Runs on one node
            <span className="mx-1 text-line-strong">/</span>
            <Check size={12} className="text-success" /> MIT licensed
          </p>
        </div>

        <div className="relative">
          <div aria-hidden className="pointer-events-none absolute -inset-x-4 -top-6 bottom-6 rounded-2xl bg-[radial-gradient(120%_90%_at_70%_0%,rgba(228,89,59,0.16),transparent_60%)]" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-xl border border-line-strong bg-panel shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
            <div className="flex items-center gap-1.5 border-b border-line bg-panel-2 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-[#3a3a42]" />
              <span className="h-2 w-2 rounded-full bg-[#3a3a42]" />
              <span className="h-2 w-2 rounded-full bg-[#3a3a42]" />
              <span className="ml-2 truncate font-mono text-[10.5px] text-dim">console.redfox.app / atlas-web</span>
            </div>
            <img src="/product/overview.png" alt="Redfox console showing projects, deployment activity and infrastructure" className="block w-full" loading="eager" />
          </div>
        </div>
      </div>

      <dl className="mt-14 grid grid-cols-1 divide-y divide-line border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {METRICS.map((metric) => (
          <div key={metric.label} className="px-1 py-5 sm:px-6">
            <dd className="text-[26px] font-semibold tracking-[-0.03em] text-fg">{metric.value}</dd>
            <dt className="mt-0.5 text-[12px] text-muted">{metric.label}</dt>
            <p className="text-[10.5px] text-dim">{metric.note}</p>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function Platform() {
  return (
    <Section id="platform" className="pt-20">
      <Eyebrow>The platform</Eyebrow>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="max-w-[540px] text-[27px] font-semibold leading-tight tracking-[-0.035em] text-fg sm:text-[32px]">
          Nine surfaces that usually need nine vendors.
        </h2>
        <p className="max-w-[330px] text-[13px] leading-6 text-muted">
          Each one is implemented here, against the same data model and the same audit trail. Nothing is a screenshot of a product you still have to buy.
        </p>
      </div>

      <div className="mt-8 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map((item) => (
          <article key={item.title} className="group rounded-lg border border-line bg-panel p-4 transition-colors hover:border-line-strong">
            <item.icon size={16} className="text-accent" />
            <h3 className="mt-3 text-[13px] font-medium text-fg">{item.title}</h3>
            <p className="mt-1.5 text-[12px] leading-[1.65] text-muted">{item.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {PLATFORM.map(([name, detail]) => (
          <div key={name} className="rounded-lg border border-line bg-panel-2 px-3.5 py-3">
            <p className="text-[12.5px] font-medium text-fg">{name}</p>
            <p className="text-[10.5px] uppercase tracking-[0.1em] text-dim">{detail}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Delivery() {
  return (
    <Section id="delivery" className="pt-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <Eyebrow>Delivery</Eyebrow>
          <h2 className="text-[27px] font-semibold leading-tight tracking-[-0.035em] text-fg sm:text-[32px]">
            From commit to a URL you can open.
          </h2>
          <ol className="mt-6 space-y-5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-panel font-mono text-[11px] text-accent">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[13px] font-medium text-fg">{step.title}</p>
                  <p className="mt-1 text-[12px] leading-[1.65] text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link to="/signup" className="mt-7 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:text-accent-hover">
            Deploy your first project <ArrowRight size={13} />
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-line-strong bg-panel">
          <div className="flex items-center justify-between border-b border-line bg-panel-2 px-3 py-2">
            <span className="font-mono text-[10.5px] text-dim">deployment / dpl_7c1f8a2</span>
            <span className="rounded border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">ready</span>
          </div>
          <img src="/product/deployments.png" alt="Deployment history with build status, duration and commit" className="block w-full" loading="lazy" />
        </div>
      </div>
    </Section>
  );
}

function Operations() {
  return (
    <Section id="operations" className="pt-20">
      <Eyebrow>Operations</Eyebrow>
      <div className="grid gap-2.5 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-[12.5px] font-medium text-fg">Query anything, safely</p>
            <span className="font-mono text-[10.5px] text-dim">atlas-web / postgres</span>
          </div>
          <img src="/product/database.png" alt="SQL editor with table browser and live results" className="block w-full" loading="lazy" />
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="rounded-lg border border-line bg-panel p-4">
            <Server size={15} className="text-info" />
            <h3 className="mt-2.5 text-[13px] font-medium text-fg">Bring your own compute</h3>
            <p className="mt-1.5 text-[12px] leading-[1.65] text-muted">
              Register a node over the Docker socket. Redfox reports reachability honestly: a host that cannot be dialled is shown as unreachable, never as healthy.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-panel p-4">
            <Globe size={15} className="text-warn" />
            <h3 className="mt-2.5 text-[13px] font-medium text-fg">Domains with verification</h3>
            <p className="mt-1.5 text-[12px] leading-[1.65] text-muted">
              Add a hostname, get the exact DNS records, then verify. Redfox resolves the record live and tells you what it found.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-panel p-4">
            <Boxes size={15} className="text-accent" />
            <h3 className="mt-2.5 text-[13px] font-medium text-fg">Containers, audited</h3>
            <p className="mt-1.5 text-[12px] leading-[1.65] text-muted">
              Start, stop and restart workloads against a real engine, with every action written to the workspace audit log.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Security() {
  return (
    <Section id="security" className="pt-20">
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Eyebrow>Security</Eyebrow>
            <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.03em] text-fg">
              Isolation and audit are defaults, not add-ons.
            </h2>
            <p className="mt-3 max-w-[420px] text-[12.5px] leading-6 text-muted">
              Every project owns its database file, build workspace and storage namespace. Sessions are server-side and revocable,
              passwords are hashed with scrypt, and secrets are encrypted before they touch disk.
            </p>
          </div>
          <ul className="grid gap-2.5 self-center sm:grid-cols-2">
            {[
              ['scrypt password hashing', ShieldCheck],
              ['AES-256-GCM secrets', KeyRound],
              ['Four roles, enforced server-side', ShieldCheck],
              ['Revocable sessions', ShieldCheck],
              ['Per-project SQL isolation', Database],
              ['Append-only audit trail', Terminal],
            ].map(([label, Icon]) => (
              <li key={label} className="flex items-start gap-2 text-[12px] leading-5 text-muted">
                <Icon size={13} className="mt-0.5 shrink-0 text-success" />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-panel-2 px-6 py-3.5 sm:px-8">
          <p className="font-mono text-[11px] text-dim">docker compose up --build</p>
          <p className="text-[11px] text-dim">One container, one volume, no external dependencies to start.</p>
        </div>
      </div>
    </Section>
  );
}

function Cta() {
  return (
    <Section className="pt-20">
      <div className="relative overflow-hidden rounded-xl border border-accent/25 bg-[linear-gradient(150deg,rgba(228,89,59,0.14),rgba(228,89,59,0.02)_55%)] px-6 py-10 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="max-w-[440px] text-[26px] font-semibold leading-[1.15] tracking-[-0.035em] text-fg sm:text-[30px]">
              Give your team one place to ship from.
            </h2>
            <p className="mt-2.5 max-w-[420px] text-[13px] leading-6 text-muted">
              Create a workspace, invite your team, and put the first project live today.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link to="/signup" className="focus-ring inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-[13px] font-medium text-[#180b07] hover:bg-accent-hover">
              Create account <ArrowRight size={14} />
            </Link>
            <Link to="/login" className="focus-ring inline-flex items-center gap-2 rounded-md border border-line-strong px-4 py-2.5 text-[13px] text-fg hover:border-accent/60">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark size={22} />
          <div>
            <p className="text-[12px] font-medium text-fg">Redfox</p>
            <p className="text-[10.5px] text-dim">Developer cloud, self-hosted · v0.9.0</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-5 text-[11.5px] text-dim">
          <a href="#platform" className="flex min-h-[32px] items-center hover:text-fg">Platform</a>
          <a href="#delivery" className="flex min-h-[32px] items-center hover:text-fg">Delivery</a>
          <a href="#security" className="flex min-h-[32px] items-center hover:text-fg">Security</a>
          <Link to="/login" className="flex min-h-[32px] items-center hover:text-fg">Sign in</Link>
          <Link to="/signup" className="flex min-h-[32px] items-center hover:text-fg">Create account</Link>
        </nav>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-base text-fg">
      <Header />
      <main className="pb-4">
        <Hero />
        <Platform />
        <Delivery />
        <Operations />
        <Security />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}

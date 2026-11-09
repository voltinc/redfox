import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Boxes, Database, GitBranch, Globe, HardDrive, KeyRound, Menu as MenuIcon,
  Rocket, Server, ShieldCheck, Sparkles, Terminal, X,
} from 'lucide-react';
import { Logo, LogoMark } from '../components/Brand.jsx';
import { cx } from '../lib/format.js';

// Product images served from web/public/product/
const PRODUCT_IMAGES = {
  overview: '/product/overview.png',
  deployments: '/product/deployments.png',
  database: '/product/database.png',
  solene: '/product/solene.png',
};

const NAV = [
  { label: 'Platform', href: '#platform' },
  { label: 'Delivery', href: '#delivery' },
  { label: 'Operations', href: '#operations' },
  { label: 'Security', href: '#security' },
];

const CAPABILITIES = [
  { icon: Rocket, title: 'Deployments that build', body: 'Install, build and publish run in an isolated workspace. The log streams as it happens and the artifact gets an immutable URL you can roll back to.' },
  { icon: GitBranch, title: 'Git in the same place', body: 'Repositories, branches and commits live in Redfox itself. Commit from the browser or push from CI through a signed webhook.' },
  { icon: Database, title: 'A database per project', body: 'Isolated SQL databases with a table browser, schema explorer and an editor that runs real statements and reports real timings.' },
  { icon: HardDrive, title: 'Object storage', body: 'Public and private buckets, checksums, signed download URLs and per-object access control, on the filesystem or any S3 target.' },
  { icon: KeyRound, title: 'Configuration, sealed', body: 'Environment variables encrypted with AES-256-GCM, scoped per environment, masked in the UI and revealed only by an audited request.' },
  { icon: Sparkles, title: 'An engineer that reads logs', body: 'Solene inspects deployments, schema and configuration to explain failures. Connect a model provider or use the built-in engine.' },
];

const STEPS = [
  { title: 'Create a project', body: 'Name it, pick a framework. A repository, database and deployment target are provisioned together.' },
  { title: 'Commit your code', body: 'Push to the repository or edit files in the console. Every commit is a revision on its branch.' },
  { title: 'Ship and verify', body: 'Watch the build stream, open the preview URL, then promote the same artifact to production.' },
];

const STRIP = ['Projects', 'Deployments', 'Repositories', 'Databases', 'Storage', 'Domains', 'Containers', 'Servers'];

function ProductImage({ name, alt, className = '', loading }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`flex aspect-video w-full items-center justify-center bg-panel-2 text-[12px] text-dim ${className}`}>
        Image unavailable: {name}.png
      </div>
    );
  }

  return (
    <img
      src={PRODUCT_IMAGES[name]}
      alt={alt}
      className={className || 'block w-full'}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}

function Eyebrow({ children }) {
  return <p className="eyebrow mb-3">{children}</p>;
}

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-base/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex min-h-[40px] items-center rounded" aria-label="Redfox home">
          <Logo size={27} />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="text-[13px] text-muted transition-colors hover:text-fg">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link to="/login" className="flex min-h-[40px] items-center px-3 text-[13px] text-muted transition-colors hover:text-fg">
            Sign in
          </Link>
          <Link to="/signup" className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--ink)] px-4 py-2 text-[13px] font-medium text-[color:var(--bg)] transition-colors hover:bg-accent">
            Start building
            <ArrowRight size={14} />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="icon-btn md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={16} /> : <MenuIcon size={16} />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-line bg-panel px-5 py-2 md:hidden">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex min-h-[44px] items-center text-[14px] text-muted">
              {item.label}
            </a>
          ))}
          <div className="flex gap-2 border-t border-line py-3">
            <Link to="/login" className="flex-1 rounded-full border border-line-strong px-3 py-2.5 text-center text-[13px]">
              Sign in
            </Link>
            <Link to="/signup" className="flex-1 rounded-full bg-[color:var(--ink)] px-3 py-2.5 text-center text-[13px] font-medium text-[color:var(--bg)]">
              Start building
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] hatch lg:block" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-[1180px] px-5 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-[11.5px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              v0.9 · self-hosted, no lock-in
            </span>

            <h1 className="display mt-6 text-[46px] text-fg sm:text-[68px]">
              Your whole stack,
              <br />
              <span className="serif-accent text-accentInk">one console.</span>
            </h1>

            <p className="mt-6 max-w-[480px] text-[15px] leading-7 text-muted">
              Redfox is the developer cloud you run yourself: repositories, builds, databases, storage, domains
              and servers in a single interface. Deploy a real artifact in under a minute.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/signup" className="inline-flex items-center gap-2 rounded-full bg-[color:var(--ink)] px-5 py-3 text-[14px] font-medium text-[color:var(--bg)] transition-colors hover:bg-accent">
                Create your workspace <ArrowRight size={15} />
              </Link>
              <Link to="/login" className="inline-flex items-center gap-2 rounded-full border border-line-strong px-5 py-3 text-[14px] text-fg transition-colors hover:border-accent hover:text-accentInk">
                Sign in
              </Link>
            </div>

            <p className="mt-5 text-[12px] text-dim">
              No card · Runs on one node · MIT licensed
            </p>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-xl border border-line-strong bg-panel raised-shadow">
              <div className="flex items-center gap-1.5 border-b border-line bg-panel-2 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-line-strong" />
                <span className="h-2 w-2 rounded-full bg-line-strong" />
                <span className="h-2 w-2 rounded-full bg-accent/60" />
                <span className="ml-2 truncate font-mono text-[10.5px] text-dim">
                  console.redfox.app / atlas-web
                </span>
              </div>

              <ProductImage
                name="overview"
                alt="The Redfox console showing projects, deployments and infrastructure"
              />
            </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-y-6 border-t border-line pt-6 sm:grid-cols-4">
          {[
            ['17', 'deployments this week'],
            ['99.4%', 'build success'],
            ['48s', 'median build'],
            ['9', 'surfaces, one login'],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="display text-[30px] text-accentInk">{value}</p>
              <p className="mt-1 text-[11.5px] text-muted">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Platform() {
  return (
    <section id="platform" className="mx-auto w-full max-w-[1180px] px-5 py-16 sm:px-8 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-[560px]">
          <Eyebrow>The platform</Eyebrow>
          <h2 className="display text-[32px] text-fg sm:text-[42px]">
            Nine surfaces that usually need <span className="serif-accent">nine vendors.</span>
          </h2>
        </div>

        <p className="max-w-[320px] text-[13px] leading-6 text-muted">
          Each is implemented here, against one data model and one audit trail. None of it is a screenshot of a
          product you still have to buy.
        </p>
      </div>

      <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map((item, index) => (
          <article key={item.title} className="group bg-panel p-6 transition-colors hover:bg-[#fffaf1]">
            <div className="flex items-center justify-between">
              <item.icon size={17} className="text-accentInk" />
              <span className="font-mono text-[10.5px] text-dim">{String(index + 1).padStart(2, '0')}</span>
            </div>
            <h3 className="mt-4 text-[14.5px] font-semibold tracking-[-0.01em] text-fg">{item.title}</h3>
            <p className="mt-2 text-[12.5px] leading-6 text-muted">{item.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {STRIP.map((item) => (
          <span key={item} className="rounded-full border border-line bg-panel px-3 py-1 text-[11.5px] text-muted">
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function Delivery() {
  return (
    <section id="delivery" className="border-y border-line bg-panel">
      <div className="mx-auto grid w-full max-w-[1180px] gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
        <div>
          <Eyebrow>Delivery</Eyebrow>
          <h2 className="display text-[32px] text-fg sm:text-[40px]">
            From commit to a URL you can open.
          </h2>

          <ol className="mt-8 space-y-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="display mt-0.5 w-7 shrink-0 text-[22px] text-accentInk">{index + 1}</span>
                <div>
                  <p className="text-[14px] font-medium text-fg">{step.title}</p>
                  <p className="mt-1 max-w-[42ch] text-[12.5px] leading-6 text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <Link to="/signup" className="mt-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-accentInk hover:text-accent">
            Deploy your first project <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-line-strong bg-panel raised-shadow">
          <div className="flex items-center justify-between border-b border-line bg-panel-2 px-4 py-2.5">
            <span className="font-mono text-[11px] text-dim">deployment / dpl_7c1f8a2</span>
            <span className="rounded-full border border-success/30 bg-success/[0.08] px-2 py-0.5 text-[10.5px] font-medium text-success">
              ready
            </span>
          </div>

          <ProductImage
            name="deployments"
            alt="Deployment history with build status, duration and commit"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}

function Operations() {
  return (
    <section id="operations" className="mx-auto w-full max-w-[1180px] px-5 py-16 sm:px-8 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Operations</Eyebrow>
          <h2 className="display max-w-[520px] text-[32px] text-fg sm:text-[40px]">
            Query it, address it, run it.
          </h2>
        </div>
      </div>

      <div className="mt-9 grid gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-line bg-panel lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <p className="text-[13px] font-medium text-fg">Query anything, safely</p>
            <span className="font-mono text-[10.5px] text-dim">atlas-web / production</span>
          </div>

          <ProductImage
            name="database"
            alt="SQL editor with a table browser and live results"
            loading="lazy"
          />
        </div>

        <div className="grid gap-4">
          {[
            { icon: Server, title: 'Bring your own compute', body: 'Register a node over the Docker socket. A host that cannot be dialled is shown as unreachable, never as healthy.' },
            { icon: Globe, title: 'Domains with verification', body: 'Add a hostname, get the exact DNS records, then verify. Redfox resolves the record live and reports what it found.' },
            { icon: Boxes, title: 'Containers, audited', body: 'Start, stop and restart workloads against a real engine, with every action written to the audit log.' },
          ].map((item) => (
            <article key={item.title} className="rounded-xl border border-line bg-panel p-5">
              <item.icon size={16} className="text-accentInk" />
              <h3 className="mt-3 text-[13.5px] font-medium text-fg">{item.title}</h3>
              <p className="mt-1.5 text-[12px] leading-6 text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Security() {
  return (
    <section id="security" className="mx-auto w-full max-w-[1180px] px-5 pb-16 sm:px-8 sm:pb-20">
      <div className="grid overflow-hidden rounded-xl border border-line bg-panel lg:grid-cols-2">
        <div className="relative p-7 sm:p-10">
          <Eyebrow>Security</Eyebrow>
          <h2 className="display text-[28px] text-fg sm:text-[34px]">Isolation and audit are defaults.</h2>
          <p className="mt-4 max-w-[44ch] text-[12.5px] leading-6 text-muted">
            Every project owns its database file, build workspace and storage namespace. Sessions are server-side
            and revocable, passwords are hashed with scrypt, and secrets are encrypted before they touch disk.
          </p>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-panel-2 px-3 py-1.5 font-mono text-[11px] text-muted">
            <Terminal size={12} className="text-accentInk" /> docker compose up --build
          </p>
        </div>

        <ul className="grid content-center gap-3 border-t border-line bg-[#fffaf1] p-7 sm:p-10 lg:border-l lg:border-t-0">
          {[
            'scrypt password hashing',
            'AES-256-GCM secrets at rest',
            'Four roles, enforced server-side',
            'Revocable sessions',
            'Per-project SQL isolation',
            'Append-only audit trail',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[12.5px] leading-6 text-muted">
              <ShieldCheck size={14} className="mt-1 shrink-0 text-success" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="mx-auto w-full max-w-[1180px] px-5 pb-20 sm:px-8">
      <div className="relative overflow-hidden rounded-2xl bg-[color:var(--ink)] px-6 py-12 text-[color:var(--bg)] sm:px-12">
        <div className="absolute inset-y-0 right-0 w-1/2 hatch-accent opacity-70" aria-hidden="true" />

        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div>
            <h2 className="display max-w-[460px] text-[30px] sm:text-[40px]">
              Give your team one place to ship from.
            </h2>
            <p className="mt-3 max-w-[420px] text-[13px] leading-6 text-[#cfc4b4]">
              Create a workspace, invite the team, and put the first project live today.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-[14px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[#ff8a33]">
              Create account <ArrowRight size={15} />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-[14px] text-[color:var(--bg)] hover:border-white/60">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark size={24} />
          <div>
            <p className="text-[12px] font-medium text-fg">redfox</p>
            <p className="text-[10.5px] text-dim">Developer cloud, self-hosted · v0.9.0</p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-x-6 text-[11.5px] text-dim">
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
      <main>
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
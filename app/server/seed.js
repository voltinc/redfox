/* Seed data for Redfox.

   Everything created here is real rows in the real database. Rows that describe
   infrastructure Redfox cannot reach are marked mode='demo' so the interface can
   say so plainly. Deployments you create afterwards are executed for real by the
   local build runner. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { analyzeDeployment } from './services/analysis.js';
import { db, nowIso, DATA_DIR, migrate } from './db.js';
import { hashPassword, encrypt, sha, id, apiKeyHash } from './crypto.js';

const iso = (date) => new Date(date).toISOString();
const ago = (min) => iso(Date.now() - min * 60000);
const daysAgo = (d) => ago(d * 1440);

let seed = 42;
function rnd() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => Math.round(a + rnd() * (b - a));

export const DEMO_PASSWORD = 'redfox-demo';

/* ---------------------------------------------------------------- fixtures */
const USERS = [
  { email: 'demo@redfox.dev', name: 'Alex Moreau', color: '#FF7000', role: 'owner' },
  { email: 'maya@redfox.dev', name: 'Maya Lindqvist', color: '#58A6FF', role: 'admin' },
  { email: 'tom@redfox.dev', name: 'Tom Okafor', color: '#3FB950', role: 'developer' },
  { email: 'sara@redfox.dev', name: 'Sara Bauer', color: '#D29922', role: 'viewer' },
];

const ATLAS_FILES = {
  'package.json': JSON.stringify({
    name: 'atlas-web',
    version: '1.4.2',
    private: true,
    type: 'module',
    scripts: { build: 'node build.mjs', dev: 'node build.mjs --watch' },
  }, null, 2),
  'build.mjs': `import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/\\n\\s*/g, '\\n');
fs.writeFileSync(path.join(out, 'index.html'), html);

const css = fs.readFileSync('src/styles.css', 'utf8')
  .replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')
  .replace(/\\s+/g, ' ')
  .replace(/\\s*([{}:;,])\\s*/g, '$1');
fs.writeFileSync(path.join(out, 'assets', 'styles.css'), css);

const js = fs.readFileSync('src/app.js', 'utf8');
fs.writeFileSync(path.join(out, 'assets', 'app.js'), js);

const files = fs.readdirSync(out, { recursive: true })
  .filter((f) => fs.statSync(path.join(out, f)).isFile());
const bytes = files.reduce((n, f) => n + fs.statSync(path.join(out, f)).size, 0);
console.log('built ' + files.length + ' files, ' + (bytes / 1024).toFixed(1) + ' kB');
for (const f of files) console.log('  dist/' + f);
`,
  'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Atlas — infrastructure for teams that ship</title>
    <link rel="stylesheet" href="assets/styles.css" />
  </head>
  <body>
    <header class="nav">
      <span class="mark">atlas</span>
      <nav><a href="#product">Product</a><a href="#pricing">Pricing</a><a href="#docs">Docs</a></nav>
      <a class="cta" href="#start">Start free</a>
    </header>
    <main>
      <section class="hero">
        <h1>Ship infrastructure changes without holding your breath.</h1>
        <p>Atlas gives platform teams a single control plane for deploys, databases and secrets.</p>
        <a class="cta" href="#start">Create a workspace</a>
      </section>
      <section id="product" class="grid">
        <article><h2>Deploys</h2><p>Preview every branch, promote in one click, roll back in two.</p></article>
        <article><h2>Data</h2><p>Isolated Postgres per project with row-level access policies.</p></article>
        <article><h2>Secrets</h2><p>Encrypted values scoped to development, preview and production.</p></article>
      </section>
    </main>
    <footer><p>© <span id="year">2026</span> Atlas Systems</p></footer>
    <script src="assets/app.js"></script>
  </body>
</html>
`,
  'src/styles.css': `:root { color-scheme: dark; --bg:#0b0b0c; --fg:#e8e8ea; --muted:#8b8b92; --line:#232326; --accent:#e4593b; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.6 ui-sans-serif, system-ui, -apple-system, sans-serif; }
.nav { display:flex; align-items:center; gap:24px; padding:16px 32px; border-bottom:1px solid var(--line); }
.mark { font-weight:650; letter-spacing:-0.02em; }
.nav nav { display:flex; gap:18px; margin-left:auto; }
a { color:inherit; text-decoration:none; }
nav a { color:var(--muted); font-size:14px; }
nav a:hover { color:var(--fg); }
.cta { border:1px solid var(--accent); color:var(--accent); padding:7px 14px; border-radius:6px; font-size:14px; }
.cta:hover { background:var(--accent); color:#0b0b0c; }
main { max-width:960px; margin:0 auto; padding:72px 32px; }
.hero h1 { font-size:44px; line-height:1.1; letter-spacing:-0.03em; margin:0 0 16px; max-width:20ch; }
.hero p { color:var(--muted); max-width:52ch; margin:0 0 28px; }
.grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:var(--line); border:1px solid var(--line); margin-top:72px; }
.grid article { background:var(--bg); padding:24px; }
.grid h2 { font-size:15px; margin:0 0 8px; }
.grid p { color:var(--muted); font-size:14px; margin:0; }
footer { border-top:1px solid var(--line); padding:24px 32px; color:var(--muted); font-size:13px; }
@media (max-width:720px) { .grid { grid-template-columns:1fr; } .hero h1 { font-size:32px; } }
`,
  'src/app.js': `const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

for (const link of document.querySelectorAll('a[href^="#"]')) {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
`,
  'README.md': `# atlas-web

Marketing site for Atlas. No framework, no runtime dependencies.

    npm run build   # emits ./dist

Output is plain HTML, CSS and JS served as a static deployment.
`,
  'redfox.json': JSON.stringify({ build: 'node build.mjs', output: 'dist' }, null, 2),
};

const PULSO_FILES = {
  'package.json': JSON.stringify({
    name: 'pulso-api',
    version: '2.1.0',
    type: 'module',
    scripts: { build: 'tsc -p tsconfig.json', start: 'node dist/server.js', test: 'node --test' },
    dependencies: { fastify: '^5.1.0', '@fastify/postgres': '^6.0.1', zod: '^3.23.8' },
  }, null, 2),
  'src/server.ts': `import Fastify from 'fastify';
import { registerRoutes } from './routes.js';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

await app.register(registerRoutes, { prefix: '/v1' });

await app.listen({ port: Number(process.env.PORT ?? 8080), host: '0.0.0.0' });
`,
  'src/routes.ts': `import type { FastifyInstance } from 'fastify';
import { db } from './db.js';

export async function registerRoutes(app: FastifyInstance) {
  app.get('/organizations', async () => {
    const { rows } = await db.query('select id, name, plan from organizations order by name');
    return rows;
  });

  app.get('/metrics', async (request) => {
    const { from } = request.query as { from?: string };
    const { rows } = await db.query(
      'select window_start, requests, p95_ms from metrics where window_start > $1 order by window_start desc limit 60',
      [from ?? new Date(Date.now() - 864e5).toISOString()],
    );
    return rows;
  });
}
`,
  'src/db.ts': `import pg from 'pg';

export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

db.on('error', (error) => {
  console.error('unexpected postgres error', error);
  process.exit(1);
});
`,
  'Dockerfile': `FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY package*.json ./
RUN npm ci --omit=dev
EXPOSE 8080
CMD ["node", "dist/server.js"]
`,
  'migrations/001_init.sql': `create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

create table metrics (
  window_start timestamptz primary key,
  requests integer not null default 0,
  p95_ms numeric not null default 0
);
`,
};

const CONSOLE_FILES = {
  'package.json': JSON.stringify({
    name: 'console-app',
    version: '0.7.3',
    private: true,
    scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
    dependencies: { next: '15.0.3', react: '19.0.0', 'react-dom': '19.0.0', '@tanstack/react-query': '^5.59.0' },
  }, null, 2),
  'next.config.ts': `import type { NextConfig } from 'next';

const config: NextConfig = {
  experimental: { typedRoutes: true },
  images: { remotePatterns: [{ hostname: 'assets.redfox.app' }] },
};

export default config;
`,
  'app/layout.tsx': `import type { ReactNode } from 'react';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
`,
  'app/page.tsx': `import { Suspense } from 'react';
import { UsageChart } from '@/components/usage-chart';

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Console</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-neutral-900" />}>
        <UsageChart />
      </Suspense>
    </main>
  );
}
`,
  'components/usage-chart.tsx': `'use client';

import { useQuery } from '@tanstack/react-query';

export function UsageChart() {
  const { data, isPending, error } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const res = await fetch('/api/usage');
      if (!res.ok) throw new Error('usage request failed');
      return res.json();
    },
  });

  if (isPending) return <div className="h-64 animate-pulse rounded-md bg-neutral-900" />;
  if (error) return <p className="text-red-400">Could not load usage.</p>;
  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
}
`,
};

const DOCS_FILES = {
  'package.json': JSON.stringify({
    name: 'docs-site',
    type: 'module',
    scripts: { build: 'astro build', preview: 'astro preview' },
    dependencies: { astro: '^5.1.0' },
  }, null, 2),
  'astro.config.mjs': `import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://docs.redfox.app',
  build: { format: 'directory' },
});
`,
  'src/pages/index.astro': `---
import Layout from '../layouts/Layout.astro';
const { version } = Astro.props;
---
<Layout title="Redfox docs">
  <h1>Documentation</h1>
  <p>Everything you need to deploy, query and observe your projects.</p>
</Layout>
`,
  'src/content/deployments.mdx': `# Deployments

A deployment is created from a git push or a manual trigger.

| Phase | What happens |
| --- | --- |
| Queue | Redfox assigns a runner and resolves the commit |
| Build | Dependencies install, then the build command runs |
| Publish | Artifacts are promoted and routing is updated |
`,
};

const SHARED_FILES = {
  'package.json': JSON.stringify({ name: '@redfox/shared-config', version: '1.2.0', main: 'index.js' }, null, 2),
  'index.js': `export const brand = {
  name: 'Redfox',
  accent: '#FF7000',
  surfaces: { base: '#0A0A0B', raised: '#101012', border: '#242428' },
};
`,
  'README.md': 'Shared design tokens and lint configuration consumed by every Redfox project.\n',
};

const REPOS = [
  { name: 'atlas-web', slug: 'atlas-web', desc: 'Marketing site for Atlas. Static output, no runtime dependencies.', files: ATLAS_FILES, langs: ['JavaScript', 'HTML', 'CSS'] },
  { name: 'pulso-api', slug: 'pulso-api', desc: 'Fastify service backing the Pulso analytics product.', files: PULSO_FILES, langs: ['TypeScript', 'SQL'] },
  { name: 'console-app', slug: 'console-app', desc: 'Next.js console for internal teams.', files: CONSOLE_FILES, langs: ['TypeScript', 'CSS'] },
  { name: 'docs-site', slug: 'docs-site', desc: 'Documentation site built with Astro.', files: DOCS_FILES, langs: ['Astro', 'MDX'] },
  { name: 'shared-config', slug: 'shared-config', desc: 'Design tokens and shared lint configuration.', files: SHARED_FILES, langs: ['JavaScript'] },
];

const COMMIT_MESSAGES = {
  'atlas-web': [
    'feat(hero): tighten headline and add pricing anchor',
    'fix(css): correct grid gap on mobile breakpoints',
    'perf: inline critical css for the hero section',
    'chore: drop unused font preload',
    'feat: add footer copyright year',
  ],
  'pulso-api': [
    'feat(metrics): expose p95 latency window endpoint',
    'fix(db): close idle connections before shutdown',
    'refactor: extract route registration',
    'test: cover organization listing',
    'chore(deps): bump fastify to 5.1.0',
  ],
  'console-app': [
    'feat(usage): move chart to react-query',
    'fix(build): pin react to 19.0.0 to satisfy peer range',
    'chore: enable typed routes',
    'refactor(layout): drop global providers wrapper',
  ],
  'docs-site': [
    'docs: document deployment phases',
    'fix(nav): correct sidebar ordering',
    'chore: bump astro',
  ],
  'shared-config': [
    'feat(tokens): add border and surface colors',
    'chore: publish 1.2.0',
  ],
};

/* ------------------------------------------------------------- db creation */
export function seedProjectDatabase(projectId, tables) {
  const file = path.join(DATA_DIR, 'dbs', `${projectId}.sqlite`);
  fs.rmSync(file, { force: true });
  const conn = new (db.constructor)(file);
  conn.pragma('journal_mode = WAL');
  for (const table of tables) {
    conn.exec(table.ddl);
    if (table.rows?.length) {
      const cols = Object.keys(table.rows[0]);
      const stmt = conn.prepare(
        `INSERT INTO ${table.name} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
      );
      const insertMany = conn.transaction((rows) => {
        for (const row of rows) stmt.run(cols.map((c) => row[c]));
      });
      insertMany(table.rows);
    }
  }
  conn.pragma('wal_checkpoint(TRUNCATE)');
  conn.close();
  return fs.statSync(file).size;
}

function orgNames() {
  return ['Northwind', 'Lumen Labs', 'Kestrel', 'Basalt', 'Orbital', 'Fathom', 'Cobalt', 'Juniper'];
}

const DATA_MODELS = {
  'pulso-api': [
    {
      name: 'organizations',
      ddl: `create table organizations (id integer primary key, name text not null, plan text not null, seats integer not null default 1, created_at text not null);`,
      rows: orgNames().map((n, i) => ({ id: i + 1, name: n, plan: ['free', 'team', 'business', 'scale'][i % 4], seats: 3 + i * 4, created_at: daysAgo(120 - i * 9).slice(0, 10) })),
    },
    {
      name: 'users',
      ddl: `create table users (id integer primary key, email text not null unique, full_name text, organization_id integer references organizations(id), role text not null default 'member', last_seen_at text);`,
      rows: [
        ['ada@northwind.co', 'Ada Nordin'], ['leo@lumenlabs.io', 'Leo Marchetti'], ['ravi@kestrel.dev', 'Ravi Chandar'],
        ['ingrid@basalt.no', 'Ingrid Haugen'], ['amir@orbital.systems', 'Amir Haddad'], ['nina@fathom.io', 'Nina Petrova'],
        ['carl@cobalt.se', 'Carl Ekström'], ['mei@juniper.app', 'Mei Tanaka'], ['jonas@northwind.co', 'Jonas Weber'],
        ['sana@kestrel.dev', 'Sana Iqbal'],
      ].map(([email, name], i) => ({
        id: i + 1, email, full_name: name, organization_id: (i % 8) + 1,
        role: i === 0 ? 'owner' : i % 4 === 0 ? 'admin' : 'member', last_seen_at: ago(between(5, 5000)),
      })),
    },
    {
      name: 'subscriptions',
      ddl: `create table subscriptions (id integer primary key, organization_id integer not null references organizations(id), status text not null, amount_cents integer not null, currency text not null default 'EUR', renews_at text);`,
      rows: Array.from({ length: 16 }, (_, i) => ({
        id: i + 1, organization_id: (i % 8) + 1,
        status: ['active', 'active', 'active', 'past_due', 'trialing'][i % 5],
        amount_cents: [0, 4900, 19900, 79900][i % 4], currency: 'EUR',
        renews_at: iso(Date.now() + between(1, 30) * 864e5).slice(0, 10),
      })),
    },
    {
      name: 'api_events',
      ddl: `create table api_events (id integer primary key, organization_id integer, route text not null, status_code integer not null, duration_ms integer not null, occurred_at text not null);`,
      rows: Array.from({ length: 40 }, (_, i) => ({
        id: i + 1, organization_id: (i % 8) + 1,
        route: pick(['/v1/organizations', '/v1/metrics', '/v1/events', '/v1/subscriptions']),
        status_code: pick([200, 200, 200, 201, 404, 500]),
        duration_ms: between(8, 420), occurred_at: ago(between(1, 900)),
      })),
    },
  ],
  'atlas-web': [
    {
      name: 'leads',
      ddl: `create table leads (id integer primary key, email text not null, company text, source text, created_at text not null);`,
      rows: Array.from({ length: 24 }, (_, i) => ({
        id: i + 1, email: `founder${i + 1}@${pick(['northwind.co', 'lumenlabs.io', 'kestrel.dev', 'basalt.no'])}`,
        company: pick(orgNames()), source: pick(['hero-cta', 'pricing', 'docs', 'referral']),
        created_at: ago(between(10, 30000)),
      })),
    },
    {
      name: 'newsletter_subscribers',
      ddl: `create table newsletter_subscribers (id integer primary key, email text not null unique, confirmed integer not null default 0, subscribed_at text not null);`,
      rows: Array.from({ length: 18 }, (_, i) => ({
        id: i + 1, email: `reader${i + 1}@example.com`, confirmed: i % 5 === 0 ? 0 : 1, subscribed_at: daysAgo(between(1, 90)),
      })),
    },
    {
      name: 'page_views',
      ddl: `create table page_views (id integer primary key, path text not null, referrer text, country text, viewed_at text not null);`,
      rows: Array.from({ length: 30 }, (_, i) => ({
        id: i + 1, path: pick(['/', '/#pricing', '/#docs', '/changelog']),
        referrer: pick(['https://news.ycombinator.com', 'https://google.com', '', 'https://x.com']),
        country: pick(['GB', 'DE', 'US', 'SE', 'NL']), viewed_at: ago(between(2, 20000)),
      })),
    },
  ],
  'console-app': [
    {
      name: 'accounts',
      ddl: `create table accounts (id integer primary key, name text not null, plan text not null, mrr integer not null default 0, created_at text not null);`,
      rows: orgNames().map((n, i) => ({ id: i + 1, name: n, plan: pick(['team', 'business', 'scale']), mrr: between(49, 2400), created_at: daysAgo(between(30, 400)) })),
    },
    {
      name: 'feature_flags',
      ddl: `create table feature_flags (id integer primary key, key text not null unique, enabled integer not null default 0, rollout integer not null default 0, updated_at text not null);`,
      rows: [
        ['usage-dashboard', 1, 100], ['new-onboarding', 1, 35], ['edge-runtime', 0, 0],
        ['audit-export', 0, 5], ['team-invites', 1, 100],
      ].map(([key, enabled, rollout], i) => ({ id: i + 1, key, enabled, rollout, updated_at: ago(between(60, 20000)) })),
    },
    {
      name: 'sessions',
      ddl: `create table sessions (id integer primary key, account_id integer, ip text, user_agent text, started_at text not null);`,
      rows: Array.from({ length: 20 }, (_, i) => ({
        id: i + 1, account_id: (i % 8) + 1, ip: `10.${between(0, 40)}.${between(0, 255)}.${between(1, 250)}`,
        user_agent: pick(['Chrome/131', 'Safari/18.1', 'Firefox/133', 'Edge/131']), started_at: ago(between(1, 4000)),
      })),
    },
  ],
  'docs-site': [
    {
      name: 'doc_pages',
      ddl: `create table doc_pages (id integer primary key, slug text not null unique, title text not null, views integer not null default 0, updated_at text not null);`,
      rows: [
        ['getting-started', 'Getting started'], ['deployments', 'Deployments'], ['databases', 'Databases'],
        ['storage', 'Storage'], ['environment-variables', 'Environment variables'], ['servers', 'Servers and containers'],
        ['cli', 'Redfox CLI'], ['webhooks', 'Webhooks'],
      ].map(([slug, title], i) => ({ id: i + 1, slug, title, views: between(120, 9400), updated_at: ago(between(100, 40000)) })),
    },
    {
      name: 'page_feedback',
      ddl: `create table page_feedback (id integer primary key, slug text not null, helpful integer not null, comment text, created_at text not null);`,
      rows: Array.from({ length: 14 }, (_, i) => ({
        id: i + 1, slug: pick(['deployments', 'databases', 'cli', 'webhooks']), helpful: i % 4 === 0 ? 0 : 1,
        comment: i % 3 === 0 ? 'Rollback section needs an example.' : null, created_at: ago(between(200, 20000)),
      })),
    },
  ],
};

/* ------------------------------------------------------------------- main */
export function isSeeded() {
  const row = db.prepare('SELECT count(*) AS n FROM workspaces').get();
  return row.n > 0;
}

export function wipe() {
  const tables = ['messages', 'conversations', 'notifications', 'api_keys', 'logs', 'events', 'metrics', 'containers',
    'servers', 'objects', 'buckets', 'databases', 'env_vars', 'domains', 'deployment_logs', 'deployments',
    'commit_files', 'commits', 'repo_files', 'branches', 'repositories', 'project_environments', 'projects',
    'memberships', 'sessions', 'workspaces', 'users'];
  for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
}

export function seedAll({ force = false } = {}) {
  migrate();
  if (force) wipe();
  if (isSeeded()) return { seeded: false };

  /* users + workspace */
  const workspaceId = id('ws');
  db.prepare('INSERT INTO workspaces (id, slug, name, plan, region, created_at) VALUES (?,?,?,?,?,?)')
    .run(workspaceId, 'redfox-labs', 'Redfox Labs', 'team', 'eu-west-1', daysAgo(210));

  const passwordHash = hashPassword(DEMO_PASSWORD);
  const userIds = [];
  for (const u of USERS) {
    const uid = id('usr');
    userIds.push(uid);
    db.prepare('INSERT INTO users (id, email, name, password_hash, avatar_color, created_at) VALUES (?,?,?,?,?,?)')
      .run(uid, u.email, u.name, passwordHash, u.color, daysAgo(200));
    db.prepare('INSERT INTO memberships (id, workspace_id, user_id, role, created_at) VALUES (?,?,?,?,?)')
      .run(id('mem'), workspaceId, uid, u.role, daysAgo(200));
  }

  /* projects */
  const projectSpecs = [
    {
      name: 'Atlas Web', slug: 'atlas-web', framework: 'static', runner: 'local',
      description: 'Marketing site for Atlas. Static output, real build runner.',
      install: 'none', build: 'node build.mjs', output: 'dist', branch: 'main', status: 'active',
    },
    {
      name: 'Pulso API', slug: 'pulso-api', framework: 'node', runner: 'demo',
      description: 'Fastify service backing the Pulso analytics product.',
      install: 'npm ci', build: 'npm run build', output: 'dist', branch: 'main', status: 'active',
    },
    {
      name: 'Console App', slug: 'console-app', framework: 'nextjs', runner: 'demo',
      description: 'Next.js console for internal teams.',
      install: 'npm ci', build: 'next build', output: '.next', branch: 'main', status: 'active',
    },
    {
      name: 'Docs Site', slug: 'docs-site', framework: 'astro', runner: 'demo',
      description: 'Documentation for Redfox itself. Astro, fully static.',
      install: 'npm ci', build: 'astro build', output: 'dist', branch: 'main', status: 'paused',
    },
  ];

  const projectIds = {};
  const repoIds = {};
  for (const p of projectSpecs) {
    const pid = id('prj');
    projectIds[p.slug] = pid;
    db.prepare(`INSERT INTO projects (id, workspace_id, name, slug, description, framework, runtime, install_command,
      build_command, output_dir, root_dir, production_branch, status, runner, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      pid, workspaceId, p.name, p.slug, p.description, p.framework, 'node20', p.install, p.build, p.output, '.',
      p.branch, p.status, p.runner, daysAgo(180), ago(120),
    );
    db.prepare('INSERT INTO project_environments (id, project_id, name, branch, url, status, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id('env'), pid, 'production', p.branch, `https://${p.slug}.redfox.app`, 'ready', daysAgo(180));
    db.prepare('INSERT INTO project_environments (id, project_id, name, branch, url, status, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id('env'), pid, 'preview', 'staging', `https://staging-${p.slug}.redfox.app`, 'ready', daysAgo(160));
  }

  /* repositories, branches, files, commits */
  for (const repo of REPOS) {
    const rid = id('repo');
    repoIds[repo.slug] = rid;
    const pid = projectIds[repo.slug] || null;
    db.prepare(`INSERT INTO repositories (id, workspace_id, project_id, name, slug, description, visibility,
      default_branch, integration, remote_url, webhook_secret, webhook_url, webhook_events, webhook_active, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      rid, workspaceId, pid, repo.name, repo.slug, repo.desc, 'private', 'main', 'native',
      `http://localhost:3000/git/${repo.slug}.git`, sha('whsec'), `http://localhost:3000/api/webhooks/git/${rid}`,
      '["push","pull_request"]', 1, daysAgo(190),
    );

    const branches = ['main'];
    if (repo.slug === 'atlas-web') branches.push('staging', 'feat/pricing-table');
    if (repo.slug === 'pulso-api') branches.push('feat/metrics-window');
    if (repo.slug === 'console-app') branches.push('fix/react-peer-range');
    for (const b of branches) {
      db.prepare('INSERT INTO branches (id, repository_id, name, head_sha, is_default, protected, updated_at) VALUES (?,?,?,?,?,?,?)')
        .run(id('brn'), rid, b, null, b === 'main' ? 1 : 0, b === 'main' ? 1 : 0, b === 'main' ? ago(90) : ago(between(200, 5000)));
    }

    for (const [filePath, content] of Object.entries(repo.files)) {
      db.prepare('INSERT INTO repo_files (id, repository_id, branch, path, kind, content, size, updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(id('fil'), rid, 'main', filePath, 'file', content, Buffer.byteLength(content), ago(between(100, 9000)));
    }
    // folders implied by file paths
    const dirs = new Set();
    for (const filePath of Object.keys(repo.files)) {
      const parts = filePath.split('/');
      for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
    }
    for (const dir of dirs) {
      db.prepare('INSERT OR IGNORE INTO repo_files (id, repository_id, branch, path, kind, content, size, updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(id('fil'), rid, 'main', dir, 'dir', null, 0, ago(between(100, 9000)));
    }

    const messages = COMMIT_MESSAGES[repo.slug] || ['initial commit'];
    const authors = [USERS[0], USERS[1], USERS[2]];
    let parent = null;
    const commitShas = [];
    messages.forEach((message, index) => {
      const cid = id('cmt');
      const commitSha = sha();
      commitShas.push(commitSha);
      const author = authors[index % (authors.length)];
      db.prepare(`INSERT INTO commits (id, repository_id, sha, branch, message, author_name, author_email,
        parent_sha, additions, deletions, files_changed, committed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        cid, rid, commitSha, 'main', message, author.name, author.email, parent,
        between(4, 90), between(0, 40), between(1, 4), ago(140 + (messages.length - index) * 720 + between(0, 120)),
      );
      parent = commitSha;
      if (index >= messages.length - 2) {
        const fileList = Object.keys(repo.files).slice(0, 3);
        for (const f of fileList) {
          db.prepare('INSERT INTO commit_files (id, commit_id, path, status, additions, deletions, patch) VALUES (?,?,?,?,?,?,?)')
            .run(id('cf'), cid, f, index === messages.length - 1 ? 'modified' : 'added', between(1, 26), between(0, 12),
              `@@ -1,4 +1,6 @@\n ${fileList.length > 1 ? 'context line' : 'context'}\n-  old value\n+  new value\n+  added line`);
        }
      }
    });
    db.prepare('UPDATE branches SET head_sha = ? WHERE repository_id = ? AND name = ?').run(commitShas.at(-1), rid, 'main');
    for (const b of branches.filter((x) => x !== 'main')) {
      db.prepare('UPDATE branches SET head_sha = ? WHERE repository_id = ? AND name = ?').run(commitShas.at(-2) || commitShas.at(-1), rid, b);
    }
  }

  /* databases */
  for (const [slug, pid] of Object.entries(projectIds)) {
    const models = DATA_MODELS[slug] || [];
    const size = seedProjectDatabase(pid, models);
    db.prepare(`INSERT INTO databases (id, project_id, engine, engine_version, region, status, file_path, size_bytes, created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(
      id('db'), pid, 'postgres', '16.3', 'eu-west-1', 'healthy', `data/dbs/${pid}.sqlite`, size, daysAgo(175),
    );
  }

  /* storage */
  const bucketSpecs = [
    { project: 'atlas-web', name: 'public-assets', visibility: 'public', files: { 'logo.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="24"><text x="0" y="18" font-family="monospace" font-size="18" fill="#FF7000">atlas</text></svg>', 'robots.txt': 'User-agent: *\nAllow: /\n' } },
    { project: 'atlas-web', name: 'uploads', visibility: 'private', files: { 'press-kit/one-pager.txt': 'Atlas press kit. Contact press@atlas.example.\n' } },
    { project: 'pulso-api', name: 'avatars', visibility: 'public', files: { 'northwind.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="#242428"/></svg>' } },
    { project: 'pulso-api', name: 'exports', visibility: 'private', files: { '2026-10/metrics.csv': 'window_start,requests,p95_ms\n2026-10-01T00:00:00Z,4120,184\n' } },
    { project: 'console-app', name: 'screenshots', visibility: 'private', files: { 'settings-page.txt': 'screenshot placeholder\n' } },
  ];
  for (const bucket of bucketSpecs) {
    const pid = projectIds[bucket.project];
    const bucketId = id('bkt');
    db.prepare('INSERT INTO buckets (id, project_id, name, visibility, created_at) VALUES (?,?,?,?,?)')
      .run(bucketId, pid, bucket.name, bucket.visibility, daysAgo(between(30, 150)));
    for (const [filePath, content] of Object.entries(bucket.files)) {
      const target = path.join(DATA_DIR, 'storage', bucketId, filePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
      db.prepare('INSERT INTO objects (id, bucket_id, path, size, mime, checksum, created_at) VALUES (?,?,?,?,?,?,?)')
        .run(id('obj'), bucketId, filePath, Buffer.byteLength(content),
          filePath.endsWith('.svg') ? 'image/svg+xml' : filePath.endsWith('.csv') ? 'text/csv' : 'text/plain',
          sha().slice(0, 32), ago(between(30, 9000)));
    }
  }

  /* environment variables */
  const envSpecs = {
    'atlas-web': [
      ['PUBLIC_SITE_URL', 'https://atlas.redfox.app', 'all', 0],
      ['ANALYTICS_ID', 'atlas_pk_7f31c9', 'production', 0],
      ['RESEND_API_KEY', 're_live_9f2ba7c41d8e4b6f9a0c', 'production', 1],
      ['STRIPE_SECRET_KEY', 'sk_live_51NxQ4bK2pQ8sT3vW', 'production', 1],
    ],
    'pulso-api': [
      ['DATABASE_URL', 'postgres://pulso_app:9Kx2pQ!w@db.internal:5432/pulso', 'all', 1],
      ['JWT_SECRET', 'jwt_9c1f8a2e7b3d5f6a8c0e2b4d6f8a1c3e', 'all', 1],
      ['SENTRY_DSN', 'https://a1b2c3@o4506.ingest.sentry.io/4506', 'production', 1],
      ['RATE_LIMIT_RPS', '120', 'production', 0],
      ['LOG_LEVEL', 'info', 'development', 0],
    ],
    'console-app': [
      ['NEXT_PUBLIC_API_URL', 'https://api.pulso.dev', 'all', 0],
      ['AUTH_SECRET', 'nxt_4d8e2f1a9b7c5d3e6f0a2b4c8d1e7f9', 'all', 1],
      ['NEXT_PUBLIC_POSTHOG_KEY', 'phc_2Kd8sLp0Qw', 'preview', 0],
    ],
    'docs-site': [
      ['PUBLIC_REDFOX_VERSION', '0.9.0', 'all', 0],
      ['ALGOLIA_WRITE_KEY', 'alg_w_7c1f9a2e', 'production', 1],
    ],
  };
  for (const [slug, vars] of Object.entries(envSpecs)) {
    for (const [key, value, target, secret] of vars) {
      db.prepare(`INSERT INTO env_vars (id, project_id, key, value_enc, target, is_secret, updated_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(
        id('envv'), projectIds[slug], key, encrypt(value), target, secret,
        USERS[1].name, daysAgo(between(10, 120)), ago(between(60, 4000)),
      );
    }
  }

  /* domains */
  const domainSpecs = [
    ['atlas-web', 'atlas.redfox.app', 'production', 'active', 'active', null],
    ['atlas-web', 'www.atlas.redfox.app', 'redirect', 'active', 'active', null],
    ['atlas-web', 'staging.atlas.redfox.app', 'preview', 'pending', 'pending', null],
    ['pulso-api', 'api.pulso.dev', 'production', 'pending', 'pending', null],
    ['console-app', 'console.redfox.app', 'production', 'error', 'error', 'CNAME target mismatch: resolved to 34.117.59.81, expected cname.redfox.app'],
    ['docs-site', 'docs.redfox.app', 'production', 'active', 'active', null],
  ];
  for (const [slug, hostname, kind, status, ssl, error] of domainSpecs) {
    db.prepare(`INSERT INTO domains (id, project_id, hostname, kind, status, ssl, verify_token, last_check, last_error, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      id('dmn'), projectIds[slug], hostname, kind, status, ssl, `redfox-verify=${sha().slice(0, 24)}`,
      status === 'active' ? ago(between(1000, 20000)) : null, error, daysAgo(between(10, 120)),
    );
  }

  /* servers and containers */
  const localServerId = id('srv');
  db.prepare(`INSERT INTO servers (id, workspace_id, name, provider, region, host, docker_endpoint, mode, status, os,
    docker_version, cpu_cores, memory_bytes, disk_bytes, last_seen, last_error, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    localServerId, workspaceId, 'local-node', 'byoc', 'eu-west-1', os.hostname(), null, 'local', 'connected',
    `${os.type()} ${os.release()}`, null, os.cpus().length, os.totalmem(), 512 * 1024 ** 3, nowIso(), null, daysAgo(180),
  );

  const demoServerSpecs = [
    { name: 'rf-edge-eu-01', provider: 'hetzner', region: 'eu-central', ip: '116.203.44.18', status: 'connected', cpu: 8, mem: 16 * 1024 ** 3, err: null },
    { name: 'rf-edge-us-01', provider: 'aws', region: 'us-east-1', ip: '18.209.71.220', status: 'connected', cpu: 4, mem: 8 * 1024 ** 3, err: null },
    { name: 'rf-staging-runner', provider: 'byoc', region: 'eu-west-1', ip: '10.0.4.21', status: 'disconnected', cpu: 2, mem: 4 * 1024 ** 3, err: 'connect: connection refused (dial tcp 10.0.4.21:2376)' },
  ];
  const demoServerIds = [];
  for (const s of demoServerSpecs) {
    const sid = id('srv');
    demoServerIds.push(sid);
    db.prepare(`INSERT INTO servers (id, workspace_id, name, provider, region, host, docker_endpoint, mode, status, os,
      docker_version, cpu_cores, memory_bytes, disk_bytes, last_seen, last_error, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      sid, workspaceId, s.name, s.provider, s.region, s.ip, `tcp://${s.ip}:2376`, 'demo', s.status,
      'Ubuntu 24.04 LTS', '27.3.1', s.cpu, s.mem, 320 * 1024 ** 3,
      s.status === 'connected' ? ago(between(1, 6)) : ago(1440 * 3), s.err, daysAgo(between(40, 160)),
    );
  }

  const containerSpecs = [
    ['atlas-web', 'redfox-atlas-web-production', 'ghcr.io/redfox-labs/atlas-web:1.4.2', 'running', 1.8, 84 * 1024 ** 2, '80->8080'],
    ['pulso-api', 'redfox-pulso-api-production', 'ghcr.io/redfox-labs/pulso-api:2.1.0', 'running', 6.4, 146 * 1024 ** 2, '80->8080'],
    ['pulso-api', 'redfox-pulso-api-worker', 'ghcr.io/redfox-labs/pulso-api:2.1.0', 'running', 2.1, 96 * 1024 ** 2, ''],
    ['console-app', 'redfox-console-app-production', 'ghcr.io/redfox-labs/console-app:0.7.3', 'restarting', 0.4, 61 * 1024 ** 2, '80->3000'],
    ['atlas-web', 'redfox-atlas-web-staging', 'ghcr.io/redfox-labs/atlas-web:1.4.1-rc.2', 'stopped', 0, 0, '80->8080'],
    ['docs-site', 'redfox-docs-site-production', 'ghcr.io/redfox-labs/docs-site:0.9.0', 'exited', 0, 0, '80->80'],
  ];
  containerSpecs.forEach((c, index) => {
    db.prepare(`INSERT INTO containers (id, server_id, project_id, name, image, status, cpu_pct, mem_bytes, ports, mode, created_at, started_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id('ctr'), demoServerIds[index % 2], projectIds[c[0]], c[1], c[2], c[3], c[4], c[5], c[6], 'demo',
      daysAgo(between(1, 20)), c[3] === 'running' ? ago(between(100, 8000)) : null,
    );
  });

  /* metrics: 24h of 5-minute samples */
  const insertMetric = db.prepare(`INSERT INTO metrics (id, scope, target, ts, cpu, mem, disk, requests, latency, errors, mode)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const load = os.loadavg()[0] / Math.max(1, os.cpus().length);
  const baseCpu = Math.min(85, Math.max(6, load * 100));
  const baseMem = (1 - os.freemem() / os.totalmem()) * 100;
  for (let i = 71; i >= 0; i--) {
    const ts = new Date(Date.now() - i * 20 * 60000).toISOString();
    insertMetric.run(id('met'), 'server', localServerId, ts,
      Math.max(3, baseCpu + Math.sin(i / 3) * 9 + between(-4, 4)),
      Math.max(10, baseMem + Math.sin(i / 5) * 4 + between(-2, 2)),
      between(38, 41), between(20, 140), between(24, 96), between(0, 3), 'live');
    for (const sid of demoServerIds.slice(0, 2)) {
      insertMetric.run(id('met'), 'server', sid, ts,
        Math.max(4, 34 + Math.sin(i / 4) * 14 + between(-5, 5)),
        Math.max(12, 58 + Math.cos(i / 6) * 8 + between(-3, 3)),
        between(52, 63), between(80, 320), between(40, 130), between(0, 6), 'demo');
    }
  }

  /* runtime logs */
  const insertLog = db.prepare(`INSERT INTO logs (id, workspace_id, project_id, deployment_id, source, level, message, path, status_code, duration_ms, mode, ts)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const routes = ['/', '/#pricing', '/api/health', '/v1/organizations', '/v1/metrics', '/assets/app.js', '/favicon.ico'];
  const messages = [
    'request completed', 'request completed', 'cache hit', 'cache miss', 'upstream responded', 'slow query (p95 412ms)',
  ];
  for (let i = 0; i < 140; i++) {
    const slug = pick(['atlas-web', 'pulso-api', 'console-app', 'docs-site']);
    const status = pick([200, 200, 200, 200, 304, 404, 500, 200]);
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    insertLog.run(id('log'), workspaceId, projectIds[slug], null,
      pick(['runtime', 'runtime', 'runtime', 'edge']), level,
      status >= 500 ? `unhandled error: TypeError: Cannot read properties of undefined (reading 'id')` : pick(messages),
      pick(routes), status, Math.round(rnd() * 640 * 10) / 10, 'demo', ago(between(1, 4000)));
  }

  /* deployments */
  const deploySpecs = [
    ['atlas-web', 'ready', 'production', 'git', 40, 61000, null],
    ['pulso-api', 'failed', 'production', 'git', 96, 43000, 'Build command exited with code 1'],
    ['console-app', 'failed', 'preview', 'git', 180, 38000, 'npm ci failed: ERESOLVE could not resolve peer dependency react@19.0.0'],
    ['atlas-web', 'ready', 'preview', 'git', 260, 58000, null],
    ['docs-site', 'ready', 'production', 'manual', 400, 52000, null],
    ['pulso-api', 'ready', 'production', 'git', 620, 47000, null],
    ['console-app', 'ready', 'preview', 'git', 900, 71000, null],
    ['atlas-web', 'cancelled', 'preview', 'manual', 1100, 12000, 'Cancelled by Maya Lindqvist'],
    ['pulso-api', 'ready', 'preview', 'git', 1500, 45000, null],
    ['docs-site', 'ready', 'preview', 'git', 2000, 49000, null],
    ['console-app', 'ready', 'production', 'git', 2600, 68000, null],
    ['atlas-web', 'ready', 'production', 'git', 3400, 60000, null],
    ['pulso-api', 'ready', 'production', 'rollback', 4200, 44000, null],
    ['docs-site', 'ready', 'production', 'git', 5000, 51000, null],
    ['console-app', 'failed', 'production', 'git', 6000, 35000, 'Build command exited with code 1'],
    ['atlas-web', 'ready', 'preview', 'git', 7000, 57000, null],
    ['pulso-api', 'ready', 'preview', 'git', 8000, 46000, null],
    ['docs-site', 'ready', 'preview', 'git', 9200, 50000, null],
    ['console-app', 'ready', 'preview', 'git', 10400, 66000, null],
    ['atlas-web', 'ready', 'production', 'redeploy', 12000, 59000, null],
  ];

  const deploymentIds = {};
  const authors = [USERS[0].name, USERS[1].name, USERS[2].name];
  for (const [slug, status, environment, trigger, minutesAgo, duration, error] of deploySpecs) {
    const pid = projectIds[slug];
    const rid = repoIds[slug];
    const repo = REPOS.find((r) => r.slug === slug);
    const commitRow = db.prepare('SELECT * FROM commits WHERE repository_id = ? ORDER BY committed_at DESC LIMIT 1').get(rid);
    const depId = id('dpl');
    deploymentIds[slug] ||= depId;
    const createdAt = ago(minutesAgo);
    const startedAt = status === 'queued' ? null : ago(minutesAgo - 0.2);
    const finishedAt = ['ready', 'failed', 'cancelled'].includes(status) ? iso(new Date(createdAt).getTime() + duration) : null;
    db.prepare(`INSERT INTO deployments (id, project_id, workspace_id, environment, status, mode, commit_sha, commit_message,
      branch, trigger, actor, url, artifact_dir, image, error, created_at, started_at, finished_at, duration_ms)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      depId, pid, workspaceId, environment, status, 'recorded',
      commitRow?.sha || sha(), commitRow?.message || 'chore: initial import',
      environment === 'production' ? 'main' : pick(['staging', 'feat/pricing-table']),
      trigger, authors[between(0, 2)],
      status === 'ready' ? `https://${environment === 'production' ? slug : `${slug}-${depId.slice(-6)}`}.redfox.app` : null,
      null, status === 'ready' ? `ghcr.io/redfox-labs/${slug}:${commitRow?.sha.slice(0, 7) || 'latest'}` : null,
      error, createdAt, startedAt, finishedAt, status === 'queued' ? null : duration,
    );
    void repo;
  }

  /* build logs for the newest deployments + both failures */
  const logFor = (depId, lines) => {
    let seq = 0;
    const stmt = db.prepare('INSERT INTO deployment_logs (id, deployment_id, seq, ts, level, phase, message) VALUES (?,?,?,?,?,?,?)');
    const base = Date.now() - between(30, 120) * 60000;
    for (const [offsetMs, level, phase, message] of lines) {
      stmt.run(id('dl'), depId, seq++, iso(base + offsetMs), level, phase, message);
    }
  };

  const [atlasId, pulsoId, consoleId] = [deploymentIds['atlas-web'], deploymentIds['pulso-api'], deploymentIds['console-app']];
  logFor(atlasId, [
    [0, 'info', 'queue', 'Deployment created from push to main (9c1f8a2)'],
    [400, 'info', 'queue', 'Runner assigned: rf-edge-eu-01'],
    [900, 'info', 'build', 'Cloning repository redfox-labs/atlas-web at 9c1f8a2'],
    [1600, 'info', 'build', 'No dependencies to install (package.json has no runtime deps)'],
    [2400, 'info', 'build', 'Running build command: node build.mjs'],
    [3100, 'info', 'build', 'built 4 files, 5.8 kB'],
    [3200, 'info', 'build', '  dist/index.html'],
    [3300, 'info', 'build', '  dist/assets/styles.css'],
    [3400, 'info', 'build', '  dist/assets/app.js'],
    [4700, 'info', 'publish', 'Artifacts uploaded (5.8 kB, 4 files)'],
    [5600, 'info', 'publish', 'Image pushed: ghcr.io/redfox-labs/atlas-web:9c1f8a2'],
    [6000, 'info', 'routing', 'Traefik route registered for atlas.redfox.app'],
    [6100, 'info', 'ready', 'Deployment ready in 61s'],
  ]);
  logFor(pulsoId, [
    [0, 'info', 'queue', 'Deployment created from push to main (4d8e2f1)'],
    [300, 'info', 'queue', 'Runner assigned: rf-edge-eu-01'],
    [800, 'info', 'build', 'Cloning repository redfox-labs/pulso-api at 4d8e2f1'],
    [2000, 'info', 'install', 'Running install command: npm ci'],
    [9000, 'info', 'install', 'added 214 packages in 7s'],
    [9200, 'info', 'build', 'Running build command: npm run build'],
    [14000, 'info', 'build', '> pulso-api@2.1.0 build'],
    [14100, 'info', 'build', '> tsc -p tsconfig.json'],
    [31000, 'error', 'build', "src/routes.ts(14,18): error TS2339: Property 'query' does not exist on type 'Pool'."],
    [31100, 'error', 'build', "src/db.ts(3,14): error TS2304: Cannot find name 'pg'."],
    [43000, 'error', 'build', 'Build command exited with code 1'],
    [43100, 'error', 'build', 'Deployment failed: build step did not complete'],
  ]);
  logFor(consoleId, [
    [0, 'info', 'queue', 'Deployment created from push to feat/react-peer-range (b7c5d3e)'],
    [500, 'info', 'build', 'Cloning repository redfox-labs/console-app at b7c5d3e'],
    [1600, 'info', 'install', 'Running install command: npm ci'],
    [8000, 'warn', 'install', 'npm warn ERESOLVE overriding peer dependency'],
    [9000, 'error', 'install', "npm error ERESOLVE could not resolve peer dependency react@19.0.0 from @tanstack/react-query@5.59.0"],
    [9100, 'error', 'install', 'npm error Fix the upstream dependency conflict, or retry with --legacy-peer-deps'],
    [38000, 'error', 'install', 'Install command exited with code 1'],
  ]);

  /* webhook / events / notifications / api keys */
  const eventSpecs = [
    ['deployment', 'info', 'Atlas Web deployed to production', 'atlas-web', 40],
    ['deployment', 'error', 'Pulso API deployment failed at build step', 'pulso-api', 96],
    ['domain', 'warn', 'console.redfox.app DNS verification failed', 'console-app', 130],
    ['env', 'info', 'STRIPE_SECRET_KEY updated in production by Maya Lindqvist', 'atlas-web', 300],
    ['git', 'info', '3 commits pushed to atlas-web/main', 'atlas-web', 420],
    ['container', 'warn', 'Container redfox-console-app-production is restarting', 'console-app', 470],
    ['database', 'info', 'Nightly backup completed for pulso-api (14.2 MB)', 'pulso-api', 720],
    ['member', 'info', 'Tom Okafor joined the workspace as developer', null, 5000],
    ['deployment', 'info', 'Docs Site promoted to production', 'docs-site', 400],
  ];
  for (const [type, level, message, slug, mins] of eventSpecs) {
    db.prepare('INSERT INTO events (id, workspace_id, project_id, type, level, actor, message, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(id('evt'), workspaceId, slug ? projectIds[slug] : null, type, level, USERS[between(0, 1)].name, message, ago(mins));
  }

  db.prepare('INSERT INTO notifications (id, user_id, title, body, href, level, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id('ntf'), userIds[0], 'Pulso API deployment failed', 'Build command exited with code 1 on main (4d8e2f1).', '/deployments', 'error', ago(96));
  db.prepare('INSERT INTO notifications (id, user_id, title, body, href, level, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id('ntf'), userIds[0], 'Domain verification failed', 'console.redfox.app points at 34.117.59.81 instead of cname.redfox.app.', '/domains', 'warn', ago(130));
  db.prepare('INSERT INTO notifications (id, user_id, title, body, href, level, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id('ntf'), userIds[0], 'Atlas Web is live', 'Deployment 9c1f8a2 finished in 61s.', '/deployments', 'success', ago(40));
  db.prepare('UPDATE notifications SET read_at = ? WHERE title = ?').run(ago(30), 'Atlas Web is live');

  const keyRaw = 'rf_live_pulso_2f8a1c9d7b3e';
  db.prepare('INSERT INTO api_keys (id, project_id, name, prefix, key_hash, scopes, last_used, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id('key'), projectIds['pulso-api'], 'Production read', keyRaw.slice(0, 13), apiKeyHash(keyRaw), 'read', ago(22), daysAgo(45));
  db.prepare('INSERT INTO api_keys (id, project_id, name, prefix, key_hash, scopes, last_used, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id('key'), projectIds['atlas-web'], 'CI preview deploys', 'rf_live_atlas', apiKeyHash('rf_live_atlas_9d2f7a1c4e6b'), 'read,write', ago(300), daysAgo(20));

  /* A real example conversation, produced by the local analysis engine over the
     seeded failed deployment. Nothing here is a fabricated model answer. */
  const failed = db.prepare(`SELECT id FROM deployments WHERE status = 'failed' ORDER BY created_at DESC LIMIT 1`).get();
  if (failed) {
    const analysis = analyzeDeployment(failed.id);
    if (analysis) {
      const convId = id('cnv');
      const stamp = ago(210);
      db.prepare('INSERT INTO conversations (id, workspace_id, user_id, project_id, title, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
        .run(convId, workspaceId, userIds[0], analysis.project.id, 'Why did the last build fail?', stamp, ago(205));
      const primary = analysis.evidence?.[0];
      const body = [
        `**${analysis.project.name} · ${analysis.deployment.environment} · ${String(analysis.deployment.commit || '').slice(0, 7)}**`,
        '',
        analysis.summary,
        analysis.causes.length ? `\n**Likely causes**\n${analysis.causes.map((c) => `- ${c.cause}`).join('\n')}` : '',
        analysis.fixes.length ? `\n**Suggested fixes**\n${analysis.fixes.map((f) => `- ${f}`).join('\n')}` : '',
        primary ? `\n\`\`\`\n${primary.message}\n\`\`\`` : '',
        '',
        '_Local analysis · no model provider connected. Computed from this deployment\'s log stream._',
      ].filter(Boolean).join('\n');
      db.prepare('INSERT INTO messages (id, conversation_id, role, content, meta, created_at) VALUES (?,?,?,?,?,?)')
        .run(id('msg'), convId, 'user', 'Why did my last build fail, and what should I change?', null, stamp);
      db.prepare('INSERT INTO messages (id, conversation_id, role, content, meta, created_at) VALUES (?,?,?,?,?,?)')
        .run(id('msg'), convId, 'assistant', body, JSON.stringify({ source: 'local' }), ago(205));
    }
  }

  return { seeded: true };
}

/* auto seed on boot */
const direct = process.argv[1] && process.argv[1].endsWith('seed.js');
if (direct) {
  const force = process.argv.includes('--force');
  const result = seedAll({ force });
  console.log(result.seeded ? 'Seed complete.' : 'Database already seeded. Use --force to rebuild.');
}

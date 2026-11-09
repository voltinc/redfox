import { Router } from 'express';
import { scaffoldRepository } from '../lib/scaffold.js';
import { db, nowIso, projectDb } from '../db.js';
import { requireAuth, workspaceContext, requireRole, loadProject, audit } from '../auth.js';
import { asyncRoute, bad, slugify, requireFields, notFound, conflict } from '../util.js';
import { id, encrypt, decrypt, maskValue, sha } from '../crypto.js';
import { verifyDomain } from '../services/dns.js';

const router = Router();
router.use(requireAuth, workspaceContext);

export const FRAMEWORKS = [
  { id: 'nextjs', label: 'Next.js', build: 'next build', output: '.next', install: 'npm ci' },
  { id: 'vite', label: 'Vite', build: 'npm run build', output: 'dist', install: 'npm ci' },
  { id: 'astro', label: 'Astro', build: 'astro build', output: 'dist', install: 'npm ci' },
  { id: 'remix', label: 'Remix', build: 'npm run build', output: 'build', install: 'npm ci' },
  { id: 'sveltekit', label: 'SvelteKit', build: 'npm run build', output: 'build', install: 'npm ci' },
  { id: 'nuxt', label: 'Nuxt', build: 'npm run build', output: '.output', install: 'npm ci' },
  { id: 'node', label: 'Node.js', build: 'npm run build', output: 'dist', install: 'npm ci' },
  { id: 'static', label: 'Static', build: '', output: '.', install: 'none' },
  { id: 'docker', label: 'Dockerfile', build: 'docker build', output: '.', install: 'none' },
  { id: 'other', label: 'Other', build: '', output: 'dist', install: 'npm ci' },
];

router.get('/meta/frameworks', asyncRoute(async (_req, res) => {
  res.json({
    frameworks: FRAMEWORKS,
    runtimes: [
      { id: 'node20', label: 'Node.js 20' },
      { id: 'node22', label: 'Node.js 22' },
      { id: 'bun1', label: 'Bun 1.1' },
      { id: 'static', label: 'Static only' },
    ],
    runners: [
      { id: 'local', label: 'Local sandbox', detail: 'Runs install and build commands on this host and publishes the output directory.' },
      { id: 'demo', label: 'Demonstration runner', detail: 'Records the pipeline without executing it. Logs are labelled.' },
    ],
  });
}));

const summarise = (project) => {
  const last = db.prepare('SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(project.id);
  const repo = db.prepare('SELECT id, name, slug, visibility FROM repositories WHERE project_id = ?').get(project.id);
  const domains = db.prepare('SELECT hostname, status, kind FROM domains WHERE project_id = ?').all(project.id);
  return {
    ...project,
    url: `https://${project.slug}.redfox.app`,
    last_deployment: last || null,
    repository: repo || null,
    domains,
  };
};

router.get('/projects', asyncRoute(async (req, res) => {
  const projects = db.prepare('SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at ASC').all(req.workspace.id);
  res.json({ projects: projects.map(summarise), role: req.role });
}));

router.post('/projects', requireRole('developer'), asyncRoute(async (req, res) => {
  const body = req.body || {};
  requireFields(body, ['name']);
  const framework = FRAMEWORKS.find((f) => f.id === body.framework) || FRAMEWORKS.at(-1);
  const slug = slugify(body.slug || body.name);
  if (!slug) throw bad('Project name must contain letters or numbers');
  if (db.prepare('SELECT 1 FROM projects WHERE workspace_id = ? AND slug = ?').get(req.workspace.id, slug)) {
    throw conflict(`A project with the slug "${slug}" already exists in this workspace`);
  }
  const runner = body.runner === 'local' ? 'local' : 'demo';
  const projectId = id('prj');
  const now = nowIso();
  db.prepare(`INSERT INTO projects (id, workspace_id, name, slug, description, framework, runtime, install_command,
    build_command, output_dir, root_dir, production_branch, status, runner, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    projectId, req.workspace.id, String(body.name).trim().slice(0, 60), slug,
    body.description ? String(body.description).slice(0, 280) : null,
    framework.id, body.runtime || 'node20',
    body.install_command ?? framework.install, body.build_command ?? framework.build,
    body.output_dir ?? framework.output, body.root_dir || '.', body.production_branch || 'main',
    'active', runner, now, now,
  );

  // isolated database for the new project
  const dbFile = `data/dbs/${projectId}.sqlite`;
  projectDb(projectId);
  db.prepare(`INSERT INTO databases (id, project_id, engine, engine_version, region, status, file_path, size_bytes, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id('db'), projectId, 'postgres', '16.3', req.workspace.region, 'healthy', dbFile, 4096, now);

  // optionally attach an existing repository, or create a new empty one
  let repositoryId = body.repository_id || null;
  if (repositoryId) {
    const repo = db.prepare('SELECT * FROM repositories WHERE id = ? AND workspace_id = ?').get(repositoryId, req.workspace.id);
    if (!repo) throw bad('Selected repository does not belong to this workspace');
    if (repo.project_id) throw conflict('That repository is already connected to another project');
    db.prepare('UPDATE repositories SET project_id = ? WHERE id = ?').run(projectId, repo.id);
  } else if (body.create_repository !== false) {
    repositoryId = id('repo');
    db.prepare(`INSERT INTO repositories (id, workspace_id, project_id, name, slug, description, visibility,
      default_branch, integration, remote_url, webhook_secret, webhook_url, webhook_events, webhook_active, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      repositoryId, req.workspace.id, projectId, slug, slug, body.description || null, 'private', 'main', 'native',
      `http://localhost:3000/git/${slug}.git`, sha('whsec'), '', '["push","pull_request"]', 1, now,
    );
    db.prepare('INSERT INTO branches (id, repository_id, name, head_sha, is_default, protected, updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(id('brn'), repositoryId, 'main', null, 1, 1, now);
    scaffoldRepository({ repoId: repositoryId, branch: 'main', name: String(body.name).trim(), author: req.user });
  }

  db.prepare('INSERT INTO project_environments (id, project_id, name, branch, url, status, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id('env'), projectId, 'production', body.production_branch || 'main', `https://${slug}.redfox.app`, 'ready', now);

  audit(req.workspace.id, projectId, 'project', `Project ${body.name} created`, req.user.name);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  res.status(201).json({ project: summarise(project) });
}));

router.get('/projects/:project', loadProject, asyncRoute(async (req, res) => {
  const project = summarise(req.project);
  const repo = db.prepare('SELECT * FROM repositories WHERE project_id = ?').get(req.project.id);
  const deployments = db.prepare('SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC LIMIT 10').all(req.project.id);
  const envCount = db.prepare('SELECT count(*) AS n FROM env_vars WHERE project_id = ?').get(req.project.id).n;
  const database = db.prepare('SELECT * FROM databases WHERE project_id = ?').get(req.project.id);
  const buckets = db.prepare('SELECT * FROM buckets WHERE project_id = ?').all(req.project.id);

  let tableSummary = { tables: 0, rows: 0 };
  try {
    const conn = projectDb(req.project.id);
    const tables = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    tableSummary = {
      tables: tables.length,
      rows: tables.reduce((sum, t) => sum + (conn.prepare(`SELECT count(*) AS n FROM "${t.name}"`).get()?.n ?? 0), 0),
    };
  } catch { /* no db */ }

  res.json({
    project,
    role: req.role,
    repository: repo || null,
    deployments,
    database: database ? { ...database, ...tableSummary } : null,
    buckets,
    env_count: envCount,
    frameworks: FRAMEWORKS,
  });
}));

router.patch('/projects/:project', requireRole('developer'), loadProject, asyncRoute(async (req, res) => {
  const body = req.body || {};
  const allowed = ['name', 'description', 'framework', 'runtime', 'install_command', 'build_command', 'output_dir',
    'root_dir', 'production_branch', 'status', 'runner'];
  const updates = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (updates.name !== undefined && !String(updates.name).trim()) throw bad('Project name cannot be empty');
  if (updates.status !== undefined && !['active', 'paused', 'archived'].includes(updates.status)) throw bad('Invalid status');
  if (updates.runner !== undefined && !['local', 'demo'].includes(updates.runner)) throw bad('Invalid runner');
  if (updates.framework !== undefined && !FRAMEWORKS.some((f) => f.id === updates.framework)) throw bad('Unknown framework');
  if (Object.keys(updates).length === 0) throw bad('No supported fields to update');

  updates.updated_at = nowIso();
  const sets = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE projects SET ${sets} WHERE id = ?`).run([...Object.values(updates), req.project.id]);
  audit(req.workspace.id, req.project.id, 'project', `Project settings updated (${Object.keys(updates).filter((k) => k !== 'updated_at').join(', ')})`, req.user.name);
  res.json({ project: summarise(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.project.id)) });
}));

router.delete('/projects/:project', requireRole('admin'), loadProject, asyncRoute(async (req, res) => {
  const { confirm } = req.body || {};
  if (confirm !== req.project.slug) throw bad(`Type the project slug "${req.project.slug}" to confirm deletion`);
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.project.id);
  audit(req.workspace.id, null, 'project', `Project ${req.project.name} deleted`, req.user.name, 'warn');
  res.json({ ok: true });
}));

router.get('/projects/:project/activity', loadProject, asyncRoute(async (req, res) => {
  const events = db.prepare('SELECT * FROM events WHERE project_id = ? ORDER BY created_at DESC LIMIT 30').all(req.project.id);
  const deployments = db.prepare('SELECT id, status, environment, commit_sha, trigger, created_at, duration_ms FROM deployments WHERE project_id = ? ORDER BY created_at DESC LIMIT 15').all(req.project.id);
  const commits = db.prepare(`SELECT c.sha, c.message, c.author_name, c.committed_at FROM commits c
    JOIN repositories r ON r.id = c.repository_id WHERE r.project_id = ? ORDER BY c.committed_at DESC LIMIT 10`).all(req.project.id);
  const merged = [
    ...events.map((e) => ({ kind: 'event', at: e.created_at, title: e.message, meta: `${e.type} · ${e.actor}`, level: e.level })),
    ...deployments.map((d) => ({ kind: 'deployment', at: d.created_at, title: `Deployment ${d.status}`, meta: `${d.environment} · ${d.commit_sha?.slice(0, 7)} · ${d.trigger}`, level: d.status === 'failed' ? 'error' : 'info', id: d.id })),
    ...commits.map((c) => ({ kind: 'commit', at: c.committed_at, title: c.message, meta: `${c.sha.slice(0, 7)} · ${c.author_name}`, level: 'info' })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 40);
  res.json({ activity: merged });
}));

/* ------------------------------------------------------- environment variables */
router.get('/projects/:project/env', loadProject, asyncRoute(async (req, res) => {
  const items = db.prepare('SELECT * FROM env_vars WHERE project_id = ? ORDER BY key ASC').all(req.project.id)
    .map((row) => ({
      id: row.id, key: row.key, target: row.target, is_secret: !!row.is_secret,
      masked: row.is_secret ? maskValue(decrypt(row.value_enc)) : decrypt(row.value_enc),
      updated_at: row.updated_at, updated_by: row.updated_by,
    }));
  res.json({ items, project: { id: req.project.id, name: req.project.name, slug: req.project.slug } });
}));

router.post('/projects/:project/env', requireRole('developer'), loadProject, asyncRoute(async (req, res) => {
  const { key, value, target = 'all', is_secret = true } = req.body || {};
  requireFields(req.body || {}, ['key', 'value']);
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw bad('Variable names must be uppercase letters, numbers and underscores, starting with a letter');
  if (!['all', 'development', 'preview', 'production'].includes(target)) throw bad('Invalid environment target');
  if (db.prepare('SELECT 1 FROM env_vars WHERE project_id = ? AND key = ? AND target = ?').get(req.project.id, key, target)) {
    throw conflict(`${key} already exists for ${target}. Edit it instead.`);
  }
  const now = nowIso();
  db.prepare(`INSERT INTO env_vars (id, project_id, key, value_enc, target, is_secret, updated_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id('envv'), req.project.id, key, encrypt(String(value)), target, is_secret ? 1 : 0, req.user.name, now, now);
  audit(req.workspace.id, req.project.id, 'env', `${key} added for ${target}`, req.user.name);
  res.status(201).json({ ok: true });
}));

router.patch('/projects/:project/env/:varId', requireRole('developer'), loadProject, asyncRoute(async (req, res) => {
  const existing = db.prepare('SELECT * FROM env_vars WHERE id = ? AND project_id = ?').get(req.params.varId, req.project.id);
  if (!existing) throw notFound('Variable not found');
  const { value, target, is_secret } = req.body || {};
  if (target !== undefined && !['all', 'development', 'preview', 'production'].includes(target)) throw bad('Invalid environment target');
  const nextValue = value === undefined ? existing.value_enc : encrypt(String(value));
  db.prepare('UPDATE env_vars SET value_enc = ?, target = ?, is_secret = ?, updated_by = ?, updated_at = ? WHERE id = ?')
    .run(nextValue, target ?? existing.target, is_secret === undefined ? existing.is_secret : (is_secret ? 1 : 0), req.user.name, nowIso(), existing.id);
  audit(req.workspace.id, req.project.id, 'env', `${existing.key} updated`, req.user.name);
  res.json({ ok: true });
}));

router.delete('/projects/:project/env/:varId', requireRole('developer'), loadProject, asyncRoute(async (req, res) => {
  const existing = db.prepare('SELECT * FROM env_vars WHERE id = ? AND project_id = ?').get(req.params.varId, req.project.id);
  if (!existing) throw notFound('Variable not found');
  db.prepare('DELETE FROM env_vars WHERE id = ?').run(existing.id);
  audit(req.workspace.id, req.project.id, 'env', `${existing.key} deleted`, req.user.name, 'warn');
  res.json({ ok: true });
}));

router.post('/projects/:project/env/:varId/reveal', requireRole('developer'), loadProject, asyncRoute(async (req, res) => {
  const existing = db.prepare('SELECT * FROM env_vars WHERE id = ? AND project_id = ?').get(req.params.varId, req.project.id);
  if (!existing) throw notFound('Variable not found');
  audit(req.workspace.id, req.project.id, 'env', `${existing.key} value revealed`, req.user.name, 'warn');
  res.json({ value: decrypt(existing.value_enc) });
}));

/* -------------------------------------------------------------------- domains */
const domainPayload = (domain, project) => ({
  ...domain,
  project_name: project.name,
  project_slug: project.slug,
  dns: [
    { type: 'CNAME', name: domain.hostname.split('.').length > 2 ? domain.hostname.split('.')[0] : '@', value: 'cname.redfox.app' },
    { type: 'TXT', name: `_redfox.${domain.hostname}`, value: domain.verify_token },
  ],
});

router.get('/domains', asyncRoute(async (req, res) => {
  const rows = db.prepare(`SELECT d.*, p.name AS project_name, p.slug AS project_slug FROM domains d
    JOIN projects p ON p.id = d.project_id WHERE p.workspace_id = ? ORDER BY d.created_at ASC`).all(req.workspace.id);
  const projects = db.prepare('SELECT id, name, slug FROM projects WHERE workspace_id = ? ORDER BY name').all(req.workspace.id);
  res.json({ domains: rows, projects, role: req.role });
}));

router.get('/projects/:project/domains', loadProject, asyncRoute(async (req, res) => {
  const rows = db.prepare('SELECT * FROM domains WHERE project_id = ? ORDER BY created_at ASC').all(req.project.id);
  res.json({ domains: rows.map((d) => domainPayload(d, req.project)) });
}));

router.post('/projects/:project/domains', requireRole('developer'), loadProject, asyncRoute(async (req, res) => {
  const { hostname, kind = 'production' } = req.body || {};
  requireFields(req.body || {}, ['hostname']);
  const host = String(hostname).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) throw bad('Enter a valid hostname, for example app.example.com');
  if (!['production', 'preview', 'redirect'].includes(kind)) throw bad('Invalid domain type');
  if (db.prepare('SELECT 1 FROM domains WHERE hostname = ?').get(host)) throw conflict('That hostname is already attached to a project');
  const domainId = id('dmn');
  db.prepare(`INSERT INTO domains (id, project_id, hostname, kind, status, ssl, verify_token, created_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(domainId, req.project.id, host, kind, 'pending', 'pending', `redfox-verify=${sha().slice(0, 24)}`, nowIso());
  audit(req.workspace.id, req.project.id, 'domain', `Domain ${host} added`, req.user.name);
  const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(domainId);
  res.status(201).json({ domain: domainPayload(domain, req.project) });
}));

router.post('/projects/:project/domains/:domainId/verify', requireRole('developer'), loadProject, asyncRoute(async (req, res) => {
  const domain = db.prepare('SELECT * FROM domains WHERE id = ? AND project_id = ?').get(req.params.domainId, req.project.id);
  if (!domain) throw notFound('Domain not found');
  const result = await verifyDomain(domain.hostname, domain.verify_token);
  const status = result.verified ? 'active' : 'error';
  db.prepare('UPDATE domains SET status = ?, ssl = ?, last_check = ?, last_error = ? WHERE id = ?')
    .run(status, result.verified ? 'active' : domain.ssl, result.checked_at, result.verified ? null : result.errors.join('; ').slice(0, 400), domain.id);
  audit(req.workspace.id, req.project.id, 'domain',
    result.verified ? `Domain ${domain.hostname} verified` : `Domain ${domain.hostname} verification failed`,
    req.user.name, result.verified ? 'info' : 'warn');
  res.json({ verified: result.verified, status, result });
}));

router.delete('/projects/:project/domains/:domainId', requireRole('developer'), loadProject, asyncRoute(async (req, res) => {
  const domain = db.prepare('SELECT * FROM domains WHERE id = ? AND project_id = ?').get(req.params.domainId, req.project.id);
  if (!domain) throw notFound('Domain not found');
  db.prepare('DELETE FROM domains WHERE id = ?').run(domain.id);
  audit(req.workspace.id, req.project.id, 'domain', `Domain ${domain.hostname} removed`, req.user.name, 'warn');
  res.json({ ok: true });
}));

export default router;

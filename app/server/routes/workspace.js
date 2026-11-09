import { Router } from 'express';
import { db, nowIso, projectDb } from '../db.js';
import { requireAuth, workspaceContext, requireRole, audit } from '../auth.js';
import { asyncRoute, bad, slugify, requireFields, paged, paginate, notFound } from '../util.js';
import { id } from '../crypto.js';
import { queueDepth } from '../services/deployEngine.js';
import { hostSnapshot } from '../services/metrics.js';
import { createInvite, listInvites } from '../services/identity.js';

const router = Router();
router.use(requireAuth, workspaceContext);

const projectRow = (p) => ({
  ...p,
  url: `https://${p.slug}.redfox.app`,
});

/* ------------------------------------------------------------------ overview */
router.get('/overview', asyncRoute(async (req, res) => {
  const wsId = req.workspace.id;
  const projects = db.prepare('SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at ASC').all(wsId).map(projectRow);
  const projectIds = projects.map((p) => p.id);

  const deployments = db.prepare(`
    SELECT d.*, p.name AS project_name, p.slug AS project_slug
    FROM deployments d JOIN projects p ON p.id = d.project_id
    WHERE d.workspace_id = ? ORDER BY d.created_at DESC LIMIT 8
  `).all(wsId);

  const lastByProject = {};
  for (const p of projectIds) {
    lastByProject[p] = db.prepare('SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(p) || null;
  }

  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const stats = db.prepare(`
    SELECT
      count(*) AS total,
      sum(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) AS ready,
      sum(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
    FROM deployments WHERE workspace_id = ? AND created_at > ?
  `).get(wsId, since);

  const series = [];
  for (let i = 13; i >= 0; i--) {
    const start = new Date(Date.now() - i * 864e5);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 864e5);
    const row = db.prepare(`SELECT sum(CASE WHEN status='ready' THEN 1 ELSE 0 END) AS ready,
                                   sum(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed
                            FROM deployments WHERE workspace_id = ? AND created_at >= ? AND created_at < ?`)
      .get(wsId, start.toISOString(), end.toISOString());
    series.push({ date: start.toISOString().slice(0, 10), ready: row.ready || 0, failed: row.failed || 0 });
  }

  const repoActivity = db.prepare(`
    SELECT c.sha, c.message, c.author_name, c.committed_at, r.slug AS repo_slug, r.name AS repo_name
    FROM commits c JOIN repositories r ON r.id = c.repository_id
    WHERE r.workspace_id = ? ORDER BY c.committed_at DESC LIMIT 6
  `).all(wsId);

  const servers = db.prepare('SELECT * FROM servers WHERE workspace_id = ? ORDER BY created_at ASC').all(wsId);
  const containers = db.prepare(`SELECT c.*, s.name AS server_name FROM containers c JOIN servers s ON s.id = c.server_id
    WHERE s.workspace_id = ?`).all(wsId);

  const databases = projects.map((p) => {
    const meta = db.prepare('SELECT * FROM databases WHERE project_id = ?').get(p.id);
    let tables = 0;
    let rows = 0;
    try {
      const conn = projectDb(p.id);
      const list = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      tables = list.length;
      rows = list.reduce((sum, t) => sum + (conn.prepare(`SELECT count(*) AS n FROM "${t.name}"`).get()?.n ?? 0), 0);
    } catch { /* project db missing */ }
    return {
      project_id: p.id, project: p.name, slug: p.slug, engine: meta?.engine ?? 'postgres',
      status: meta?.status ?? 'unknown', size_bytes: meta?.size_bytes ?? 0, tables, rows,
    };
  });

  const events = db.prepare('SELECT * FROM events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 8').all(wsId);
  const domains = db.prepare(`SELECT d.*, p.name AS project_name FROM domains d JOIN projects p ON p.id = d.project_id
                              WHERE p.workspace_id = ?`).all(wsId);

  const host = hostSnapshot();
  const localServer = servers.find((s) => s.mode === 'local');

  res.json({
    workspace: req.workspace,
    role: req.role,
    projects: projects.map((p) => ({
      ...p,
      last_deployment: lastByProject[p.id],
      domains: domains.filter((d) => d.project_id === p.id).map((d) => ({ hostname: d.hostname, status: d.status })),
    })),
    stats: {
      projects: projects.length,
      deployments_7d: stats.total || 0,
      success_rate: stats.total ? Math.round((stats.ready / stats.total) * 100) : null,
      failed_7d: stats.failed || 0,
      repositories: db.prepare('SELECT count(*) AS n FROM repositories WHERE workspace_id = ?').get(wsId).n,
      domains_active: domains.filter((d) => d.status === 'active').length,
      servers_connected: servers.filter((s) => s.status === 'connected').length,
      containers_running: containers.filter((c) => c.status === 'running').length,
      containers_total: containers.length,
      env_vars: db.prepare('SELECT count(*) AS n FROM env_vars WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = ?)').get(wsId).n,
    },
    series,
    deployments,
    repo_activity: repoActivity,
    infrastructure: {
      servers: servers.map((s) => ({
        id: s.id, name: s.name, provider: s.provider, region: s.region, mode: s.mode,
        status: s.status, last_seen: s.last_seen,
      })),
      containers: containers.map((c) => ({ id: c.id, name: c.name, status: c.status, server_name: c.server_name, mode: c.mode })),
      host: host,
      demo_servers: servers.filter((s) => s.mode === 'demo').length,
    },
    databases,
    events,
    domains,
    queue: queueDepth(),
    demo: {
      seeded_repositories: true,
      note: 'Projects, repositories, historical deployments and demonstration servers were seeded so the workspace is populated. Deployments you trigger on the Atlas Web project execute real builds on this host.',
    },
  });
}));

/* ----------------------------------------------------------------- workspace */
router.get('/workspace', asyncRoute(async (req, res) => {
  const members = db.prepare(`SELECT m.id, m.role, m.created_at, u.id AS user_id, u.name, u.email, u.avatar_color
    FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY m.created_at ASC`).all(req.workspace.id);
  const counts = {
    projects: db.prepare('SELECT count(*) AS n FROM projects WHERE workspace_id = ?').get(req.workspace.id).n,
    repositories: db.prepare('SELECT count(*) AS n FROM repositories WHERE workspace_id = ?').get(req.workspace.id).n,
    members: members.length,
  };
  res.json({ workspace: req.workspace, role: req.role, members, counts });
}));

router.patch('/workspace', requireRole('admin'), asyncRoute(async (req, res) => {
  const { name, region } = req.body || {};
  if (name !== undefined) {
    if (!String(name).trim()) throw bad('Workspace name cannot be empty');
    db.prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(String(name).trim().slice(0, 60), req.workspace.id);
  }
  if (region !== undefined) {
    if (!['eu-west-1', 'eu-central', 'us-east-1', 'ap-southeast-1'].includes(region)) throw bad('Unsupported region');
    db.prepare('UPDATE workspaces SET region = ? WHERE id = ?').run(region, req.workspace.id);
  }
  audit(req.workspace.id, null, 'workspace', `Workspace settings updated by ${req.user.name}`, req.user.name);
  res.json({ ok: true });
}));

router.get('/workspace/invites', asyncRoute(async (req, res) => {
  res.json({ invites: listInvites(req.workspace.id), role: req.role });
}));

router.post('/workspace/invites', requireRole('admin'), asyncRoute(async (req, res) => {
  const { email, role } = req.body || {};
  const allowed = ['admin', 'developer', 'viewer'];
  if (role && !allowed.includes(role)) throw bad('Role must be admin, developer or viewer');
  const invite = createInvite({ workspaceId: req.workspace.id, userId: req.user.id, email, role });
  audit(req.workspace.id, null, 'identity', `Invitation created${invite.email ? ` for ${invite.email}` : ''}`, req.user.name);
  res.status(201).json({ invite: { ...invite, state: 'pending' }, token: invite.token });
}));

router.delete('/workspace/invites/:inviteId', requireRole('admin'), asyncRoute(async (req, res) => {
  const invite = db.prepare('SELECT * FROM invites WHERE id = ? AND workspace_id = ?').get(req.params.inviteId, req.workspace.id);
  if (!invite) throw notFound('Invitation not found');
  db.prepare('DELETE FROM invites WHERE id = ?').run(invite.id);
  res.json({ ok: true });
}));

router.get('/workspace/members', asyncRoute(async (req, res) => {
  const members = db.prepare(`SELECT m.id, m.role, m.created_at, u.id AS user_id, u.name, u.email, u.avatar_color
    FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY m.created_at ASC`).all(req.workspace.id);
  res.json({ members, role: req.role });
}));

router.patch('/workspace/members/:memberId', requireRole('admin'), asyncRoute(async (req, res) => {
  const { role } = req.body || {};
  if (!['admin', 'developer', 'viewer'].includes(role)) throw bad('Role must be admin, developer or viewer');
  const member = db.prepare('SELECT * FROM memberships WHERE id = ? AND workspace_id = ?').get(req.params.memberId, req.workspace.id);
  if (!member) throw bad('Member not found');
  if (member.role === 'owner') throw bad('The workspace owner role cannot be changed here');
  db.prepare('UPDATE memberships SET role = ? WHERE id = ?').run(role, member.id);
  audit(req.workspace.id, null, 'member', `Role changed to ${role} for member ${member.user_id}`, req.user.name);
  res.json({ ok: true });
}));

router.delete('/workspace/members/:memberId', requireRole('admin'), asyncRoute(async (req, res) => {
  const member = db.prepare('SELECT * FROM memberships WHERE id = ? AND workspace_id = ?').get(req.params.memberId, req.workspace.id);
  if (!member) throw bad('Member not found');
  if (member.role === 'owner') throw bad('The workspace owner cannot be removed');
  db.prepare('DELETE FROM memberships WHERE id = ?').run(member.id);
  res.json({ ok: true });
}));

router.get('/workspace/events', asyncRoute(async (req, res) => {
  const { limit, page, offset } = paginate(req, 30);
  const total = db.prepare('SELECT count(*) AS n FROM events WHERE workspace_id = ?').get(req.workspace.id).n;
  const items = db.prepare(`SELECT e.*, p.name AS project_name, p.slug AS project_slug FROM events e
    LEFT JOIN projects p ON p.id = e.project_id WHERE e.workspace_id = ?
    ORDER BY e.created_at DESC LIMIT ? OFFSET ?`).all(req.workspace.id, limit, offset);
  res.json(paged(items, total, page, limit));
}));

router.get('/workspaces', asyncRoute(async (req, res) => {
  res.json({ workspaces: req.workspaces });
}));

router.post('/workspaces', asyncRoute(async (req, res) => {
  const { name } = req.body || {};
  requireFields(req.body || {}, ['name']);
  const slug = slugify(name);
  if (db.prepare('SELECT 1 FROM workspaces WHERE slug = ?').get(slug)) throw bad('A workspace with that name already exists');
  const wsId = id('ws');
  db.prepare('INSERT INTO workspaces (id, slug, name, plan, region, created_at) VALUES (?,?,?,?,?,?)')
    .run(wsId, slug, String(name).trim(), 'team', 'eu-west-1', nowIso());
  db.prepare('INSERT INTO memberships (id, workspace_id, user_id, role, created_at) VALUES (?,?,?,?,?)')
    .run(id('mem'), wsId, req.user.id, 'owner', nowIso());
  res.status(201).json({ workspace: { id: wsId, slug, name: String(name).trim() } });
}));

/* ------------------------------------------------------------ notifications */
router.get('/notifications', asyncRoute(async (req, res) => {
  const items = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(req.user.id);
  res.json({ items, unread: items.filter((n) => !n.read_at).length });
}));

router.post('/notifications/:id/read', asyncRoute(async (req, res) => {
  db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?').run(nowIso(), req.params.id, req.user.id);
  res.json({ ok: true });
}));

router.post('/notifications/read-all', asyncRoute(async (req, res) => {
  db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(nowIso(), req.user.id);
  res.json({ ok: true });
}));

/* -------------------------------------------------------------------- search */
router.get('/search', asyncRoute(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ projects: [], deployments: [], repositories: [], files: [], commands: [] });
  const like = `%${q}%`;
  const wsId = req.workspace.id;

  const projects = db.prepare('SELECT id, name, slug, framework, status FROM projects WHERE workspace_id = ? AND (name LIKE ? OR slug LIKE ?) LIMIT 6')
    .all(wsId, like, like);
  const deployments = db.prepare(`SELECT d.id, d.status, d.environment, d.commit_sha, d.created_at, p.name AS project_name
    FROM deployments d JOIN projects p ON p.id = d.project_id
    WHERE d.workspace_id = ? AND (d.commit_sha LIKE ? OR d.commit_message LIKE ? OR d.id LIKE ?)
    ORDER BY d.created_at DESC LIMIT 6`).all(wsId, like, like, like);
  const repositories = db.prepare('SELECT id, name, slug, description FROM repositories WHERE workspace_id = ? AND (name LIKE ? OR description LIKE ?) LIMIT 6')
    .all(wsId, like, like);
  const files = db.prepare(`SELECT f.path, f.repository_id, r.slug AS repo_slug FROM repo_files f
    JOIN repositories r ON r.id = f.repository_id
    WHERE r.workspace_id = ? AND f.kind = 'file' AND f.path LIKE ? LIMIT 8`).all(wsId, like);

  res.json({ projects, deployments, repositories, files });
}));

export default router;

import { Router } from 'express';
import fs from 'node:fs';
import { db, nowIso, projectDb } from '../db.js';
import { requireAuth, workspaceContext, requireRole, audit } from '../auth.js';
import { asyncRoute, bad, notFound, requireFields, paged, paginate, formatBytes } from '../util.js';
import { id } from '../crypto.js';
import { ping, listContainers, containerAction } from '../services/docker.js';
import { hostSnapshot, series } from '../services/metrics.js';

const router = Router();
router.use(requireAuth, workspaceContext);

const decorateServer = (server) => {
  const containers = db.prepare('SELECT * FROM containers WHERE server_id = ?').all(server.id);
  const latest = db.prepare('SELECT * FROM metrics WHERE scope = ? AND target = ? ORDER BY ts DESC LIMIT 1').get('server', server.id);
  return {
    ...server,
    containers: containers.length,
    containers_running: containers.filter((c) => c.status === 'running').length,
    cpu: latest?.cpu ?? null,
    mem: latest?.mem ?? null,
    disk: latest?.disk ?? null,
    connected: server.status === 'connected',
    demonstration: server.mode === 'demo',
  };
};

/* ------------------------------------------------------------------ servers */
router.get('/servers', asyncRoute(async (req, res) => {
  const servers = db.prepare('SELECT * FROM servers WHERE workspace_id = ? ORDER BY created_at ASC').all(req.workspace.id);
  const host = hostSnapshot();
  res.json({
    servers: servers.map(decorateServer),
    host,
    role: req.role,
    docker: { capable: false, reason: 'No Docker socket is mounted in this installation. Connect a Docker host to control containers.' },
  });
}));

router.post('/servers', requireRole('admin'), asyncRoute(async (req, res) => {
  const { name, provider = 'byoc', region = 'eu-west-1', host, docker_endpoint } = req.body || {};
  requireFields(req.body || {}, ['name']);
  const serverId = id('srv');
  const mode = docker_endpoint ? 'byoc' : 'demo';
  db.prepare(`INSERT INTO servers (id, workspace_id, name, provider, region, host, docker_endpoint, mode, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(serverId, req.workspace.id, String(name).trim().slice(0, 60), provider, region,
    host || null, docker_endpoint || null, mode, docker_endpoint ? 'provisioning' : 'disconnected', nowIso());

  let check = { ok: false, error: 'No Docker endpoint supplied, so nothing was contacted' };
  if (docker_endpoint) {
    check = await ping({ docker_endpoint });
    db.prepare('UPDATE servers SET status = ?, last_error = ?, last_seen = ? WHERE id = ?')
      .run(check.ok ? 'connected' : 'error', check.ok ? null : check.error, check.ok ? nowIso() : null, serverId);
  }
  audit(req.workspace.id, null, 'server', `Server ${name} added`, req.user.name);
  res.status(201).json({ server: decorateServer(db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId)), probe: check });
}));

router.get('/servers/:serverId', asyncRoute(async (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ? AND workspace_id = ?').get(req.params.serverId, req.workspace.id);
  if (!server) throw notFound('Server not found');
  const containers = db.prepare(`SELECT c.*, p.name AS project_name, p.slug AS project_slug FROM containers c
    LEFT JOIN projects p ON p.id = c.project_id WHERE c.server_id = ? ORDER BY c.name`).all(server.id);
  const metrics = series(server.id, { hours: Number(req.query.hours || 24) });
  res.json({
    server: decorateServer(server),
    containers,
    metrics,
    host: server.mode === 'local' ? hostSnapshot() : null,
    hint: server.mode === 'demo'
      ? 'This server record is demonstration data. Redfox has not contacted it, and container controls are disabled.'
      : null,
  });
}));

router.post('/servers/:serverId/test', requireRole('developer'), asyncRoute(async (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ? AND workspace_id = ?').get(req.params.serverId, req.workspace.id);
  if (!server) throw notFound('Server not found');
  if (server.mode === 'demo') {
    return res.json({ reachable: false, demo: true, error: 'Demonstration server. Redfox has no endpoint to contact for this record.' });
  }
  if (server.mode === 'local') {
    const snap = hostSnapshot();
    db.prepare('UPDATE servers SET status = ?, last_seen = ?, last_error = NULL WHERE id = ?').run('connected', nowIso(), server.id);
    return res.json({ reachable: true, host: snap, detail: 'This is the host running Redfox. Metrics are read directly from the operating system.' });
  }
  const check = await ping(server);
  if (check.ok) {
    const list = await listContainers(server);
    db.prepare('UPDATE servers SET status = ?, docker_version = ?, last_seen = ?, last_error = NULL WHERE id = ?')
      .run('connected', check.version, nowIso(), server.id);
    db.prepare('DELETE FROM containers WHERE server_id = ? AND mode = ?').run(server.id, 'live');
    for (const c of list.containers) {
      db.prepare(`INSERT INTO containers (id, server_id, project_id, name, image, status, ports, mode, created_at)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(id('ctr'), server.id, null, c.name, c.image,
        ['running', 'exited', 'restarting', 'paused'].includes(c.status) ? c.status : 'stopped', c.ports, 'live', nowIso());
    }
    return res.json({ reachable: true, version: check.version, containers: list.containers.length });
  }
  db.prepare('UPDATE servers SET status = ?, last_error = ? WHERE id = ?').run('error', check.error, server.id);
  res.json({ reachable: false, error: check.error });
}));

router.delete('/servers/:serverId', requireRole('admin'), asyncRoute(async (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ? AND workspace_id = ?').get(req.params.serverId, req.workspace.id);
  if (!server) throw notFound('Server not found');
  if (server.mode === 'local') throw bad('The host running Redfox cannot be removed from the workspace');
  db.prepare('DELETE FROM servers WHERE id = ?').run(server.id);
  audit(req.workspace.id, null, 'server', `Server ${server.name} removed`, req.user.name, 'warn');
  res.json({ ok: true });
}));

/* --------------------------------------------------------------- containers */
router.get('/containers', asyncRoute(async (req, res) => {
  const filters = ['s.workspace_id = ?'];
  const params = [req.workspace.id];
  if (req.query.status) { filters.push('c.status = ?'); params.push(req.query.status); }
  if (req.query.server) { filters.push('c.server_id = ?'); params.push(req.query.server); }
  const containers = db.prepare(`SELECT c.*, s.name AS server_name, s.mode AS server_mode, p.name AS project_name, p.slug AS project_slug
    FROM containers c JOIN servers s ON s.id = c.server_id LEFT JOIN projects p ON p.id = c.project_id
    WHERE ${filters.join(' AND ')} ORDER BY c.status = 'running' DESC, c.name ASC`).all(params);
  const servers = db.prepare('SELECT id, name, mode, status FROM servers WHERE workspace_id = ?').all(req.workspace.id);
  res.json({
    containers,
    servers,
    counts: {
      running: containers.filter((c) => c.status === 'running').length,
      stopped: containers.filter((c) => ['stopped', 'exited'].includes(c.status)).length,
      restarting: containers.filter((c) => c.status === 'restarting').length,
    },
    role: req.role,
  });
}));

router.post('/containers/:containerId/:action', requireRole('developer'), asyncRoute(async (req, res) => {
  const { action } = req.params;
  if (!['start', 'stop', 'restart'].includes(action)) throw bad('Action must be start, stop or restart');
  const container = db.prepare(`SELECT c.*, s.mode AS server_mode, s.docker_endpoint, s.status AS server_status
    FROM containers c JOIN servers s ON s.id = c.server_id
    WHERE c.id = ? AND s.workspace_id = ?`).get(req.params.containerId, req.workspace.id);
  if (!container) throw notFound('Container not found');
  if (container.server_mode === 'demo') {
    return res.status(409).json({
      error: 'This container belongs to a demonstration server. No container runtime is connected for it, so nothing was changed.',
      demo: true,
    });
  }
  const result = await containerAction({ docker_endpoint: container.docker_endpoint }, container.name, action);
  if (!result.ok) return res.status(502).json({ error: `Docker host rejected the command: ${result.error}` });

  const nextStatus = action === 'stop' ? 'stopped' : 'running';
  db.prepare('UPDATE containers SET status = ?, started_at = ? WHERE id = ?')
    .run(nextStatus, nextStatus === 'running' ? nowIso() : null, container.id);
  audit(req.workspace.id, container.project_id, 'container', `${container.name} ${action}ped`, req.user.name, 'warn');
  res.json({ ok: true, container: db.prepare('SELECT * FROM containers WHERE id = ?').get(container.id) });
}));

/* --------------------------------------------------------------- monitoring */
router.get('/monitoring', asyncRoute(async (req, res) => {
  const hours = Math.min(168, Math.max(1, Number(req.query.hours || 24)));
  const servers = db.prepare('SELECT * FROM servers WHERE workspace_id = ?').all(req.workspace.id);
  const streams = servers.map((server) => ({
    server: { id: server.id, name: server.name, mode: server.mode, status: server.status, provider: server.provider },
    series: series(server.id, { hours }),
  }));

  const projects = db.prepare('SELECT id, name, slug FROM projects WHERE workspace_id = ?').all(req.workspace.id);
  const databaseSizes = projects.map((p) => {
    const row = db.prepare('SELECT size_bytes, engine, status FROM databases WHERE project_id = ?').get(p.id);
    let tables = 0;
    let rows = 0;
    try {
      const conn = projectDb(p.id);
      const list = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      tables = list.length;
      rows = list.reduce((sum, t) => sum + (conn.prepare(`SELECT count(*) AS n FROM "${t.name}"`).get()?.n ?? 0), 0);
    } catch { /* ignore */ }
    return { project: p.name, slug: p.slug, engine: row?.engine ?? 'postgres', status: row?.status ?? 'unknown', size_bytes: row?.size_bytes ?? 0, size_label: formatBytes(row?.size_bytes ?? 0), tables, rows };
  });

  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const deployActivity = db.prepare(`SELECT status, count(*) AS n FROM deployments WHERE workspace_id = ? AND created_at > ? GROUP BY status`)
    .all(req.workspace.id, since);
  const errorRate = db.prepare(`SELECT level, count(*) AS n FROM logs WHERE workspace_id = ? AND ts > ? GROUP BY level`)
    .all(req.workspace.id, since);
  const queue = db.prepare("SELECT status, count(*) AS n FROM deployments WHERE workspace_id = ? AND status IN ('queued','building','deploying') GROUP BY status")
    .all(req.workspace.id);

  const recentFailures = db.prepare(`SELECT d.id, d.commit_sha, d.error, d.created_at, p.name AS project_name
    FROM deployments d JOIN projects p ON p.id = d.project_id
    WHERE d.workspace_id = ? AND d.status = 'failed' ORDER BY d.created_at DESC LIMIT 5`).all(req.workspace.id);

  const courses = [
    { name: 'API', target: 'api.redfox.app', status: 'operational', p95: 42 },
    { name: 'Build workers', target: 'worker-pool', status: queue.length ? 'degraded' : 'operational', detail: `${queue.reduce((s, q) => s + q.n, 0)} in flight` },
    { name: 'Database', target: 'postgres', status: databaseSizes.some((d) => d.status !== 'healthy') ? 'degraded' : 'operational' },
    { name: 'Object storage', target: 's3', status: 'operational' },
  ];

  res.json({
    hours, host: hostSnapshot(), servers: streams, database_sizes: databaseSizes,
    deployment_activity: deployActivity, log_levels: errorRate, queue, recent_failures: recentFailures, health: courses,
  });
}));

/* --------------------------------------------------------------------- logs */
router.get('/logs', asyncRoute(async (req, res) => {
  const { limit, page, offset } = paginate(req, 50);
  const filters = ['l.workspace_id = ?'];
  const params = [req.workspace.id];
  if (req.query.project) { filters.push('l.project_id = ?'); params.push(req.query.project); }
  if (req.query.source) { filters.push('l.source = ?'); params.push(req.query.source); }
  if (req.query.level) { filters.push('l.level = ?'); params.push(req.query.level); }
  if (req.query.mode) { filters.push('l.mode = ?'); params.push(req.query.mode); }
  if (req.query.q) { filters.push('(l.message LIKE ? OR l.path LIKE ?)'); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  if (req.query.hours) {
    filters.push('l.ts > ?');
    params.push(new Date(Date.now() - Number(req.query.hours) * 3600_000).toISOString());
  }
  const where = filters.join(' AND ');
  const total = db.prepare(`SELECT count(*) AS n FROM logs l WHERE ${where}`).get(params).n;
  const items = db.prepare(`SELECT l.*, p.name AS project_name, p.slug AS project_slug FROM logs l
    LEFT JOIN projects p ON p.id = l.project_id WHERE ${where} ORDER BY l.ts DESC LIMIT ? OFFSET ?`)
    .all([...params, limit, offset]);
  const facets = db.prepare(`SELECT source, level, count(*) AS n FROM logs WHERE workspace_id = ? GROUP BY source, level`).all(req.workspace.id);
  const projects = db.prepare('SELECT id, name, slug FROM projects WHERE workspace_id = ? ORDER BY name').all(req.workspace.id);
  res.json({ ...paged(items, total, page, limit), facets, projects });
}));

export default router;

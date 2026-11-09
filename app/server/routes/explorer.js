import { Router } from 'express';
import crypto from 'node:crypto';
import { db, nowIso, projectDb } from '../db.js';
import { requireAuth, workspaceContext, requireRole } from '../auth.js';
import { asyncRoute, bad, notFound, requireFields } from '../util.js';
import { id, apiKeyHash } from '../crypto.js';

const router = Router();

const ENDPOINTS = [
  { group: 'Projects', method: 'GET', path: '/api/projects', description: 'List projects in the active workspace', body: null },
  { group: 'Projects', method: 'GET', path: '/api/projects/{slug}', description: 'Project detail with repository, deployments and database', body: null },
  { group: 'Deployments', method: 'GET', path: '/api/deployments?limit=5', description: 'Recent deployments with status and commit', body: null },
  { group: 'Deployments', method: 'POST', path: '/api/deployments', description: 'Queue a deployment for a project', body: { project: 'atlas-web', environment: 'preview', branch: 'main' } },
  { group: 'Deployments', method: 'GET', path: '/api/deployments/{id}/logs', description: 'Build log lines for a deployment', body: null },
  { group: 'Git', method: 'GET', path: '/api/repos', description: 'List repositories with head commit', body: null },
  { group: 'Git', method: 'GET', path: '/api/repos/{id}/tree?branch=main', description: 'Browse a repository tree', body: null },
  { group: 'Database', method: 'GET', path: '/api/database?project=atlas-web', description: 'Tables, columns and row counts', body: null },
  { group: 'Database', method: 'POST', path: '/api/database/{project}/sql', description: 'Run SQL against a project database', body: { sql: 'select count(*) as n from leads', mode: 'read' } },
  { group: 'Observability', method: 'GET', path: '/api/logs?limit=20&level=error', description: 'Filtered runtime and build logs', body: null },
  { group: 'Infrastructure', method: 'GET', path: '/api/servers', description: 'Servers with live host metrics', body: null },
  { group: 'Data API', method: 'GET', path: '/v1/{project}/{table}?limit=5', description: 'Public data API. Requires a project API key in the apikey header.', body: null, public: true },
];

router.use(requireAuth, workspaceContext);

router.get('/explorer/endpoints', asyncRoute(async (req, res) => {
  const projects = db.prepare('SELECT id, name, slug FROM projects WHERE workspace_id = ? ORDER BY name').all(req.workspace.id);
  res.json({ endpoints: ENDPOINTS, base_url: `${req.protocol}://${req.get('host')}`, projects, role: req.role });
}));

router.post('/explorer/request', asyncRoute(async (req, res) => {
  const { method = 'GET', path: target, body } = req.body || {};
  requireFields(req.body || {}, ['path']);
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(String(method).toUpperCase())) throw bad('Unsupported method');
  const path = String(target);
  if (!path.startsWith('/api/') && !path.startsWith('/v1/')) throw bad('The explorer can only call Redfox API paths starting with /api/ or /v1/');
  if (path.includes('..')) throw bad('Invalid path');

  const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
  const started = Date.now();
  try {
    const response = await fetch(base + path, {
      method: String(method).toUpperCase(),
      headers: {
        'content-type': 'application/json',
        cookie: req.headers.cookie || '',
        ...(req.body.api_key ? { apikey: req.body.api_key } : {}),
      },
      body: ['GET', 'HEAD'].includes(String(method).toUpperCase()) || !body ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    res.json({
      status: response.status,
      status_text: response.statusText,
      duration_ms: Date.now() - started,
      size_bytes: Buffer.byteLength(text),
      headers: Object.fromEntries([...response.headers.entries()].filter(([k]) => k !== 'set-cookie')),
      body: json ?? text.slice(0, 20000),
      raw: json ? null : text.slice(0, 20000),
      url: path,
      method: String(method).toUpperCase(),
    });
  } catch (error) {
    res.status(502).json({ error: `Request failed: ${error.message}`, duration_ms: Date.now() - started });
  }
}));

/* ---------------------------------------------------------------- api keys */
router.get('/explorer/keys', asyncRoute(async (req, res) => {
  const projectKey = req.query.project;
  const params = [req.workspace.id];
  let filter = '';
  if (projectKey) { filter = ' AND p.slug = ?'; params.push(projectKey); }
  const keys = db.prepare(`SELECT k.id, k.name, k.prefix, k.scopes, k.last_used, k.created_at, p.name AS project_name, p.slug AS project_slug
    FROM api_keys k JOIN projects p ON p.id = k.project_id
    WHERE p.workspace_id = ?${filter} ORDER BY k.created_at DESC`).all(params);
  res.json({ keys, role: req.role });
}));

router.post('/explorer/keys', requireRole('developer'), asyncRoute(async (req, res) => {
  const { project, name, scopes = 'read' } = req.body || {};
  requireFields(req.body || {}, ['project', 'name']);
  const proj = db.prepare('SELECT * FROM projects WHERE workspace_id = ? AND (id = ? OR slug = ?)')
    .get(req.workspace.id, project, project);
  if (!proj) throw bad('Project not found');
  if (!/^(read|read,write)$/.test(scopes)) throw bad('Scopes must be "read" or "read,write"');
  const raw = `rf_live_${proj.slug.replace(/-/g, '')}_${crypto.randomBytes(12).toString('base64url').replace(/[-_]/g, '')}`;
  const keyId = id('key');
  db.prepare('INSERT INTO api_keys (id, project_id, name, prefix, key_hash, scopes, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(keyId, proj.id, String(name).slice(0, 60), raw.slice(0, 14), apiKeyHash(raw), scopes, nowIso());
  res.status(201).json({ key: raw, id: keyId, scopes, warning: 'This is the only time the full key is shown.' });
}));

router.delete('/explorer/keys/:keyId', requireRole('developer'), asyncRoute(async (req, res) => {
  const key = db.prepare(`SELECT k.* FROM api_keys k JOIN projects p ON p.id = k.project_id
    WHERE k.id = ? AND p.workspace_id = ?`).get(req.params.keyId, req.workspace.id);
  if (!key) throw notFound('Key not found');
  db.prepare('DELETE FROM api_keys WHERE id = ?').run(key.id);
  res.json({ ok: true });
}));

export default router;

/* ============================================================ public data API */
export const dataRouter = Router();

function authenticateDataApi(req) {
  const raw = req.get('apikey') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!raw) return { error: 'Missing apikey header' };
  const key = db.prepare('SELECT * FROM api_keys WHERE key_hash = ?').get(apiKeyHash(raw));
  if (!key) return { error: 'Invalid API key' };
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(key.project_id);
  return { key, project };
}

const parseFilters = (query, columns) => {
  const where = [];
  const params = [];
  for (const [key, value] of Object.entries(query)) {
    if (['limit', 'offset', 'order', 'select'].includes(key)) continue;
    const column = columns.find((c) => c.name === key);
    if (!column) continue;
    const [op, ...rest] = String(value).split('.');
    const raw = rest.join('.');
    const operators = { eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=' };
    if (operators[op]) {
      where.push(`"${key}" ${operators[op]} ?`);
      params.push(raw);
    } else if (op === 'like') {
      where.push(`"${key}" LIKE ?`);
      params.push(raw);
    } else {
      where.push(`"${key}" = ?`);
      params.push(String(value));
    }
  }
  return { where, params };
};

dataRouter.get('/:project/:table', asyncRoute(async (req, res) => {
  const auth = authenticateDataApi(req);
  if (auth.error) return res.status(401).json({ error: auth.error, hint: 'Create a key from API Explorer in Redfox.' });
  const { project, key } = auth;
  if (project.slug !== req.params.project) {
    return res.status(403).json({ error: 'This API key belongs to a different project' });
  }
  const conn = projectDb(project.id);
  const table = String(req.params.table);
  const exists = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!exists) return res.status(404).json({ error: `Table "${table}" does not exist`, tables: conn.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name) });

  const columns = conn.prepare(`PRAGMA table_info("${table}")`).all();
  const { where, params } = parseFilters(req.query, columns);
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 500);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const orderCol = String(req.query.order || '').split('.');
  const orderBy = orderCol[0] && columns.some((c) => c.name === orderCol[0])
    ? ` ORDER BY "${orderCol[0]}" ${orderCol[1] === 'desc' ? 'DESC' : 'ASC'}`
    : '';
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const total = conn.prepare(`SELECT count(*) AS n FROM "${table}"${whereSql}`).get(params).n;
  const rows = conn.prepare(`SELECT * FROM "${table}"${whereSql}${orderBy} LIMIT ? OFFSET ?`).all([...params, limit, offset]);

  db.prepare('UPDATE api_keys SET last_used = ? WHERE id = ?').run(nowIso(), key.id);
  res.setHeader('content-range', `${offset}-${offset + rows.length - 1}/${total}`);
  res.setHeader('x-redfox-project', project.slug);
  res.json(rows);
}));

dataRouter.post('/:project/:table', asyncRoute(async (req, res) => {
  const auth = authenticateDataApi(req);
  if (auth.error) return res.status(401).json({ error: auth.error });
  if (!auth.key.scopes.includes('write')) return res.status(403).json({ error: 'This API key is read-only' });
  const { project } = auth;
  if (project.slug !== req.params.project) return res.status(403).json({ error: 'API key belongs to a different project' });
  const conn = projectDb(project.id);
  const table = String(req.params.table);
  const exists = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!exists) return res.status(404).json({ error: `Table "${table}" does not exist` });
  const columns = conn.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  const keys = Object.keys(payload).filter((k) => columns.includes(k));
  if (!keys.length) return res.status(400).json({ error: 'No matching columns in payload', columns });
  const info = conn.prepare(`INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
    .run(keys.map((k) => payload[k]));
  db.prepare('UPDATE api_keys SET last_used = ? WHERE id = ?').run(nowIso(), auth.key.id);
  res.status(201).json({ ok: true, last_insert_rowid: info.lastInsertRowid, changes: info.changes });
}));

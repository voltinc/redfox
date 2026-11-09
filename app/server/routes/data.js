import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, nowIso, projectDb, DATA_DIR } from '../db.js';
import { requireAuth, workspaceContext, requireRole, loadProject, audit } from '../auth.js';
import { asyncRoute, bad, notFound, requireFields, conflict, paged, paginate, formatBytes } from '../util.js';
import { id, sha } from '../crypto.js';
import { describeSchema } from '../services/analysis.js';

const router = Router();
router.use(requireAuth, workspaceContext);

/* ================================================================ DATABASE */
const READ_STATEMENTS = /^\s*(select|with|pragma|explain)\b/i;

router.get('/database', loadProject, asyncRoute(async (req, res) => {
  const conn = projectDb(req.project.id);
  const meta = db.prepare('SELECT * FROM databases WHERE project_id = ?').get(req.project.id);
  const tables = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const detail = tables.map((t) => {
    const columns = conn.prepare(`PRAGMA table_info("${t.name}")`).all()
      .map((c) => ({ name: c.name, type: c.type, pk: !!c.pk, notnull: !!c.notnull, default: c.dflt_value }));
    const rows = conn.prepare(`SELECT count(*) AS n FROM "${t.name}"`).get().n;
    return { name: t.name, rows, columns };
  });
  const fileSize = fs.existsSync(meta?.file_path ? path.resolve(meta.file_path) : '')
    ? fs.statSync(path.resolve(meta.file_path)).size
    : 0;
  const projects = db.prepare('SELECT id, name, slug FROM projects WHERE workspace_id = ? ORDER BY name').all(req.workspace.id);
  res.json({
    project: { id: req.project.id, name: req.project.name, slug: req.project.slug },
    projects,
    meta: meta ? { ...meta, size_bytes: fileSize, size_label: formatBytes(fileSize) } : null,
    tables: detail,
    total_rows: detail.reduce((sum, t) => sum + t.rows, 0),
    role: req.role,
    can_write: ['owner', 'admin', 'developer'].includes(req.role),
  });
}));

router.get('/database/:project/tables/:table/rows', loadProject, asyncRoute(async (req, res) => {
  const conn = projectDb(req.project.id);
  const table = String(req.params.table);
  const exists = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!exists) throw notFound(`Table "${table}" does not exist in this project database`);
  const { limit, page, offset } = paginate(req, 25);
  const columns = conn.prepare(`PRAGMA table_info("${table}")`).all();
  const orderBy = req.query.order && columns.some((c) => c.name === String(req.query.order).replace('-', ''))
    ? `"${String(req.query.order).replace('-', '')}" ${String(req.query.order).startsWith('-') ? 'DESC' : 'ASC'}`
    : null;
  let where = '';
  const params = [];
  if (req.query.q) {
    const textCols = columns.filter((c) => /text|char/i.test(c.type));
    if (textCols.length) {
      where = ` WHERE ${textCols.map((c) => `"${c.name}" LIKE ?`).join(' OR ')}`;
      params.push(...textCols.map(() => `%${req.query.q}%`));
    }
  }
  const total = conn.prepare(`SELECT count(*) AS n FROM "${table}"${where}`).get(params).n;
  const rows = conn.prepare(`SELECT * FROM "${table}"${where}${orderBy ? ` ORDER BY ${orderBy}` : ''} LIMIT ? OFFSET ?`)
    .all([...params, limit, offset]);
  res.json({ ...paged(rows, total, page, limit), columns, table, primary_key: columns.find((c) => c.pk)?.name ?? null });
}));

router.get('/database/:project/schema', loadProject, asyncRoute(async (req, res) => {
  const conn = projectDb(req.project.id);
  const schema = describeSchema(conn, req.project);
  const ddl = conn.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  res.json({ ...schema, ddl });
}));

router.post('/database/:project/sql', loadProject, asyncRoute(async (req, res) => {
  const { sql, mode = 'read' } = req.body || {};
  requireFields(req.body || {}, ['sql']);
  const statement = String(sql).trim().replace(/;\s*$/, '');
  if (!statement) throw bad('Write a statement to run');
  if (statement.includes(';')) throw bad('Run one statement at a time. Remove the extra semicolon.');
  const isRead = READ_STATEMENTS.test(statement);
  if (!isRead && mode !== 'write') throw bad('This statement modifies data. Switch the run mode to write to execute it.');
  if (!isRead && !['owner', 'admin', 'developer'].includes(req.role)) {
    throw new (await import('../util.js')).HttpError(403, 'Your role is read-only for this project database');
  }
  const conn = projectDb(req.project.id);
  const started = process.hrtime.bigint();
  try {
    if (isRead) {
      const rows = conn.prepare(statement).all();
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      return res.json({
        kind: 'rows', rows, row_count: rows.length,
        columns: rows.length ? Object.keys(rows[0]) : [],
        duration_ms: Math.round(durationMs * 100) / 100,
      });
    }
    const info = conn.prepare(statement).run();
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    audit(req.workspace.id, req.project.id, 'database', `SQL write executed on ${req.project.slug}: ${statement.slice(0, 120)}`, req.user.name, 'warn');
    return res.json({ kind: 'mutation', changes: info.changes, last_insert_rowid: info.lastInsertRowid, duration_ms: Math.round(durationMs * 100) / 100 });
  } catch (error) {
    return res.status(400).json({ error: `Query failed: ${error.message}`, sql: statement });
  }
}));

router.get('/database/:project/connection', loadProject, asyncRoute(async (req, res) => {
  const meta = db.prepare('SELECT * FROM databases WHERE project_id = ?').get(req.project.id);
  res.json({
    connection: {
      engine: meta?.engine ?? 'postgres',
      version: meta?.engine_version ?? '16.3',
      host: `${req.project.slug}.db.internal`,
      port: 5432,
      database: req.project.slug.replace(/-/g, '_'),
      user: `${req.project.slug.replace(/-/g, '_')}_app`,
      ssl: 'required',
      pooler: `${req.project.slug}.pooler.redfox.app:6543`,
      note: 'Passwords are held in the platform secret store and are never returned to the browser. Inject DATABASE_URL through project environment variables.',
    },
    postgrest: {
      url: `https://${req.project.slug}.api.redfox.app/rest/v1`,
      schema: 'public',
      auth: 'apikey header with a project API key',
    },
  });
}));

/* ----------------------------------------------------------------- STORAGE */
const SIGNING_KEY = 'redfox-storage-signing';

router.get('/storage', asyncRoute(async (req, res) => {
  const projects = db.prepare('SELECT id, name, slug FROM projects WHERE workspace_id = ? ORDER BY name').all(req.workspace.id);
  const projectFilter = req.query.project
    ? projects.find((p) => p.slug === req.query.project || p.id === req.query.project)
    : null;
  const scoped = projectFilter ? [projectFilter] : projects;
  const buckets = [];
  for (const project of scoped) {
    for (const bucket of db.prepare('SELECT * FROM buckets WHERE project_id = ? ORDER BY name').all(project.id)) {
      const stats = db.prepare('SELECT count(*) AS files, COALESCE(sum(size),0) AS bytes FROM objects WHERE bucket_id = ?').get(bucket.id);
      buckets.push({ ...bucket, project, file_count: stats.files, size_bytes: stats.bytes, size_label: formatBytes(stats.bytes) });
    }
  }
  const totalBytes = buckets.reduce((sum, b) => sum + b.size_bytes, 0);
  res.json({ buckets, projects, total_bytes: totalBytes, total_label: formatBytes(totalBytes), role: req.role });
}));

router.get('/storage/:bucketId/objects', asyncRoute(async (req, res) => {
  const bucket = db.prepare(`SELECT b.*, p.workspace_id, p.name AS project_name, p.slug AS project_slug FROM buckets b
    JOIN projects p ON p.id = b.project_id WHERE b.id = ? AND p.workspace_id = ?`).get(req.params.bucketId, req.workspace.id);
  if (!bucket) throw notFound('Bucket not found');
  const prefix = String(req.query.path || '').replace(/^\/+|\/+$/g, '');
  const all = db.prepare('SELECT * FROM objects WHERE bucket_id = ? ORDER BY path ASC').all(bucket.id);
  const items = prefix ? all.filter((o) => o.path.startsWith(`${prefix}/`)) : all;
  res.json({
    bucket, items: items.map((o) => ({ ...o, size_label: formatBytes(o.size) })),
    folders: [...new Set(items.map((o) => (o.path.includes('/') ? o.path.split('/')[0] : null)).filter(Boolean))],
    role: req.role,
  });
}));

router.post('/storage/buckets', requireRole('developer'), asyncRoute(async (req, res) => {
  const { project, name, visibility = 'private' } = req.body || {};
  requireFields(req.body || {}, ['project', 'name']);
  if (!['private', 'public'].includes(visibility)) throw bad('Visibility must be private or public');
  const proj = db.prepare('SELECT * FROM projects WHERE workspace_id = ? AND (id = ? OR slug = ?)').get(req.workspace.id, project, project);
  if (!proj) throw bad('Project not found');
  const bucketName = String(name).toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  if (!bucketName) throw bad('Bucket name must contain letters or numbers');
  if (db.prepare('SELECT 1 FROM buckets WHERE project_id = ? AND name = ?').get(proj.id, bucketName)) {
    throw conflict('A bucket with that name already exists in this project');
  }
  const bucketId = id('bkt');
  db.prepare('INSERT INTO buckets (id, project_id, name, visibility, created_at) VALUES (?,?,?,?,?)')
    .run(bucketId, proj.id, bucketName, visibility, nowIso());
  audit(req.workspace.id, proj.id, 'storage', `Bucket ${bucketName} created`, req.user.name);
  res.status(201).json({ bucket: db.prepare('SELECT * FROM buckets WHERE id = ?').get(bucketId) });
}));

router.patch('/storage/buckets/:bucketId', requireRole('developer'), asyncRoute(async (req, res) => {
  const bucket = db.prepare(`SELECT b.* FROM buckets b JOIN projects p ON p.id = b.project_id
    WHERE b.id = ? AND p.workspace_id = ?`).get(req.params.bucketId, req.workspace.id);
  if (!bucket) throw notFound('Bucket not found');
  const { visibility } = req.body || {};
  if (!['private', 'public'].includes(visibility)) throw bad('Visibility must be private or public');
  db.prepare('UPDATE buckets SET visibility = ? WHERE id = ?').run(visibility, bucket.id);
  res.json({ ok: true });
}));

router.delete('/storage/buckets/:bucketId', requireRole('developer'), asyncRoute(async (req, res) => {
  const bucket = db.prepare(`SELECT b.* FROM buckets b JOIN projects p ON p.id = b.project_id
    WHERE b.id = ? AND p.workspace_id = ?`).get(req.params.bucketId, req.workspace.id);
  if (!bucket) throw notFound('Bucket not found');
  const count = db.prepare('SELECT count(*) AS n FROM objects WHERE bucket_id = ?').get(bucket.id).n;
  if (count > 0) throw conflict(`Bucket is not empty (${count} objects). Delete its files first.`);
  db.prepare('DELETE FROM buckets WHERE id = ?').run(bucket.id);
  fs.rmSync(path.join(DATA_DIR, 'storage', bucket.id), { recursive: true, force: true });
  audit(req.workspace.id, bucket.project_id, 'storage', `Bucket ${bucket.name} deleted`, req.user.name, 'warn');
  res.json({ ok: true });
}));

router.post('/storage/:bucketId/upload', requireRole('developer'),
  asyncRoute(async (req, res) => {
    const bucket = db.prepare(`SELECT b.* FROM buckets b JOIN projects p ON p.id = b.project_id
      WHERE b.id = ? AND p.workspace_id = ?`).get(req.params.bucketId, req.workspace.id);
    if (!bucket) throw notFound('Bucket not found');
    const filePath = String(req.query.path || req.get('x-file-name') || '').trim().replace(/^\/+/, '');
    if (!filePath || filePath.includes('..')) throw bad('A safe file path is required');
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) throw bad('Upload body is empty');
    if (body.length > 25 * 1024 * 1024) throw bad('Files are limited to 25 MB in this installation');

    const target = path.join(DATA_DIR, 'storage', bucket.id, filePath);
    if (!path.resolve(target).startsWith(path.resolve(DATA_DIR, 'storage', bucket.id))) throw bad('Invalid path');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);

    const existing = db.prepare('SELECT * FROM objects WHERE bucket_id = ? AND path = ?').get(bucket.id, filePath);
    const checksum = crypto.createHash('sha256').update(body).digest('hex').slice(0, 32);
    const mime = req.get('content-type') || 'application/octet-stream';
    if (existing) {
      db.prepare('UPDATE objects SET size = ?, mime = ?, checksum = ?, created_at = ? WHERE id = ?')
        .run(body.length, mime, checksum, nowIso(), existing.id);
      return res.json({ object: db.prepare('SELECT * FROM objects WHERE id = ?').get(existing.id), replaced: true });
    }
    const objectId = id('obj');
    db.prepare('INSERT INTO objects (id, bucket_id, path, size, mime, checksum, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(objectId, bucket.id, filePath, body.length, mime, checksum, nowIso());
    audit(req.workspace.id, bucket.project_id, 'storage', `Uploaded ${filePath} to ${bucket.name}`, req.user.name);
    res.status(201).json({ object: db.prepare('SELECT * FROM objects WHERE id = ?').get(objectId), replaced: false });
  }));

router.delete('/storage/objects/:objectId', requireRole('developer'), asyncRoute(async (req, res) => {
  const object = db.prepare(`SELECT o.*, b.project_id FROM objects o JOIN buckets b ON b.id = o.bucket_id
    JOIN projects p ON p.id = b.project_id WHERE o.id = ? AND p.workspace_id = ?`).get(req.params.objectId, req.workspace.id);
  if (!object) throw notFound('Object not found');
  fs.rmSync(path.join(DATA_DIR, 'storage', object.bucket_id, object.path), { force: true });
  db.prepare('DELETE FROM objects WHERE id = ?').run(object.id);
  audit(req.workspace.id, object.project_id, 'storage', `Deleted ${object.path}`, req.user.name, 'warn');
  res.json({ ok: true });
}));

function sign(objectId, expires) {
  return crypto.createHmac('sha256', SIGNING_KEY).update(`${objectId}:${expires}`).digest('hex').slice(0, 32);
}

router.post('/storage/objects/:objectId/signed', asyncRoute(async (req, res) => {
  const object = db.prepare(`SELECT o.* FROM objects o JOIN buckets b ON b.id = o.bucket_id
    JOIN projects p ON p.id = b.project_id WHERE o.id = ? AND p.workspace_id = ?`).get(req.params.objectId, req.workspace.id);
  if (!object) throw notFound('Object not found');
  const expires = Date.now() + 5 * 60000;
  res.json({ url: `/api/storage/signed/${object.id}?expires=${expires}&sig=${sign(object.id, expires)}`, expires_in: 300 });
}));

/* Signed storage URLs are intentionally unauthenticated: the HMAC and expiry in
   the URL are the credential. Mounted before the session middleware. */
export const publicStorageRouter = Router();
publicStorageRouter.get('/storage/signed/:objectId', asyncRoute(async (req, res) => {
  const { expires, sig } = req.query;
  if (!expires || !sig || Number(expires) < Date.now()) return res.status(410).json({ error: 'This signed URL has expired' });
  if (sign(req.params.objectId, Number(expires)) !== sig) return res.status(403).json({ error: 'Invalid signature' });
  const object = db.prepare('SELECT * FROM objects WHERE id = ?').get(req.params.objectId);
  if (!object) throw notFound('Object not found');
  const file = path.join(DATA_DIR, 'storage', object.bucket_id, object.path);
  if (!fs.existsSync(file)) throw notFound('File is missing from storage');
  res.setHeader('content-type', object.mime);
  res.sendFile(file);
}));

router.get('/storage/objects/:objectId/content', asyncRoute(async (req, res) => {
  const object = db.prepare(`SELECT o.* FROM objects o JOIN buckets b ON b.id = o.bucket_id
    JOIN projects p ON p.id = b.project_id WHERE o.id = ? AND p.workspace_id = ?`).get(req.params.objectId, req.workspace.id);
  if (!object) throw notFound('Object not found');
  const file = path.join(DATA_DIR, 'storage', object.bucket_id, object.path);
  if (!fs.existsSync(file)) throw notFound('File is missing from storage');
  res.setHeader('content-type', object.mime);
  res.setHeader('content-disposition', `inline; filename="${path.basename(object.path)}"`);
  res.sendFile(file);
}));

export default router;

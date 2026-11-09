import { db, nowIso } from './db.js';
import { id, verifyPassword } from './crypto.js';

export const SESSION_COOKIE = 'redfox_session';
const SESSION_DAYS = 14;

export function createSession(userId) {
  const sid = id('sess');
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_DAYS * 864e5);
  db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .run(sid, userId, created.toISOString(), expires.toISOString());
  return { sid, expires };
}

export function destroySession(sid) {
  if (sid) db.prepare('DELETE FROM sessions WHERE id = ?').run(sid);
}

export function userFromSession(sid) {
  if (!sid) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    destroySession(sid);
    return null;
  }
  const user = db.prepare('SELECT id, email, name, avatar_color, created_at FROM users WHERE id = ?').get(session.user_id);
  return user || null;
}

export function attemptLogin(email, password) {
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(String(email || '').trim());
  if (!user) return null;
  if (!verifyPassword(String(password || ''), user.password_hash)) return null;
  return { id: user.id, email: user.email, name: user.name, avatar_color: user.avatar_color };
}

/* --- middleware ---------------------------------------------------------- */
export function attachUser(req, _res, next) {
  req.user = userFromSession(req.cookies?.[SESSION_COOKIE]);
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

/* Resolve the workspace the request acts on, and the caller's role in it. */
export function workspaceContext(req, res, next) {
  const slugOrId = req.params.workspace || req.query.workspace || req.get('x-redfox-workspace');
  const membershipRows = db.prepare(`
    SELECT m.workspace_id, m.role, w.slug, w.name, w.plan, w.region
    FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = ? ORDER BY w.created_at ASC
  `).all(req.user.id);
  if (!membershipRows.length) return res.status(403).json({ error: 'No workspace membership' });
  const wanted = slugOrId
    ? membershipRows.find((m) => m.slug === slugOrId || m.workspace_id === slugOrId)
    : membershipRows[0];
  if (!wanted) return res.status(404).json({ error: 'Workspace not found' });
  req.workspace = { id: wanted.workspace_id, slug: wanted.slug, name: wanted.name, plan: wanted.plan, region: wanted.region };
  req.role = wanted.role;
  req.workspaces = membershipRows.map((m) => ({ id: m.workspace_id, slug: m.slug, name: m.name, role: m.role, plan: m.plan }));
  next();
}

const RANK = { viewer: 1, developer: 2, admin: 3, owner: 4 };

export function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.role || RANK[req.role] < RANK[minRole]) {
      return res.status(403).json({
        error: `Your role (${req.role}) cannot perform this action. Requires ${minRole} or higher.`,
      });
    }
    next();
  };
}

/* Resolve ?project= or :projectId and assert it belongs to the workspace. */
export function loadProject(req, res, next) {
  const key = req.params.projectId || req.params.project || req.query.project || req.body?.project_id || req.body?.project;
  if (!key) return res.status(400).json({ error: 'Project is required' });
  const project = db.prepare('SELECT * FROM projects WHERE workspace_id = ? AND (id = ? OR slug = ?)')
    .get(req.workspace.id, key, key);
  if (!project) return res.status(404).json({ error: 'Project not found in this workspace' });
  req.project = project;
  next();
}

export function audit(workspaceId, projectId, type, message, actor = 'system', level = 'info') {
  db.prepare(`INSERT INTO events (id, workspace_id, project_id, type, level, actor, message, created_at)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(id('evt'), workspaceId, projectId || null, type, level, actor, message, nowIso());
}

export function notify(userId, title, body, href, level = 'info') {
  db.prepare(`INSERT INTO notifications (id, user_id, title, body, href, level, created_at)
              VALUES (?,?,?,?,?,?,?)`)
    .run(id('ntf'), userId, title, body || null, href || null, level, nowIso());
}

import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { attemptLogin, createSession, destroySession, SESSION_COOKIE, requireAuth, workspaceContext } from '../auth.js';
import { asyncRoute, bad } from '../util.js';
import { providerInfo } from '../services/llm.js';
import { hashPassword, verifyPassword } from '../crypto.js';

const router = Router();

router.post('/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw bad('Email and password are required');
  const user = attemptLogin(email, password);
  if (!user) return res.status(401).json({ error: 'Incorrect email or password' });
  const { sid, expires } = createSession(user.id);
  res.cookie(SESSION_COOKIE, sid, { httpOnly: true, sameSite: 'lax', expires, path: '/' });
  res.json({ user });
}));

router.post('/auth/logout', asyncRoute(async (req, res) => {
  destroySession(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
}));

router.get('/auth/me', requireAuth, workspaceContext, asyncRoute(async (req, res) => {
  const unread = db.prepare('SELECT count(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(req.user.id).n;
  res.json({
    user: req.user,
    workspace: req.workspace,
    role: req.role,
    workspaces: req.workspaces,
    notifications: { unread },
    llm: providerInfo(),
    server: { version: '0.9.0', data_dir: 'local', build: process.env.NODE_ENV || 'development' },
  });
}));

router.get('/account', requireAuth, asyncRoute(async (req, res) => {
  const sessions = db.prepare('SELECT id, created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ user: req.user, sessions });
}));

router.patch('/account', requireAuth, asyncRoute(async (req, res) => {
  const { name, avatar_color } = req.body || {};
  if (name !== undefined) {
    if (!String(name).trim()) throw bad('Name cannot be empty');
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(name).trim().slice(0, 80), req.user.id);
  }
  if (avatar_color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(avatar_color)) throw bad('Avatar colour must be a hex value like #E4593B');
    db.prepare('UPDATE users SET avatar_color = ? WHERE id = ?').run(avatar_color, req.user.id);
  }
  res.json({ user: db.prepare('SELECT id, email, name, avatar_color FROM users WHERE id = ?').get(req.user.id) });
}));

router.post('/account/password', requireAuth, asyncRoute(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  const stored = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(String(current_password || ''), stored.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  if (!new_password || String(new_password).length < 8) throw bad('New password must be at least 8 characters');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(new_password)), req.user.id);
  res.json({ ok: true });
}));

router.post('/account/sessions/revoke', requireAuth, asyncRoute(async (req, res) => {
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(req.user.id, req.cookies?.[SESSION_COOKIE] || '');
  res.json({ ok: true });
}));

export default router;

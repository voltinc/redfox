import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { attemptLogin, createSession, destroySession, SESSION_COOKIE, requireAuth, workspaceContext } from '../auth.js';
import { asyncRoute, bad } from '../util.js';
import { providerInfo } from '../services/llm.js';
import { hashPassword, verifyPassword } from '../crypto.js';
import { enforceRateLimit } from '../rate-limit.js';
import {
  acceptInvite, createAccount, inviteByToken, inviteSummary, validateSignup,
} from '../services/identity.js';
import { audit } from '../auth.js';

const router = Router();

router.post('/auth/login', asyncRoute(async (req, res) => {
  if (!enforceRateLimit(req, res, { name: 'login', limit: 20, windowMs: 15 * 60_000 })) return;
  const { email, password } = req.body || {};
  if (!email || !password) throw bad('Email and password are required');
  const user = attemptLogin(email, password);
  if (!user) return res.status(401).json({ error: 'Incorrect email or password' });
  const { sid, expires } = createSession(user.id);
  res.cookie(SESSION_COOKIE, sid, { httpOnly: true, sameSite: 'lax', expires, path: '/' });
  res.json({ user });
}));


/* ------------------------------------------------------------------ signup */
router.post('/auth/register', asyncRoute(async (req, res) => {
  if (process.env.REDFOX_SIGNUP === 'closed') {
    return res.status(403).json({ error: 'Signups are closed on this instance' });
  }
  if (!enforceRateLimit(req, res, { name: 'register', limit: 10, windowMs: 60 * 60_000 })) return;
  const { invite_token: inviteToken } = req.body || {};
  const invite = inviteToken ? inviteByToken(inviteToken) : null;

  const { errors, values } = validateSignup(req.body || {});
  if (invite?.email && values.email && invite.email.toLowerCase() !== values.email) {
    errors.email = `This invitation was sent to ${invite.email}`;
  }
  if (Object.keys(errors).length) {
    return res.status(422).json({ error: 'Check the highlighted fields', fields: errors });
  }

  const { user, workspace } = createAccount({
    name: values.name,
    email: values.email,
    password: values.password,
    workspaceName: invite ? undefined : values.workspaceName,
  });

  let joined = null;
  if (invite) {
    joined = acceptInvite({ token: inviteToken, userId: user.id });
    /* The workspace created during signup is redundant when the account joins an
       existing one, so it is removed rather than left as an empty husk. */
    if (joined.workspace.id !== workspace.id && db.prepare('SELECT count(*) AS n FROM memberships WHERE workspace_id = ?').get(workspace.id).n === 1) {
      db.prepare('DELETE FROM memberships WHERE workspace_id = ? AND user_id = ?').run(workspace.id, user.id);
      db.prepare('DELETE FROM workspaces WHERE id = ?').run(workspace.id);
    }
  }

  const { sid, expires } = createSession(user.id);
  res.cookie(SESSION_COOKIE, sid, { httpOnly: true, sameSite: 'lax', expires, path: '/' });
  audit(joined?.workspace.id || workspace.id, null, 'identity', `Account created for ${user.email}`, user.name);
  res.status(201).json({ user, workspace: joined?.workspace || workspace, role: joined?.role || 'owner' });
}));

/* -------------------------------------------------------------- invitations */
router.get('/invites/:token', asyncRoute(async (req, res) => {
  res.json(inviteSummary(req.params.token));
}));

router.post('/invites/:token/accept', requireAuth, workspaceContext, asyncRoute(async (req, res) => {
  const result = acceptInvite({ token: req.params.token, userId: req.user.id });
  res.json(result);
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
    if (!/^#[0-9a-fA-F]{6}$/.test(avatar_color)) throw bad('Avatar colour must be a hex value like #FF7000');
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

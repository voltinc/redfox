/* Account creation, workspace bootstrap and invitations.

   Everything here writes real rows: a user, a workspace or membership, and an
   audit entry. New accounts start empty on purpose. There is no sample project
   attached to a signup, so the first thing a new team sees is its own data. */

import crypto from 'node:crypto';
import { db, nowIso } from '../db.js';
import { id, hashPassword } from '../crypto.js';
import { bad, conflict, notFound, slugify } from '../util.js';

export const INVITE_TTL_DAYS = 14;

const RESERVED = new Set([
  'admin', 'api', 'app', 'auth', 'billing', 'blog', 'dashboard', 'docs', 'help',
  'login', 'logout', 'mail', 'new', 'root', 'security', 'settings', 'signup',
  'status', 'support', 'system', 'team', 'www',
]);

export function normaliseEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function validateSignup({ name, email, password, workspaceName, workspace }) {
  const errors = {};
  const cleanName = String(name || '').trim();
  if (cleanName.length < 2) errors.name = 'Enter your full name';
  else if (cleanName.length > 80) errors.name = 'Keep the name under 80 characters';

  const cleanEmail = normaliseEmail(email);
  if (!cleanEmail) errors.email = 'Enter your work email';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) errors.email = 'That email address does not look right';
  else if (db.prepare('SELECT 1 FROM users WHERE lower(email) = ?').get(cleanEmail)) errors.email = 'An account already exists with that email';

  const secret = String(password || '');
  if (secret.length < 10) errors.password = 'Use at least 10 characters';
  else if (secret.length > 200) errors.password = 'Keep the password under 200 characters';
  else if (/^[a-z]+$/i.test(secret)) errors.password = 'Add a number or symbol';
  else if (/^(password|1234567890|qwertyuiop)/i.test(secret)) errors.password = 'That password is too common';
  else if (cleanEmail && secret.toLowerCase().includes(cleanEmail.split('@')[0])) errors.password = 'Do not use your email address as the password';

  const cleanWorkspace = String(workspaceName || workspace || '').trim();
  if (cleanWorkspace && cleanWorkspace.length > 60) errors.workspace = 'Keep the workspace name under 60 characters';

  return { errors, values: { name: cleanName, email: cleanEmail, password: secret, workspaceName: cleanWorkspace } };
}

export function uniqueWorkspaceSlug(preferred) {
  const base = slugify(preferred) || 'workspace';
  if (!RESERVED.has(base) && !db.prepare('SELECT 1 FROM workspaces WHERE slug = ?').get(base)) return base;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `${base}-${crypto.randomBytes(2).toString('hex')}`;
    if (!db.prepare('SELECT 1 FROM workspaces WHERE slug = ?').get(candidate)) return candidate;
  }
  return `${base}-${crypto.randomBytes(4).toString('hex')}`;
}

export function createWorkspaceFor({ userId, workspaceName, name, region = 'eu-west-1' }) {
  const display = workspaceName || `${name.split(' ')[0]}'s workspace`;
  const slug = uniqueWorkspaceSlug(display);
  const wsId = id('ws');
  const now = nowIso();
  db.prepare('INSERT INTO workspaces (id, slug, name, plan, region, created_at) VALUES (?,?,?,?,?,?)')
    .run(wsId, slug, display, 'free', region, now);
  db.prepare('INSERT INTO memberships (id, workspace_id, user_id, role, created_at) VALUES (?,?,?,?,?)')
    .run(id('mem'), wsId, userId, 'owner', now);
  return db.prepare('SELECT * FROM workspaces WHERE id = ?').get(wsId);
}

export function createAccount({ name, email, password, workspaceName, avatarColor }) {
  const existed = db.prepare('SELECT 1 FROM users WHERE lower(email) = ?').get(email);
  if (existed) throw conflict('An account already exists with that email');
  const userId = id('usr');
  db.prepare('INSERT INTO users (id, email, name, password_hash, avatar_color, created_at) VALUES (?,?,?,?,?,?)')
    .run(userId, email, name, hashPassword(password), avatarColor || '#E4593B', nowIso());
  const user = db.prepare('SELECT id, email, name, avatar_color FROM users WHERE id = ?').get(userId);
  const workspace = createWorkspaceFor({ userId, workspaceName, name });
  db.prepare('INSERT INTO notifications (id, user_id, title, body, href, level, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id('ntf'), userId, 'Welcome to Redfox', `Create your first project in ${workspace.name} to get a repository, database and URL.`, '/projects/new', 'success', nowIso());
  return { user, workspace };
}

/* --- invitations ---------------------------------------------------------- */

export function createInvite({ workspaceId, userId, email, role }) {
  const cleanEmail = email ? normaliseEmail(email) : null;
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) throw bad('Enter a valid email address');
  if (cleanEmail) {
    const member = db.prepare(`SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = ? AND lower(u.email) = ?`).get(workspaceId, cleanEmail);
    if (member) throw bad('That person is already in this workspace');
  }
  const token = crypto.randomBytes(24).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + INVITE_TTL_DAYS * 864e5);
  const inviteId = id('inv');
  db.prepare(`INSERT INTO invites (id, workspace_id, email, role, token, invited_by, created_at, expires_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(inviteId, workspaceId, cleanEmail, role || 'developer', token, userId, now.toISOString(), expires.toISOString());
  return db.prepare('SELECT * FROM invites WHERE id = ?').get(inviteId);
}

export function listInvites(workspaceId) {
  return db.prepare(`SELECT i.*, u.name AS invited_by_name, u.email AS invited_by_email
    FROM invites i LEFT JOIN users u ON u.id = i.invited_by
    WHERE i.workspace_id = ? ORDER BY i.created_at DESC`).all(workspaceId)
    .map((invite) => ({
      ...invite,
      token: undefined,
      state: invite.accepted_at ? 'accepted' : new Date(invite.expires_at) < new Date() ? 'expired' : 'pending',
    }));
}

export function inviteByToken(token) {
  const invite = db.prepare('SELECT * FROM invites WHERE token = ?').get(String(token || ''));
  if (!invite) throw notFound('That invitation link is not valid');
  if (invite.accepted_at) throw bad('That invitation has already been used');
  if (new Date(invite.expires_at) < new Date()) throw bad('That invitation has expired');
  return invite;
}

export function inviteSummary(token) {
  const invite = db.prepare('SELECT * FROM invites WHERE token = ?').get(String(token || ''));
  if (!invite) return { valid: false, reason: 'not_found' };
  if (invite.accepted_at) return { valid: false, reason: 'accepted' };
  if (new Date(invite.expires_at) < new Date()) return { valid: false, reason: 'expired' };
  const workspace = db.prepare('SELECT name, slug, region FROM workspaces WHERE id = ?').get(invite.workspace_id);
  const inviter = db.prepare('SELECT name, email FROM users WHERE id = ?').get(invite.invited_by);
  const existing = db.prepare('SELECT id, email, name FROM users WHERE lower(email) = ?').get(invite.email || '');
  return {
    valid: true,
    workspace,
    role: invite.role,
    email: invite.email,
    inviter: inviter ? { name: inviter.name, email: inviter.email } : null,
    has_account: Boolean(existing),
  };
}

export function acceptInvite({ token, userId }) {
  const invite = inviteByToken(token);
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(userId);
  if (!user) throw notFound('Account not found');
  if (invite.email && normaliseEmail(invite.email) !== normaliseEmail(user.email)) {
    throw bad(`This invitation was sent to ${invite.email}. Sign in with that address to accept it.`);
  }
  const already = db.prepare('SELECT 1 FROM memberships WHERE workspace_id = ? AND user_id = ?').get(invite.workspace_id, user.id);
  const now = nowIso();
  if (!already) {
    db.prepare('INSERT INTO memberships (id, workspace_id, user_id, role, created_at) VALUES (?,?,?,?,?)')
      .run(id('mem'), invite.workspace_id, user.id, invite.role, now);
  }
  db.prepare('UPDATE invites SET accepted_at = ?, accepted_by = ? WHERE id = ?').run(now, user.id, invite.id);
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(invite.workspace_id);
  return { workspace, role: invite.role, already_member: Boolean(already) };
}

import { Router } from 'express';
import crypto from 'node:crypto';
import { db, nowIso } from '../db.js';
import { requireAuth, workspaceContext, requireRole, audit } from '../auth.js';
import { asyncRoute, bad, notFound, slugify, requireFields, conflict, paged, paginate } from '../util.js';
import { id, sha } from '../crypto.js';
import { enqueue } from '../services/deployEngine.js';

const router = Router();

function repoOr404(repoId, workspaceId) {
  const repo = db.prepare('SELECT * FROM repositories WHERE id = ? AND workspace_id = ?').get(repoId, workspaceId);
  if (!repo) throw notFound('Repository not found');
  return repo;
}

const gitSha = (seed) => crypto.createHash('sha1').update(`${seed}:${Date.now()}:${Math.random()}`).digest('hex');

/* ------------------------------------------------------------------ listing */
router.get('/repos', requireAuth, workspaceContext, asyncRoute(async (req, res) => {
  const repos = db.prepare('SELECT * FROM repositories WHERE workspace_id = ? ORDER BY created_at ASC').all(req.workspace.id);
  const items = repos.map((repo) => {
    const head = db.prepare('SELECT * FROM commits WHERE repository_id = ? ORDER BY committed_at DESC LIMIT 1').get(repo.id);
    const project = repo.project_id ? db.prepare('SELECT name, slug, id FROM projects WHERE id = ?').get(repo.project_id) : null;
    return {
      ...repo,
      branch_count: db.prepare('SELECT count(*) AS n FROM branches WHERE repository_id = ?').get(repo.id).n,
      commit_count: db.prepare('SELECT count(*) AS n FROM commits WHERE repository_id = ?').get(repo.id).n,
      file_count: db.prepare("SELECT count(*) AS n FROM repo_files WHERE repository_id = ? AND kind = 'file'").get(repo.id).n,
      head_commit: head || null,
      project,
    };
  });
  const projects = db.prepare('SELECT id, name, slug FROM projects WHERE workspace_id = ? ORDER BY name').all(req.workspace.id);
  res.json({ repositories: items, projects, role: req.role });
}));

router.post('/repos', requireAuth, workspaceContext, requireRole('developer'), asyncRoute(async (req, res) => {
  const body = req.body || {};
  requireFields(body, ['name']);
  const slug = slugify(body.slug || body.name);
  if (!slug) throw bad('Repository name must contain letters or numbers');
  if (db.prepare('SELECT 1 FROM repositories WHERE workspace_id = ? AND slug = ?').get(req.workspace.id, slug)) {
    throw conflict(`A repository named "${slug}" already exists`);
  }
  if (body.visibility && !['private', 'public'].includes(body.visibility)) throw bad('Visibility must be private or public');
  const repoId = id('repo');
  const now = nowIso();
  db.prepare(`INSERT INTO repositories (id, workspace_id, project_id, name, slug, description, visibility, default_branch,
    integration, remote_url, webhook_secret, webhook_url, webhook_events, webhook_active, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    repoId, req.workspace.id, body.project_id || null, String(body.name).trim(), slug,
    body.description || null, body.visibility || 'private', 'main', 'native',
    `http://localhost:3000/git/${slug}.git`, sha('whsec'), '', '["push","pull_request"]', 1, now,
  );
  db.prepare('INSERT INTO branches (id, repository_id, name, head_sha, is_default, protected, updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(id('brn'), repoId, 'main', null, 1, 1, now);

  if (body.init_readme !== false) {
    const readme = `# ${body.name}\n\n${body.description || 'Created in Redfox.'}\n`;
    commitFile({
      repoId, branch: 'main', path: 'README.md', content: readme,
      message: 'chore: initial commit', author: req.user, status: 'added',
    });
  }
  audit(req.workspace.id, body.project_id || null, 'git', `Repository ${slug} created`, req.user.name);
  res.status(201).json({ repository: db.prepare('SELECT * FROM repositories WHERE id = ?').get(repoId) });
}));

/* ------------------------------------------------------ one repository views */
router.get('/repos/:repoId', requireAuth, workspaceContext, asyncRoute(async (req, res) => {
  const repo = repoOr404(req.params.repoId, req.workspace.id);
  const branches = db.prepare('SELECT * FROM branches WHERE repository_id = ? ORDER BY is_default DESC, name ASC').all(repo.id);
  const branch = req.query.branch || repo.default_branch;
  const commits = db.prepare('SELECT * FROM commits WHERE repository_id = ? AND branch = ? ORDER BY committed_at DESC LIMIT 20').all(repo.id, branch);
  const head = db.prepare('SELECT * FROM commits WHERE repository_id = ? AND branch = ? ORDER BY committed_at DESC LIMIT 1').get(repo.id, branch);
  const project = repo.project_id ? db.prepare('SELECT id, name, slug, framework, runner FROM projects WHERE id = ?').get(repo.project_id) : null;
  const fileCount = db.prepare("SELECT count(*) AS n FROM repo_files WHERE repository_id = ? AND branch = ? AND kind = 'file'").get(repo.id, branch).n;
  res.json({
    repository: repo,
    project,
    branches,
    branch,
    head,
    commits,
    files: fileCount,
    role: req.role,
    can_write: ['owner', 'admin', 'developer'].includes(req.role),
  });
}));

router.get('/repos/:repoId/tree', requireAuth, workspaceContext, asyncRoute(async (req, res) => {
  const repo = repoOr404(req.params.repoId, req.workspace.id);
  const branch = req.query.branch || repo.default_branch;
  const dir = String(req.query.path || '').replace(/^\/+|\/+$/g, '');
  const all = db.prepare('SELECT path, kind, size FROM repo_files WHERE repository_id = ? AND branch = ?').all(repo.id, branch);
  const prefix = dir ? `${dir}/` : '';
  const seen = new Map();
  for (const entry of all) {
    if (!entry.path.startsWith(prefix)) continue;
    const rest = entry.path.slice(prefix.length);
    if (!rest) continue;
    const top = rest.split('/')[0];
    const isDir = rest.includes('/');
    if (!seen.has(top) || (isDir && seen.get(top).kind !== 'dir')) {
      seen.set(top, { name: top, path: prefix + top, kind: isDir ? 'dir' : entry.kind, size: isDir ? null : entry.size });
    }
  }
  const entries = [...seen.values()].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1));
  res.json({ branch, path: dir, entries, branches: db.prepare('SELECT name FROM branches WHERE repository_id = ? ORDER BY name').all(repo.id).map((b) => b.name) });
}));

router.get('/repos/:repoId/file', requireAuth, workspaceContext, asyncRoute(async (req, res) => {
  const repo = repoOr404(req.params.repoId, req.workspace.id);
  const branch = req.query.branch || repo.default_branch;
  const filePath = String(req.query.path || '');
  if (!filePath) throw bad('A file path is required');
  const file = db.prepare("SELECT * FROM repo_files WHERE repository_id = ? AND branch = ? AND path = ? AND kind = 'file'")
    .get(repo.id, branch, filePath);
  if (!file) throw notFound(`No file at ${filePath} on ${branch}`);
  const commits = db.prepare(`SELECT c.sha, c.message, c.author_name, c.committed_at, cf.additions, cf.deletions
    FROM commits c JOIN commit_files cf ON cf.commit_id = c.id
    WHERE c.repository_id = ? AND cf.path = ? ORDER BY c.committed_at DESC LIMIT 10`).all(repo.id, filePath);
  const language = filePath.endsWith('.ts') || filePath.endsWith('.tsx') ? 'ts'
    : filePath.endsWith('.js') || filePath.endsWith('.mjs') ? 'js'
      : filePath.endsWith('.sql') ? 'sql'
        : filePath.endsWith('.json') ? 'json'
          : filePath.endsWith('.md') ? 'md'
            : filePath.endsWith('.css') ? 'css'
              : filePath.endsWith('.astro') ? 'html'
                : filePath.endsWith('.tsx') ? 'tsx' : 'text';
  res.json({ file: { ...file, content: file.content ?? '' }, language, history: commits, branch });
}));

router.get('/repos/:repoId/commits', requireAuth, workspaceContext, asyncRoute(async (req, res) => {
  const repo = repoOr404(req.params.repoId, req.workspace.id);
  const { limit, page, offset } = paginate(req, 30);
  const branch = req.query.branch || repo.default_branch;
  const total = db.prepare('SELECT count(*) AS n FROM commits WHERE repository_id = ? AND branch = ?').get(repo.id, branch).n;
  const items = db.prepare('SELECT * FROM commits WHERE repository_id = ? AND branch = ? ORDER BY committed_at DESC LIMIT ? OFFSET ?')
    .all(repo.id, branch, limit, offset);
  res.json(paged(items, total, page, limit));
}));

router.get('/repos/:repoId/commits/:commitSha', requireAuth, workspaceContext, asyncRoute(async (req, res) => {
  const repo = repoOr404(req.params.repoId, req.workspace.id);
  const commit = db.prepare('SELECT * FROM commits WHERE repository_id = ? AND sha = ?').get(repo.id, req.params.commitSha);
  if (!commit) throw notFound('Commit not found');
  const files = db.prepare('SELECT * FROM commit_files WHERE commit_id = ?').all(commit.id);
  const deployments = db.prepare('SELECT id, status, environment, created_at FROM deployments WHERE project_id = ? AND commit_sha = ?')
    .all(repo.project_id || '', commit.sha);
  res.json({ commit, files, deployments, repository: repo });
}));

/* --------------------------------------------------------------- write paths */
export function commitFile({ repoId, branch, path, content, message, author, status = 'modified' }) {
  const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(repoId);
  const existing = db.prepare('SELECT * FROM repo_files WHERE repository_id = ? AND branch = ? AND path = ?').get(repoId, branch, path);
  const now = nowIso();
  const newSha = gitSha(`${repoId}:${path}`);
  const added = existing ? Math.max(0, (content.match(/\n/g) || []).length) : content.split('\n').length;
  const commitId = id('cmt');

  db.prepare(`INSERT INTO commits (id, repository_id, sha, branch, message, author_name, author_email, parent_sha,
    additions, deletions, files_changed, committed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    commitId, repoId, newSha, branch, message, author.name, author.email,
    db.prepare('SELECT head_sha FROM branches WHERE repository_id = ? AND name = ?').get(repoId, branch)?.head_sha ?? null,
    added, status === 'added' ? 0 : 1, 1, now,
  );
  db.prepare('INSERT INTO commit_files (id, commit_id, path, status, additions, deletions, patch) VALUES (?,?,?,?,?,?,?)')
    .run(id('cf'), commitId, path, status, added, status === 'added' ? 0 : 1,
      `@@ -0,0 +1,${Math.min(added, 40)} @@\n${content.split('\n').slice(0, 40).map((l) => `+${l}`).join('\n')}`);

  if (existing) {
    db.prepare('UPDATE repo_files SET content = ?, size = ?, updated_at = ? WHERE id = ?')
      .run(content, Buffer.byteLength(content), now, existing.id);
  } else {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/');
      db.prepare('INSERT OR IGNORE INTO repo_files (id, repository_id, branch, path, kind, content, size, updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(id('fil'), repoId, branch, dir, 'dir', null, 0, now);
    }
    db.prepare('INSERT INTO repo_files (id, repository_id, branch, path, kind, content, size, updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(id('fil'), repoId, branch, path, 'file', content, Buffer.byteLength(content), now);
  }
  const branchRow = db.prepare('SELECT * FROM branches WHERE repository_id = ? AND name = ?').get(repoId, branch);
  if (branchRow) db.prepare('UPDATE branches SET head_sha = ?, updated_at = ? WHERE id = ?').run(newSha, now, branchRow.id);
  else db.prepare('INSERT INTO branches (id, repository_id, name, head_sha, is_default, protected, updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(id('brn'), repoId, branch, newSha, 0, 0, now);

  audit(repo.workspace_id, repo.project_id, 'git', `Commit ${newSha.slice(0, 7)} on ${repo.slug}/${branch}: ${message}`, author.name);
  return { sha: newSha, commitId };
}

router.post('/repos/:repoId/contents', requireAuth, workspaceContext, requireRole('developer'), asyncRoute(async (req, res) => {
  const repo = repoOr404(req.params.repoId, req.workspace.id);
  const { branch = repo.default_branch, path: filePath, content, message } = req.body || {};
  requireFields(req.body || {}, ['path', 'content', 'message']);
  if (String(filePath).startsWith('/') || String(filePath).includes('..')) throw bad('File paths must stay inside the repository');
  const existing = db.prepare("SELECT id FROM repo_files WHERE repository_id = ? AND branch = ? AND path = ? AND kind = 'file'")
    .get(repo.id, branch, filePath);
  const result = commitFile({
    repoId: repo.id, branch, path: String(filePath), content: String(content),
    message: String(message).slice(0, 200), author: req.user, status: existing ? 'modified' : 'added',
  });
  res.status(201).json({ commit: db.prepare('SELECT * FROM commits WHERE id = ?').get(result.commitId) });
}));

router.post('/repos/:repoId/branches', requireAuth, workspaceContext, requireRole('developer'), asyncRoute(async (req, res) => {
  const repo = repoOr404(req.params.repoId, req.workspace.id);
  const { name, from } = req.body || {};
  requireFields(req.body || {}, ['name']);
  const branchName = String(name).trim().replace(/\s+/g, '-');
  if (!/^[A-Za-z0-9._\/-]{1,60}$/.test(branchName)) throw bad('Branch names use letters, numbers, dots, dashes and slashes');
  if (db.prepare('SELECT 1 FROM branches WHERE repository_id = ? AND name = ?').get(repo.id, branchName)) {
    throw conflict(`Branch "${branchName}" already exists`);
  }
  const source = from || repo.default_branch;
  const sourceFiles = db.prepare('SELECT * FROM repo_files WHERE repository_id = ? AND branch = ?').all(repo.id, source);
  const now = nowIso();
  for (const file of sourceFiles) {
    db.prepare('INSERT INTO repo_files (id, repository_id, branch, path, kind, content, size, updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(id('fil'), repo.id, branchName, file.path, file.kind, file.content, file.size, now);
  }
  const head = db.prepare('SELECT * FROM commits WHERE repository_id = ? AND branch = ? ORDER BY committed_at DESC LIMIT 1').get(repo.id, source);
  db.prepare('INSERT INTO branches (id, repository_id, name, head_sha, is_default, protected, updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(id('brn'), repo.id, branchName, head?.sha ?? null, 0, 0, now);
  audit(req.workspace.id, repo.project_id, 'git', `Branch ${branchName} created from ${source}`, req.user.name);
  res.status(201).json({ branch: db.prepare('SELECT * FROM branches WHERE repository_id = ? AND name = ?').get(repo.id, branchName) });
}));

router.delete('/repos/:repoId/branches/:name', requireAuth, workspaceContext, requireRole('developer'), asyncRoute(async (req, res) => {
  const repo = repoOr404(req.params.repoId, req.workspace.id);
  const branch = db.prepare('SELECT * FROM branches WHERE repository_id = ? AND name = ?').get(repo.id, req.params.name);
  if (!branch) throw notFound('Branch not found');
  if (branch.is_default) throw bad('The default branch cannot be deleted');
  db.prepare('DELETE FROM branches WHERE id = ?').run(branch.id);
  db.prepare('DELETE FROM repo_files WHERE repository_id = ? AND branch = ?').run(repo.id, branch.name);
  audit(req.workspace.id, repo.project_id, 'git', `Branch ${branch.name} deleted`, req.user.name, 'warn');
  res.json({ ok: true });
}));

router.patch('/repos/:repoId', requireAuth, workspaceContext, requireRole('developer'), asyncRoute(async (req, res) => {
  const repo = repoOr404(req.params.repoId, req.workspace.id);
  const { description, visibility, default_branch, project_id } = req.body || {};
  if (visibility && !['private', 'public'].includes(visibility)) throw bad('Visibility must be private or public');
  if (default_branch && !db.prepare('SELECT 1 FROM branches WHERE repository_id = ? AND name = ?').get(repo.id, default_branch)) {
    throw bad('Default branch must be an existing branch');
  }
  if (project_id) {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(project_id, req.workspace.id);
    if (!project) throw bad('Project not found in this workspace');
  }
  db.prepare('UPDATE repositories SET description = ?, visibility = ?, default_branch = ?, project_id = ? WHERE id = ?').run(
    description ?? repo.description, visibility ?? repo.visibility, default_branch ?? repo.default_branch,
    project_id === null ? null : (project_id ?? repo.project_id), repo.id,
  );
  audit(req.workspace.id, repo.project_id, 'git', `Repository settings updated for ${repo.slug}`, req.user.name);
  res.json({ repository: db.prepare('SELECT * FROM repositories WHERE id = ?').get(repo.id) });
}));

/* ------------------------------------------------------------------- webhook */
router.get('/repos/:repoId/webhook', requireAuth, workspaceContext, asyncRoute(async (req, res) => {
  const repo = repoOr404(req.params.repoId, req.workspace.id);
  res.json({
    webhook: {
      url: repo.webhook_url || `${req.protocol}://${req.get('host')}/api/webhooks/git/${repo.id}`,
      events: JSON.parse(repo.webhook_events || '[]'),
      active: !!repo.webhook_active,
      secret_configured: !!repo.webhook_secret,
      secret_preview: repo.webhook_secret ? `${repo.webhook_secret.slice(0, 10)}${'•'.repeat(10)}` : null,
    },
    remote: { url: repo.remote_url, integration: repo.integration },
  });
}));

router.patch('/repos/:repoId/webhook', requireAuth, workspaceContext, requireRole('admin'), asyncRoute(async (req, res) => {
  const repo = repoOr404(req.params.repoId, req.workspace.id);
  const { url, events, active } = req.body || {};
  if (events && (!Array.isArray(events) || events.some((e) => !['push', 'pull_request'].includes(e)))) {
    throw bad('Supported events are push and pull_request');
  }
  db.prepare('UPDATE repositories SET webhook_url = ?, webhook_events = ?, webhook_active = ? WHERE id = ?').run(
    url ?? repo.webhook_url, JSON.stringify(events ?? JSON.parse(repo.webhook_events || '[]')),
    active === undefined ? repo.webhook_active : (active ? 1 : 0), repo.id,
  );
  res.json({ ok: true });
}));

router.post('/repos/:repoId/webhook/test', requireAuth, workspaceContext, requireRole('admin'), asyncRoute(async (req, res) => {
  const repo = repoOr404(req.params.repoId, req.workspace.id);
  if (!repo.webhook_url) throw bad('Set a webhook URL before sending a test delivery');
  const payload = { event: 'ping', repository: repo.slug, zen: 'Redfox webhook test delivery', sent_at: nowIso() };
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(repo.webhook_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-redfox-event': 'ping', 'x-redfox-signature': `sha256=${crypto.createHmac('sha256', repo.webhook_secret || '').update(JSON.stringify(payload)).digest('hex')}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.json({ delivered: response.ok, status: response.status, duration_ms: Date.now() - started, url: repo.webhook_url });
  } catch (error) {
    return res.json({ delivered: false, error: error.message, duration_ms: Date.now() - started, url: repo.webhook_url });
  }
}));

/* -------------------------------------------------- inbound git webhook (public) */
const hookRouter = Router();
hookRouter.post('/webhooks/git/:repoId', asyncRoute(async (req, res) => {
  const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(req.params.repoId);
  if (!repo) return res.status(404).json({ error: 'Unknown repository' });
  if (!repo.webhook_active) return res.status(409).json({ error: 'Webhook is disabled for this repository' });

  const signature = req.get('x-redfox-signature') || '';
  const raw = JSON.stringify(req.body || {});
  const expected = `sha256=${crypto.createHmac('sha256', repo.webhook_secret || '').update(raw).digest('hex')}`;
  if (repo.webhook_secret && signature) {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Signature mismatch' });
    }
  }
  const event = req.get('x-redfox-event') || req.body?.event || 'push';
  if (event === 'ping') return res.json({ ok: true, event: 'ping' });

  const commitSha = req.body?.after || req.body?.commit || null;
  const branch = (req.body?.ref || '').replace('refs/heads/', '') || repo.default_branch;
  const project = repo.project_id ? db.prepare('SELECT * FROM projects WHERE id = ?').get(repo.project_id) : null;
  if (!project) return res.json({ ok: true, ignored: 'Repository is not connected to a project' });

  const commit = commitSha
    ? db.prepare('SELECT * FROM commits WHERE repository_id = ? AND sha = ?').get(repo.id, commitSha)
    : db.prepare('SELECT * FROM commits WHERE repository_id = ? AND branch = ? ORDER BY committed_at DESC LIMIT 1').get(repo.id, branch);

  const isProduction = branch === project.production_branch && project.status !== 'paused';
  const depId = id('dpl');
  db.prepare(`INSERT INTO deployments (id, project_id, workspace_id, environment, status, mode, commit_sha, commit_message,
    branch, trigger, actor, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    depId, project.id, repo.workspace_id, isProduction ? 'production' : 'preview', 'queued', project.runner,
    commit?.sha ?? commitSha, commit?.message ?? req.body?.message ?? 'Push received', branch, 'git', 'webhook', nowIso(),
  );
  audit(repo.workspace_id, project.id, 'deployment', `Webhook push on ${repo.slug}/${branch} queued deployment`, 'webhook');
  enqueue(depId);
  res.status(202).json({ ok: true, deployment_id: depId, environment: isProduction ? 'production' : 'preview' });
}));

export { hookRouter };
export default router;

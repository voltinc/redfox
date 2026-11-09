import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, nowIso, DATA_DIR } from '../db.js';
import { requireAuth, workspaceContext, requireRole, loadProject, audit } from '../auth.js';
import { asyncRoute, bad, notFound, paged, paginate } from '../util.js';
import { id } from '../crypto.js';
import { enqueue, cancel, bus, deploymentLogs, queueDepth } from '../services/deployEngine.js';
import { analyzeDeployment } from '../services/analysis.js';

const router = Router();
router.use(requireAuth, workspaceContext);

const STATUSES = ['queued', 'building', 'deploying', 'ready', 'failed', 'cancelled'];

router.get('/deployments', asyncRoute(async (req, res) => {
  const { limit, page, offset } = paginate(req, 20);
  const filters = ['d.workspace_id = ?'];
  const params = [req.workspace.id];
  if (req.query.project) { filters.push('p.slug = ?'); params.push(req.query.project); }
  if (req.query.status && STATUSES.includes(req.query.status)) { filters.push('d.status = ?'); params.push(req.query.status); }
  if (req.query.environment) { filters.push('d.environment = ?'); params.push(req.query.environment); }
  if (req.query.q) { filters.push('(d.commit_message LIKE ? OR d.commit_sha LIKE ? OR d.id LIKE ?)'); params.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`); }
  const where = filters.join(' AND ');
  const total = db.prepare(`SELECT count(*) AS n FROM deployments d JOIN projects p ON p.id = d.project_id WHERE ${where}`).get(params).n;
  const items = db.prepare(`SELECT d.*, p.name AS project_name, p.slug AS project_slug
    FROM deployments d JOIN projects p ON p.id = d.project_id
    WHERE ${where} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`).all([...params, limit, offset]);
  const projects = db.prepare('SELECT id, name, slug FROM projects WHERE workspace_id = ? ORDER BY name').all(req.workspace.id);
  res.json({ ...paged(items, total, page, limit), projects, queue: queueDepth(), role: req.role });
}));

router.post('/deployments', requireRole('developer'), loadProject, asyncRoute(async (req, res) => {
  const { environment = 'production', branch, trigger = 'manual' } = req.body || {};
  if (!['production', 'preview'].includes(environment)) throw bad('Environment must be production or preview');
  if (req.project.status === 'archived') throw bad('Archived projects cannot be deployed');
  const repo = db.prepare('SELECT * FROM repositories WHERE project_id = ?').get(req.project.id);
  if (!repo) throw bad('Connect a repository to this project before deploying');

  /* Preview deployments follow the repository's default branch unless a branch
     is named explicitly, so a fresh project never fails on a missing branch. */
  const targetBranch = branch
    || (environment === 'production' ? req.project.production_branch : (repo.default_branch || req.project.production_branch));
  const branchRow = db.prepare('SELECT * FROM branches WHERE repository_id = ? AND name = ?').get(repo.id, targetBranch);
  if (!branchRow) throw bad(`Branch "${targetBranch}" does not exist in ${repo.name}. Available branches: ${db.prepare('SELECT name FROM branches WHERE repository_id = ?').all(repo.id).map((b) => b.name).join(', ')}`);
  const commit = db.prepare('SELECT * FROM commits WHERE repository_id = ? AND sha = ?').get(repo.id, branchRow.head_sha)
    || db.prepare('SELECT * FROM commits WHERE repository_id = ? ORDER BY committed_at DESC LIMIT 1').get(repo.id);

  const depId = id('dpl');
  db.prepare(`INSERT INTO deployments (id, project_id, workspace_id, environment, status, mode, commit_sha, commit_message,
    branch, trigger, actor, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    depId, req.project.id, req.workspace.id, environment, 'queued', req.project.runner,
    commit?.sha ?? null, commit?.message ?? 'No commit resolved',
    targetBranch, trigger, req.user.name, nowIso(),
  );
  audit(req.workspace.id, req.project.id, 'deployment', `Deployment queued for ${environment} (${targetBranch})`, req.user.name);
  enqueue(depId);
  res.status(201).json({ deployment: db.prepare('SELECT * FROM deployments WHERE id = ?').get(depId) });
}));

router.get('/deployments/:deploymentId', asyncRoute(async (req, res) => {
  const deployment = db.prepare(`SELECT d.*, p.name AS project_name, p.slug AS project_slug, p.framework, p.runner,
    p.build_command, p.output_dir, p.install_command
    FROM deployments d JOIN projects p ON p.id = d.project_id
    WHERE d.id = ? AND d.workspace_id = ?`).get(req.params.deploymentId, req.workspace.id);
  if (!deployment) throw notFound('Deployment not found');
  const repo = db.prepare('SELECT id, name, slug FROM repositories WHERE project_id = ?').get(deployment.project_id);
  const commit = deployment.commit_sha && repo
    ? db.prepare('SELECT * FROM commits WHERE repository_id = ? AND sha = ?').get(repo.id, deployment.commit_sha)
    : null;
  const logs = db.prepare('SELECT * FROM deployment_logs WHERE deployment_id = ? ORDER BY seq ASC').all(deployment.id);
  const previous = db.prepare(`SELECT id, created_at, status FROM deployments WHERE project_id = ? AND environment = ?
    AND created_at < ? ORDER BY created_at DESC LIMIT 1`).get(deployment.project_id, deployment.environment, deployment.created_at);
  res.json({
    deployment,
    repository: repo || null,
    commit: commit || null,
    logs,
    previous,
    artifact: deployment.artifact_dir && fs.existsSync(deployment.artifact_dir)
      ? { available: true, path: deployment.artifact_dir, public_url: `/preview/${deployment.id}/` }
      : { available: false },
    role: req.role,
  });
}));

router.get('/deployments/:deploymentId/logs', asyncRoute(async (req, res) => {
  const deployment = db.prepare('SELECT id, status FROM deployments WHERE id = ? AND workspace_id = ?')
    .get(req.params.deploymentId, req.workspace.id);
  if (!deployment) throw notFound('Deployment not found');
  const afterSeq = Number(req.query.after ?? -1);
  res.json({
    status: deployment.status,
    logs: deploymentLogs(deployment.id, { afterSeq, limit: Number(req.query.limit ?? 2000) }),
  });
}));

router.get('/deployments/:deploymentId/stream', asyncRoute(async (req, res) => {
  const deployment = db.prepare('SELECT id, status FROM deployments WHERE id = ? AND workspace_id = ?')
    .get(req.params.deploymentId, req.workspace.id);
  if (!deployment) throw notFound('Deployment not found');

  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const history = deploymentLogs(deployment.id);
  send('snapshot', { status: deployment.status, logs: history });

  const channel = `dep:${deployment.id}`;
  const listener = (payload) => {
    if (payload.type === 'log') send('log', payload.log);
    if (payload.type === 'status') send('status', { status: payload.status });
  };
  bus.on(channel, listener);

  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15000);
  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off(channel, listener);
    res.end();
  });
}));

router.post('/deployments/:deploymentId/cancel', requireRole('developer'), asyncRoute(async (req, res) => {
  const deployment = db.prepare('SELECT * FROM deployments WHERE id = ? AND workspace_id = ?')
    .get(req.params.deploymentId, req.workspace.id);
  if (!deployment) throw notFound('Deployment not found');
  if (!['queued', 'building', 'deploying'].includes(deployment.status)) {
    throw bad(`Only queued, building or deploying deployments can be cancelled. This one is ${deployment.status}.`);
  }
  const ok = cancel(deployment.id);
  audit(req.workspace.id, deployment.project_id, 'deployment', `Deployment ${deployment.id} cancelled`, req.user.name, 'warn');
  res.json({ ok });
}));

router.post('/deployments/:deploymentId/redeploy', requireRole('developer'), asyncRoute(async (req, res) => {
  const deployment = db.prepare('SELECT * FROM deployments WHERE id = ? AND workspace_id = ?')
    .get(req.params.deploymentId, req.workspace.id);
  if (!deployment) throw notFound('Deployment not found');
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(deployment.project_id);
  const depId = id('dpl');
  db.prepare(`INSERT INTO deployments (id, project_id, workspace_id, environment, status, mode, commit_sha, commit_message,
    branch, trigger, actor, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    depId, project.id, req.workspace.id, deployment.environment, 'queued', project.runner,
    deployment.commit_sha, deployment.commit_message, deployment.branch, 'redeploy', req.user.name, nowIso(),
  );
  enqueue(depId);
  audit(req.workspace.id, project.id, 'deployment', `Redeploy of ${deployment.commit_sha?.slice(0, 7)} queued`, req.user.name);
  res.status(201).json({ deployment: db.prepare('SELECT * FROM deployments WHERE id = ?').get(depId) });
}));

router.post('/deployments/:deploymentId/rollback', requireRole('developer'), asyncRoute(async (req, res) => {
  const deployment = db.prepare('SELECT d.*, p.slug AS project_slug FROM deployments d JOIN projects p ON p.id = d.project_id WHERE d.id = ? AND d.workspace_id = ?')
    .get(req.params.deploymentId, req.workspace.id);
  if (!deployment) throw notFound('Deployment not found');
  if (deployment.status !== 'ready') throw bad('Only a ready deployment can be promoted or rolled back to');
  if (!deployment.artifact_dir || !fs.existsSync(deployment.artifact_dir)) {
    throw bad('This deployment has no stored artifact in this installation, so it cannot be promoted directly. Redeploy the commit instead.');
  }
  const newId = id('dpl');
  const artifactDir = path.join(DATA_DIR, 'deployments', newId);
  fs.rmSync(artifactDir, { recursive: true, force: true });
  fs.cpSync(deployment.artifact_dir, artifactDir, { recursive: true });
  db.prepare(`INSERT INTO deployments (id, project_id, workspace_id, environment, status, mode, commit_sha, commit_message,
    branch, trigger, actor, url, artifact_dir, image, created_at, started_at, finished_at, duration_ms)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    newId, deployment.project_id, req.workspace.id, deployment.environment, 'ready', deployment.mode,
    deployment.commit_sha, `Rollback to ${deployment.commit_sha?.slice(0, 7)}: ${deployment.commit_message}`,
    deployment.branch, 'rollback', req.user.name, `/preview/${newId}/`, artifactDir, deployment.image,
    nowIso(), nowIso(), nowIso(), 0,
  );
  db.prepare('INSERT INTO deployment_logs (id, deployment_id, seq, ts, level, phase, message) VALUES (?,?,?,?,?,?,?)')
    .run(id('dl'), newId, 0, nowIso(), 'info', 'publish', `Promoted stored artifact from ${deployment.id} (${deployment.commit_sha?.slice(0, 7)})`);
  db.prepare('INSERT INTO deployment_logs (id, deployment_id, seq, ts, level, phase, message) VALUES (?,?,?,?,?,?,?)')
    .run(id('dl'), newId, 1, nowIso(), 'info', 'routing', 'Routing updated to the promoted artifact');
  audit(req.workspace.id, deployment.project_id, 'deployment', `Rollback to ${deployment.commit_sha?.slice(0, 7)} promoted`, req.user.name, 'warn');
  res.status(201).json({ deployment: db.prepare('SELECT * FROM deployments WHERE id = ?').get(newId) });
}));

router.post('/deployments/:deploymentId/promote', requireRole('developer'), asyncRoute(async (req, res) => {
  const deployment = db.prepare('SELECT d.*, p.runner FROM deployments d JOIN projects p ON p.id = d.project_id WHERE d.id = ? AND d.workspace_id = ?')
    .get(req.params.deploymentId, req.workspace.id);
  if (!deployment) throw notFound('Deployment not found');
  if (deployment.environment === 'production') throw bad('This deployment is already in production');
  const newId = id('dpl');
  db.prepare(`INSERT INTO deployments (id, project_id, workspace_id, environment, status, mode, commit_sha, commit_message,
    branch, trigger, actor, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    newId, deployment.project_id, req.workspace.id, 'production', 'queued', deployment.runner || deployment.mode,
    deployment.commit_sha, deployment.commit_message, deployment.branch, 'promote', req.user.name, nowIso(),
  );
  enqueue(newId);
  audit(req.workspace.id, deployment.project_id, 'deployment', `Preview ${deployment.id} promoted to production`, req.user.name);
  res.status(201).json({ deployment: db.prepare('SELECT * FROM deployments WHERE id = ?').get(newId) });
}));

router.get('/deployments/:deploymentId/analysis', asyncRoute(async (req, res) => {
  const deployment = db.prepare('SELECT id FROM deployments WHERE id = ? AND workspace_id = ?')
    .get(req.params.deploymentId, req.workspace.id);
  if (!deployment) throw notFound('Deployment not found');
  const analysis = analyzeDeployment(deployment.id);
  res.json({ analysis, source: 'local' });
}));

export default router;

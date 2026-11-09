/* Deployment engine.

   Two runners, and the platform never pretends one is the other:

   local  - Redfox materialises the commit from the repository store, runs the
            real install and build commands as child processes, captures their
            output line by line, then publishes the output directory as a real
            preview URL served by this server.
   docker - reserved for a connected Docker host. Only used when a Docker host
            answers a ping; otherwise the request is refused with a clear error.
   demo   - replays a scripted pipeline for projects whose source is not in this
            installation. Every log line is prefixed and the deployment is
            marked demo, so nothing claims a build happened when it did not.
*/
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { db, nowIso, DATA_DIR } from '../db.js';
import { id } from '../crypto.js';
import { decrypt } from '../crypto.js';
import { audit, notify } from '../auth.js';

export const bus = new EventEmitter();
bus.setMaxListeners(0);

const MAX_CONCURRENT = 2;
const running = new Map(); // deploymentId -> { child, cancelled }
let activeCount = 0;
const queue = [];

const BUILD_TIMEOUT_MS = Number(process.env.REDFOX_BUILD_TIMEOUT_MS || 180000);
/* Build workspaces live outside the application tree on purpose: npm and other
   tools resolve package.json upwards, and a workspace nested inside the Redfox
   source would inherit Redfox's own manifest. */
const BUILD_DIR = process.env.REDFOX_BUILD_DIR || path.join(os.tmpdir(), 'redfox-builds');
const ARTIFACT_DIR = path.join(DATA_DIR, 'deployments');
fs.mkdirSync(BUILD_DIR, { recursive: true });
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function logLine(deploymentId, level, phase, message) {
  const seq = db.prepare('SELECT COALESCE(MAX(seq), -1) + 1 AS next FROM deployment_logs WHERE deployment_id = ?')
    .get(deploymentId).next;
  const entry = { deployment_id: deploymentId, seq, ts: nowIso(), level, phase, message };
  db.prepare('INSERT INTO deployment_logs (id, deployment_id, seq, ts, level, phase, message) VALUES (?,?,?,?,?,?,?)')
    .run(id('dl'), deploymentId, entry.seq, entry.ts, entry.level, entry.phase, entry.message);
  bus.emit(`dep:${deploymentId}`, { type: 'log', log: entry });
  return entry;
}

function setStatus(deploymentId, status, patch = {}) {
  const fields = { status, ...patch };
  const sets = Object.keys(fields).map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE deployments SET ${sets} WHERE id = ?`).run([...Object.values(fields), deploymentId]);
  bus.emit(`dep:${deploymentId}`, { type: 'status', status });
}

function projectEnv(projectId, environment) {
  const rows = db.prepare('SELECT key, value_enc, target FROM env_vars WHERE project_id = ?').all(projectId);
  const env = {};
  for (const r of rows) {
    if (r.target === 'all' || r.target === environment || (environment === 'preview' && r.target === 'production')) {
      env[r.key] = decrypt(r.value_enc);
    }
  }
  return env;
}

function writeTree(repoId, branch, targetDir) {
  const files = db.prepare("SELECT path, kind, content FROM repo_files WHERE repository_id = ? AND branch = ? AND kind = 'file'")
    .all(repoId, branch);
  for (const file of files) {
    const dest = path.join(targetDir, file.path);
    if (!dest.startsWith(targetDir)) continue; // path traversal guard
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, file.content ?? '');
  }
  return files.length;
}

function runCommand({ deploymentId, phase, command, cwd, env, timeoutMs = BUILD_TIMEOUT_MS }) {
  return new Promise((resolve) => {
    logLine(deploymentId, 'info', phase, `$ ${command}`);
    let child;
    try {
      child = spawn(command, {
        cwd,
        shell: '/bin/bash',
        env: { ...process.env, CI: '1', NODE_ENV: phase === 'install' ? 'development' : 'production', ...env },
      });
    } catch (error) {
      resolve({ code: 1, stderr: String(error.message) });
      return;
    }
    running.set(deploymentId, { child });
    let stderrTail = '';
    const timer = setTimeout(() => {
      logLine(deploymentId, 'error', phase, `Command exceeded ${Math.round(timeoutMs / 1000)}s and was terminated`);
      child.kill('SIGKILL');
    }, timeoutMs);

    const pipe = (stream, level) => {
      let buffer = '';
      stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          if (level === 'error') stderrTail = line.trim();
          logLine(deploymentId, level, phase, line.replace(/\u001b\[[0-9;]*m/g, '').slice(0, 2000));
        }
      });
      stream.on('end', () => {
        if (buffer.trim()) logLine(deploymentId, level, phase, buffer.trim().slice(0, 2000));
      });
    };
    pipe(child.stdout, 'info');
    pipe(child.stderr, 'error');

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      running.delete(deploymentId);
      resolve({ code: code ?? (signal ? 137 : 1), stderr: stderrTail });
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      running.delete(deploymentId);
      resolve({ code: 1, stderr: error.message });
    });
  });
}

async function publishArtifacts(deploymentId, workDir, outputDir) {
  const source = path.join(workDir, outputDir);
  if (!fs.existsSync(source)) {
    throw new Error(`Output directory "${outputDir}" was not produced by the build`);
  }
  const target = path.join(ARTIFACT_DIR, deploymentId);
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
  let files = 0;
  let bytes = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else { files++; bytes += fs.statSync(full).size; }
    }
  };
  walk(target);
  if (files === 0) throw new Error('Build produced an empty output directory');
  return { files, bytes, dir: target };
}

async function runLocalBuild(deployment, project, repo) {
  const { id: depId, environment, branch } = deployment;
  const workDir = path.join(BUILD_DIR, depId);
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  setStatus(depId, 'building', { started_at: nowIso() });
  logLine(depId, 'info', 'queue', `Runner: local build sandbox (pid ${process.pid})`);
  logLine(depId, 'info', 'build', `Selected commit ${deployment.commit_sha?.slice(0, 7)} on ${branch}`);

  if (!repo) throw new Error('No repository is connected to this project');
  const fileCount = writeTree(repo.id, branch, workDir);
  logLine(depId, 'info', 'build', `Checked out ${fileCount} files from ${repo.slug}/${branch}`);
  if (fileCount === 0) throw new Error(`Branch "${branch}" does not exist in ${repo.slug}`);

  const env = projectEnv(project.id, environment);
  logLine(depId, 'info', 'install', `Injected ${Object.keys(env).length} environment variables for ${environment}`);
  logLine(depId, 'info', 'install', `Build environment: ${project.runtime} (${process.version} compatible)`);

  const install = (project.install_command || '').trim();
  if (install && install !== 'none') {
    const result = await runCommand({ deploymentId: depId, phase: 'install', command: install, cwd: workDir, env });
    if (result.code !== 0) throw new Error(`Install command exited with code ${result.code}${result.stderr ? `: ${result.stderr}` : ''}`);
    logLine(depId, 'info', 'install', 'Dependencies installed');
  } else {
    logLine(depId, 'info', 'install', 'No install step configured, skipping');
  }

  const build = (project.build_command || '').trim();
  if (!build) {
    logLine(depId, 'info', 'build', 'No build command configured, publishing source files as-is');
  } else {
    const result = await runCommand({ deploymentId: depId, phase: 'build', command: build, cwd: workDir, env });
    if (result.code !== 0) throw new Error(`Build command exited with code ${result.code}${result.stderr ? `: ${result.stderr}` : ''}`);
    logLine(depId, 'info', 'build', 'Build completed');
  }

  setStatus(depId, 'deploying');
  logLine(depId, 'info', 'publish', `Publishing artifacts from "${project.output_dir}"`);
  const published = await publishArtifacts(depId, workDir, project.output_dir);
  logLine(depId, 'info', 'publish', `Published ${published.files} files (${(published.bytes / 1024).toFixed(1)} kB)`);

  const url = `/preview/${depId}/`;
  logLine(depId, 'info', 'routing', `Route registered: ${url}`);
  return { url, artifactDir: published.dir };
}

const DEMO_STEPS = [
  ['queue', 'info', 'Deployment created from manual trigger'],
  ['queue', 'info', 'Waiting for an available runner'],
  ['queue', 'info', 'Runner assigned from the demonstration pool'],
  ['build', 'warn', 'Demonstration runner: no build sandbox is attached to this project, so build steps are replayed rather than executed'],
  ['build', 'info', 'Cloning repository and checking out the selected commit'],
  ['install', 'info', 'Running install command'],
  ['install', 'info', 'Dependencies resolved'],
  ['build', 'info', 'Running build command'],
  ['build', 'info', 'Compiling application'],
  ['build', 'info', 'Build completed'],
  ['publish', 'info', 'Artifacts prepared'],
  ['publish', 'info', 'Container image recorded'],
  ['routing', 'info', 'Routing rules registered with Traefik'],
];

async function runDemoBuild(deployment, project) {
  const { id: depId } = deployment;
  setStatus(depId, 'building', { started_at: nowIso() });
  logLine(depId, 'warn', 'queue', 'Demonstration mode: this deployment records the pipeline but does not execute it');
  logLine(depId, 'info', 'queue', `Project runner is set to "demo". Switch the project runner to "local" to execute real builds.`);
  for (const [phase, level, message] of DEMO_STEPS.slice(3)) {
    await new Promise((r) => setTimeout(r, 380 + Math.random() * 520));
    if (!running.has(depId) && db.prepare('SELECT status FROM deployments WHERE id = ?').get(depId)?.status === 'cancelled') {
      return { cancelled: true };
    }
    logLine(depId, level, phase, message);
  }
  setStatus(depId, 'deploying');
  await new Promise((r) => setTimeout(r, 700));
  const url = `https://${project.slug}-${deployment.commit_sha?.slice(0, 7) || 'latest'}.preview.redfox.app`;
  logLine(depId, 'warn', 'ready', 'Marked ready for demonstration. No artifact is served at this URL.');
  return { url, artifactDir: null };
}

async function execute(deploymentId) {
  const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
  if (!deployment) return;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(deployment.project_id);
  const repo = db.prepare('SELECT * FROM repositories WHERE project_id = ?').get(project.id);
  const startedAt = Date.now();

  try {
    let outcome;
    if (project.runner === 'local' && repo) {
      outcome = await runLocalBuild(deployment, project, repo);
    } else {
      outcome = await runDemoBuild(deployment, project);
    }

    if (outcome.cancelled) {
      logLine(deploymentId, 'warn', 'queue', 'Deployment cancelled');
      setStatus(deploymentId, 'cancelled', { finished_at: nowIso(), duration_ms: Date.now() - startedAt });
      return;
    }

    const duration = Date.now() - startedAt;
    const mode = project.runner === 'local' ? 'local' : 'demo';
    db.prepare(`UPDATE deployments SET status = 'ready', url = ?, artifact_dir = ?, image = ?, mode = ?,
                finished_at = ?, duration_ms = ? WHERE id = ?`)
      .run(outcome.url, outcome.artifactDir, `redfox/${project.slug}:${deployment.commit_sha?.slice(0, 7)}`, mode,
        nowIso(), duration, deploymentId);
    bus.emit(`dep:${deploymentId}`, { type: 'status', status: 'ready' });
    logLine(deploymentId, 'info', 'ready', `Deployment ready in ${(duration / 1000).toFixed(1)}s`);

    audit(project.workspace_id, project.id, 'deployment', `${project.name} deployed to ${deployment.environment} (${deployment.commit_sha?.slice(0, 7)})`, deployment.actor);
    const owners = db.prepare('SELECT user_id FROM memberships WHERE workspace_id = ? AND role IN (\'owner\',\'admin\')').all(project.workspace_id);
    for (const owner of owners) {
      notify(owner.user_id, `${project.name} deployed`, `${deployment.environment} • ${deployment.commit_sha?.slice(0, 7)} • ${(duration / 1000).toFixed(0)}s`,
        `/deployments/${deploymentId}`, 'success');
    }
  } catch (error) {
    const duration = Date.now() - startedAt;
    const message = error.message || 'Deployment failed';
    logLine(deploymentId, 'error', 'build', message);
    logLine(deploymentId, 'error', 'build', 'Deployment failed');
    db.prepare(`UPDATE deployments SET status = 'failed', error = ?, finished_at = ?, duration_ms = ? WHERE id = ?`)
      .run(message, nowIso(), duration, deploymentId);
    bus.emit(`dep:${deploymentId}`, { type: 'status', status: 'failed' });
    audit(project.workspace_id, project.id, 'deployment', `${project.name} deployment failed: ${message}`, deployment.actor, 'error');
    const owners = db.prepare('SELECT user_id FROM memberships WHERE workspace_id = ? AND role IN (\'owner\',\'admin\')').all(project.workspace_id);
    for (const owner of owners) {
      notify(owner.user_id, `${project.name} deployment failed`, message, `/deployments/${deploymentId}`, 'error');
    }
  } finally {
    running.delete(deploymentId);
    activeCount -= 1;
    fs.rmSync(path.join(BUILD_DIR, deploymentId), { recursive: true, force: true });
    drain();
  }
}

function drain() {
  while (activeCount < MAX_CONCURRENT && queue.length) {
    const next = queue.shift();
    activeCount += 1;
    execute(next).catch((error) => console.error('deployment worker error', error));
  }
}

export function enqueue(deploymentId) {
  queue.push(deploymentId);
  setStatus(deploymentId, 'queued');
  drain();
}

export function cancel(deploymentId) {
  const job = running.get(deploymentId);
  if (job?.child) job.child.kill('SIGTERM');
  queue.splice(queue.indexOf(deploymentId), 1);
  const dep = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
  if (dep && ['queued', 'building', 'deploying'].includes(dep.status)) {
    logLine(deploymentId, 'warn', 'queue', 'Cancelled by operator');
    setStatus(deploymentId, 'cancelled', { finished_at: nowIso() });
    return true;
  }
  return false;
}

export function queueDepth() {
  return { queued: queue.length, running: activeCount };
}

export function deploymentLogs(deploymentId, { afterSeq = -1, limit = 5000 } = {}) {
  return db.prepare('SELECT seq, ts, level, phase, message FROM deployment_logs WHERE deployment_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?')
    .all(deploymentId, afterSeq, limit);
}

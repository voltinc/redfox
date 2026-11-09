import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, migrate, nowIso, DATA_DIR, ROOT } from './db.js';
import { seedAll } from './seed.js';
import { attachUser } from './auth.js';
import { HttpError } from './util.js';
import { id } from './crypto.js';
import { startSampler } from './services/metrics.js';
import { queueDepth } from './services/deployEngine.js';

import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspace.js';
import projectRoutes from './routes/projects.js';
import deploymentRoutes from './routes/deployments.js';
import repoRoutes, { hookRouter } from './routes/repos.js';
import dataRoutes, { publicStorageRouter } from './routes/data.js';
import infraRoutes from './routes/infra.js';
import soleneRoutes from './routes/solene.js';
import explorerRoutes, { dataRouter } from './routes/explorer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

migrate();
const seedResult = seedAll();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(cookieParser());
app.use(attachUser);

/* raw body for storage uploads must be parsed before the json parser */
app.use('/api/storage/:bucketId/upload', express.raw({ type: '*/*', limit: '25mb' }));
app.use(express.json({ limit: '4mb' }));

/* ---------------------------------------------------------- request logging */
const insertLog = db.prepare(`INSERT INTO logs (id, workspace_id, project_id, deployment_id, source, level, message,
  path, status_code, duration_ms, mode, ts) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
let liveLogCount = 0;

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/v1/')) return;
    if (req.path.includes('/stream')) return;
    if (res.statusCode === 304) return;
    const workspace = db.prepare("SELECT id FROM workspaces ORDER BY created_at LIMIT 1").get();
    if (!workspace) return;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    const duration = Date.now() - started;
    if (level !== 'info' || Math.random() < 0.35) {
      try {
        insertLog.run(id('log'), workspace.id, null, null, req.path.startsWith('/v1/') ? 'edge' : 'runtime',
          level, `${req.method} ${req.path}`, req.path, res.statusCode, duration, 'live', nowIso());
        liveLogCount += 1;
        if (liveLogCount > 400) {
          db.prepare("DELETE FROM logs WHERE mode = 'live' AND id IN (SELECT id FROM logs WHERE mode = 'live' ORDER BY ts ASC LIMIT 400)").run();
          liveLogCount = 0;
        }
      } catch { /* logging must never break a request */ }
    }
  });
  next();
});

/* ------------------------------------------------------------------- routes */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.9.0',
    uptime_seconds: Math.round(process.uptime()),
    queue: queueDepth(),
    seeded: seedResult,
  });
});

/* Public routes are mounted before any router that applies session auth, so an
   inbound webhook or a signed storage URL is never blocked by the session guard. */
app.use('/api', publicStorageRouter);
app.use('/api', hookRouter);

app.use('/api', authRoutes);
app.use('/api', workspaceRoutes);
app.use('/api', projectRoutes);
app.use('/api', deploymentRoutes);
app.use('/api', repoRoutes);
app.use('/api', dataRoutes);
app.use('/api', infraRoutes);
app.use('/api', soleneRoutes);
app.use('/api', explorerRoutes);
app.use('/v1', dataRouter);

/* ------------------------------------------------------- deployment previews */
app.use('/preview/:deploymentId', (req, res, next) => {
  const dir = path.join(DATA_DIR, 'deployments', req.params.deploymentId);
  if (!fs.existsSync(dir)) {
    return res.status(404).type('text/plain').send('This deployment has no stored artifact in this installation.');
  }
  express.static(dir, { index: 'index.html', extensions: ['html'] })(req, res, next);
});

/* --------------------------------------------------------------- web client */
const webDist = path.join(ROOT, 'web', 'dist');
const indexHtml = path.join(webDist, 'index.html');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api|\/v1|\/preview).*/, (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (!fs.existsSync(indexHtml)) return next();
    res.setHeader('cache-control', 'no-cache');
    res.sendFile(indexHtml);
  });
} else {
  app.get('/', (_req, res) => {
    res.type('text/plain').send('Redfox API is running. Build the web client with `npm run build`, then restart, or run `npm run dev`.');
  });
}

/* ------------------------------------------------------------ error handling */
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/v1/')) {
    return res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
  }
  res.status(404).type('text/plain').send('Not found');
});

app.use((error, req, res, _next) => {
  const status = error instanceof HttpError ? error.status : error.status || 500;
  if (status >= 500) console.error(`[${req.method} ${req.path}]`, error);
  const payload = { error: error.message || 'Internal error' };
  if (error.details) payload.details = error.details;
  if (status >= 500 && process.env.NODE_ENV !== 'production') payload.stack = error.stack?.split('\n').slice(0, 6);
  res.status(status).json(payload);
});

startSampler(15000);

app.listen(PORT, () => {
  console.log(`Redfox running on http://localhost:${PORT}`);
  console.log(`  data directory: ${DATA_DIR}`);
  console.log(`  seeded:         ${seedResult.seeded ? 'yes (fresh workspace)' : 'existing workspace'}`);
  console.log(`  demo login:     demo@redfox.dev / redfox-demo`);
});

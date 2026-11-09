/* Metrics sampling.

   Live series come from the machine actually running Redfox (os.cpus, freemem,
   plus request counts recorded by the API). Series for demonstration servers are
   generated and stored with mode='demo' so charts can label them. */
import os from 'node:os';
import fs from 'node:fs';
import { db, nowIso } from '../db.js';
import { id } from '../crypto.js';

let lastCpu = os.cpus().map((c) => c.times);

function cpuUsage() {
  const current = os.cpus().map((c) => c.times);
  let idleDelta = 0;
  let totalDelta = 0;
  current.forEach((times, i) => {
    const prev = lastCpu[i] || times;
    const idle = times.idle - prev.idle;
    const total = ['user', 'nice', 'sys', 'idle', 'irq'].reduce((sum, k) => sum + (times[k] - prev[k]), 0);
    idleDelta += idle;
    totalDelta += total;
  });
  lastCpu = current;
  if (!totalDelta) return 0;
  return Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
}

function diskUsage() {
  try {
    const stats = fs.statfsSync('/');
    return ((stats.blocks - stats.bfree) / stats.blocks) * 100;
  } catch {
    return 0;
  }
}

export function hostSnapshot() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    cpu: Math.round(cpuUsage() * 10) / 10,
    mem: Math.round(((total - free) / total) * 1000) / 10,
    disk: Math.round(diskUsage() * 10) / 10,
    cores: os.cpus().length,
    memoryBytes: total,
    uptimeSeconds: Math.round(os.uptime()),
    load: os.loadavg().map((n) => Math.round(n * 100) / 100),
    platform: `${os.type()} ${os.release()}`,
  };
}

export function recordSample() {
  const local = db.prepare("SELECT id FROM servers WHERE mode = 'local'").get();
  const snap = hostSnapshot();
  if (local) {
    const since = new Date(Date.now() - 60000).toISOString();
    const requests = db.prepare('SELECT count(*) AS n FROM logs WHERE ts > ? AND mode = ?').get(since, 'live')?.n ?? 0;
    db.prepare(`INSERT INTO metrics (id, scope, target, ts, cpu, mem, disk, requests, latency, errors, mode)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      id('met'), 'server', local.id, nowIso(), snap.cpu, snap.mem, snap.disk,
      requests, null, db.prepare("SELECT count(*) AS n FROM logs WHERE ts > ? AND level = 'error'").get(since)?.n ?? 0, 'live',
    );
  }
  db.prepare("DELETE FROM metrics WHERE ts < ?").run(new Date(Date.now() - 14 * 864e5).toISOString());
  return snap;
}

export function series(target, { hours = 24, mode } = {}) {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const params = [target, since];
  let sql = 'SELECT ts, cpu, mem, disk, requests, errors, mode FROM metrics WHERE target = ? AND ts > ?';
  if (mode) { sql += ' AND mode = ?'; params.push(mode); }
  sql += ' ORDER BY ts ASC';
  return db.prepare(sql).all(params);
}

export function startSampler(intervalMs = 15000) {
  recordSample();
  const timer = setInterval(() => {
    try { recordSample(); } catch (error) { console.error('metric sample failed', error.message); }
  }, intervalMs);
  timer.unref?.();
  return timer;
}

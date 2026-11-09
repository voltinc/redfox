import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.REDFOX_DATA_DIR || path.join(ROOT, 'data');

for (const dir of [DATA_DIR, path.join(DATA_DIR, 'dbs'), path.join(DATA_DIR, 'storage'), path.join(DATA_DIR, 'deployments')]) {
  fs.mkdirSync(dir, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'redfox.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}

/* Per-project database. Each project gets its own file, so isolation is real:
   no cross-project query can touch another project's tables through the API. */
const projectDbs = new Map();
export function projectDb(projectId) {
  if (projectDbs.has(projectId)) return projectDbs.get(projectId);
  const file = path.join(DATA_DIR, 'dbs', `${projectId}.sqlite`);
  const conn = new Database(file);
  conn.pragma('journal_mode = WAL');
  projectDbs.set(projectId, conn);
  return conn;
}

export function closeProjectDb(projectId) {
  const conn = projectDbs.get(projectId);
  if (conn) { conn.close(); projectDbs.delete(projectId); }
  const file = path.join(DATA_DIR, 'dbs', `${projectId}.sqlite`);
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.rmSync(file + suffix, { force: true }); } catch { /* ignore */ }
  }
}

export function rows(sql, params = []) {
  return db.prepare(sql).all(params);
}
export function row(sql, params = []) {
  return db.prepare(sql).get(params);
}
export function run(sql, params = []) {
  return db.prepare(sql).run(params);
}
export function nowIso() {
  return new Date().toISOString();
}

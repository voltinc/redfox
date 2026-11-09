PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_color  TEXT NOT NULL DEFAULT '#E4593B',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  plan       TEXT NOT NULL DEFAULT 'team',
  region     TEXT NOT NULL DEFAULT 'eu-west-1',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'developer',
  created_at   TEXT NOT NULL,
  UNIQUE (workspace_id, user_id)
);


CREATE TABLE IF NOT EXISTS invites (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        TEXT,
  role         TEXT NOT NULL DEFAULT 'developer',
  token        TEXT NOT NULL UNIQUE,
  invited_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  accepted_at  TEXT,
  accepted_by  TEXT
);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id                 TEXT PRIMARY KEY,
  workspace_id       TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  slug               TEXT NOT NULL,
  description        TEXT,
  framework          TEXT NOT NULL DEFAULT 'other',
  runtime            TEXT NOT NULL DEFAULT 'node20',
  install_command    TEXT NOT NULL DEFAULT 'npm ci',
  build_command      TEXT NOT NULL DEFAULT 'npm run build',
  output_dir         TEXT NOT NULL DEFAULT 'dist',
  root_dir           TEXT NOT NULL DEFAULT '.',
  production_branch  TEXT NOT NULL DEFAULT 'main',
  status             TEXT NOT NULL DEFAULT 'active',
  runner             TEXT NOT NULL DEFAULT 'demo',
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (workspace_id, slug)
);

CREATE TABLE IF NOT EXISTS project_environments (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  branch     TEXT,
  url        TEXT,
  status     TEXT NOT NULL DEFAULT 'idle',
  created_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Git (Gitea-compatible integration boundary)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS repositories (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id     TEXT REFERENCES projects(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,
  description    TEXT,
  visibility     TEXT NOT NULL DEFAULT 'private',
  default_branch TEXT NOT NULL DEFAULT 'main',
  integration    TEXT NOT NULL DEFAULT 'native',
  remote_url     TEXT,
  webhook_secret TEXT,
  webhook_url    TEXT,
  webhook_events TEXT NOT NULL DEFAULT '["push","pull_request"]',
  webhook_active INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  UNIQUE (workspace_id, slug)
);

CREATE TABLE IF NOT EXISTS branches (
  id             TEXT PRIMARY KEY,
  repository_id  TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  head_sha       TEXT,
  is_default     INTEGER NOT NULL DEFAULT 0,
  protected      INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL,
  UNIQUE (repository_id, name)
);

CREATE TABLE IF NOT EXISTS commits (
  id             TEXT PRIMARY KEY,
  repository_id  TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  sha            TEXT NOT NULL,
  branch         TEXT NOT NULL,
  message        TEXT NOT NULL,
  author_name    TEXT NOT NULL,
  author_email   TEXT NOT NULL,
  parent_sha     TEXT,
  additions      INTEGER NOT NULL DEFAULT 0,
  deletions      INTEGER NOT NULL DEFAULT 0,
  files_changed  INTEGER NOT NULL DEFAULT 0,
  committed_at   TEXT NOT NULL,
  UNIQUE (repository_id, sha)
);

CREATE TABLE IF NOT EXISTS repo_files (
  id            TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  branch        TEXT NOT NULL,
  path          TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'file',
  content       TEXT,
  size          INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL,
  UNIQUE (repository_id, branch, path)
);

CREATE TABLE IF NOT EXISTS commit_files (
  id           TEXT PRIMARY KEY,
  commit_id    TEXT NOT NULL REFERENCES commits(id) ON DELETE CASCADE,
  path         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'modified',
  additions    INTEGER NOT NULL DEFAULT 0,
  deletions    INTEGER NOT NULL DEFAULT 0,
  patch        TEXT
);

-- ---------------------------------------------------------------------------
-- Deployments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deployments (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment    TEXT NOT NULL DEFAULT 'production',
  status         TEXT NOT NULL DEFAULT 'queued',
  mode           TEXT NOT NULL DEFAULT 'demo',
  commit_sha     TEXT,
  commit_message TEXT,
  branch         TEXT,
  trigger        TEXT NOT NULL DEFAULT 'manual',
  actor          TEXT NOT NULL DEFAULT 'system',
  url            TEXT,
  artifact_dir   TEXT,
  image          TEXT,
  error          TEXT,
  created_at     TEXT NOT NULL,
  started_at     TEXT,
  finished_at    TEXT,
  duration_ms    INTEGER
);

CREATE TABLE IF NOT EXISTS deployment_logs (
  id            TEXT PRIMARY KEY,
  deployment_id TEXT NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  seq           INTEGER NOT NULL,
  ts            TEXT NOT NULL,
  level         TEXT NOT NULL DEFAULT 'info',
  phase         TEXT NOT NULL DEFAULT 'build',
  message       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS domains (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  hostname    TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'production',
  status      TEXT NOT NULL DEFAULT 'pending',
  ssl         TEXT NOT NULL DEFAULT 'pending',
  verify_token TEXT NOT NULL,
  last_check  TEXT,
  last_error  TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE (project_id, hostname)
);

-- ---------------------------------------------------------------------------
-- Environment variables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS env_vars (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value_enc   TEXT NOT NULL,
  target      TEXT NOT NULL DEFAULT 'all',
  is_secret   INTEGER NOT NULL DEFAULT 1,
  updated_by  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (project_id, key, target)
);

-- ---------------------------------------------------------------------------
-- Database service (per-project isolated SQLite stand-in for PostgreSQL)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS databases (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  engine       TEXT NOT NULL DEFAULT 'postgres',
  engine_version TEXT NOT NULL DEFAULT '16.3',
  region       TEXT NOT NULL DEFAULT 'eu-west-1',
  status       TEXT NOT NULL DEFAULT 'healthy',
  file_path    TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buckets (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL,
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS objects (
  id         TEXT PRIMARY KEY,
  bucket_id  TEXT NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  size       INTEGER NOT NULL DEFAULT 0,
  mime       TEXT NOT NULL DEFAULT 'application/octet-stream',
  checksum   TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (bucket_id, path)
);

-- ---------------------------------------------------------------------------
-- Infrastructure
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS servers (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  provider       TEXT NOT NULL DEFAULT 'redfox-cloud',
  region         TEXT NOT NULL DEFAULT 'eu-west-1',
  host           TEXT,
  docker_endpoint TEXT,
  mode           TEXT NOT NULL DEFAULT 'demo',
  status         TEXT NOT NULL DEFAULT 'disconnected',
  os             TEXT,
  docker_version TEXT,
  cpu_cores      INTEGER,
  memory_bytes   INTEGER,
  disk_bytes     INTEGER,
  last_seen      TEXT,
  last_error     TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS containers (
  id          TEXT PRIMARY KEY,
  server_id   TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  image       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'running',
  cpu_pct     REAL NOT NULL DEFAULT 0,
  mem_bytes   INTEGER NOT NULL DEFAULT 0,
  ports       TEXT NOT NULL DEFAULT '',
  mode        TEXT NOT NULL DEFAULT 'demo',
  created_at  TEXT NOT NULL,
  started_at  TEXT
);

CREATE TABLE IF NOT EXISTS metrics (
  id       TEXT PRIMARY KEY,
  scope    TEXT NOT NULL,
  target   TEXT NOT NULL,
  ts       TEXT NOT NULL,
  cpu      REAL,
  mem      REAL,
  disk     REAL,
  requests INTEGER,
  latency  REAL,
  errors   INTEGER,
  mode     TEXT NOT NULL DEFAULT 'live'
);

-- ---------------------------------------------------------------------------
-- Observability
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logs (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL,
  project_id    TEXT,
  deployment_id TEXT,
  source        TEXT NOT NULL,
  level         TEXT NOT NULL DEFAULT 'info',
  message       TEXT NOT NULL,
  path          TEXT,
  status_code   INTEGER,
  duration_ms   REAL,
  mode          TEXT NOT NULL DEFAULT 'live',
  ts            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id   TEXT,
  type         TEXT NOT NULL,
  level        TEXT NOT NULL DEFAULT 'info',
  actor        TEXT NOT NULL DEFAULT 'system',
  message      TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT,
  href       TEXT,
  level      TEXT NOT NULL DEFAULT 'info',
  read_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  prefix     TEXT NOT NULL,
  key_hash   TEXT NOT NULL,
  scopes     TEXT NOT NULL DEFAULT 'read',
  last_used  TEXT,
  created_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Solene (AI assistant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  project_id TEXT,
  title      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  meta            TEXT,
  created_at      TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_projects_ws        ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dep_project        ON deployments(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dep_ws             ON deployments(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dep_logs           ON deployment_logs(deployment_id, seq);
CREATE INDEX IF NOT EXISTS idx_commits_repo       ON commits(repository_id, committed_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_repo_branch  ON repo_files(repository_id, branch, path);
CREATE INDEX IF NOT EXISTS idx_logs_ws            ON logs(workspace_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_logs_project       ON logs(project_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_ws          ON events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_scope      ON metrics(scope, target, ts DESC);
CREATE INDEX IF NOT EXISTS idx_obj_bucket         ON objects(bucket_id);
CREATE INDEX IF NOT EXISTS idx_env_project        ON env_vars(project_id);
CREATE INDEX IF NOT EXISTS idx_containers_server  ON containers(server_id);
CREATE INDEX IF NOT EXISTS idx_invites_token   ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_ws      ON invites(workspace_id, created_at DESC);

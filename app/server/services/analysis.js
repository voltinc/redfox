/* Local analysis engine.

   This is what Solene answers with when no model provider is connected. It is a
   deterministic analyser over real Redfox data: deployment logs, project config,
   stored schema. It is labelled as local analysis in the interface, never as a
   language model response. */
import { db } from '../db.js';

const PATTERNS = [
  {
    id: 'peer-dependency',
    match: /ERESOLVE|peer dependency|peerDependencies/i,
    cause: 'npm could not satisfy a peer dependency range while installing.',
    fixes: [
      'Align the conflicting package version with the peer range declared by its parent (usually react/react-dom).',
      'If the range is intentionally wider, install with --legacy-peer-deps and record why in the lockfile commit.',
      'Pin the package in package.json overrides so the resolution is reproducible in CI.',
    ],
  },
  {
    id: 'module-not-found',
    match: /Cannot find module|MODULE_NOT_FOUND|Could not resolve/i,
    cause: 'A module required by the build does not exist in the installed tree.',
    fixes: [
      'Add the missing package to dependencies (not devDependencies) if it is used at build or runtime.',
      'Check that the import path matches the file system casing; Linux builds are case sensitive.',
    ],
  },
  {
    id: 'typescript',
    match: /error TS\d+/i,
    cause: 'The TypeScript compiler rejected the source.',
    fixes: [
      'Fix the reported type error at the file and line in the log.',
      'If the type is genuinely dynamic, narrow it explicitly rather than disabling strict mode.',
      'Run the same compiler version locally so the failure is reproducible before pushing.',
    ],
  },
  {
    id: 'missing-env',
    match: /process\.env\.\w+|environment variable .* (?:missing|not set)/i,
    cause: 'The build or runtime referenced an environment variable that is not set for this environment.',
    fixes: [
      'Add the variable under Environment variables for the environment this deployment targets.',
      'Remember that only production-scoped values are exposed to preview builds, so preview values must be set separately.',
    ],
  },
  {
    id: 'exit-code',
    match: /exited with code (\d+)/i,
    cause: 'A build command returned a non-zero exit code.',
    fixes: [
      'Read the last error line before the exit to find the failing step.',
      'Verify the build command in project settings matches what the repository actually defines.',
    ],
  },
  {
    id: 'memory',
    match: /heap out of memory|JavaScript heap|OOM|Killed/i,
    cause: 'The build exhausted the memory available to the runner.',
    fixes: [
      'Raise the runner memory limit, or run the build with NODE_OPTIONS=--max-old-space-size.',
      'Split the build, or move heavy generation out of the deploy path.',
    ],
  },
  {
    id: 'auth',
    match: /401|403|authentication (?:failed|required)|unauthorized/i,
    cause: 'A step failed to authenticate against a dependency or API.',
    fixes: [
      'Confirm the token stored in environment variables is valid and scoped for this environment.',
      'Rotate the credential if it was revoked, then redeploy so the build picks up the new value.',
    ],
  },
  {
    id: 'missing-output',
    match: /Output directory .* was not produced|empty output directory/i,
    cause: 'The build finished but did not write to the configured output directory.',
    fixes: [
      'Check the output directory in project settings. It must match what the framework emits.',
      'If the build writes to a nested path, set the root directory as well.',
    ],
  },
];

export function analyzeDeployment(deploymentId) {
  const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
  if (!deployment) return null;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(deployment.project_id);
  const logs = db.prepare('SELECT level, phase, message, seq FROM deployment_logs WHERE deployment_id = ? ORDER BY seq ASC').all(deploymentId);
  const errors = logs.filter((l) => l.level === 'error');

  const matched = [];
  const haystack = errors.map((e) => e.message).join('\n');
  for (const pattern of PATTERNS) {
    if (pattern.match.test(haystack)) matched.push(pattern);
  }
  // Missing env var names referenced in logs
  const envNames = [...new Set([...haystack.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]))];
  const configured = envNames.length
    ? db.prepare(`SELECT key, target FROM env_vars WHERE project_id = ? AND key IN (${envNames.map(() => '?').join(',')})`)
      .all(project.id, ...envNames)
    : [];

  const evidence = errors.slice(0, 6).map((e) => ({ seq: e.seq, phase: e.phase, message: e.message }));

  let summary;
  if (deployment.status === 'ready') {
    summary = `${project.name} deployed successfully to ${deployment.environment} in ${((deployment.duration_ms || 0) / 1000).toFixed(0)}s. No failure signal in ${logs.length} log lines.`;
  } else if (deployment.status === 'cancelled') {
    summary = `Deployment was cancelled before it completed. Nothing was published, so the previous version is still serving traffic.`;
  } else if (!errors.length) {
    summary = `The deployment finished as ${deployment.status} but the log stream contains no error lines. Re-run with full logging to capture the failing step.`;
  } else {
    const first = errors[0];
    summary = `Build failed in the ${first.phase} phase. ${matched[0]?.cause ?? 'The log shows a non-zero exit without a recognised signature.'}`;
  }

  const causes = matched.map((m) => ({ id: m.id, cause: m.cause }));
  const fixes = matched.flatMap((m) => m.fixes);
  if (envNames.length) {
    const missing = envNames.filter((name) => !configured.some((c) => c.key === name));
    if (missing.length) {
      causes.push({ id: 'env-absent', cause: `Referenced variables not present in project settings: ${missing.join(', ')}.` });
      fixes.unshift(`Add ${missing.join(', ')} to Environment variables, scoped to ${deployment.environment}.`);
    }
  }
  if (!fixes.length) {
    fixes.push('Open the build log and find the first error line, not the last. Later lines are usually consequences.');
    fixes.push('Reproduce the build locally with the same install and build command before redeploying.');
  }

  const confidence = matched.length ? (errors.length > 3 ? 'high' : 'medium') : 'low';

  return {
    deployment: {
      id: deployment.id, status: deployment.status, environment: deployment.environment,
      commit: deployment.commit_sha, branch: deployment.branch, duration_ms: deployment.duration_ms,
      trigger: deployment.trigger, mode: deployment.mode,
    },
    project: { id: project.id, name: project.name, slug: project.slug, framework: project.framework, build_command: project.build_command },
    summary,
    causes,
    fixes,
    evidence,
    log_lines: logs.length,
    error_lines: errors.length,
    confidence,
  };
}

export function analyzeText(text) {
  const matched = PATTERNS.filter((p) => p.match.test(text));
  return matched.map((m) => ({ id: m.id, cause: m.cause, fixes: m.fixes }));
}

export function tableList(conn) {
  return conn.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all().map((r) => r.name);
}

export function describeSchema(conn, project) {
  const tables = tableList(conn);
  const detail = tables.map((name) => {
    const columns = conn.prepare(`PRAGMA table_info(${JSON.stringify(name)})`).all();
    const count = conn.prepare(`SELECT count(*) AS n FROM "${name}"`).get().n;
    return { name, rows: count, columns: columns.map((c) => ({ name: c.name, type: c.type, pk: !!c.pk, notnull: !!c.notnull })) };
  });
  const totalRows = detail.reduce((sum, t) => sum + t.rows, 0);
  const lines = detail.map((t) => `${t.name} (${t.rows} rows): ${t.columns.map((c) => c.name).join(', ')}`);
  return {
    summary: `${project.name} has ${tables.length} tables and ${totalRows} rows in its isolated database.`,
    tables: detail,
    markdown: `**Schema for ${project.name}**\n\n${lines.map((l) => `- \`${l}\``).join('\n')}`,
  };
}

export function generateSql(conn, project, intent) {
  const text = String(intent || '').toLowerCase();
  const tables = tableList(conn);
  if (!tables.length) return { sql: '-- no tables in this database yet', explanation: 'This project database has no tables yet.' };

  const target = tables.find((t) => text.includes(t.replace(/_/g, ' ')) || text.includes(t)) || tables[0];
  const columns = conn.prepare(`PRAGMA table_info(${JSON.stringify(target)})`).all();
  const colNames = columns.map((c) => c.name);
  const numeric = columns.filter((c) => /int|real|numeric/i.test(c.type)).map((c) => c.name);
  const timeCol = colNames.find((c) => /_at$|date|time/.test(c)) ?? colNames[0];

  if (/count|how many/.test(text)) {
    return {
      sql: `select count(*) as total\nfrom ${target};`,
      explanation: `Counts every row in ${target}.`,
    };
  }
  if (/group|per |by /.test(text)) {
    const groupCol = colNames.find((c) => /status|plan|role|type|kind|country|source|level/.test(c)) ?? colNames[1] ?? colNames[0];
    const agg = numeric[0];
    return {
      sql: `select ${groupCol},\n       count(*) as rows${agg ? `,\n       sum(${agg}) as total_${agg}` : ''}\nfrom ${target}\ngroup by ${groupCol}\norder by rows desc;`,
      explanation: `Groups ${target} by ${groupCol}${agg ? ` and totals ${agg}` : ''}.`,
    };
  }
  if (/recent|latest|newest|last/.test(text)) {
    return {
      sql: `select *\nfrom ${target}\norder by ${timeCol} desc\nlimit 20;`,
      explanation: `Returns the 20 most recent rows in ${target}, ordered by ${timeCol}.`,
    };
  }
  if (/where|filter|that|with /.test(text)) {
    const words = text.replace(/[^a-z0-9_\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !['select', 'from', 'where', 'rows', 'that', 'with', 'show', 'give', 'list'].includes(w));
    const value = words.find((w) => colNames.some((c) => c.includes(w))) ?? null;
    const col = value ? colNames.find((c) => c.includes(value)) : colNames[0];
    return {
      sql: `select ${colNames.slice(0, 4).join(', ')}\nfrom ${target}\nwhere ${col} is not null\norder by ${timeCol} desc\nlimit 50;`,
      explanation: `Filters ${target} on ${col}. Replace the predicate with the value you want to match.`,
    };
  }
  return {
    sql: `select ${colNames.slice(0, 5).join(', ')}\nfrom ${target}\norder by ${timeCol} desc\nlimit 100;`,
    explanation: `Selects the first columns of ${target}, newest first.`,
  };
}

export function diagnoseProject(project, extras = {}) {
  const findings = [];
  const envCount = db.prepare('SELECT count(*) AS n FROM env_vars WHERE project_id = ?').get(project.id).n;
  const repo = db.prepare('SELECT * FROM repositories WHERE project_id = ?').get(project.id);
  const failed = db.prepare("SELECT count(*) AS n FROM deployments WHERE project_id = ? AND status = 'failed'").get(project.id).n;
  const domains = db.prepare('SELECT hostname, status FROM domains WHERE project_id = ?').all(project.id);
  const lastDeploy = db.prepare('SELECT status, created_at FROM deployments WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(project.id);

  if (!repo) findings.push({ level: 'warn', message: 'No repository is connected. Deployments cannot resolve a commit until one is linked.' });
  if (!envCount) findings.push({ level: 'warn', message: 'No environment variables are set. Production builds will run without configuration.' });
  if (project.runner === 'demo') findings.push({ level: 'info', message: 'This project uses the demonstration runner. Set the runner to "local" in project settings to execute real builds.' });
  if (failed > 2) findings.push({ level: 'warn', message: `${failed} deployments have failed. Start with the most recent build log.` });
  for (const d of domains.filter((x) => x.status !== 'active')) {
    findings.push({ level: 'warn', message: `Domain ${d.hostname} is ${d.status}. DNS must point at cname.redfox.app before it can serve traffic.` });
  }
  if (lastDeploy?.status === 'ready') findings.push({ level: 'ok', message: 'The most recent deployment is ready and serving traffic.' });
  if (extras.pending) findings.push({ level: 'info', message: `${extras.pending} deployment(s) are still queued.` });
  return findings;
}

/* End-to-end smoke test. Exercises the real API over HTTP, including a real
   build of the Atlas Web project, then checks the published preview artifact.

   Usage: node scripts/smoke.js [port]
*/
const PORT = process.argv[2] || process.env.PORT || 3000;
const BASE = `http://127.0.0.1:${PORT}`;
let cookie = '';
const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  const mark = ok ? 'ok  ' : 'FAIL';
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function call(method, path, body, opts = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(opts.headers || {}),
    },
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
    redirect: 'manual',
  });
  const setCookie = response.headers.getSetCookie?.() || [];
  for (const c of setCookie) if (c.startsWith('redfox_session=')) cookie = c.split(';')[0];
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non json */ }
  return { status: response.status, json, text, headers: response.headers };
}

function assert(name, condition, detail) {
  record(name, !!condition, detail || '');
  return !!condition;
}

async function waitForDeployment(id, timeoutMs = 120000) {
  const started = Date.now();
  for (;;) {
    const res = await call('GET', `/api/deployments/${id}`);
    const status = res.json?.deployment?.status;
    if (['ready', 'failed', 'cancelled'].includes(status)) return res.json;
    if (Date.now() - started > timeoutMs) return { timeout: true, last: status };
    await new Promise((r) => setTimeout(r, 900));
  }
}

(async () => {
  console.log(`\nRedfox smoke test → ${BASE}\n`);

  /* auth */
  const bad = await call('POST', '/api/auth/login', { email: 'demo@redfox.dev', password: 'wrong' });
  assert('rejects bad password', bad.status === 401, `HTTP ${bad.status}`);
  const login = await call('POST', '/api/auth/login', { email: 'demo@redfox.dev', password: 'redfox-demo' });
  assert('logs in with demo account', login.status === 200 && !!cookie, login.json?.user?.email);
  const me = await call('GET', '/api/auth/me');
  assert('returns session context', me.status === 200 && me.json.role === 'owner', `role=${me.json?.role}`);
  assert('reports LLM provider state', typeof me.json?.llm?.configured === 'boolean', `configured=${me.json?.llm?.configured}`);

  const unauth = await fetch(`${BASE}/api/projects`);
  assert('blocks unauthenticated requests', unauth.status === 401, `HTTP ${unauth.status}`);

  /* overview + workspace */
  const overview = await call('GET', '/api/overview');
  assert('overview loads', overview.status === 200 && Array.isArray(overview.json.projects), `${overview.json?.projects?.length} projects`);
  assert('overview has 14 day series', overview.json?.series?.length === 14);
  assert('overview includes live host metrics', typeof overview.json?.infrastructure?.host?.cpu === 'number', `cpu=${overview.json?.infrastructure?.host?.cpu}%`);

  const ws = await call('GET', '/api/workspace');
  assert('workspace members listed', ws.status === 200 && ws.json.members.length >= 4);

  const projects = await call('GET', '/api/projects');
  assert('projects listed', projects.json?.projects?.length >= 4);
  const atlas = projects.json.projects.find((p) => p.slug === 'atlas-web');

  const meta = await call('GET', '/api/meta/frameworks');
  assert('framework metadata', meta.json?.frameworks?.length > 5);

  /* repositories + real commit */
  const repos = await call('GET', '/api/repos');
  assert('repositories listed', repos.json?.repositories?.length >= 5, `${repos.json?.repositories?.length} repos`);
  const atlasRepo = repos.json.repositories.find((r) => r.slug === 'atlas-web');
  const repo = await call('GET', `/api/repos/${atlasRepo.id}`);
  assert('repo detail with commits', repo.status === 200 && repo.json.commits.length > 0, `${repo.json?.commits?.length} commits`);
  const tree = await call('GET', `/api/repos/${atlasRepo.id}/tree?branch=main`);
  assert('repo tree lists files', tree.json?.entries?.some((e) => e.name === 'index.html'));
  const file = await call('GET', `/api/repos/${atlasRepo.id}/file?path=build.mjs&branch=main`);
  assert('file content served', file.json?.file?.content?.includes('dist'), `${file.json?.file?.size} bytes`);
  const commit = await call('POST', `/api/repos/${atlasRepo.id}/contents`, {
    path: 'CHANGELOG.md', content: '# Changelog\n\n## 1.4.3\n- Automated smoke test commit\n', message: 'docs: add changelog via smoke test', branch: 'main',
  });
  assert('creates a real commit', commit.status === 201 && !!commit.json.commit.sha, commit.json?.commit?.sha?.slice(0, 7));
  const newBranch = await call('POST', `/api/repos/${atlasRepo.id}/branches`, { name: 'smoke/test-branch', from: 'main' });
  assert('creates a branch', newBranch.status === 201, newBranch.json?.branch?.name);

  /* real deployment on the local runner */
  const deploy = await call('POST', '/api/deployments', { project: 'atlas-web', environment: 'preview', branch: 'main' });
  assert('queues a deployment', deploy.status === 201 && !!deploy.json.deployment.id, deploy.json?.deployment?.id);
  const depId = deploy.json?.deployment?.id;
  const finished = await waitForDeployment(depId);
  assert('local build completes', finished?.deployment?.status === 'ready', `status=${finished?.deployment?.status} error=${finished?.deployment?.error || 'none'}`);
  assert('build log captured', finished?.logs?.length > 4, `${finished?.logs?.length} lines`);
  assert('artifact published', finished?.artifact?.available === true, finished?.artifact?.public_url);
  if (finished?.artifact?.available) {
    const preview = await fetch(BASE + finished.artifact.public_url);
    const html = await preview.text();
    assert('preview URL serves built output', preview.status === 200 && html.includes('Atlas'), `HTTP ${preview.status}, ${html.length} bytes`);
  }
  const analysis = await call('GET', `/api/deployments/${depId}/analysis`);
  assert('deployment analysis works', analysis.status === 200 && !!analysis.json.analysis.summary);

  /* database: real SQL against an isolated project db */
  const dbOverview = await call('GET', '/api/database?project=atlas-web');
  assert('database overview', dbOverview.json?.tables?.length === 3, `${dbOverview.json?.tables?.length} tables`);
  const sqlRead = await call('POST', '/api/database/atlas-web/sql', { sql: 'select count(*) as leads from leads', mode: 'read' });
  assert('runs read query', sqlRead.status === 200 && sqlRead.json.rows?.[0]?.leads > 0, JSON.stringify(sqlRead.json?.rows?.[0]));
  const sqlBlocked = await call('POST', '/api/database/atlas-web/sql', { sql: "delete from leads where id = 1", mode: 'read' });
  assert('blocks writes in read mode', sqlBlocked.status === 400, sqlBlocked.json?.error?.slice(0, 40));
  const sqlWrite = await call('POST', '/api/database/atlas-web/sql', {
    sql: "insert into newsletter_subscribers (email, confirmed, subscribed_at) values ('smoke@redfox.dev', 1, '2026-11-07')", mode: 'write',
  });
  assert('runs write query in write mode', sqlWrite.status === 200 && sqlWrite.json.changes === 1);
  const isolation = await call('POST', '/api/database/pulso-api/sql', { sql: 'select name from sqlite_master where type=\'table\'', mode: 'read' });
  const pulsoTables = (isolation.json?.rows || []).map((r) => r.name);
  assert('project databases are isolated', !pulsoTables.includes('leads') && pulsoTables.includes('organizations'), pulsoTables.join(','));

  /* storage */
  const storage = await call('GET', '/api/storage');
  assert('buckets listed', storage.json?.buckets?.length >= 5);
  const bucket = storage.json.buckets[0];
  const upload = await fetch(`${BASE}/api/storage/${bucket.id}/upload?path=smoke/test.txt`, {
    method: 'POST', headers: { 'content-type': 'text/plain', cookie }, body: 'hello from the smoke test',
  });
  assert('uploads a file', upload.status === 201, `HTTP ${upload.status}`);
  const objects = await call('GET', `/api/storage/${bucket.id}/objects`);
  const uploaded = objects.json?.items?.find((o) => o.path === 'smoke/test.txt');
  assert('file appears in listing', !!uploaded, uploaded?.size_label);
  const signed = await call('POST', `/api/storage/objects/${uploaded.id}/signed`);
  const signedFetch = await fetch(BASE + signed.json.url);
  assert('signed URL downloads', signedFetch.status === 200 && (await signedFetch.text()).includes('hello from'));
  const content = await call('GET', `/api/storage/objects/${uploaded.id}/content`);
  assert('authenticated content read', content.status === 200);
  const removed = await call('DELETE', `/api/storage/objects/${uploaded.id}`);
  assert('deletes a file', removed.status === 200);

  /* env vars */
  const env = await call('GET', '/api/projects/atlas-web/env');
  const secretVar = env.json.items.find((v) => v.is_secret);
  assert('env vars masked', !!secretVar && secretVar.masked.includes('•'), secretVar?.masked);
  const revealed = await call('POST', `/api/projects/atlas-web/env/${secretVar.id}/reveal`);
  assert('reveal returns value', revealed.status === 200 && typeof revealed.json.value === 'string');
  const createdVar = await call('POST', '/api/projects/atlas-web/env', { key: 'SMOKE_TEST_FLAG', value: 'enabled', target: 'preview' });
  assert('creates env var', createdVar.status === 201);
  const duplicate = await call('POST', '/api/projects/atlas-web/env', { key: 'SMOKE_TEST_FLAG', value: 'x', target: 'preview' });
  assert('rejects duplicate env var', duplicate.status === 409);

  /* domains */
  const domains = await call('GET', '/api/domains');
  assert('domains listed', domains.json?.domains?.length >= 6);
  const addDomain = await call('POST', '/api/projects/atlas-web/domains', { hostname: `smoke-${Date.now()}.example.com` });
  assert('adds a domain', addDomain.status === 201);
  const verify = await call('POST', `/api/projects/atlas-web/domains/${addDomain.json.domain.id}/verify`);
  assert('domain verification performs a real DNS lookup', verify.status === 200 && verify.json.verified === false, (verify.json?.result?.errors || []).join(' | ').slice(0, 90));
  await call('DELETE', `/api/projects/atlas-web/domains/${addDomain.json.domain.id}`);

  /* infrastructure */
  const servers = await call('GET', '/api/servers');
  assert('servers listed', servers.json?.servers?.length >= 4);
  assert('local host reports live metrics', servers.json.servers.some((s) => s.mode === 'local' && typeof s.cpu === 'number'));
  const local = servers.json.servers.find((s) => s.mode === 'local');
  const hostTest = await call('POST', `/api/servers/${local.id}/test`);
  assert('local host probe succeeds', hostTest.json?.reachable === true);
  const demo = servers.json.servers.find((s) => s.mode === 'demo');
  const demoTest = await call('POST', `/api/servers/${demo.id}/test`);
  assert('demo server probe is honest', demoTest.json?.reachable === false && demoTest.json.demo === true);

  const containers = await call('GET', '/api/containers');
  assert('containers listed', containers.json?.containers?.length >= 6);
  const container = containers.json.containers[0];
  const containerAction = await call('POST', `/api/containers/${container.id}/restart`);
  assert('container control refused on demo server', containerAction.status === 409, containerAction.json?.error?.slice(0, 50));

  const monitoring = await call('GET', '/api/monitoring');
  assert('monitoring payload', monitoring.status === 200 && monitoring.json.servers.length >= 4);
  assert('monitoring has live series', monitoring.json.servers.some((s) => s.series.length > 10));

  const logs = await call('GET', '/api/logs?limit=10');
  assert('logs query', logs.status === 200 && logs.json.items.length > 0, `${logs.json?.total} total`);
  const errorLogs = await call('GET', '/api/logs?level=error&limit=5');
  assert('logs filter by level', errorLogs.json.items.every((l) => l.level === 'error'));

  /* solene */
  const status = await call('GET', '/api/solene/status');
  assert('solene reports its mode', ['local', 'model'].includes(status.json?.mode), status.json?.mode);
  const conv = await call('POST', '/api/solene/conversations', { project_id: 'pulso-api' });
  const convId = conv.json?.conversation?.id;
  assert('creates conversation', !!convId);
  const answer = await call('POST', `/api/solene/conversations/${convId}/messages`, { content: 'Why did the last deployment fail?' });
  assert('solene answers from real data', answer.status === 201 && answer.json.message.content.length > 80, `${answer.json?.message?.content?.length} chars, mode=${answer.json?.mode}`);
  const convList = await call('GET', '/api/solene/conversations');
  assert('conversation persisted', convList.json.conversations.some((c) => c.id === convId));
  await call('DELETE', `/api/solene/conversations/${convId}`);

  /* api keys + public data API */
  const key = await call('POST', '/api/explorer/keys', { project: 'atlas-web', name: 'smoke key', scopes: 'read' });
  assert('creates api key', key.status === 201 && key.json.key.startsWith('rf_live_'), key.json?.id);
  const publicData = await fetch(`${BASE}/v1/atlas-web/leads?limit=2`, { headers: { apikey: key.json.key } });
  const publicJson = await publicData.json();
  assert('data API returns rows with key', publicData.status === 200 && Array.isArray(publicJson) && publicJson.length === 2);
  assert('data API sets content-range', !!publicData.headers.get('content-range'), publicData.headers.get('content-range'));
  const wrongProject = await fetch(`${BASE}/v1/pulso-api/organizations`, { headers: { apikey: key.json.key } });
  assert('data API enforces project scope', wrongProject.status === 403);
  const noKey = await fetch(`${BASE}/v1/atlas-web/leads`);
  assert('data API requires a key', noKey.status === 401);
  await call('DELETE', `/api/explorer/keys/${key.json.id}`);

  const explorer = await call('POST', '/api/explorer/request', { method: 'GET', path: '/api/projects' });
  assert('explorer proxies a real request', explorer.status === 200 && explorer.json.status === 200, `${explorer.json?.duration_ms}ms`);

  /* project lifecycle */
  const created = await call('POST', '/api/projects', { name: 'Smoke Project', framework: 'vite', runner: 'demo' });
  assert('creates a project', created.status === 201, created.json?.project?.slug);
  const dup = await call('POST', '/api/projects', { name: 'Smoke Project' });
  assert('rejects duplicate project slug', dup.status === 409);
  const patched = await call('PATCH', `/api/projects/${created.json.project.slug}`, { build_command: 'npm run build:prod' });
  assert('updates project settings', patched.status === 200 && patched.json.project.build_command === 'npm run build:prod');
  const deletedWrong = await call('DELETE', `/api/projects/${created.json.project.slug}`, { confirm: 'nope' });
  assert('delete needs slug confirmation', deletedWrong.status === 400);
  const deleted = await call('DELETE', `/api/projects/${created.json.project.slug}`, { confirm: 'smoke-project' });
  assert('deletes project', deleted.status === 200);

  /* webhook */
  const hook = await fetch(`${BASE}/api/webhooks/git/${atlasRepo.id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-redfox-event': 'push', 'x-redfox-signature': 'sha256=deadbeef' },
    body: JSON.stringify({ ref: 'refs/heads/main', after: 'deadbeef' }),
  });
  assert('webhook rejects a bad signature', hook.status === 401 && (await hook.json()).error === 'Signature mismatch');

  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  if (failures) {
    console.log('\nFailures:');
    for (const r of results.filter((x) => !x.ok)) console.log(` - ${r.name} ${r.detail}`);
    process.exit(1);
  }
  console.log('All checks passed.\n');
})().catch((error) => {
  console.error('smoke test crashed:', error);
  process.exit(1);
});

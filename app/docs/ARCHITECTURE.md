# Redfox architecture

Redfox is a single Node process plus a SQLite data root. That is a deliberate starting
point, not a limitation of the design: every external system sits behind a boundary that
can be replaced without touching the interface.

```
browser ── HTTP ──▶ server/index.js
                        │
                        ├── auth.js             sessions · roles · audit
                        ├── db.js               SQLite (app data + per-project DBs)
                        ├── services/deployEngine.js   queue · runner · artefacts
                        ├── services/docker.js         Docker engine client
                        ├── services/dns.js            domain verification
                        ├── services/metrics.js        host metrics
                        └── services/llm.js            model provider
```

## Multi-tenancy

Every table that holds workspace data carries `workspace_id`. Requests resolve a
workspace from the session and all queries are scoped to it, including joins. RBAC is
checked per route:

| Role | Read | Write projects/deploys | Manage members/settings | Delete workspace |
| --- | --- | --- | --- | --- |
| viewer | yes | no | no | no |
| developer | yes | yes | no | no |
| admin | yes | yes | yes | no |
| owner | yes | yes | yes | yes |

Environment values, API keys and webhook secrets are encrypted with AES-256-GCM using
key material derived from `REDFOX_SECRET_KEY`. The browser only ever sees masks; reveal
is a separate authenticated request that is audited.

## Deployment pipeline

1. A push webhook (`POST /api/webhooks/git/:repoId`) or a manual trigger creates a
   deployment row with status `queued`.
2. The queue is a FIFO in `deployEngine.js`. It provisions a workspace under
   `REDFOX_BUILD_DIR`, outside the application tree, so tooling cannot resolve Redfox's
   own `package.json`.
3. The branch tree is materialised from the repository store, project variables for the
   target environment are decrypted into the process environment, install and build
   commands run with a timeout.
4. The output directory is copied to `data/deployments/<deploymentId>` and served at
   `/preview/<deploymentId>/`.
5. Every line of stdout/stderr is persisted against the deployment with a phase and
   severity, which is what Solene reads when explaining a failure.

Statuses: `queued → building → deploying → ready`, or `failed` / `cancelled`. Rollback
re-points production at the artefact of a previous successful deployment; promote copies
a preview's commit onto the production branch record and queues a production build.

### Replacing the runner

`deployEngine.js` exports `enqueue(deploymentId)`. A remote runner only needs to consume
the same deployment rows and write back status and logs. The expected contract:

```
POST /api/internal/deployments/:id/claim     → 200 with deployment + signed variable bundle
POST /api/internal/deployments/:id/logs      → append log lines
POST /api/internal/deployments/:id/finish    → status, duration, artefact location, error
```

That contract is what a Docker-based worker, or one running on a connected server, would
implement. Nothing in the interface changes.

## Integration boundaries

Each of these is a single module today and a swap later.

### Git: Gitea

The native store keeps repositories, branches, commits and file blobs in SQLite and is
what the interface talks to. For Gitea, keep the `repositories` row and replace the file
and commit calls with the Gitea API: `/api/v1/repos/{owner}/{repo}/contents`,
`/git/commits`, `/branches`. Webhooks already carry a per-repository secret and an event
list, so pointing `remote_url` at a Gitea remote needs no schema change. Git smart HTTP
is served today as a read-only advertisement at `/git/:slug.git`; a real remote needs the
pack protocol, which is exactly what Gitea provides.

### Database: PostgreSQL + PostgREST

Project databases are isolated per project today (one SQLite file each, no cross-project
access, no shared credentials). The `databases` table records engine, version, region and
status, and the SQL editor executes against the project's connection. Moving to Postgres
means:

- one database (or schema) per project, created by a provisioning worker;
- `databases.file_path` becomes a connection reference, never a password;
- the SQL editor calls PostgREST's `/rpc` with a scoped role;
- row-level policies mirror the workspace role model.

The API surface already returns connection *hints* only, so no credential needs to move
into the browser.

### Object storage: S3

`routes/storage.js` writes objects to `data/storage/<bucket>/<path>` and returns signed
download URLs. The S3 adapter implements the same three operations: `putObject`,
`getSignedUrl`, `deleteObject`. Bucket access policy (private / public read) maps to ACLs
or bucket policy.

### Containers: Docker

`services/docker.js` speaks the Docker Engine API over a unix socket or `DOCKER_HOST`.
When no engine is reachable, container actions return 409 with the reason and the UI shows
a connection prompt instead of a fake success. The seeded infrastructure rows are marked
`mode='demo'` and rendered as demonstration data.

### Routing: Traefik

Preview URLs are served by the Redfox process today. In a multi-node install Traefik
labels are generated per deployment:

```
traefik.http.routers.<deployment>.rule=Host(`<slug>--<hash>.redfox.app`)
traefik.http.services.<deployment>.loadbalancer.server.port=8080
```

Custom domains resolve to the same router set, which is why the `domains` table stores the
verification record and the routing target separately.

## BYOC

The Bring Your Own Cloud path is a first-class goal:

1. **Connected servers.** The `servers` table already models provider, region, address,
   capacity and status, and the Docker boundary takes an endpoint per server.
2. **Remote runner.** The internal deployment contract above is transport-agnostic; a
   worker on a user's server can claim jobs, stream logs and publish artefacts to the
   user's own object storage.
3. **Customer infrastructure.** Gitea, Postgres and S3 endpoints become per-workspace
   settings rather than platform defaults, so workspaces can point at their own stack.
4. **Data residency.** Workspace region already exists on the model; it becomes the
   selector for which provider and bucket a project is provisioned into.

Nothing in the interface is tied to Redfox hosting: every panel reads state from the API,
and every API route resolves its backing store through one module.

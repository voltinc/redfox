# Redfox

An all-in-one developer cloud: git hosting, deployments, databases, storage, container
infrastructure and an AI assistant in a single platform. Dark-first interface, real build
execution, honest boundaries wherever a capability needs infrastructure this host does
not have.

```
Overview  Projects  Deployments  Domains
Repositories  Database  Storage  API Explorer
Servers  Containers  Environment Variables  Logs  Monitoring
Solene
```

## Quick start

```bash
npm install
npm --prefix web install
npm run build       # builds web/dist
npm run seed        # creates the demo workspace and data
npm start           # http://localhost:3000
```

Demo account: `demo@redfox.dev` / `redfox-demo` (owner). The login screen also lists the
other seeded roles (admin, developer, viewer) so permission behaviour can be checked.

For development, `npm run dev` runs the API on `:3000` and Vite on `:5173` with proxies.

### Docker

```bash
docker compose up --build
```

The image builds the web bundle, seeds on first boot and stores everything under the
`redfox-data` volume. Set `REDFOX_SECRET_KEY` in the environment before exposing it to
anyone: it encrypts environment-variable values and API keys.

## What is actually implemented

| Area | Behaviour |
| --- | --- |
| Authentication | Email + password with scrypt hashes, HTTP-only session cookies, self-serve signup, rate-limited login and registration, four roles (owner, admin, developer, viewer), audit log. |
| Workspaces | Multi-workspace membership, workspace switching, expiring invitation links (14 days) with role selection, revoke, invite-aware signup that joins the invited workspace. |
| Onboarding | A new account starts empty, with a guided first-project flow instead of sample data. |
| Projects | Create, edit, delete with typed confirmation, framework presets, build command, output directory, activity feed, per-project tabs. |
| Git hosting | Native repository layer: repositories, branches, commits, file trees, file read/write, webhooks with secrets, remote configuration. Real objects, real history. |
| Deployments | A real local build runner: checks out the branch, injects environment variables, runs install and build, publishes artefacts, serves them at `/preview/<id>/`. Statuses, logs, redeploy, rollback, promote, cancel. |
| Build logs | Streamed line-by-line with phase and severity, persisted, filterable, copyable. |
| Database | One SQLite file per project (never shared), table browser, schema explorer, SQL editor with real execution and row limits, connection info. |
| Storage | Buckets and files stored on disk with checksums, signed download URLs, access policies, usage accounting. |
| Environment variables | AES-256-GCM encryption at rest, per-environment scoping, masked by default, explicit reveal, copy. |
| Infrastructure | Server, container and monitoring views backed by stored state; actions are refused when no runtime is connected instead of pretending. |
| Solene | Chat with a real local analysis engine over your deployment logs, schema and configuration. Uses a hosted model only if `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY` is set. |
| API Explorer | Lists the live REST surface, endpoints and example payloads, pulls a real API key. |
| Documentation | An in-product reference at `/docs` covering deploys, environments, databases, storage, API keys, roles and operations. |
| Public site | A marketing landing page with real screenshots of the running console, sign-in and sign-up routes. |

## Honest boundaries

Redfox runs on one host. Anything that needs other machines is modelled, labelled and
refused rather than simulated:

- **Demo-mode records.** Seeded servers and containers carry `mode='demo'` and the UI
  prints "demonstration data" next to them. Real local records (`mode='local'`) are
  distinguished everywhere.
- **Recorded deployments.** Historical seeded deployments are marked `mode='recorded'`
  with their original logs. Deployments you trigger run the real engine.
- **Container controls.** Start/stop/restart require a connected Docker endpoint
  (`DOCKER_HOST`); without it the API returns 409 and the UI explains why.
- **Domain verification** performs a real DNS lookup of the expected CNAME/A record.
- **Solene** never invents a model answer. Without a provider key the reply is computed
  from workspace data and labelled "local analysis".

## Architecture

```
web/            React + Vite + Tailwind interface
server/
  index.js      HTTP server, static bundle, preview routing
  db.js         SQLite schema and migrations
  auth.js       sessions, roles, workspace scoping, audit
  routes/       auth, projects, repos, deployments, database, storage,
                envvars, domains, infrastructure, logs, monitoring,
                solene, explorer, apikeys
  services/
    deployEngine.js   build queue, command runner, artefact publishing
    analysis.js       Solene's local analysis (real log/schema inspection)
    llm.js            model provider boundary
    docker.js         Docker engine client boundary
    dns.js            domain verification
    metrics.js        host metrics collection
  lib/scaffold.js     starter sources committed to new repositories
data/           SQLite databases, artefacts, uploaded objects
```

Details and the integration contracts for Gitea, PostgreSQL/PostgREST, Docker, Traefik
and S3 live in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Environment

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (default 3000). |
| `REDFOX_DATA_DIR` | Data root (default `./data`). |
| `REDFOX_SECRET_KEY` | Key material for environment-variable encryption. Set in production. |
| `REDFOX_BUILD_DIR` | Build workspace root (default: system temp). Kept outside the app tree so npm cannot inherit Redfox's own manifest. |
| `REDFOX_BUILD_TIMEOUT_MS` | Per-command build timeout (default 180000). |
| `GEMINI_API_KEY` | Enables hosted Solene answers on Google Gemini (default `gemini-2.5-flash`). `GOOGLE_API_KEY` works as an alias. |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` | Alternative hosted providers; Gemini wins when several keys are present. |
| `REDFOX_MODEL` | Model name override for the selected provider, e.g. `gemini-2.5-pro`. |
| `DOCKER_HOST` | Enables real container controls when a Docker API endpoint is reachable. |

## Safety notes

- Database credentials and service keys never reach the browser; the API exposes
  connection *hints*, not secrets.
- Environment values are encrypted at rest and returned masked unless explicitly revealed
  by a user with write access.
- Build commands run as the server user with the project's variables injected. Treat the
  build runner as trusted code: run Redfox on a host you control, or in the container
  image, and never expose it to untrusted users without isolating the runner further.
- Preview content is served from published artefacts on a separate path; it never
  executes project code server-side.

## Tests

```bash
npm run smoke     # 67 API assertions against a running instance
```

`npm run smoke` boots against a live server and exercises the real API, including an
actual build of the Atlas Web project and a fetch of the published preview artefact.

The browser harness used during development (a 30-route sweep for console errors and
layout overflow, plus end-to-end flows for login, project creation, deployment,
environment variables, SQL, storage, git commits, domains, Solene and deletion) runs on
Playwright and is kept outside this source bundle.

## Navigation

The console groups related surfaces into five tabbed hubs so the sidebar stays short:

| Hub | Tabs | Legacy URLs |
| --- | --- | --- |
| Data | SQL databases, object storage | `/database`, `/storage` redirect |
| Observability | Logs, metrics | `/logs`, `/monitoring` |
| Infrastructure | Servers, containers, environment | `/servers`, `/containers`, `/environment` |
| Documentation | Guide, API reference | `/explorer` |
| Settings | Workspace, account | `/settings/workspace` |

Old links keep working: every legacy path redirects to its hub and carries any `?project=` selection through.

## Recovering access

There is no outbound mail, so passwords are reset on the host:

```bash
npm run reset-password -- you@company.com          # generates a password
npm run reset-password -- you@company.com newpass  # or set one
```

The command rewrites the hash with scrypt and deletes that user's sessions, so anyone already signed in is logged out.

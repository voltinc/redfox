import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen, Boxes, Database, Globe, HardDrive, KeyRound, Rocket, ScrollText, ShieldCheck, Sparkles, Terminal, Users,
} from 'lucide-react';
import { PageBody } from '../components/Shell.jsx';
import { Badge, Panel, PageHeader } from '../ui/index.jsx';

const SECTIONS = [
  {
    id: 'quickstart',
    title: 'Quickstart',
    icon: Rocket,
    body: [
      'Create a project from Projects → New project. Redfox creates the repository, an isolated SQLite database, a storage bucket and three environments, then commits a static starter page.',
      'Press Deploy on the project. The local runner checks out the branch into a workspace outside the application tree, injects the environment variables for the target environment, runs the configured install and build commands, and publishes the output directory as an immutable artifact.',
      'Deployments are immutable. A preview URL looks like /preview/<deployment-id>/ and keeps serving the artifact you built, even after later deployments.',
    ],
  },
  {
    id: 'projects',
    title: 'Projects and configuration',
    icon: Boxes,
    body: [
      'Framework presets set the install command, build command and output directory. Static projects have no build step: the repository root is the artifact.',
      'The runner is per project. Local executes real builds on this host. Simulated records the pipeline without executing it, and every screen marks those records so they are never mistaken for real output.',
      'Output directory is relative to the checkout root. Leave the build command empty to publish source files as-is.',
    ],
  },
  {
    id: 'git',
    title: 'Repositories',
    icon: Terminal,
    body: [
      'Every project has a native repository with branches, commits, per-commit file lists and diffs. Create or edit files from the file browser; each save is a commit with an author, message and content-addressed SHA.',
      'Branches are cheap: create one from the current tree and deploy it as a preview. Protected default branches require the developer role or higher to write.',
    ],
  },
  {
    id: 'databases',
    title: 'Databases',
    icon: Database,
    body: [
      'Each project gets a separate database file, so isolation is real rather than a naming convention. The SQL editor runs statements against the selected project only.',
      'Writes are audited and require the developer role. Results are capped and include execution time, so a runaway query is obvious immediately.',
    ],
  },
  {
    id: 'storage',
    title: 'Object storage',
    icon: HardDrive,
    body: [
      'Uploads are stored on this host with a SHA-256 checksum, content type and size. Buckets are scoped to a project and can be private or public.',
      'Private objects are only reachable through a signed URL with an expiry, generated on demand. Public objects serve directly.',
    ],
  },
  {
    id: 'api',
    title: 'API and keys',
    icon: KeyRound,
    body: [
      'The console is a client of the same HTTP API that your code can use. Create a key under API Explorer → Keys with read or read+write scope; the secret is shown once and stored only as a hash.',
      'Send it as a bearer token against /v1: GET /v1/projects, GET /v1/projects/:slug, POST /v1/projects/:slug/deployments, GET /v1/deployments/:id.',
      'Requests with a missing, revoked or under-scoped key are rejected before they reach project data, and every key records its last use.',
    ],
    code: `curl -H "authorization: Bearer rf_live_..." \\
  http://localhost:3000/v1/projects`,
  },
  {
    id: 'domains',
    title: 'Domains',
    icon: Globe,
    body: [
      'Add a domain to a project, then verify it. Verification performs a real DNS lookup for the CNAME or A record and records the answer it received.',
      'A domain stays pending until the record matches. Redfox does not mark a domain verified because you asked it to.',
    ],
  },
  {
    id: 'environments',
    title: 'Environments and secrets',
    icon: ScrollText,
    body: [
      'Variables are scoped to production, preview or all environments. Values are encrypted with AES-256-GCM under the instance key and are never returned in full by the API after they are saved.',
      'The build runner decrypts values for the target environment only, at build time. Revealing a value in the console is audited.',
    ],
  },
  {
    id: 'security',
    title: 'Security and roles',
    icon: ShieldCheck,
    body: [
      'Four roles: owner, admin, developer and viewer. Read paths are open to every member; writes require developer or above; membership, domains and workspace settings require admin.',
      'Sessions are httpOnly cookies with a server-side record, listed and revocable in account settings. Sign-in and signup are rate limited per address.',
      'Every meaningful change writes an audit event with the actor, action and target. The workspace audit log is the source of truth for who did what.',
    ],
  },
  {
    id: 'ai',
    title: 'Model providers',
    icon: Sparkles,
    body: [
      'Solene answers from local workspace analysis unless a model key is present. Set one of GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY or OPENROUTER_API_KEY in the environment and restart the server; the provider badge in the sidebar turns orange.',
      'Gemini is the default when GEMINI_API_KEY is set, using gemini-2.5-flash. Override the model for any provider with REDFOX_MODEL. Keys are read from the environment only, never stored in the database and never shown in the interface.',
    ],
    code: `# .env\nGEMINI_API_KEY=your-key\n# optional\nREDFOX_MODEL=gemini-2.5-pro`,
  },
  {
    id: 'recovery',
    title: 'Recovering access',
    icon: KeyRound,
    body: [
      'This deployment has no outbound mail, so password recovery is an operator action rather than an email link. Run the reset command on the host; it rewrites the hash and signs every existing session out.',
      'If you cannot reach the host, any workspace owner can reset a member password from Workspace settings. For a locked-out sole owner, the command below is the only route back in, which is why it runs next to the database rather than in the browser.',
    ],
    code: `npm run reset-password -- you@company.com\n# or let it generate one\nnpm run reset-password -- you@company.com`,
  },
  {
    id: 'team',
    title: 'Team and invitations',
    icon: Users,
    body: [
      'Create an invitation from Workspace settings. Choose a role, optionally pin it to an email address, and share the link. Invitations expire after seven days and can be revoked at any time.',
      'Recipients who already have an account join immediately. New users create the account and land in the inviting workspace rather than an empty one of their own.',
    ],
  },
];

export default function Docs() {
  const { hash } = useLocation();
  const [active, setActive] = useState(SECTIONS[0].id);
  const section = SECTIONS.find((item) => item.id === active) || SECTIONS[0];

  // Deep links such as /docs#recovery open the matching section.
  useEffect(() => {
    const id = String(hash || '').replace('#', '');
    if (id && SECTIONS.some((item) => item.id === id)) setActive(id);
  }, [hash]);

  return (
    <>
      <PageHeader
        title="Documentation"
        description="How Redfox actually behaves: the pipeline, the data model, the API and the security model."
        actions={<Badge tone="neutral">v0.9</Badge>}
      />
      <PageBody>
        <div className="[&>*]:min-w-0 grid gap-2.5 lg:grid-cols-[210px_minmax(0,1fr)]">
          <Panel className="h-fit overflow-hidden lg:sticky lg:top-3">
            <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
              <BookOpen size={12} className="text-dim" />
              <span className="text-2xs uppercase tracking-[0.1em] text-dim">Contents</span>
            </div>
            <nav className="py-1">
              {SECTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActive(item.id)}
                    className={`flex w-full items-center gap-2 px-3 py-[6px] text-left text-xs transition-colors ${
                      active === item.id ? 'bg-panel-2 text-fg' : 'text-muted hover:bg-panel-2/60 hover:text-fg'
                    }`}
                  >
                    <Icon size={12} className={active === item.id ? 'text-accent' : 'text-dim'} />
                    {item.title}
                  </button>
                );
              })}
            </nav>
          </Panel>

          <Panel className="min-w-0">
            <article className="px-5 py-4">
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-fg">{section.title}</h2>
              <div className="mt-2 space-y-2.5">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="max-w-[74ch] text-[13px] leading-6 text-muted">{paragraph}</p>
                ))}
              </div>
              {section.code ? (
                <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-[#f8f1e4] px-3 py-2.5 font-mono text-[11.5px] leading-5 text-muted">
                  {section.code}
                </pre>
              ) : null}
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-2xs text-dim">
                  Need the full reference? The bundle ships README.md and docs/ARCHITECTURE.md with the storage
                  layout, adapter boundaries and bring-your-own-cloud path.
                </p>
                <Link to="/solene" className="mt-1.5 inline-block text-xs text-accentInk underline decoration-accentInk/40 underline-offset-2">
                  Ask Solene about this workspace
                </Link>
              </div>
            </article>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}

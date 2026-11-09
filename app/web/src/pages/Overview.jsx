import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowRight, ArrowUpRight, Box, Database, GitBranch, Globe, HardDrive, KeyRound, Plus,
  Rocket, ScrollText, Server, Sparkles, Terminal,
} from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import { DeployModal } from '../components/DeployModal.jsx';
import GettingStarted from '../components/GettingStarted.jsx';
import {
  Badge, Banner, Button, Dot, EmptyState, ErrorState, IconButton, LoadingBlock, Panel, PageHeader,
  SectionTitle, StatusBadge, Table, Td, Th, Tr, Sparkline,
} from '../ui/index.jsx';
import { AreaChart, BarSeries, StatTile, UsageBar } from '../ui/Charts.jsx';
import { bytes, cx, duration, num, relativeTime, shortSha } from '../lib/format.js';

const QUICK_ACTIONS = [
  { label: 'New project', to: '/projects/new', icon: Plus },
  { label: 'Browse repositories', to: '/repositories', icon: GitBranch },
  { label: 'Open SQL editor', to: '/database', icon: Database },
  { label: 'Ask Solene', to: '/solene', icon: Sparkles },
];

export default function Overview() {
  const { workspace, user, llm } = useAuth();
  const navigate = useNavigate();
  const [deployOpen, setDeployOpen] = useState(false);
  const { data, loading, error, reload } = useApi('/api/overview');

  if (error) {
    return (
      <PageBody>
        <ErrorState error={error} onRetry={reload} />
      </PageBody>
    );
  }

  const projects = data?.projects || [];
  const deployments = data?.deployments || [];
  const stats = data?.stats || {};
  const series = data?.series || [];
  const events = data?.events || [];
  const databases = data?.databases || [];
  const infrastructure = data?.infrastructure || { servers: [], containers: [], host: {} };
  const repoActivity = data?.repo_activity || [];

  const successSeries = series.map((s) => (s.ready + s.failed > 0 ? Math.round((s.ready / (s.ready + s.failed)) * 100) : 0));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${workspace?.name} · ${projects.length} projects · ${stats.repositories ?? 0} repositories · region ${workspace?.region}`}
        actions={(
          <>
            <Button size="sm" variant="secondary" icon={Activity} onClick={() => navigate('/monitoring')}>Monitoring</Button>
            <Button size="sm" variant="primary" icon={Rocket} onClick={() => setDeployOpen(true)}>Deploy</Button>
          </>
        )}
      />

      <PageBody>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-medium tracking-[-0.01em] text-fg">{greeting}, {user?.name?.split(' ')[0]}</h2>
            <p className="mt-0.5 text-sm text-muted">
              {data?.queue?.running ? `${data.queue.running} build in progress` : 'No builds running'}
              {data?.queue?.queued ? ` · ${data.queue.queued} queued` : ''}
              {stats.failed_7d ? ` · ${stats.failed_7d} failed in the last 7 days` : ' · no failures this week'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="inline-flex h-7 items-center gap-1.5 rounded border border-line bg-panel px-2 text-xs text-muted transition-colors hover:border-strong hover:text-fg"
              >
                <action.icon size={12} /> {action.label}
              </Link>
            ))}
          </div>
        </div>

        {loading ? <LoadingBlock label="Loading workspace" rows={5} /> : !projects.length ? (
          <GettingStarted firstName={user?.name?.split(' ')[0]} workspace={workspace} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <StatTile
                label="Active projects"
                value={projects.filter((p) => p.status === 'active').length}
                hint={`${projects.length} total · ${projects.filter((p) => p.status === 'paused').length} paused`}
                icon={Box}
                onClick={() => navigate('/projects')}
              />
              <StatTile
                label="Deployments · 7d"
                value={stats.deployments_7d ?? 0}
                hint={data?.queue?.running ? `${data.queue.running} building now` : 'queue idle'}
                icon={Rocket}
                onClick={() => navigate('/deployments')}
              />
              <StatTile
                label="Success rate · 7d"
                value={stats.success_rate === null ? '—' : `${stats.success_rate}%`}
                hint={`${stats.failed_7d ?? 0} failed`}
                tone={stats.success_rate !== null && stats.success_rate < 80 ? 'warn' : 'default'}
                spark={successSeries}
              />
              <StatTile
                label="Infrastructure"
                value={`${stats.servers_connected ?? 0}/${infrastructure.servers.length}`}
                hint={`${stats.containers_running ?? 0} of ${stats.containers_total ?? 0} containers running`}
                icon={Server}
                onClick={() => navigate('/servers')}
              />
            </div>

            <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
              <Panel>
                <div className="flex items-start justify-between border-b border-line px-4 py-2.5">
                  <div>
                    <h2 className="text-sm font-medium text-fg">Deployment activity</h2>
                    <p className="mt-0.5 text-xs text-dim">Deployments per day over the last 14 days</p>
                  </div>
                  <div className="flex items-center gap-2 text-2xs text-dim">
                    <span className="tabular">{series.reduce((sum, s) => sum + s.ready, 0)} ready</span>
                    <span className="h-3 w-px bg-line" />
                    <span className="tabular">{series.reduce((sum, s) => sum + s.failed, 0)} failed</span>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <BarSeries
                    data={series}
                    height={104}
                    series={[
                      { key: 'ready', label: 'Ready', color: 'var(--success)' },
                      { key: 'failed', label: 'Failed', color: 'var(--danger)' },
                    ]}
                  />
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3">
                    <div>
                      <p className="text-2xs uppercase tracking-[0.07em] text-dim">Production</p>
                      <p className="mt-0.5 text-sm tabular text-fg">{deployments.filter((d) => d.environment === 'production').length}</p>
                    </div>
                    <div>
                      <p className="text-2xs uppercase tracking-[0.07em] text-dim">Previews</p>
                      <p className="mt-0.5 text-sm tabular text-fg">{deployments.filter((d) => d.environment === 'preview').length}</p>
                    </div>
                    <div>
                      <p className="text-2xs uppercase tracking-[0.07em] text-dim">Median build</p>
                      <p className="mt-0.5 text-sm tabular text-fg">
                        {(() => {
                          const times = deployments.map((d) => d.duration_ms).filter(Boolean).sort((a, b) => a - b);
                          if (!times.length) return '—';
                          return duration(times[Math.floor(times.length / 2)]);
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel>
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <h2 className="text-sm font-medium text-fg">Recent deployments</h2>
                  <Link to="/deployments" className="flex items-center gap-1 text-2xs text-dim hover:text-fg">All <ArrowRight size={10} /></Link>
                </div>
                <div className="divide-y divide-line/70">
                  {deployments.slice(0, 6).map((deployment) => (
                    <Link
                      key={deployment.id}
                      to={`/deployments/${deployment.id}`}
                      className="flex items-center gap-2 px-4 py-[7px] transition-colors hover:bg-raised/60"
                    >
                      <StatusBadge status={deployment.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-fg">{deployment.project_name}</p>
                        <p className="truncate font-mono text-2xs text-dim">{shortSha(deployment.commit_sha)} · {deployment.environment}</p>
                      </div>
                      <span className="shrink-0 text-2xs text-dim">{relativeTime(deployment.created_at)}</span>
                    </Link>
                  ))}
                  {deployments.length === 0 ? <div className="px-4 py-6 text-center text-xs text-dim">No deployments yet.</div> : null}
                </div>
              </Panel>
            </div>

            <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
              <Panel>
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <h2 className="text-sm font-medium text-fg">Projects</h2>
                  <Link to="/projects" className="flex items-center gap-1 text-2xs text-dim hover:text-fg">All projects <ArrowRight size={10} /></Link>
                </div>
                <Table>
                  <thead>
                    <tr>
                      <Th>Project</Th>
                      <Th>Framework</Th>
                      <Th>Last deployment</Th>
                      <Th>Domains</Th>
                      <Th align="right"> </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <Tr key={project.id} onClick={() => navigate(`/projects/${project.slug}`)}>
                        <Td>
                          <div className="flex items-center gap-2">
                            <span className={cx('h-1.5 w-1.5 rounded-full', project.status === 'active' ? 'bg-success' : 'bg-dim')} />
                            <span className="font-medium text-fg">{project.name}</span>
                            <span className="font-mono text-2xs text-dim">{project.slug}</span>
                          </div>
                        </Td>
                        <Td><span className="text-xs text-muted">{project.framework}</span></Td>
                        <Td>
                          {project.last_deployment ? (
                            <span className="flex items-center gap-2">
                              <StatusBadge status={project.last_deployment.status} />
                              <span className="text-2xs text-dim">{relativeTime(project.last_deployment.created_at)}</span>
                            </span>
                          ) : <span className="text-2xs text-dim">never deployed</span>}
                        </Td>
                        <Td>
                          {project.domains.filter((d) => d.status === 'active').length ? (
                            <span className="flex items-center gap-1 text-xs text-muted">
                              <Globe size={11} className="text-dim" />
                              {project.domains.filter((d) => d.status === 'active').length}
                            </span>
                          ) : <span className="text-2xs text-dim">none</span>}
                        </Td>
                        <Td align="right"><ArrowUpRight size={12} className="ml-auto text-dim" /></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </Panel>

              <div className="space-y-2.5">
                <Panel>
                  <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                    <h2 className="text-sm font-medium text-fg">Infrastructure</h2>
                    <Link to="/servers" className="text-2xs text-dim hover:text-fg">Servers</Link>
                  </div>
                  <div className="space-y-2.5 px-4 py-3">
                    {infrastructure.host?.cpu !== undefined ? (
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs text-fg">
                            <Dot tone="success" /> local-node
                            <Badge tone="success">live</Badge>
                          </span>
                          <span className="text-2xs text-dim">{infrastructure.host.cores} cores</span>
                        </div>
                        <div className="space-y-1.5">
                          <UsageBar value={infrastructure.host.cpu} label="CPU" tone={infrastructure.host.cpu > 80 ? 'warn' : 'accent'} />
                          <UsageBar value={infrastructure.host.mem} label="Memory" tone={infrastructure.host.mem > 85 ? 'warn' : 'accent'} />
                          <UsageBar value={infrastructure.host.disk} label="Disk" tone={infrastructure.host.disk > 85 ? 'warn' : 'accent'} />
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5 border-t border-line pt-2.5">
                      {infrastructure.servers.filter((s) => s.mode !== 'local').map((server) => (
                        <span key={server.id} className="inline-flex items-center gap-1 rounded border border-line bg-base px-1.5 py-0.5 text-2xs text-muted">
                          <Dot tone={server.status === 'connected' ? 'success' : server.status === 'error' ? 'danger' : 'neutral'} />
                          {server.name}
                          {server.mode === 'demo' ? <span className="text-dim">· demo</span> : null}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-2xs text-dim">
                      <span>{stats.containers_running} containers running</span>
                      <Link to="/containers" className="hover:text-fg">Containers</Link>
                    </div>
                  </div>
                </Panel>

                <Panel>
                  <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                    <h2 className="text-sm font-medium text-fg">Databases</h2>
                    <Link to="/database" className="text-2xs text-dim hover:text-fg">Open</Link>
                  </div>
                  <div className="divide-y divide-line/70">
                    {databases.map((database) => (
                      <Link
                        key={database.project_id}
                        to={`/database?project=${database.slug}`}
                        className="flex items-center justify-between px-4 py-[6px] transition-colors hover:bg-raised/60"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Database size={11} className="shrink-0 text-dim" />
                          <span className="truncate text-xs text-fg">{database.project}</span>
                          <span className="text-2xs text-dim">{database.tables} tables · {num(database.rows)} rows</span>
                        </span>
                        <span className="shrink-0 text-2xs tabular text-dim">{bytes(database.size_bytes)}</span>
                      </Link>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>

            <div className="mt-2.5 grid gap-2.5 lg:grid-cols-3">
              <Panel>
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <h2 className="text-sm font-medium text-fg">Repository activity</h2>
                  <Link to="/repositories" className="text-2xs text-dim hover:text-fg">Git</Link>
                </div>
                <div className="divide-y divide-line/70">
                  {repoActivity.map((commit) => (
                    <Link key={`${commit.repo_slug}-${commit.sha}`} to="/repositories" className="flex items-start gap-2 px-4 py-2 transition-colors hover:bg-raised/60">
                      <GitBranch size={11} className="mt-[3px] shrink-0 text-dim" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs text-fg">{commit.message}</span>
                        <span className="mt-0.5 block truncate text-2xs text-dim">{commit.author_name} · {commit.repo_slug} · {relativeTime(commit.committed_at)}</span>
                      </span>
                      <span className="shrink-0 font-mono text-2xs text-dim">{shortSha(commit.sha)}</span>
                    </Link>
                  ))}
                </div>
              </Panel>

              <Panel>
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <h2 className="text-sm font-medium text-fg">Recent events</h2>
                  <Link to="/logs" className="text-2xs text-dim hover:text-fg">Logs</Link>
                </div>
                <div className="divide-y divide-line/70">
                  {events.slice(0, 6).map((event) => (
                    <div key={event.id} className="flex items-start gap-2 px-4 py-[6px]">
                      <Dot tone={event.level === 'error' ? 'danger' : event.level === 'warn' ? 'warn' : 'success'} className="mt-[6px]" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs leading-4 text-muted">{event.message}</span>
                        <span className="text-2xs text-dim">{relativeTime(event.created_at)} · {event.actor}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className="flex flex-col">
                <div className="border-b border-line px-4 py-2.5">
                  <h2 className="text-sm font-medium text-fg">Solene</h2>
                  <p className="mt-0.5 text-xs text-dim">{llm?.configured ? `${llm.label} · ${llm.model}` : 'Local analysis mode'}</p>
                </div>
                <div className="flex flex-1 flex-col justify-between px-4 py-3">
                  <p className="text-xs leading-5 text-muted">
                    {llm?.configured
                      ? 'Ask about a failed build, generate SQL, or review your project configuration. Answers use your real workspace data as context.'
                      : 'No model provider is connected, so Solene answers with the local analysis engine: real log parsing, schema inspection and configuration review, clearly labelled.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button size="xs" variant="secondary" icon={Sparkles} onClick={() => navigate('/solene')}>Open assistant</Button>
                    <Button size="xs" variant="ghost" icon={ScrollText} onClick={() => navigate('/logs?level=error')}>Recent errors</Button>
                  </div>
                </div>
              </Panel>
            </div>

            <Banner tone="neutral" className="mt-3" title="About this instance.">
              This workspace is preloaded with sample projects, repositories and deployment history so every screen has real structure to work
              with. Deployments run on the local runner execute real builds on this host and publish a working preview URL. Infrastructure marked
              simulated has not been contacted; Redfox says so wherever it appears.
            </Banner>
          </>
        )}
      </PageBody>

      <DeployModal open={deployOpen} onClose={() => setDeployOpen(false)} projects={projects} />
    </>
  );
}

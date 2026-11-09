import React from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowRight, Clock, Database, ExternalLink, GitBranch, Globe, HardDrive, KeyRound, Rocket, Settings, ShieldCheck, Terminal,
} from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import {
  Badge, Banner, Button, EmptyState, KeyValue, LoadingBlock, Panel, PanelHeader, StatusBadge, Table, Td, Th, Tr,
} from '../ui/index.jsx';
import { DeploymentsTable } from '../components/DeploymentsTable.jsx';
import { bytes, cx, duration, num, relativeTime, shortSha } from '../lib/format.js';

export default function ProjectOverview() {
  const context = useOutletContext();
  const { project, repository, deployments, database, buckets, env_count: envCount, writable } = context;
  const navigate = useNavigate();
  const activity = useApi(`/api/projects/${project.slug}/activity`);
  const last = deployments[0];
  const production = deployments.find((d) => d.environment === 'production' && d.status === 'ready');

  return (
    <PageBody>
      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-2.5">
          <Panel>
            <PanelHeader
              title="Latest deployment"
              icon={Rocket}
              actions={<Link to={`/projects/${project.slug}/deployments`} className="flex items-center gap-1 text-2xs text-dim hover:text-fg">All deployments <ArrowRight size={10} /></Link>}
            />
            {!last ? (
              <EmptyState
                icon={Rocket}
                compact
                title="No deployments yet"
                description="Deploy this project to produce a build log and a preview URL."
                action={<Button size="sm" variant="primary" icon={Rocket} disabled={!writable} onClick={() => navigate(`/projects/${project.slug}/deployments`)}>Go to deployments</Button>}
              />
            ) : (
              <div className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={last.status} />
                      <Badge tone={last.environment === 'production' ? 'accent' : 'neutral'}>{last.environment}</Badge>
                      {last.mode === 'demo' ? <Badge tone="warn">demo runner</Badge> : null}
                      <span className="font-mono text-2xs text-dim">{shortSha(last.commit_sha)}</span>
                    </div>
                    <p className="mt-1.5 truncate text-sm text-fg">{last.commit_message || 'No commit message'}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-2xs text-dim">
                      <span className="flex items-center gap-1"><Clock size={9} /> {duration(last.duration_ms)}</span>
                      <span className="flex items-center gap-1"><GitBranch size={9} /> {last.branch}</span>
                      <span>{relativeTime(last.created_at)}</span>
                      <span>by {last.actor}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/deployments/${last.id}`)}>Open log</Button>
                    {last.status === 'ready' && last.artifact_dir ? (
                      <a
                        href={`/preview/${last.id}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-7 items-center gap-1.5 rounded border border-line bg-raised px-2.5 text-sm text-fg hover:border-strong"
                      >
                        <ExternalLink size={12} /> Preview
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3">
                  <div>
                    <p className="text-2xs uppercase tracking-[0.07em] text-dim">Production</p>
                    <p className="mt-0.5 text-xs text-fg">
                      {production ? <span className="flex items-center gap-1"><ShieldCheck size={10} className="text-success" /> {shortSha(production.commit_sha)}</span> : 'not deployed'}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xs uppercase tracking-[0.07em] text-dim">Deployments</p>
                    <p className="mt-0.5 text-xs tabular text-fg">{deployments.length} recent</p>
                  </div>
                  <div>
                    <p className="text-2xs uppercase tracking-[0.07em] text-dim">Success</p>
                    <p className="mt-0.5 text-xs tabular text-fg">
                      {deployments.length ? `${Math.round((deployments.filter((d) => d.status === 'ready').length / deployments.length) * 100)}%` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader title="Recent deployments" icon={Rocket} dense actions={<Link to={`/projects/${project.slug}/deployments`} className="text-2xs text-dim hover:text-fg">View all</Link>} />
            {deployments.length ? <DeploymentsTable deployments={deployments.slice(0, 5)} /> : <EmptyState icon={Rocket} compact title="Nothing deployed" description="Deployments triggered here produce real build logs." />}
          </Panel>

          <Panel>
            <PanelHeader title="Activity" icon={Clock} dense />
            {activity.loading ? <LoadingBlock label="Loading activity" rows={3} /> : (
              <div className="max-h-[280px] overflow-y-auto divide-y divide-line/60">
                {(activity.data?.activity || []).map((item, index) => (
                  <div key={`${item.kind}-${index}`} className="flex items-start gap-2 px-3 py-1.5">
                    <span className={cx('mt-[6px] h-1 w-1 shrink-0 rounded-full',
                      item.level === 'error' ? 'bg-danger' : item.level === 'warn' ? 'bg-warn' : 'bg-dim')} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-muted">{item.title}</p>
                      <p className="truncate text-2xs text-dim">{item.meta}</p>
                    </div>
                    <span className="shrink-0 text-2xs text-dim">{relativeTime(item.at)}</span>
                  </div>
                ))}
                {!activity.data?.activity?.length ? <p className="px-3 py-4 text-xs text-dim">No activity recorded yet.</p> : null}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-2.5">
          <Panel>
            <PanelHeader title="Configuration" icon={Settings} dense actions={<Link to={`/projects/${project.slug}/settings`} className="text-2xs text-dim hover:text-fg">Edit</Link>} />
            <div className="p-3">
              <KeyValue
                columns={1}
                items={[
                  { label: 'Framework', value: <span className="capitalize">{project.framework}</span> },
                  { label: 'Runner', value: <Badge tone={project.runner === 'local' ? 'success' : 'warn'}>{project.runner === 'local' ? 'local sandbox' : 'demonstration'}</Badge> },
                  { label: 'Install', value: project.install_command, mono: true },
                  { label: 'Build', value: project.build_command, mono: true },
                  { label: 'Output', value: project.output_dir, mono: true },
                  { label: 'Production branch', value: project.production_branch, mono: true },
                ]}
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Repository" icon={GitBranch} dense actions={<Link to={`/projects/${project.slug}/repository`} className="text-2xs text-dim hover:text-fg">Browse</Link>} />
            <div className="p-3">
              {repository ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-fg">{repository.slug}</span>
                    <Badge tone="neutral">{repository.visibility}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-dim">{repository.description || 'No description'}</p>
                  <div className="mt-2 flex items-center gap-2 text-2xs text-dim">
                    <GitBranch size={10} /> default {repository.default_branch}
                  </div>
                </>
              ) : (
                <p className="text-xs text-dim">No repository connected. Import one from project settings.</p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Database" icon={Database} dense actions={<Link to={`/projects/${project.slug}/database`} className="text-2xs text-dim hover:text-fg">Open</Link>} />
            <div className="p-3">
              {database ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">{database.engine} {database.engine_version}</span>
                    <Badge tone="success">{database.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-2xs text-dim">
                    <span>{database.tables} tables · {num(database.rows)} rows</span>
                    <span className="tabular">{bytes(database.size_bytes)}</span>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <Button size="xs" variant="ghost" icon={Terminal} onClick={() => navigate(`/projects/${project.slug}/database`)}>SQL editor</Button>
                  </div>
                </div>
              ) : <p className="text-xs text-dim">No database provisioned.</p>}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Storage" icon={HardDrive} dense actions={<Link to={`/projects/${project.slug}/storage`} className="text-2xs text-dim hover:text-fg">Open</Link>} />
            <div className="divide-y divide-line/60">
              {buckets.length ? buckets.map((bucket) => (
                <Link key={bucket.id} to={`/projects/${project.slug}/storage`} className="flex items-center justify-between px-3 py-[6px] hover:bg-raised/60">
                  <span className="flex items-center gap-1.5 text-xs text-muted"><HardDrive size={10} className="text-dim" /> {bucket.name}</span>
                  <Badge tone={bucket.visibility === 'public' ? 'info' : 'neutral'}>{bucket.visibility}</Badge>
                </Link>
              )) : <p className="px-3 py-3 text-xs text-dim">No buckets. Create one from the Storage tab.</p>}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Domains" icon={Globe} dense actions={<Link to={`/projects/${project.slug}/settings`} className="text-2xs text-dim hover:text-fg">Manage</Link>} />
            <div className="divide-y divide-line/60">
              {project.domains?.length ? project.domains.map((domain) => (
                <div key={domain.hostname} className="flex items-center justify-between px-3 py-[6px]">
                  <span className="truncate font-mono text-2xs text-muted">{domain.hostname}</span>
                  <StatusBadge status={domain.status} />
                </div>
              )) : <p className="px-3 py-3 text-xs text-dim">No custom domains attached.</p>}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Environment" icon={KeyRound} dense actions={<Link to={`/projects/${project.slug}/settings#environment`} className="text-2xs text-dim hover:text-fg">Manage</Link>} />
            <div className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="text-muted">{envCount} variables</span>
              <span className="text-2xs text-dim">values encrypted</span>
            </div>
          </Panel>
        </div>
      </div>

      {project.runner === 'demo' ? (
        <Banner tone="warn" className="mt-2.5" title="Demonstration runner.">
          Deployments for this project record the pipeline without executing it. Change the runner to local in settings to run real builds on this host.
        </Banner>
      ) : null}
    </PageBody>
  );
}

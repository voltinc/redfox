import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Database, Server as ServerIcon } from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import {
  Badge, Banner, Dot, ErrorState, LoadingBlock, PageHeader, Panel, PanelHeader, SegmentedControl,
  StatusBadge, Table, Td, Th, Tr,
} from '../ui/index.jsx';
import { AreaChart, StatTile, UsageBar } from '../ui/Charts.jsx';
import { bytes, num, relativeTime, shortSha } from '../lib/format.js';

const RANGES = [
  { value: '1', label: '1h' },
  { value: '24', label: '24h' },
  { value: '168', label: '7d' },
];

export default function Monitoring() {
  const [hours, setHours] = useState('24');
  const { data, loading, error, reload } = useApi(`/api/monitoring?hours=${hours}`, { deps: [hours] });

  if (error) return <PageBody><ErrorState error={error} onRetry={reload} /></PageBody>;
  if (loading && !data) return <PageBody><LoadingBlock label="Loading metrics" rows={6} /></PageBody>;

  const host = data.host;
  const local = data.servers.find((entry) => entry.server.mode === 'local');
  const demo = data.servers.filter((entry) => entry.server.mode !== 'local');
  const deployCounts = data.deployment_activity.reduce((acc, row) => ({ ...acc, [row.status]: row.n }), {});
  const totalDeployments = Object.values(deployCounts).reduce((sum, n) => sum + n, 0);
  const errorCount = data.log_levels.find((row) => row.level === 'error')?.n ?? 0;

  const chart = (entry, key, color, unit = '%') => {
    const points = entry.series;
    return (
      <AreaChart
        series={[{ key, label: key.toUpperCase(), color, values: points.map((point) => point[key] ?? 0), fill: true }]}
        labels={points.map((point) => new Date(point.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}
        unit={unit}
        yMax={100}
        height={120}
      />
    );
  };

  return (
    <>
      <PageHeader
        title="Monitoring"
        description="Resource usage, deployment activity and application health across the workspace."
        actions={<SegmentedControl size="md" value={hours} onChange={setHours} options={RANGES} />}
      />
      <PageBody wide>
        <div className="mb-2.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatTile label={`Deployments · ${hours === '168' ? '7d' : `${hours}h`}`} value={totalDeployments} hint={`${deployCounts.ready ?? 0} ready · ${deployCounts.failed ?? 0} failed`} icon={Activity} tone={deployCounts.failed ? 'warn' : 'default'} />
          <StatTile label="In flight" value={(data.queue || []).reduce((sum, row) => sum + row.n, 0)} hint={(data.queue || []).map((row) => `${row.status} ${row.n}`).join(' · ') || 'queue idle'} />
          <StatTile label="Error events" value={errorCount} hint="log lines at error level" icon={AlertTriangle} tone={errorCount ? 'danger' : 'default'} />
          <StatTile label="Databases" value={data.database_sizes.length} hint={`${num(data.database_sizes.reduce((sum, entry) => sum + entry.rows, 0))} rows total`} icon={Database} />
        </div>

        <div className="grid gap-2.5 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <PanelHeader title="Host resource usage" description={`${local?.server.name || 'local node'} · sampled every 15 seconds`} icon={ServerIcon} actions={<Badge tone="success">live</Badge>} />
            <div className="grid gap-3 p-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs"><span className="text-muted">CPU</span><span className="tabular text-dim">{host.cpu.toFixed(1)}%</span></div>
                {local ? chart(local, 'cpu', 'var(--accent)') : null}
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs"><span className="text-muted">Memory</span><span className="tabular text-dim">{host.mem.toFixed(1)}%</span></div>
                {local ? chart(local, 'mem', 'var(--info)') : null}
              </div>
              <div className="sm:col-span-2">
                <div className="mb-1 flex items-center justify-between text-xs"><span className="text-muted">Disk</span><span className="tabular text-dim">{host.disk.toFixed(1)}%</span></div>
                {local ? chart(local, 'disk', 'var(--fg-dim)') : null}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 border-t border-line px-3 py-2 text-2xs text-dim">
              <span>{host.cores} cores</span>
              <span>load {host.load.map((n) => n.toFixed(2)).join(' / ')}</span>
              <span>{bytes(host.memoryBytes)} memory</span>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Health" icon={Activity} />
            <div className="divide-y divide-line/70">
              {data.health.map((check) => (
                <div key={check.name} className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs text-fg">{check.name}</p>
                    <p className="font-mono text-2xs text-dim">{check.target}{check.detail ? ` · ${check.detail}` : ''}{check.p95 ? ` · p95 ${check.p95}ms` : ''}</p>
                  </div>
                  <Badge tone={check.status === 'operational' ? 'success' : 'warn'}>{check.status}</Badge>
                </div>
              ))}
            </div>
            <div className="border-t border-line px-3 py-2">
              <p className="text-2xs leading-4 text-dim">
                Checks are derived from stored deployment and database state on this host. External probes appear here once an
                uptime provider is connected.
              </p>
            </div>
          </Panel>
        </div>

        <div className="mt-2.5 grid gap-2.5 lg:grid-cols-2">
          <Panel className="overflow-hidden">
            <PanelHeader title="Servers" description="Resource use per host" dense actions={<Link to="/servers" className="text-2xs text-dim hover:text-fg">Manage</Link>} />
            <div className="divide-y divide-line/70">
              {data.servers.map((entry) => (
                <div key={entry.server.id} className="px-3 py-2">
                  <div className="flex items-center justify-between">
                    <Link to={`/servers/${entry.server.id}`} className="flex items-center gap-1.5 text-xs text-fg hover:text-accent">
                      <Dot tone={entry.server.status === 'connected' ? 'success' : entry.server.status === 'error' ? 'danger' : 'neutral'} />
                      {entry.server.name}
                      {entry.server.mode === 'demo' ? <Badge tone="warn">simulated</Badge> : null}
                    </Link>
                    <span className="text-2xs text-dim">{entry.series.length ? `${new Date(entry.series.at(-1).ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'no data'}</span>
                  </div>
                  {entry.series.length ? (
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      <UsageBar value={entry.series.at(-1).cpu} label="CPU" />
                      <UsageBar value={entry.series.at(-1).mem} label="RAM" />
                      <UsageBar value={entry.series.at(-1).disk} label="Disk" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader title="Databases" description="Size and row counts per project" dense actions={<Link to="/database" className="text-2xs text-dim hover:text-fg">Open</Link>} />
            <Table>
              <thead><tr><Th>Project</Th><Th align="right">Tables</Th><Th align="right">Rows</Th><Th align="right">Size</Th><Th>Status</Th></tr></thead>
              <tbody>
                {data.database_sizes.map((entry) => (
                  <Tr key={entry.slug}>
                    <Td><Link to={`/database?project=${entry.slug}`} className="text-xs text-fg hover:text-accent">{entry.project}</Link></Td>
                    <Td align="right"><span className="tabular text-xs text-muted">{entry.tables}</span></Td>
                    <Td align="right"><span className="tabular text-xs text-muted">{num(entry.rows)}</span></Td>
                    <Td align="right"><span className="tabular text-xs text-muted">{entry.size_label}</span></Td>
                    <Td><StatusBadge status={entry.status} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        </div>

        <Panel className="mt-2.5">
          <PanelHeader title="Recent failures" icon={AlertTriangle} dense actions={<Link to="/deployments?status=failed" className="text-2xs text-dim hover:text-fg">All failures</Link>} />
          {data.recent_failures.length === 0 ? (
            <p className="px-3 py-5 text-center text-xs text-dim">No failed deployments recorded.</p>
          ) : (
            <div className="divide-y divide-line/70">
              {data.recent_failures.map((failure) => (
                <Link key={failure.id} to={`/deployments/${failure.id}`} className="flex items-start gap-2 px-3 py-2 hover:bg-raised/60">
                  <AlertTriangle size={11} className="mt-[3px] shrink-0 text-danger" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-fg">{failure.project_name} <span className="font-mono text-2xs text-dim">{shortSha(failure.commit_sha)}</span></p>
                    <p className="truncate text-2xs text-dim">{failure.error}</p>
                  </div>
                  <span className="shrink-0 text-2xs text-dim">{relativeTime(failure.created_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        {demo.length ? (
          <Banner tone="neutral" className="mt-2.5" title="Simulated series.">
            {demo.length} server{demo.length === 1 ? '' : 's'} show sample metric series, labelled simulated on their pages. Live samples only come from this host.
          </Banner>
        ) : null}
      </PageBody>
    </>
  );
}

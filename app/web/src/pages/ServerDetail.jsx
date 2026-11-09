import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Container, RefreshCw, Server as ServerIcon, Trash2 } from 'lucide-react';
import { del, post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import {
  Badge, Banner, Button, ConfirmDialog, KeyValue, ErrorState, LoadingBlock, PageHeader, Panel, PanelHeader,
  StatusBadge, Table, Td, Th, Tr, useToast,
} from '../ui/index.jsx';
import { AreaChart, UsageBar } from '../ui/Charts.jsx';
import { relativeTime } from '../lib/format.js';
import { canAdmin, useAuth } from '../lib/auth.jsx';

export default function ServerDetail() {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { role } = useAuth();
  const { data, loading, error, reload } = useApi(`/api/servers/${serverId}`);
  const [busy, setBusy] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  if (error) return <PageBody><ErrorState error={error} onRetry={reload} /></PageBody>;
  if (loading && !data) return <PageBody><LoadingBlock label="Loading server" rows={5} /></PageBody>;

  const server = data.server;
  const metrics = data.metrics || [];
  const labels = metrics.map((point) => new Date(point.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));

  const probe = async () => {
    setBusy(true);
    try {
      const result = await post(`/api/servers/${serverId}/test`);
      if (result.reachable) toast.success('Host reachable', result.detail || (result.version ? `Docker ${result.version}` : 'Responded'));
      else toast.push({ title: 'Host unreachable', description: result.error, tone: 'danger' });
      reload();
    } catch (err) {
      toast.error('Probe failed', err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await del(`/api/servers/${serverId}`);
      toast.success('Server removed', server.name);
      navigate('/infrastructure');
    } catch (err) {
      toast.error('Could not remove server', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        breadcrumb={<><Link to="/servers" className="hover:text-fg">Servers</Link><span>/</span><span className="text-muted">{server.name}</span></>}
        title={server.name}
        badge={(
          <>
            <StatusBadge status={server.status} />
            {server.mode === 'demo' ? <Badge tone="warn">demonstration</Badge> : null}
            {server.mode === 'local' ? <Badge tone="success">this host</Badge> : null}
          </>
        )}
        description={`${server.provider} · ${server.region} · ${server.host || server.docker_endpoint || 'no endpoint'}`}
        actions={(
          <>
            <Button size="sm" variant="secondary" icon={ArrowLeft} onClick={() => navigate('/infrastructure')}>Back</Button>
            <Button size="sm" variant="secondary" icon={RefreshCw} loading={busy} onClick={probe}>Probe host</Button>
            <Button size="sm" variant="danger" icon={Trash2} disabled={!canAdmin(role) || server.mode === 'local'} onClick={() => setRemoveOpen(true)}>Remove</Button>
          </>
        )}
      />

      <PageBody>
        {server.mode === 'demo' ? (
          <Banner tone="warn" className="mb-2.5" title="Demonstration record.">
            Redfox has never contacted this host. The metrics and containers below are seeded examples, and container controls are refused with an explicit error.
          </Banner>
        ) : null}
        {server.last_error ? <Banner tone="danger" className="mb-2.5" title="Last connection error.">{server.last_error}</Banner> : null}

        <div className="grid gap-2.5 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <PanelHeader title="Resource usage" description="24 hours of samples" icon={ServerIcon} />
            <div className="p-3">
              {metrics.length > 1 ? (
                <AreaChart
                  series={[
                    { key: 'cpu', label: 'CPU', color: 'var(--accent)', values: metrics.map((m) => m.cpu ?? 0), fill: true },
                    { key: 'mem', label: 'Memory', color: 'var(--info)', values: metrics.map((m) => m.mem ?? 0) },
                  ]}
                  labels={labels}
                  unit="%"
                  yMax={100}
                  height={170}
                />
              ) : (
                <p className="px-1 py-8 text-center text-xs text-dim">No samples recorded for this host yet.</p>
              )}
              <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
                <div>
                  <p className="text-2xs uppercase tracking-[0.07em] text-dim">CPU now</p>
                  <p className="mt-0.5 text-sm tabular text-fg">{server.cpu !== null ? `${Number(server.cpu).toFixed(1)}%` : '—'}</p>
                  <UsageBar className="mt-1" value={server.cpu ?? 0} />
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-[0.07em] text-dim">Memory now</p>
                  <p className="mt-0.5 text-sm tabular text-fg">{server.mem !== null ? `${Number(server.mem).toFixed(0)}%` : '—'}</p>
                  <UsageBar className="mt-1" value={server.mem ?? 0} />
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-[0.07em] text-dim">Disk now</p>
                  <p className="mt-0.5 text-sm tabular text-fg">{server.disk !== null ? `${Number(server.disk).toFixed(0)}%` : '—'}</p>
                  <UsageBar className="mt-1" value={server.disk ?? 0} />
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Details" />
            <div className="p-3">
              <KeyValue
                columns={1}
                items={[
                  { label: 'Provider', value: server.provider },
                  { label: 'Region', value: server.region },
                  { label: 'Endpoint', value: server.docker_endpoint || server.host || '—', mono: true },
                  { label: 'OS', value: server.os || 'unknown' },
                  { label: 'Docker', value: server.docker_version || 'not reported' },
                  { label: 'Cores', value: server.cpu_cores ?? '—' },
                  { label: 'Last seen', value: server.last_seen ? relativeTime(server.last_seen) : 'never' },
                ]}
              />
            </div>
            {data.hint ? <div className="border-t border-line px-3 py-2 text-2xs text-dim">{data.hint}</div> : null}
          </Panel>
        </div>

        <Panel className="mt-2.5 overflow-hidden">
          <PanelHeader title="Containers on this host" icon={Container} dense actions={<Link to="/containers" className="text-2xs text-dim hover:text-fg">All containers</Link>} />
          {data.containers.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-dim">No containers recorded for this host.</p>
          ) : (
            <Table>
              <thead>
                <tr><Th>Container</Th><Th>Image</Th><Th>Status</Th><Th align="right">CPU</Th><Th align="right">Memory</Th><Th>Started</Th></tr>
              </thead>
              <tbody>
                {data.containers.map((container) => (
                  <Tr key={container.id}>
                    <Td>
                      <span className="font-mono text-xs text-fg">{container.name}</span>
                      {container.project_name ? <span className="ml-1.5 text-2xs text-dim">{container.project_name}</span> : null}
                    </Td>
                    <Td><span className="block max-w-[260px] truncate font-mono text-2xs text-dim">{container.image}</span></Td>
                    <Td><StatusBadge status={container.status} /></Td>
                    <Td align="right"><span className="tabular text-xs text-muted">{container.cpu_pct ? `${container.cpu_pct}%` : '—'}</span></Td>
                    <Td align="right"><span className="tabular text-xs text-muted">{container.mem_bytes ? `${(container.mem_bytes / 1048576).toFixed(0)} MB` : '—'}</span></Td>
                    <Td><span className="text-2xs text-dim">{container.started_at ? relativeTime(container.started_at) : 'never'}</span></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </PageBody>

      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={remove}
        loading={busy}
        danger
        title="Remove server"
        description={`Remove ${server.name} from the workspace? The host itself is not modified.`}
        confirmLabel="Remove server"
      />
    </>
  );
}

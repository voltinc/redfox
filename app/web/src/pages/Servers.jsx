import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Plus, RefreshCw, Server as ServerIcon, Trash2 } from 'lucide-react';
import { del, post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import {
  Badge, Banner, Button, ConfirmDialog, Dot, ErrorState, Field, IconButton, Input, LoadingBlock, Modal,
  PageHeader, Panel, PanelHeader, Select, StatusBadge, Table, Td, Th, Tr, useToast,
} from '../ui/index.jsx';
import { UsageBar } from '../ui/Charts.jsx';
import { bytes, cx, relativeTime } from '../lib/format.js';
import { canAdmin, useAuth } from '../lib/auth.jsx';

const PROVIDERS = ['byoc', 'hetzner', 'aws', 'gcp', 'digitalocean', 'redfox-cloud', 'other'];

export default function Servers() {
  const navigate = useNavigate();
  const toast = useToast();
  const { role } = useAuth();
  const admin = canAdmin(role);
  const { data, loading, error, reload } = useApi('/api/servers');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', provider: 'byoc', region: 'eu-west-1', docker_endpoint: '' });
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const servers = data?.servers || [];
  const host = data?.host;

  const addServer = async () => {
    setBusy(true);
    setProbe(null);
    try {
      const result = await post('/api/servers', form);
      setProbe({ ...result.probe, server: result.server });
      toast.success('Server added', result.probe?.ok ? 'Docker host answered the ping.' : 'Record created. The host did not answer.');
      reload();
    } catch (err) {
      toast.error('Could not add server', err.message);
    } finally {
      setBusy(false);
    }
  };

  const test = async (server) => {
    try {
      const result = await post(`/api/servers/${server.id}/test`);
      if (result.reachable) toast.success('Host reachable', result.version ? `Docker ${result.version}` : 'Responded to probe');
      else toast.push({ title: 'Host unreachable', description: result.error, tone: 'danger' });
      reload();
    } catch (err) {
      toast.error('Probe failed', err.message);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await del(`/api/servers/${deleteTarget.id}`);
      toast.success('Server removed', deleteTarget.name);
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error('Could not remove server', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Servers"
        description="Hosts that run your containers. Redfox reports what it can actually reach and labels everything else as demonstration data."
        actions={(
          <>
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={reload}>Refresh</Button>
            <Button size="sm" variant="primary" icon={Plus} disabled={!admin} onClick={() => { setProbe(null); setAddOpen(true); }}>Connect server</Button>
          </>
        )}
      />
      <PageBody>
        {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <LoadingBlock label="Loading infrastructure" rows={5} /> : (
          <>
            <Panel className="mb-2.5">
              <PanelHeader title="This host" icon={ServerIcon} description="Metrics are read directly from the operating system running Redfox." actions={<Badge tone="success">live</Badge>} />
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-2xs uppercase tracking-[0.07em] text-dim">CPU</p>
                  <p className="mt-0.5 text-[19px] font-semibold tabular text-fg">{host?.cpu?.toFixed(1)}%</p>
                  <UsageBar className="mt-1.5" value={host?.cpu} />
                  <p className="mt-1 text-2xs text-dim">{host?.cores} cores · load {host?.load?.map((n) => n.toFixed(2)).join(' / ')}</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-[0.07em] text-dim">Memory</p>
                  <p className="mt-0.5 text-[19px] font-semibold tabular text-fg">{host?.mem?.toFixed(1)}%</p>
                  <UsageBar className="mt-1.5" value={host?.mem} tone={host?.mem > 85 ? 'warn' : 'accent'} />
                  <p className="mt-1 text-2xs text-dim">{bytes(host?.memoryBytes)} total</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-[0.07em] text-dim">Disk</p>
                  <p className="mt-0.5 text-[19px] font-semibold tabular text-fg">{host?.disk?.toFixed(1)}%</p>
                  <UsageBar className="mt-1.5" value={host?.disk} tone={host?.disk > 85 ? 'warn' : 'accent'} />
                  <p className="mt-1 text-2xs text-dim">root volume</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-[0.07em] text-dim">Platform</p>
                  <p className="mt-0.5 text-sm text-fg">{host?.platform}</p>
                  <p className="mt-1 text-2xs text-dim">uptime {Math.floor((host?.uptimeSeconds || 0) / 3600)}h</p>
                  <p className="mt-0.5 text-2xs text-dim">{data?.docker?.reason}</p>
                </div>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <PanelHeader title="Connected servers" description="Records marked demonstration have never been contacted by Redfox." icon={ServerIcon} />
              <Table>
                <thead>
                  <tr>
                    <Th>Server</Th>
                    <Th>Provider</Th>
                    <Th>Status</Th>
                    <Th align="right">Containers</Th>
                    <Th align="right">CPU</Th>
                    <Th align="right">Memory</Th>
                    <Th>Last seen</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {servers.map((server) => (
                    <Tr key={server.id} onClick={() => navigate(`/servers/${server.id}`)}>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <Dot tone={server.status === 'connected' ? 'success' : server.status === 'error' ? 'danger' : 'neutral'} />
                          <span className="font-medium text-fg">{server.name}</span>
                          {server.mode === 'local' ? <Badge tone="success">this host</Badge> : null}
                          {server.mode === 'demo' ? <Badge tone="warn">demo</Badge> : null}
                        </div>
                        <p className="mt-0.5 font-mono text-2xs text-dim">{server.host || server.docker_endpoint || 'no endpoint'}</p>
                      </Td>
                      <Td><span className="text-xs capitalize text-muted">{server.provider} · {server.region}</span></Td>
                      <Td><StatusBadge status={server.status} /></Td>
                      <Td align="right"><span className="tabular text-xs text-muted">{server.containers_running}/{server.containers}</span></Td>
                      <Td align="right"><span className="tabular text-xs text-muted">{server.cpu !== null ? `${Number(server.cpu).toFixed(1)}%` : '—'}</span></Td>
                      <Td align="right"><span className="tabular text-xs text-muted">{server.mem !== null ? `${Number(server.mem).toFixed(0)}%` : '—'}</span></Td>
                      <Td><span className="text-2xs text-dim">{server.last_seen ? relativeTime(server.last_seen) : 'never'}</span></Td>
                      <Td align="right">
                        <div onClick={(event) => event.stopPropagation()} className="flex items-center justify-end gap-0.5">
                          <Button size="xs" variant="ghost" icon={Activity} onClick={() => test(server)}>Probe</Button>
                          <IconButton label="Remove server" icon={Trash2} size={12} tone="danger" disabled={!admin || server.mode === 'local'} onClick={() => setDeleteTarget(server)} />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Panel>

            <Banner tone="neutral" className="mt-2.5" title="Bring your own cloud.">
              Adding a server with a Docker endpoint makes Redfox call <span className="font-mono">/_ping</span> on it immediately. If it answers, containers are
              listed from the live Docker API. If it does not, the error is stored and shown instead of a fake success.
            </Banner>
          </>
        )}
      </PageBody>

      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setProbe(null); }}
        title="Connect a server"
        description="Point Redfox at a Docker Engine endpoint. Leave the endpoint empty to create a demonstration record."
        footer={(
          <>
            <Button size="sm" onClick={() => { setAddOpen(false); setProbe(null); }}>Close</Button>
            <Button size="sm" variant="primary" onClick={addServer} loading={busy} disabled={!form.name.trim()}>Add server</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field label="Name" required>
            <Input autoFocus value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="rf-edge-eu-02" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Provider">
              <Select value={form.provider} onChange={(event) => setForm((prev) => ({ ...prev, provider: event.target.value }))}>
                {PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
              </Select>
            </Field>
            <Field label="Region">
              <Input mono value={form.region} onChange={(event) => setForm((prev) => ({ ...prev, region: event.target.value }))} />
            </Field>
          </div>
          <Field label="Docker endpoint" hint="tcp://host:2375, http://host:2375 or unix:///var/run/docker.sock">
            <Input mono value={form.docker_endpoint} onChange={(event) => setForm((prev) => ({ ...prev, docker_endpoint: event.target.value }))} placeholder="tcp://10.0.0.4:2375" />
          </Field>
          {probe ? (
            <Banner tone={probe.ok ? 'info' : 'danger'} title={probe.ok ? 'Docker host answered.' : 'No answer from the host.'}>
              {probe.ok ? `Docker ${probe.version || 'unknown version'} responded to the ping. Containers will be listed from the live API.` : probe.error}
            </Banner>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={busy}
        danger
        title="Remove server"
        description={`Remove ${deleteTarget?.name} and its container records from this workspace? The host itself is not changed.`}
        confirmLabel="Remove server"
      />
    </>
  );
}

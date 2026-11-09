import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Container as ContainerIcon, Pause, Play, RefreshCw } from 'lucide-react';
import { post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import {
  Badge, Banner, Button, EmptyState, ErrorState, LoadingBlock, PageHeader, Panel, SegmentedControl,
  Select, StatusBadge, Table, Td, Th, Tr, useToast,
} from '../ui/index.jsx';
import { bytes, relativeTime } from '../lib/format.js';
import { canWrite, useAuth } from '../lib/auth.jsx';

export default function Containers() {
  const toast = useToast();
  const { role } = useAuth();
  const writable = canWrite(role);
  const [status, setStatus] = useState('all');
  const [server, setServer] = useState('');
  const [busyId, setBusyId] = useState(null);
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (server) params.set('server', server);
  const { data, loading, error, reload } = useApi(`/api/containers?${params.toString()}`, { deps: [status, server] });

  const containers = data?.containers || [];
  const demoCount = containers.filter((container) => container.server_mode === 'demo').length;

  const act = async (container, action) => {
    setBusyId(`${container.id}-${action}`);
    try {
      await post(`/api/containers/${container.id}/${action}`);
      toast.success(`Container ${action}ed`, container.name);
      reload();
    } catch (err) {
      toast.push({ title: 'Container command refused', description: err.message, tone: 'danger', duration: 7000 });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Containers"
        description="Container workloads across connected servers, with resource use and lifecycle controls."
        actions={<Button size="sm" variant="secondary" icon={RefreshCw} onClick={reload}>Refresh</Button>}
      />
      <PageBody>
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <SegmentedControl
            size="sm"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All' },
              { value: 'running', label: `Running ${data?.counts?.running ?? 0}` },
              { value: 'stopped', label: `Stopped ${data?.counts?.stopped ?? 0}` },
              { value: 'restarting', label: `Restarting ${data?.counts?.restarting ?? 0}` },
            ]}
          />
          <div className="w-[170px]">
            <Select value={server} onChange={(event) => setServer(event.target.value)}>
              <option value="">All servers</option>
              {(data?.servers || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </div>
          <span className="ml-auto text-2xs text-dim">{containers.length} containers</span>
        </div>

        {demoCount ? (
          <Banner tone="warn" className="mb-2.5" title="Simulated containers.">
            {demoCount} container{demoCount === 1 ? '' : 's'} belong to servers this instance has not contacted. Start, stop and restart
            return an explicit refusal for those records rather than pretending to act.
          </Banner>
        ) : null}

        <Panel className="overflow-hidden">
          {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <LoadingBlock label="Loading containers" rows={5} /> : containers.length === 0 ? (
            <EmptyState icon={ContainerIcon} title="No containers" description="Containers appear here once a Docker host is connected and running workloads." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Container</Th>
                  <Th>Server</Th>
                  <Th>Image</Th>
                  <Th>Status</Th>
                  <Th align="right">CPU</Th>
                  <Th align="right">Memory</Th>
                  <Th>Ports</Th>
                  <Th>Started</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {containers.map((container) => (
                  <Tr key={container.id}>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <ContainerIcon size={11} className="text-dim" />
                        <span className="font-mono text-xs text-fg">{container.name}</span>
                      </div>
                      {container.project_slug ? (
                        <Link to={`/projects/${container.project_slug}`} className="mt-0.5 block text-2xs text-dim hover:text-fg">{container.project_name}</Link>
                      ) : null}
                    </Td>
                    <Td>
                      <Link to={`/servers/${container.server_id}`} className="flex items-center gap-1 text-xs text-muted hover:text-fg">
                        {container.server_name}
                        {container.server_mode === 'demo' ? <Badge tone="warn">simulated</Badge> : null}
                      </Link>
                    </Td>
                    <Td><span className="block max-w-[220px] truncate font-mono text-2xs text-dim">{container.image}</span></Td>
                    <Td><StatusBadge status={container.status} /></Td>
                    <Td align="right"><span className="tabular text-xs text-muted">{container.cpu_pct ? `${container.cpu_pct}%` : '—'}</span></Td>
                    <Td align="right"><span className="tabular text-xs text-muted">{container.mem_bytes ? bytes(container.mem_bytes) : '—'}</span></Td>
                    <Td><span className="font-mono text-2xs text-dim">{container.ports || '—'}</span></Td>
                    <Td><span className="text-2xs text-dim">{container.started_at ? relativeTime(container.started_at) : 'never'}</span></Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-0.5">
                        {container.status === 'running' ? (
                          <Button size="xs" variant="ghost" icon={Pause} loading={busyId === `${container.id}-stop`} disabled={!writable} onClick={() => act(container, 'stop')}>Stop</Button>
                        ) : (
                          <Button size="xs" variant="ghost" icon={Play} loading={busyId === `${container.id}-start`} disabled={!writable} onClick={() => act(container, 'start')}>Start</Button>
                        )}
                        <Button size="xs" variant="ghost" icon={RefreshCw} loading={busyId === `${container.id}-restart`} disabled={!writable} onClick={() => act(container, 'restart')}>Restart</Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <p className="mt-2 px-1 text-2xs text-dim">
          Live container data comes from the Docker Engine API of a connected host. This installation mounts no Docker socket, so the controls only
          operate on hosts you have connected and verified.
        </p>
      </PageBody>
    </>
  );
}

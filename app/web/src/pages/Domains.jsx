import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { del, post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import { DnsRecords } from '../components/DomainsPanel.jsx';
import {
  Badge, Banner, Button, ConfirmDialog, EmptyState, ErrorState, IconButton, LoadingBlock, Modal, Field,
  Input, PageHeader, Panel, Select, StatusBadge, Table, Td, Th, Tr, useToast,
} from '../ui/index.jsx';
import { relativeTime } from '../lib/format.js';
import { canWrite, useAuth } from '../lib/auth.jsx';

export default function Domains() {
  const toast = useToast();
  const { role } = useAuth();
  const writable = canWrite(role);
  const { data, loading, error, reload } = useApi('/api/domains');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ project: '', hostname: '', kind: 'production' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [records, setRecords] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [verifying, setVerifying] = useState(null);

  const domains = data?.domains || [];
  const projects = data?.projects || [];

  const add = async () => {
    setBusy(true);
    setFormError(null);
    try {
      const result = await post(`/api/projects/${form.project}/domains`, { hostname: form.hostname, kind: form.kind });
      toast.success('Domain added', 'Add the DNS records, then run verification.');
      setAddOpen(false);
      setForm({ project: '', hostname: '', kind: 'production' });
      reload();
      setRecords({ ...result.domain, dns: result.domain.dns || [] });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (domain) => {
    setVerifying(domain.id);
    try {
      const result = await post(`/api/projects/${domain.project_slug}/domains/${domain.id}/verify`);
      if (result.verified) toast.success('Domain verified', domain.hostname);
      else toast.push({ title: 'Verification failed', description: result.result?.errors?.[0] || 'DNS records are not correct yet.', tone: 'danger' });
      reload();
    } catch (err) {
      toast.error('Verification failed', err.message);
    } finally {
      setVerifying(null);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await del(`/api/projects/${deleteTarget.project_slug}/domains/${deleteTarget.id}`);
      toast.success('Domain removed', deleteTarget.hostname);
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error('Could not remove domain', err.message);
    } finally {
      setBusy(false);
    }
  };

  const active = domains.filter((d) => d.status === 'active').length;
  const pending = domains.filter((d) => d.status === 'pending').length;
  const failing = domains.filter((d) => d.status === 'error').length;

  return (
    <>
      <PageHeader
        title="Domains"
        description="Custom hostnames routed to your projects. Verification performs live DNS lookups."
        actions={<Button size="sm" variant="primary" icon={Plus} disabled={!writable} onClick={() => { setFormError(null); setForm({ project: projects[0]?.slug || '', hostname: '', kind: 'production' }); setAddOpen(true); }}>Add domain</Button>}
      />
      <PageBody>
        <div className="mb-2.5 grid grid-cols-3 gap-2.5">
          <Panel className="px-3.5 py-2.5">
            <p className="text-2xs uppercase tracking-[0.07em] text-dim">Active</p>
            <p className="mt-0.5 text-[19px] font-semibold tabular text-fg">{active}</p>
          </Panel>
          <Panel className="px-3.5 py-2.5">
            <p className="text-2xs uppercase tracking-[0.07em] text-dim">Pending</p>
            <p className="mt-0.5 text-[19px] font-semibold tabular text-fg">{pending}</p>
          </Panel>
          <Panel className="px-3.5 py-2.5">
            <p className="text-2xs uppercase tracking-[0.07em] text-dim">Failing</p>
            <p className="mt-0.5 text-[19px] font-semibold tabular text-danger">{failing}</p>
          </Panel>
        </div>

        <Panel className="overflow-hidden">
          {error ? <ErrorState error={error} onRetry={reload} /> : loading && !domains.length ? <LoadingBlock label="Loading domains" rows={5} /> : domains.length === 0 ? (
            <EmptyState icon={Globe} title="No domains configured" description="Attach a hostname to a project to serve it on your own domain." action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>Add domain</Button>} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Hostname</Th>
                  <Th>Project</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>SSL</Th>
                  <Th>Last check</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {domains.map((domain) => (
                  <Tr key={domain.id}>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Globe size={11} className="text-dim" />
                        <span className="font-mono text-xs text-fg">{domain.hostname}</span>
                      </div>
                      {domain.last_error ? <p className="mt-0.5 max-w-[320px] truncate text-2xs text-danger">{domain.last_error}</p> : null}
                    </Td>
                    <Td><Link to={`/projects/${domain.project_slug}`} className="text-xs text-muted hover:text-fg">{domain.project_name}</Link></Td>
                    <Td><Badge tone={domain.kind === 'production' ? 'accent' : 'neutral'}>{domain.kind}</Badge></Td>
                    <Td><StatusBadge status={domain.status} /></Td>
                    <Td><Badge tone={domain.ssl === 'active' ? 'success' : 'neutral'}>{domain.ssl}</Badge></Td>
                    <Td><span className="text-2xs text-dim">{domain.last_check ? relativeTime(domain.last_check) : 'never'}</span></Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button size="xs" variant="ghost" icon={RefreshCw} loading={verifying === domain.id} disabled={!writable} onClick={() => verify(domain)}>Verify</Button>
                        <IconButton label="DNS records" icon={ShieldCheck} size={12} onClick={() => setRecords({ ...domain, dns: domain.dns || [
                          { type: 'CNAME', name: domain.hostname, value: 'cname.redfox.app' },
                          { type: 'TXT', name: `_redfox.${domain.hostname}`, value: domain.verify_token },
                        ] })} />
                        <IconButton label="Remove domain" icon={Trash2} size={12} tone="danger" disabled={!writable} onClick={() => setDeleteTarget(domain)} />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
        <Banner tone="neutral" className="mt-2.5" title="How routing works.">
          Redfox registers the hostname with its router (Traefik in a full BYOC deployment) once the CNAME and TXT challenge check out.
          The router terminates TLS and forwards to the project's container. In this installation the routing table is data only: no external proxy is connected.
        </Banner>
      </PageBody>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add domain"
        description="Pick the project that should answer on this hostname."
        footer={(
          <>
            <Button size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={add} loading={busy} disabled={!form.project || !form.hostname.trim()}>Add domain</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field label="Project" required>
            <Select value={form.project} onChange={(event) => setForm((prev) => ({ ...prev, project: event.target.value }))}>
              <option value="">Select a project</option>
              {projects.map((project) => <option key={project.id} value={project.slug}>{project.name}</option>)}
            </Select>
          </Field>
          <Field label="Hostname" required hint="Without protocol or path.">
            <Input autoFocus mono value={form.hostname} onChange={(event) => setForm((prev) => ({ ...prev, hostname: event.target.value }))} placeholder="app.example.com" />
          </Field>
          <Field label="Type">
            <Select value={form.kind} onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value }))}>
              <option value="production">Production</option>
              <option value="preview">Preview</option>
              <option value="redirect">Redirect</option>
            </Select>
          </Field>
          {formError ? <Banner tone="danger">{formError}</Banner> : null}
        </div>
      </Modal>

      <DnsRecords domain={records} onClose={() => setRecords(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={busy}
        danger
        title="Remove domain"
        description={`Remove ${deleteTarget?.hostname} from ${deleteTarget?.project_name}?`}
        confirmLabel="Remove domain"
      />
    </>
  );
}

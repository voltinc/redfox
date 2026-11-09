import React, { useState } from 'react';
import { CheckCircle2, Copy, Globe, Loader2, Plus, RefreshCw, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { del, post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import {
  Badge, Banner, Button, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, LoadingBlock,
  Modal, Panel, PanelHeader, Select, StatusBadge, Table, Td, Th, Tr, useToast,
} from '../ui/index.jsx';
import { formatDateTime, relativeTime } from '../lib/format.js';
import { canWrite, useAuth } from '../lib/auth.jsx';

export function DnsRecords({ domain, onClose }) {
  return (
    <Modal
      open={!!domain}
      onClose={onClose}
      title="DNS records"
      description={domain ? `Add these records at your DNS provider for ${domain.hostname}` : ''}
      width="lg"
      footer={<Button size="sm" onClick={onClose}>Done</Button>}
    >
      {domain ? (
        <div className="space-y-2">
          <Table>
            <thead><tr><Th>Type</Th><Th>Name</Th><Th>Value</Th><Th align="right"> </Th></tr></thead>
            <tbody>
              {(domain.dns || []).map((record) => (
                <Tr key={`${record.type}-${record.name}`}>
                  <Td><Badge tone="neutral" mono>{record.type}</Badge></Td>
                  <Td><span className="font-mono text-xs text-fg">{record.name}</span></Td>
                  <Td><span className="block max-w-[300px] truncate font-mono text-2xs text-muted">{record.value}</span></Td>
                  <Td align="right">
                    <IconButton
                      label="Copy value"
                      icon={Copy}
                      size={11}
                      onClick={() => navigator.clipboard.writeText(record.value)}
                    />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Banner tone="neutral" title="Verification is real.">
            Verify performs live DNS lookups from the Redfox host for the CNAME and the TXT record. If egress DNS is unavailable the lookup failure is shown verbatim rather than being treated as success.
          </Banner>
          {domain.last_error ? <Banner tone="danger" title="Last check failed.">{domain.last_error}</Banner> : null}
        </div>
      ) : null}
    </Modal>
  );
}

export default function DomainsPanel({ projectSlug, compact = false }) {
  const toast = useToast();
  const { role } = useAuth();
  const writable = canWrite(role);
  const { data, loading, error, reload } = useApi(projectSlug ? `/api/projects/${projectSlug}/domains` : null, { skip: !projectSlug, deps: [projectSlug] });
  const [addOpen, setAddOpen] = useState(false);
  const [hostname, setHostname] = useState('');
  const [kind, setKind] = useState('production');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [records, setRecords] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [verifying, setVerifying] = useState(null);

  const domains = data?.domains || [];

  const add = async () => {
    setBusy(true);
    setFormError(null);
    try {
      const result = await post(`/api/projects/${projectSlug}/domains`, { hostname, kind });
      toast.success('Domain added', 'Add the DNS records, then verify.');
      setAddOpen(false);
      setHostname('');
      reload();
      setRecords(result.domain);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (domain) => {
    setVerifying(domain.id);
    try {
      const result = await post(`/api/projects/${projectSlug}/domains/${domain.id}/verify`);
      if (result.verified) toast.success('Domain verified', domain.hostname);
      else toast.push({ title: 'Verification failed', description: result.result?.errors?.[0] || 'DNS records are not correct yet.', tone: 'danger' });
      reload();
    } catch (err) {
      toast.error('Verification request failed', err.message);
    } finally {
      setVerifying(null);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await del(`/api/projects/${projectSlug}/domains/${deleteTarget.id}`);
      toast.success('Domain removed', deleteTarget.hostname);
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error('Could not remove domain', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Domains"
          icon={Globe}
          description={compact ? undefined : 'Custom hostnames served by this project.'}
          actions={<Button size="sm" variant="secondary" icon={Plus} disabled={!writable} onClick={() => { setFormError(null); setAddOpen(true); }}>Add domain</Button>}
        />
        {error ? <ErrorState error={error} onRetry={reload} /> : loading && !domains.length ? <LoadingBlock label="Loading domains" rows={2} /> : domains.length === 0 ? (
          <EmptyState icon={Globe} compact title="No custom domains" description="Attach a hostname, point its CNAME at cname.redfox.app and verify it." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Hostname</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Last check</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <Tr key={domain.id}>
                  <Td>
                    <span className="flex items-center gap-1.5">
                      <Globe size={11} className="text-dim" />
                      <span className="font-mono text-xs text-fg">{domain.hostname}</span>
                    </span>
                    {domain.last_error ? <span className="mt-0.5 block max-w-[420px] truncate text-2xs text-danger">{domain.last_error}</span> : null}
                  </Td>
                  <Td><Badge tone={domain.kind === 'production' ? 'accent' : 'neutral'}>{domain.kind}</Badge></Td>
                  <Td><StatusBadge status={domain.status} /></Td>
                  <Td><span className="text-2xs text-dim">{domain.last_check ? relativeTime(domain.last_check) : 'never'}</span></Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="xs" variant="ghost" icon={RefreshCw} loading={verifying === domain.id} disabled={!writable} onClick={() => verify(domain)}>Verify</Button>
                      <IconButton label="DNS records" icon={ShieldCheck} size={12} onClick={() => setRecords(domain)} />
                      <IconButton label="Remove domain" icon={Trash2} size={12} tone="danger" disabled={!writable} onClick={() => setDeleteTarget(domain)} />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        {!compact ? (
          <div className="border-t border-line px-3 py-2 text-2xs text-dim">
            SSL certificates are issued once the CNAME resolves to cname.redfox.app and the TXT challenge is present.
          </div>
        ) : null}
      </Panel>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add domain"
        description="Attach a hostname to this project, then add the DNS records."
        footer={(
          <>
            <Button size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={add} loading={busy} disabled={!hostname.trim()}>Add domain</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field label="Hostname" required hint="Without protocol or path, for example app.example.com">
            <Input autoFocus mono value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="app.example.com" />
          </Field>
          <Field label="Type">
            <Select value={kind} onChange={(event) => setKind(event.target.value)}>
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
        description={`Remove ${deleteTarget?.hostname}? Traffic to that hostname will stop routing to this project.`}
        confirmLabel="Remove domain"
      />
    </>
  );
}

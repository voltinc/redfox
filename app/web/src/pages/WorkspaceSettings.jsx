import React, { useState } from 'react';
import { Building2, Check, CreditCard, Save, ShieldCheck, Trash2, Users } from 'lucide-react';
import { del, patch, post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import InvitesPanel from '../components/InvitesPanel.jsx';
import {
  Avatar, Badge, Banner, Button, ConfirmDialog, ErrorState, Field, Input, LoadingBlock, PageHeader, Panel,
  PanelHeader, Select, Table, Td, Th, Tr, useToast,
} from '../ui/index.jsx';
import { relativeTime } from '../lib/format.js';
import { useAuth, canAdmin } from '../lib/auth.jsx';

const REGIONS = [
  { value: 'eu-west-1', label: 'EU West (Ireland)' },
  { value: 'eu-central', label: 'EU Central (Frankfurt)' },
  { value: 'us-east-1', label: 'US East (Virginia)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
];

const ROLES = ['admin', 'developer', 'viewer'];

export default function WorkspaceSettings() {
  const toast = useToast();
  const { role, refresh } = useAuth();
  const admin = canAdmin(role);
  const { data, loading, error, reload } = useApi('/api/workspace');
  const events = useApi('/api/workspace/events?limit=12');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [removeMember, setRemoveMember] = useState(null);

  if (error) return <PageBody><ErrorState error={error} onRetry={reload} /></PageBody>;
  if (loading && !data) return <PageBody><LoadingBlock label="Loading workspace" rows={5} /></PageBody>;

  const workspace = data.workspace;
  const current = form || { name: workspace.name, region: workspace.region };

  const save = async () => {
    setBusy(true);
    try {
      await patch('/api/workspace', current);
      toast.success('Workspace updated');
      setForm(null);
      reload();
      refresh();
    } catch (err) {
      toast.error('Could not save workspace', err.message);
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (member, nextRole) => {
    try {
      await patch(`/api/workspace/members/${member.id}`, { role: nextRole });
      toast.success('Role updated', `${member.name} is now ${nextRole}`);
      reload();
    } catch (err) {
      toast.error('Could not change role', err.message);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await del(`/api/workspace/members/${removeMember.id}`);
      toast.success('Member removed', removeMember.name);
      setRemoveMember(null);
      reload();
    } catch (err) {
      toast.error('Could not remove member', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Workspace settings"
        description={`${workspace.name} · ${workspace.plan} plan · ${workspace.region}`}
        badge={<Badge tone="neutral">{role}</Badge>}
      />
      <PageBody>
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-2.5">
            <Panel>
              <PanelHeader title="General" icon={Building2} description="Shared identity for everyone in this workspace." />
              <div className="space-y-3 p-4">
                <Field label="Workspace name">
                  <Input value={current.name} onChange={(event) => setForm({ ...current, name: event.target.value })} disabled={!admin} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Default region" hint="New databases provision here.">
                    <Select value={current.region} onChange={(event) => setForm({ ...current, region: event.target.value })} disabled={!admin}>
                      {REGIONS.map((region) => <option key={region.value} value={region.value}>{region.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Workspace slug" hint="Used in git remotes and hostnames.">
                    <Input mono value={workspace.slug} disabled />
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="primary" icon={Save} loading={busy} disabled={!admin || !form} onClick={save}>Save changes</Button>
                </div>
                {!admin ? <p className="text-2xs text-dim">Only owners and admins can change workspace settings.</p> : null}
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <PanelHeader title="Members" icon={Users} description="Role-based access control applies to every API call." dense />
              <Table>
                <thead>
                  <tr><Th>Member</Th><Th>Role</Th><Th>Joined</Th><Th align="right"> </Th></tr>
                </thead>
                <tbody>
                  {data.members.map((member) => (
                    <Tr key={member.id}>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Avatar name={member.name} color={member.avatar_color} size={22} />
                          <div className="min-w-0">
                            <p className="truncate text-xs text-fg">{member.name}</p>
                            <p className="truncate text-2xs text-dim">{member.email}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        {member.role === 'owner' || !admin ? (
                          <Badge tone={member.role === 'owner' ? 'accent' : 'neutral'}>{member.role}</Badge>
                        ) : (
                          <div className="w-[120px]">
                            <Select value={member.role} onChange={(event) => changeRole(member, event.target.value)}>
                              {ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
                            </Select>
                          </div>
                        )}
                      </Td>
                      <Td><span className="text-2xs text-dim">{relativeTime(member.created_at)}</span></Td>
                      <Td align="right">
                        {member.role !== 'owner' && admin ? (
                          <Button size="xs" variant="ghost" icon={Trash2} onClick={() => setRemoveMember(member)}>Remove</Button>
                        ) : null}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <div className="border-t border-line px-3 py-2 text-2xs text-dim">
                Viewer is read-only. Developer can deploy, commit and change variables. Admin can also manage members and delete projects.
              </div>
            </Panel>
            <InvitesPanel admin={admin} />
          </div>

          <div className="space-y-2.5">
            <Panel>
              <PanelHeader title="Plan" icon={CreditCard} />
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm capitalize text-fg">{workspace.plan} plan</span>
                  <Badge tone="success">active</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-line pt-2 text-center">
                  <div><p className="text-2xs uppercase tracking-[0.06em] text-dim">Projects</p><p className="text-sm tabular text-fg">{data.counts.projects}</p></div>
                  <div><p className="text-2xs uppercase tracking-[0.06em] text-dim">Repos</p><p className="text-sm tabular text-fg">{data.counts.repositories}</p></div>
                  <div><p className="text-2xs uppercase tracking-[0.06em] text-dim">Members</p><p className="text-sm tabular text-fg">{data.counts.members}</p></div>
                </div>
                <p className="border-t border-line pt-2 text-2xs leading-4 text-dim">
                  Billing is not connected in this installation. Plan limits are recorded but not enforced, and no payment provider is called.
                </p>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Security" icon={ShieldCheck} />
              <div className="space-y-1.5 p-4 text-xs text-muted">
                <p className="flex items-start gap-1.5"><Check size={11} className="mt-[3px] shrink-0 text-success" /> Row-level isolation per project database</p>
                <p className="flex items-start gap-1.5"><Check size={11} className="mt-[3px] shrink-0 text-success" /> Environment variables encrypted with AES-256-GCM</p>
                <p className="flex items-start gap-1.5"><Check size={11} className="mt-[3px] shrink-0 text-success" /> API keys stored as SHA-256 hashes, scoped per project</p>
                <p className="flex items-start gap-1.5"><Check size={11} className="mt-[3px] shrink-0 text-success" /> Session cookies are HTTP-only; passwords hashed with scrypt</p>
                <p className="flex items-start gap-1.5"><Check size={11} className="mt-[3px] shrink-0 text-success" /> Role checks enforced server-side on every route</p>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Audit log" dense actions={<span className="text-2xs text-dim">latest 12</span>} />
              <div className="max-h-[300px] divide-y divide-line/60 overflow-y-auto">
                {(events.data?.items || []).map((event) => (
                  <div key={event.id} className="px-3 py-1.5">
                    <p className="text-xs text-muted">{event.message}</p>
                    <p className="text-2xs text-dim">{event.actor} · {relativeTime(event.created_at)}</p>
                  </div>
                ))}
                {!events.data?.items?.length ? <p className="px-3 py-3 text-xs text-dim">No audit events.</p> : null}
              </div>
            </Panel>
          </div>
        </div>
      </PageBody>

      <ConfirmDialog
        open={!!removeMember}
        onClose={() => setRemoveMember(null)}
        onConfirm={remove}
        loading={busy}
        danger
        title="Remove member"
        description={`Remove ${removeMember?.name} from ${workspace.name}? They immediately lose access to every project and API route.`}
        confirmLabel="Remove member"
      />
    </>
  );
}

import React, { useState } from 'react';
import { Check, Copy, Link2, Loader2, Mail, Plus, Trash2, UserPlus } from 'lucide-react';
import { del, post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { relativeTime } from '../lib/format.js';
import {
  Badge, Button, EmptyState, ErrorState, Field, Input, Panel, PanelHeader, Select, Table, Td, Th, Tr, useToast,
} from '../ui/index.jsx';

const ROLES = ['admin', 'developer', 'viewer'];

function inviteLink(token) {
  return `${window.location.origin}/signup?invite=${token}`;
}

export default function InvitesPanel({ admin }) {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/api/workspace/invites');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('developer');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const [formError, setFormError] = useState(null);

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const result = await post('/api/workspace/invites', { email: email.trim() || undefined, role });
      setCreated({ link: inviteLink(result.token), email: result.invite.email, role: result.invite.role });
      setEmail('');
      reload();
      toast.success('Invitation ready', 'Share the link with your teammate.');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (invite) => {
    try {
      await del(`/api/workspace/invites/${invite.id}`);
      reload();
      toast.success('Invitation revoked');
    } catch (err) {
      toast.error('Could not revoke', err.message);
    }
  };

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Link copied');
    } catch {
      toast.error('Copy failed', 'Select the link and copy it manually');
    }
  };

  const invites = data?.invites || [];

  return (
    <Panel className="overflow-hidden" id="invites">
      <PanelHeader
        title="Invitations"
        icon={UserPlus}
        description="Invite links expire after 14 days and can be revoked at any time."
        dense
      />

      {admin ? (
        <form onSubmit={create} className="grid gap-2 border-b border-line px-3 py-3 sm:grid-cols-[minmax(0,1fr)_130px_auto]">
          <div>
            <Field label="Email" hint="Leave empty for a link anyone with the URL can use.">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" />
            </Field>
            {formError ? <p className="mt-1 text-[11px] text-danger">{formError}</p> : null}
          </div>
          <Field label="Role">
            <Select value={role} onChange={(event) => setRole(event.target.value)}>
              {ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="primary" size="sm" icon={Plus} loading={busy} disabled={busy}>
              Create invite
            </Button>
          </div>
        </form>
      ) : null}

      {created ? (
        <div className="border-b border-line bg-panel-2 px-3 py-3">
          <div className="flex items-start gap-2">
            <Link2 size={13} className="mt-0.5 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] text-fg">
                Invite for {created.email || 'anyone with this link'} as {created.role}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <code className="min-w-0 flex-1 truncate rounded border border-line bg-base px-2 py-1 font-mono text-[10.5px] text-muted">{created.link}</code>
                <Button size="xs" variant="secondary" icon={Copy} onClick={() => copy(created.link)}>Copy</Button>
                <Button size="xs" variant="ghost" icon={Check} onClick={() => setCreated(null)} aria-label="Dismiss invite" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="p-3"><ErrorState error={error} onRetry={reload} /></div> : null}

      {loading && !data ? (
        <p className="flex items-center gap-2 px-3 py-4 text-[11.5px] text-dim"><Loader2 size={12} className="animate-spin" /> Loading invitations</p>
      ) : invites.length === 0 ? (
        <div className="px-3 py-2">
          <EmptyState
            icon={Mail}
            compact
            title="No open invitations"
            description={admin ? 'Create a link above and send it to a teammate.' : 'Only workspace admins can invite people.'}
          />
        </div>
      ) : (
        <Table>
          <thead>
            <tr><Th>Invitee</Th><Th>Role</Th><Th>Created</Th><Th>State</Th><Th align="right"> </Th></tr>
          </thead>
          <tbody>
            {invites.map((invite) => (
              <Tr key={invite.id}>
                <Td>
                  <p className="text-xs text-fg">{invite.email || 'Open link'}</p>
                  <p className="text-2xs text-dim">{invite.invited_by_name ? `by ${invite.invited_by_name}` : ''}</p>
                </Td>
                <Td><Badge tone="neutral">{invite.role}</Badge></Td>
                <Td><span className="text-2xs text-dim">{relativeTime(invite.created_at)}</span></Td>
                <Td>
                  <Badge tone={invite.state === 'pending' ? 'warn' : invite.state === 'accepted' ? 'success' : 'neutral'}>{invite.state}</Badge>
                </Td>
                <Td align="right">
                  {invite.state === 'pending' && admin ? (
                    <Button size="xs" variant="ghost" icon={Trash2} onClick={() => revoke(invite)}>Revoke</Button>
                  ) : null}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}

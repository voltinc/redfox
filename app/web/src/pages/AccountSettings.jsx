import React, { useState } from 'react';
import { KeyRound, LogOut, Save, ShieldCheck, User } from 'lucide-react';
import { patch, post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import {
  Avatar, Badge, Banner, Button, ConfirmDialog, ErrorState, Field, Input, LoadingBlock, PageHeader, Panel,
  PanelHeader, Table, Td, Th, Tr, useToast,
} from '../ui/index.jsx';
import { formatDateTime, relativeTime } from '../lib/format.js';
import { useAuth } from '../lib/auth.jsx';

const COLORS = ['#FF7000', '#2454C8', '#1C7A3D', '#A25C00', '#7A3FB8', '#B8331F', '#191714'];

export default function AccountSettings() {
  const toast = useToast();
  const { user, role, logout, refresh } = useAuth();
  const { data, loading, error, reload } = useApi('/api/account');
  const [profile, setProfile] = useState(null);
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [revokeOpen, setRevokeOpen] = useState(false);

  if (error) return <PageBody><ErrorState error={error} onRetry={reload} /></PageBody>;
  if (loading && !data) return <PageBody><LoadingBlock label="Loading account" rows={4} /></PageBody>;

  const current = profile || { name: user.name, avatar_color: user.avatar_color };

  const saveProfile = async () => {
    setBusy(true);
    try {
      await patch('/api/account', current);
      toast.success('Profile updated');
      setProfile(null);
      refresh();
      reload();
    } catch (err) {
      toast.error('Could not update profile', err.message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    setPasswordError(null);
    if (passwords.new_password !== passwords.confirm) {
      setPasswordError('New passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await post('/api/account/password', {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      toast.success('Password changed');
      setPasswords({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revokeSessions = async () => {
    setBusy(true);
    try {
      await post('/api/account/sessions/revoke');
      toast.success('Other sessions revoked');
      setRevokeOpen(false);
      reload();
    } catch (err) {
      toast.error('Could not revoke sessions', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Account settings" description="Your profile, credentials and active sessions." badge={<Badge tone="neutral">{role}</Badge>} />
      <PageBody>
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="space-y-2.5">
            <Panel>
              <PanelHeader title="Profile" icon={User} description="Shown next to your commits, deployments and audit events." />
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={current.name} color={current.avatar_color} size={40} />
                  <div className="min-w-0">
                    <p className="text-sm text-fg">{current.name}</p>
                    <p className="text-xs text-dim">{user.email}</p>
                  </div>
                </div>
                <Field label="Full name">
                  <Input value={current.name} onChange={(event) => setProfile({ ...current, name: event.target.value })} />
                </Field>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted">Avatar colour</p>
                  <div className="flex items-center gap-1.5">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setProfile({ ...current, avatar_color: color })}
                        className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                        style={{ background: color, borderColor: current.avatar_color === color ? 'var(--fg)' : 'transparent' }}
                        aria-label={`Use ${color}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="primary" icon={Save} loading={busy} disabled={!profile} onClick={saveProfile}>Save profile</Button>
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Password" icon={KeyRound} description="Passwords are hashed with scrypt and a per-user salt." />
              <div className="space-y-3 p-4">
                <Field label="Current password">
                  <Input type="password" value={passwords.current_password} onChange={(event) => setPasswords((prev) => ({ ...prev, current_password: event.target.value }))} autoComplete="current-password" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="New password" hint="At least 8 characters.">
                    <Input type="password" value={passwords.new_password} onChange={(event) => setPasswords((prev) => ({ ...prev, new_password: event.target.value }))} autoComplete="new-password" />
                  </Field>
                  <Field label="Confirm new password">
                    <Input type="password" value={passwords.confirm} onChange={(event) => setPasswords((prev) => ({ ...prev, confirm: event.target.value }))} autoComplete="new-password" />
                  </Field>
                </div>
                {passwordError ? <Banner tone="danger">{passwordError}</Banner> : null}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="primary"
                    loading={busy}
                    disabled={!passwords.current_password || passwords.new_password.length < 8}
                    onClick={changePassword}
                  >
                    Change password
                  </Button>
                </div>
                <p className="text-2xs text-dim">This instance ships with a seeded administrator account. Change its password before exposing the server to a network.</p>
              </div>
            </Panel>
          </div>

          <div className="space-y-2.5">
            <Panel className="overflow-hidden">
              <PanelHeader title="Sessions" icon={ShieldCheck} dense actions={<Button size="xs" variant="ghost" onClick={() => setRevokeOpen(true)}>Revoke others</Button>} />
              <Table>
                <thead><tr><Th>Created</Th><Th>Expires</Th></tr></thead>
                <tbody>
                  {(data.sessions || []).map((session) => (
                    <Tr key={session.id}>
                      <Td><span className="text-2xs text-muted">{formatDateTime(session.created_at)}</span></Td>
                      <Td><span className="text-2xs text-dim">{relativeTime(session.expires_at)}</span></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <div className="border-t border-line px-3 py-2 text-2xs text-dim">
                Sessions last 14 days. The current session is included in this list.
              </div>
            </Panel>

            <Panel className="p-4">
              <p className="text-xs font-medium text-fg">Sign out</p>
              <p className="mt-1 text-2xs leading-4 text-dim">Ends this session on this device. Other sessions stay active unless you revoke them.</p>
              <Button size="sm" variant="danger" icon={LogOut} className="mt-2" onClick={logout}>Sign out</Button>
            </Panel>
          </div>
        </div>
      </PageBody>

      <ConfirmDialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        onConfirm={revokeSessions}
        loading={busy}
        danger
        title="Revoke other sessions"
        description="Every other browser session for this account is signed out immediately. This session stays active."
        confirmLabel="Revoke sessions"
      />
    </>
  );
}

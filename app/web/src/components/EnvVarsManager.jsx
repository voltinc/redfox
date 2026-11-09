import React, { useState } from 'react';
import { Copy, Eye, EyeOff, KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { del, patch, post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import {
  Badge, Banner, Button, ConfirmDialog, CopyButton, EmptyState, ErrorState, Field, IconButton, Input,
  LoadingBlock, Modal, Panel, PanelHeader, SearchInput, SegmentedControl, Select, Switch, Table, Td, Th, Tr,
  useToast,
} from '../ui/index.jsx';
import { relativeTime } from '../lib/format.js';
import { canWrite, useAuth } from '../lib/auth.jsx';

const TARGET_TONE = { all: 'neutral', production: 'accent', preview: 'info', development: 'success' };

export default function EnvVarsManager({ project, projects = [], onProjectChange }) {
  const toast = useToast();
  const { role } = useAuth();
  const writable = canWrite(role);
  const slug = project?.slug;
  const { data, loading, error, reload } = useApi(slug ? `/api/projects/${slug}/env` : null, { skip: !slug, deps: [slug] });
  const [revealed, setRevealed] = useState({});
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ key: '', value: '', target: 'production', is_secret: true });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const items = data?.items || [];

  const filtered = items.filter((item) => {
    if (target !== 'all' && item.target !== target) return false;
    if (search && !item.key.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const resetForm = () => { setForm({ key: '', value: '', target: 'production', is_secret: true }); setFormError(null); };

  const submitAdd = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await post(`/api/projects/${slug}/env`, form);
      toast.success('Variable added', `${form.key} · ${form.target}`);
      setAddOpen(false);
      resetForm();
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async () => {
    setBusy(true);
    setFormError(null);
    try {
      const payload = { target: editTarget.target, is_secret: editTarget.is_secret };
      if (editTarget.newValue) payload.value = editTarget.newValue;
      await patch(`/api/projects/${slug}/env/${editTarget.id}`, payload);
      toast.success('Variable updated', editTarget.key);
      setEditTarget(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reveal = async (item) => {
    if (revealed[item.id]) {
      setRevealed((prev) => ({ ...prev, [item.id]: null }));
      return;
    }
    try {
      const result = await post(`/api/projects/${slug}/env/${item.id}/reveal`);
      setRevealed((prev) => ({ ...prev, [item.id]: result.value }));
    } catch (err) {
      toast.error('Could not reveal value', err.message);
    }
  };

  const copy = async (item) => {
    try {
      const value = revealed[item.id] ?? (await post(`/api/projects/${slug}/env/${item.id}/reveal`)).value;
      await navigator.clipboard.writeText(value);
      toast.success('Copied to clipboard', item.key);
    } catch (err) {
      toast.error('Could not copy value', err.message);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await del(`/api/projects/${slug}/env/${deleteTarget.id}`);
      toast.success('Variable deleted', deleteTarget.key);
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error('Could not delete variable', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!slug) return <EmptyState icon={KeyRound} title="Choose a project" description="Environment variables are scoped to one project." />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {onProjectChange ? (
          <div className="w-[190px]">
            <Select value={slug} onChange={(event) => onProjectChange(event.target.value)}>
              {projects.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </Select>
          </div>
        ) : null}
        <SearchInput value={search} onChange={setSearch} placeholder="Filter variables" className="w-full sm:w-56" />
        <SegmentedControl
          size="sm"
          value={target}
          onChange={setTarget}
          options={[
            { value: 'all', label: 'All' },
            { value: 'production', label: 'Production' },
            { value: 'preview', label: 'Preview' },
            { value: 'development', label: 'Dev' },
          ]}
        />
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-2xs text-dim">{filtered.length} of {items.length}</span>
          <Button size="sm" variant="primary" icon={Plus} disabled={!writable} onClick={() => { resetForm(); setAddOpen(true); }}>Add variable</Button>
        </div>
      </div>

      <Panel className="overflow-hidden">
        {loading && !items.length ? <LoadingBlock label="Loading variables" rows={4} /> : filtered.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title={items.length ? 'No variables match' : 'No environment variables'}
            description={items.length ? 'Adjust the filter to see the other variables.' : 'Add a variable to inject configuration into builds and runtimes.'}
            action={!items.length ? <Button size="sm" variant="primary" icon={Plus} disabled={!writable} onClick={() => { resetForm(); setAddOpen(true); }}>Add variable</Button> : null}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Value</Th>
                <Th>Environment</Th>
                <Th>Updated</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <Tr key={item.id}>
                  <Td>
                    <span className="flex items-center gap-1.5">
                      <KeyRound size={11} className="text-dim" />
                      <span className="font-mono text-xs text-fg">{item.key}</span>
                      {item.is_secret ? <Badge tone="neutral">secret</Badge> : null}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <span className="max-w-[260px] truncate font-mono text-2xs text-muted">
                        {revealed[item.id] ?? item.masked}
                      </span>
                      {item.is_secret ? (
                        <IconButton label={revealed[item.id] ? 'Hide value' : 'Reveal value'} icon={revealed[item.id] ? EyeOff : Eye} size={11} onClick={() => reveal(item)} disabled={!writable} />
                      ) : null}
                      <IconButton label="Copy value" icon={Copy} size={11} onClick={() => copy(item)} />
                    </div>
                  </Td>
                  <Td><Badge tone={TARGET_TONE[item.target]}>{item.target}</Badge></Td>
                  <Td><span className="text-2xs text-dim">{relativeTime(item.updated_at)} · {item.updated_by || 'unknown'}</span></Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-0.5">
                      <IconButton label="Edit variable" icon={Pencil} size={12} disabled={!writable} onClick={() => { setFormError(null); setEditTarget({ ...item, newValue: '', revealedValue: undefined }); }} />
                      <IconButton label="Delete variable" icon={Trash2} size={12} tone="danger" disabled={!writable} onClick={() => setDeleteTarget(item)} />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-2xs text-dim">
          <span>Values are encrypted at rest with AES-256-GCM and never included in client bundles.</span>
          <span>Reveals are recorded in the audit log.</span>
        </div>
      </Panel>

      <Banner tone="neutral" title="How values reach your app.">
        Builds receive variables scoped to their environment. Production-scoped values are also available to preview builds; development-only values are not. Secrets stay on the server: the browser only ever receives masked values.
      </Banner>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add environment variable"
        description={`${project.name} · values are encrypted before they are stored`}
        footer={(
          <>
            <Button size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={submitAdd} loading={busy} disabled={!form.key || !form.value}>Add variable</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field label="Name" required hint="Uppercase letters, numbers and underscores.">
            <Input
              autoFocus
              mono
              value={form.key}
              onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') }))}
              placeholder="STRIPE_SECRET_KEY"
            />
          </Field>
          <Field label="Value" required>
            <Input mono type={form.is_secret ? 'password' : 'text'} value={form.value} onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))} placeholder="sk_live_..." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Environment">
              <Select value={form.target} onChange={(event) => setForm((prev) => ({ ...prev, target: event.target.value }))}>
                <option value="all">All environments</option>
                <option value="development">Development</option>
                <option value="preview">Preview</option>
                <option value="production">Production</option>
              </Select>
            </Field>
            <div className="pt-5">
              <Switch
                checked={form.is_secret}
                onChange={(value) => setForm((prev) => ({ ...prev, is_secret: value }))}
                label="Secret value"
                description="Mask in the interface"
              />
            </div>
          </div>
          {formError ? <Banner tone="danger">{formError}</Banner> : null}
        </div>
      </Modal>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Edit ${editTarget?.key || ''}`}
        footer={(
          <>
            <Button size="sm" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={submitEdit} loading={busy}>Save changes</Button>
          </>
        )}
      >
        {editTarget ? (
          <div className="space-y-3">
            <Field label="New value" hint="Leave empty to keep the stored value.">
              <Input mono type="password" value={editTarget.newValue} onChange={(event) => setEditTarget((prev) => ({ ...prev, newValue: event.target.value }))} placeholder="unchanged" />
            </Field>
            <Field label="Environment">
              <Select value={editTarget.target} onChange={(event) => setEditTarget((prev) => ({ ...prev, target: event.target.value }))}>
                <option value="all">All environments</option>
                <option value="development">Development</option>
                <option value="preview">Preview</option>
                <option value="production">Production</option>
              </Select>
            </Field>
            <Switch
              checked={!!editTarget.is_secret}
              onChange={(value) => setEditTarget((prev) => ({ ...prev, is_secret: value }))}
              label="Secret value"
              description="Mask in the interface"
            />
            {formError ? <Banner tone="danger">{formError}</Banner> : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={busy}
        danger
        title="Delete variable"
        description={`Delete ${deleteTarget?.key}? Builds that depend on it will fail until it is replaced.`}
        confirmLabel="Delete variable"
      />
    </div>
  );
}

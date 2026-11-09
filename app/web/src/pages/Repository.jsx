import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Check, Copy, ExternalLink, FilePlus2, GitBranch, GitCommitHorizontal, Lock, Pencil, Plus, Send,
  Settings, ShieldAlert, Trash2, Webhook,
} from 'lucide-react';
import { del, patch, post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import RepoBrowser from '../components/RepoBrowser.jsx';
import {
  Badge, Banner, Button, ConfirmDialog, CopyButton, EmptyState, ErrorState, Field, IconButton, Input,
  LoadingBlock, Modal, PageHeader, Panel, PanelHeader, Pagination, Select, Switch, TabLink, Table, Td, Textarea,
  Th, Tr, useToast,
} from '../ui/index.jsx';
import { relativeTime, shortSha } from '../lib/format.js';
import { canWrite, useAuth } from '../lib/auth.jsx';

export default function Repository() {
  const { repoId } = useParams();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'code';
  const navigate = useNavigate();
  const toast = useToast();
  const { role } = useAuth();
  const writable = canWrite(role);

  const { data, loading, error, reload } = useApi(`/api/repos/${repoId}`);
  const [commitPage, setCommitPage] = useState(1);
  const commits = useApi(`/api/repos/${repoId}/commits?page=${commitPage}&limit=25`, { skip: tab !== 'commits', deps: [commitPage, tab] });
  const webhook = useApi(`/api/repos/${repoId}/webhook`, { skip: tab !== 'settings' });

  const [browserKey, setBrowserKey] = useState(0);
  const [editor, setEditor] = useState(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorError, setEditorError] = useState(null);
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchFrom, setBranchFrom] = useState('main');
  const [deleteBranch, setDeleteBranch] = useState(null);
  const [settingsForm, setSettingsForm] = useState(null);
  const [webhookForm, setWebhookForm] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [currentPath, setCurrentPath] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.repository) {
      setSettingsForm({
        description: data.repository.description || '',
        visibility: data.repository.visibility,
        default_branch: data.repository.default_branch,
      });
      setBranchFrom(data.repository.default_branch);
    }
  }, [data?.repository?.id]);

  useEffect(() => {
    if (webhook.data?.webhook) {
      setWebhookForm({
        url: webhook.data.webhook.url,
        events: webhook.data.webhook.events,
        active: webhook.data.webhook.active,
      });
    }
  }, [webhook.data?.webhook?.url]);

  if (error?.status === 404) {
    return <PageBody><ErrorState error={{ message: 'This repository does not exist in the workspace.' }} onRetry={() => navigate('/repositories')} /></PageBody>;
  }
  if (loading && !data) return <PageBody><LoadingBlock label="Loading repository" rows={6} /></PageBody>;

  const repo = data.repository;
  const branches = data.branches || [];
  const head = data.head;

  const openNewFile = () => {
    setEditorError(null);
    setEditor({ mode: 'create', path: '', content: '', message: '', branch: data.branch });
  };

  const openEditFile = () => {
    if (!currentPath) return;
    setEditorError(null);
    setEditor({ mode: 'edit', path: currentPath, content: null, message: '', branch: data.branch, loading: true });
    fetch(`/api/repos/${repoId}/file?branch=${encodeURIComponent(data.branch)}&path=${encodeURIComponent(currentPath)}`, { credentials: 'same-origin' })
      .then((response) => response.json())
      .then((payload) => {
        if (payload.error) throw new Error(payload.error);
        setEditor((prev) => ({ ...prev, content: payload.file.content, loading: false }));
      })
      .catch((err) => setEditor((prev) => ({ ...prev, loading: false, content: '', error: err.message })));
  };

  const submitCommit = async () => {
    setEditorBusy(true);
    setEditorError(null);
    try {
      const result = await post(`/api/repos/${repoId}/contents`, {
        branch: editor.branch,
        path: editor.path,
        content: editor.content,
        message: editor.message,
      });
      toast.success('Commit created', shortSha(result.commit.sha));
      setEditor(null);
      setBrowserKey((key) => key + 1);
      reload();
      if (tab === 'commits') commits.reload();
    } catch (err) {
      setEditorError(err.message);
    } finally {
      setEditorBusy(false);
    }
  };

  const createBranch = async () => {
    setBusy(true);
    try {
      await post(`/api/repos/${repoId}/branches`, { name: branchName, from: branchFrom });
      toast.success('Branch created', branchName);
      setBranchOpen(false);
      setBranchName('');
      reload();
    } catch (err) {
      toast.error('Could not create branch', err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeBranch = async () => {
    setBusy(true);
    try {
      await del(`/api/repos/${repoId}/branches/${encodeURIComponent(deleteBranch.name)}`);
      toast.success('Branch deleted', deleteBranch.name);
      setDeleteBranch(null);
      reload();
    } catch (err) {
      toast.error('Could not delete branch', err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    setBusy(true);
    try {
      await patch(`/api/repos/${repoId}`, settingsForm);
      toast.success('Repository settings saved');
      reload();
    } catch (err) {
      toast.error('Could not save settings', err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveWebhook = async () => {
    setBusy(true);
    try {
      await patch(`/api/repos/${repoId}/webhook`, webhookForm);
      toast.success('Webhook saved');
      webhook.reload();
    } catch (err) {
      toast.error('Could not save webhook', err.message);
    } finally {
      setBusy(false);
    }
  };

  const testWebhook = async () => {
    setBusy(true);
    setTestResult(null);
    try {
      const result = await post(`/api/repos/${repoId}/webhook/test`);
      setTestResult(result);
      if (result.delivered) toast.success('Delivery accepted', `HTTP ${result.status} in ${result.duration_ms}ms`);
      else toast.push({ title: 'Delivery failed', description: result.error || `HTTP ${result.status}`, tone: 'danger' });
    } catch (err) {
      toast.error('Test delivery failed', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        breadcrumb={<><Link to="/repositories" className="hover:text-fg">Repositories</Link><span>/</span><span className="text-muted">{repo.slug}</span></>}
        title={repo.name}
        badge={(
          <>
            <Badge tone="neutral">{repo.visibility}</Badge>
            {data.project ? <Link to={`/projects/${data.project.slug}`} className="text-2xs text-info hover:underline">{data.project.name}</Link> : null}
          </>
        )}
        description={repo.description || 'No description'}
        actions={(
          <>
            {data.project ? <Button size="sm" variant="secondary" icon={ExternalLink} onClick={() => navigate(`/projects/${data.project.slug}`)}>Project</Button> : null}
            <Button size="sm" variant="secondary" icon={FilePlus2} disabled={!writable} onClick={openNewFile}>New file</Button>
            <Button size="sm" variant="secondary" icon={Plus} disabled={!writable} onClick={() => setBranchOpen(true)}>New branch</Button>
          </>
        )}
        tabs={(
          <>
            <TabLink to={`/repositories/${repoId}`} end>Code</TabLink>
            <TabLink to={`/repositories/${repoId}?tab=commits`}>Commits</TabLink>
            <TabLink to={`/repositories/${repoId}?tab=branches`} count={branches.length}>Branches</TabLink>
            <TabLink to={`/repositories/${repoId}?tab=settings`}>Settings</TabLink>
          </>
        )}
      />

      <PageBody wide>
        {tab === 'code' ? (
          <>
            <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-md border border-line bg-panel px-3 py-2">
              <GitBranch size={12} className="text-dim" />
              <span className="font-mono text-xs text-fg">{data.branch}</span>
              {head ? (
                <>
                  <span className="text-2xs text-dim">head</span>
                  <Link to={`/repositories/${repoId}/commits/${head.sha}`} className="font-mono text-2xs text-muted hover:text-accent">{shortSha(head.sha)}</Link>
                  <span className="min-w-0 flex-1 truncate text-2xs text-muted">{head.message}</span>
                  <span className="text-2xs text-dim">{head.author_name} · {relativeTime(head.committed_at)}</span>
                </>
              ) : <span className="text-2xs text-dim">no commits yet</span>}
              <div className="ml-auto flex items-center gap-1">
                {currentPath ? <Button size="xs" variant="secondary" icon={Pencil} disabled={!writable} onClick={openEditFile}>Edit {currentPath.split('/').pop()}</Button> : null}
                <Button size="xs" variant="ghost" icon={GitCommitHorizontal} onClick={() => navigate(`/repositories/${repoId}?tab=commits`)}>History</Button>
              </div>
            </div>
            <RepoBrowser
              repoId={repoId}
              branches={branches}
              branch={data.branch}
              onFileOpen={setCurrentPath}
              refreshKey={browserKey}
            />
            <Banner tone="neutral" className="mt-2.5" title="Where this lives.">
              Commits are stored by Redfox's native repository layer. The same objects can be served by Gitea: the repository record carries an
              integration field and remote URL, so switching providers does not change this interface.
            </Banner>
          </>
        ) : null}

        {tab === 'commits' ? (
          <Panel className="overflow-hidden">
            {commits.loading && !commits.data ? <LoadingBlock label="Loading commits" rows={6} /> : commits.error ? <ErrorState error={commits.error} onRetry={commits.reload} /> : !commits.data?.items?.length ? (
              <EmptyState icon={GitCommitHorizontal} title="No commits" description="Commit a file to start the history." />
            ) : (
              <>
                <Table>
                  <thead>
                    <tr><Th>Commit</Th><Th>Author</Th><Th>Branch</Th><Th align="right">Changes</Th><Th align="right">When</Th></tr>
                  </thead>
                  <tbody>
                    {commits.data.items.map((commit) => (
                      <Tr key={commit.sha} onClick={() => navigate(`/repositories/${repoId}/commits/${commit.sha}`)}>
                        <Td>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-2xs text-dim">{shortSha(commit.sha)}</span>
                            <span className="max-w-[420px] truncate text-xs text-fg">{commit.message}</span>
                          </div>
                        </Td>
                        <Td><span className="text-xs text-muted">{commit.author_name}</span></Td>
                        <Td><span className="font-mono text-2xs text-dim">{commit.branch}</span></Td>
                        <Td align="right">
                          <span className="text-2xs">
                            <span className="text-success">+{commit.additions}</span> <span className="text-danger">-{commit.deletions}</span>
                            <span className="ml-1.5 text-dim">{commit.files_changed} files</span>
                          </span>
                        </Td>
                        <Td align="right"><span className="text-2xs text-dim">{relativeTime(commit.committed_at)}</span></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
                <Pagination page={commits.data.page} pages={commits.data.pages} total={commits.data.total} limit={commits.data.limit} onPage={setCommitPage} className="border-t border-line" />
              </>
            )}
          </Panel>
        ) : null}

        {tab === 'branches' ? (
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Branches"
              icon={GitBranch}
              description="Creating a branch copies the current tree so you can deploy it as a preview."
              actions={<Button size="sm" variant="secondary" icon={Plus} disabled={!writable} onClick={() => setBranchOpen(true)}>New branch</Button>}
            />
            <Table>
              <thead>
                <tr><Th>Branch</Th><Th>Head</Th><Th align="right">Updated</Th><Th align="right">Actions</Th></tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <Tr key={branch.id}>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <GitBranch size={11} className="text-dim" />
                        <span className="font-mono text-xs text-fg">{branch.name}</span>
                        {branch.is_default ? <Badge tone="accent">default</Badge> : null}
                        {branch.protected ? <Lock size={9} className="text-dim" /> : null}
                      </span>
                    </Td>
                    <Td>
                      {branch.head_sha ? (
                        <Link to={`/repositories/${repoId}/commits/${branch.head_sha}`} className="font-mono text-2xs text-muted hover:text-accent">{shortSha(branch.head_sha)}</Link>
                      ) : <span className="text-2xs text-dim">empty</span>}
                    </Td>
                    <Td align="right"><span className="text-2xs text-dim">{relativeTime(branch.updated_at)}</span></Td>
                    <Td align="right">
                      <Button
                        size="xs"
                        variant="ghost"
                        icon={Trash2}
                        disabled={!writable || branch.is_default}
                        onClick={() => setDeleteBranch(branch)}
                      >
                        Delete
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        ) : null}

        {tab === 'settings' ? (
          <div className="grid gap-2.5 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Repository settings" icon={Settings} />
              {settingsForm ? (
                <div className="space-y-3 p-4">
                  <Field label="Description">
                    <Textarea rows={2} value={settingsForm.description} onChange={(event) => setSettingsForm((prev) => ({ ...prev, description: event.target.value }))} disabled={!writable} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Visibility">
                      <Select value={settingsForm.visibility} onChange={(event) => setSettingsForm((prev) => ({ ...prev, visibility: event.target.value }))} disabled={!writable}>
                        <option value="private">Private</option>
                        <option value="public">Public</option>
                      </Select>
                    </Field>
                    <Field label="Default branch">
                      <Select value={settingsForm.default_branch} onChange={(event) => setSettingsForm((prev) => ({ ...prev, default_branch: event.target.value }))} disabled={!writable}>
                        {branches.map((branch) => <option key={branch.name} value={branch.name}>{branch.name}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <Field label="Git remote" hint="Use this as the origin when pushing from outside Redfox.">
                    <div className="flex items-center gap-1">
                      <Input readOnly mono value={repo.remote_url || ''} />
                      <CopyButton value={repo.remote_url || ''} label="" className="px-1" />
                    </div>
                  </Field>
                  <div className="flex justify-end">
                    <Button size="sm" variant="primary" loading={busy} disabled={!writable} onClick={saveSettings}>Save settings</Button>
                  </div>
                </div>
              ) : <LoadingBlock rows={3} />}
            </Panel>

            <Panel>
              <PanelHeader title="Webhook" icon={Webhook} description="Receive push events and deploy automatically." />
              {webhookForm ? (
                <div className="space-y-3 p-4">
                  <Field label="Payload URL">
                    <div className="flex items-center gap-1">
                      <Input mono value={webhookForm.url} onChange={(event) => setWebhookForm((prev) => ({ ...prev, url: event.target.value }))} disabled={!writable} />
                      <CopyButton value={webhookForm.url} label="" className="px-1" />
                    </div>
                  </Field>
                  <Field label="Events">
                    <div className="flex flex-wrap gap-3 pt-1">
                      {['push', 'pull_request'].map((event) => (
                        <label key={event} className="flex items-center gap-1.5 text-xs text-muted">
                          <input
                            type="checkbox"
                            checked={webhookForm.events.includes(event)}
                            onChange={(checked) => setWebhookForm((prev) => ({
                              ...prev,
                              events: checked.target.checked
                                ? [...prev.events, event]
                                : prev.events.filter((item) => item !== event),
                            }))}
                            className="accent-[var(--accent)]"
                          />
                          {event}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Switch checked={webhookForm.active} onChange={(value) => setWebhookForm((prev) => ({ ...prev, active: value }))} label="Webhook active" description="Disabled webhooks are rejected with 409" />
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="primary" loading={busy} disabled={!writable} onClick={saveWebhook}>Save webhook</Button>
                    <Button size="sm" variant="secondary" icon={Send} loading={busy} disabled={!writable} onClick={testWebhook}>Send test delivery</Button>
                  </div>
                  {testResult ? (
                    <Banner tone={testResult.delivered ? 'info' : 'danger'} title={testResult.delivered ? 'Delivery accepted.' : 'Delivery failed.'}>
                      {testResult.delivered ? `HTTP ${testResult.status} in ${testResult.duration_ms}ms from ${testResult.url}` : `${testResult.error || `HTTP ${testResult.status}`} · ${testResult.duration_ms}ms`}
                    </Banner>
                  ) : null}
                  <div className="rounded border border-line bg-base p-2">
                    <p className="text-2xs uppercase tracking-[0.07em] text-dim">Signature</p>
                    <p className="mt-0.5 font-mono text-2xs text-muted">x-redfox-signature: sha256=HMAC(payload, secret)</p>
                    <p className="mt-1 text-2xs text-dim">Secret {webhook.data?.webhook?.secret_preview || 'not configured'}. Requests with a mismatched signature are rejected with 401.</p>
                  </div>
                </div>
              ) : <LoadingBlock rows={3} />}
            </Panel>

            <Panel className="lg:col-span-2">
              <PanelHeader title="Integration" icon={ShieldAlert} />
              <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="text-xs text-muted">Native Redfox repository store</p>
                  <p className="mt-0.5 text-2xs text-dim">
                    Records: {data.files} files · {branches.length} branches · {repo.commit_count ?? '—'} commits. Set <span className="font-mono">integration</span> to <span className="font-mono">gitea</span> and provide a remote URL to move hosting without changing this interface.
                  </p>
                </div>
                <Badge tone="neutral">integration: {repo.integration}</Badge>
              </div>
            </Panel>
          </div>
        ) : null}
      </PageBody>

      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.mode === 'create' ? 'New file' : `Edit ${editor?.path || ''}`}
        description="Committing writes to the repository and can be deployed immediately."
        width="lg"
        footer={(
          <>
            <Button size="sm" onClick={() => setEditor(null)}>Cancel</Button>
            <Button size="sm" variant="primary" icon={Check} onClick={submitCommit} loading={editorBusy} disabled={!editor?.path || !editor?.message || editor?.content === null}>
              Commit to {editor?.branch}
            </Button>
          </>
        )}
      >
        {editor ? (
          <div className="space-y-3">
            {editor.mode === 'create' ? (
              <Field label="File path" required>
                <Input autoFocus mono value={editor.path} onChange={(event) => setEditor((prev) => ({ ...prev, path: event.target.value }))} placeholder="src/app.js" />
              </Field>
            ) : null}
            <Field label="Content" required>
              <Textarea
                mono
                rows={12}
                value={editor.loading ? 'Loading…' : (editor.content ?? '')}
                onChange={(event) => setEditor((prev) => ({ ...prev, content: event.target.value }))}
              />
            </Field>
            <Field label="Commit message" required>
              <Input value={editor.message} onChange={(event) => setEditor((prev) => ({ ...prev, message: event.target.value }))} placeholder="feat: update hero copy" />
            </Field>
            {editorError ? <Banner tone="danger">{editorError}</Banner> : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={branchOpen}
        onClose={() => setBranchOpen(false)}
        title="New branch"
        description="Copies the tree from the selected branch."
        footer={(
          <>
            <Button size="sm" onClick={() => setBranchOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={createBranch} loading={busy} disabled={!branchName.trim()}>Create branch</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field label="Branch name" required hint="For example feat/pricing-table">
            <Input autoFocus mono value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="feat/pricing-table" />
          </Field>
          <Field label="From branch">
            <Select value={branchFrom} onChange={(event) => setBranchFrom(event.target.value)}>
              {branches.map((branch) => <option key={branch.name} value={branch.name}>{branch.name}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteBranch}
        onClose={() => setDeleteBranch(null)}
        onConfirm={removeBranch}
        loading={busy}
        danger
        title="Delete branch"
        description={`Delete ${deleteBranch?.name}? Commits remain reachable from other branches, but this branch name is removed.`}
        confirmLabel="Delete branch"
      />
    </>
  );
}

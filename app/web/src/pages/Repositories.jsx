import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, GitCommitHorizontal, GitFork, Lock, MoreHorizontal, Plus, Settings } from 'lucide-react';
import { post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import {
  Badge, Button, EmptyState, ErrorState, IconButton, LoadingBlock, Menu, MenuItem, Modal, Field, Input,
  PageHeader, Panel, SearchInput, Select, Table, Td, Th, Tr, Textarea, useToast,
} from '../ui/index.jsx';
import { relativeTime, shortSha } from '../lib/format.js';
import { canWrite, useAuth } from '../lib/auth.jsx';

export default function Repositories() {
  const navigate = useNavigate();
  const toast = useToast();
  const { role } = useAuth();
  const writable = canWrite(role);
  const { data, loading, error, reload } = useApi('/api/repos');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', visibility: 'private', project_id: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const repos = (data?.repositories || []).filter((repo) => (
    !search || `${repo.name} ${repo.description || ''}`.toLowerCase().includes(search.toLowerCase())
  ));

  const create = async () => {
    setBusy(true);
    setFormError(null);
    try {
      const result = await post('/api/repos', {
        name: form.name,
        description: form.description || undefined,
        visibility: form.visibility,
        project_id: form.project_id || null,
      });
      toast.success('Repository created', result.repository.slug);
      setCreateOpen(false);
      setForm({ name: '', description: '', visibility: 'private', project_id: '' });
      navigate(`/repositories/${result.repository.id}`);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Repositories"
        description="Git storage for this workspace. Branches, commits and webhooks are hosted by Redfox; a Gitea integration can take over the same records."
        actions={<Button size="sm" variant="primary" icon={Plus} disabled={!writable} onClick={() => { setFormError(null); setCreateOpen(true); }}>New repository</Button>}
      />
      <PageBody>
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <SearchInput value={search} onChange={setSearch} placeholder="Filter repositories" className="w-full sm:w-64" />
          <span className="ml-auto text-2xs text-dim">{repos.length} repositories</span>
        </div>

        <Panel className="overflow-hidden">
          {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <LoadingBlock label="Loading repositories" rows={4} /> : repos.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title={search ? 'No repositories match' : 'No repositories yet'}
              description={search ? 'Try a different search.' : 'Create a repository to hold source code and trigger deployments on push.'}
              action={!search ? <Button size="sm" variant="primary" icon={Plus} disabled={!writable} onClick={() => setCreateOpen(true)}>New repository</Button> : null}
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Repository</Th>
                  <Th>Connected project</Th>
                  <Th>Head commit</Th>
                  <Th align="right">Branches</Th>
                  <Th align="right">Commits</Th>
                  <Th align="right">Updated</Th>
                  <Th align="right"> </Th>
                </tr>
              </thead>
              <tbody>
                {repos.map((repo) => (
                  <Tr key={repo.id} onClick={() => navigate(`/repositories/${repo.id}`)}>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <GitBranch size={11} className="text-dim" />
                        <span className="font-medium text-fg">{repo.name}</span>
                        {repo.visibility === 'private' ? <Lock size={9} className="text-dim" /> : null}
                      </div>
                      <p className="mt-0.5 max-w-[320px] truncate text-2xs text-dim">{repo.description || 'No description'}</p>
                    </Td>
                    <Td>
                      {repo.project
                        ? <span className="text-xs text-muted">{repo.project.name}</span>
                        : <span className="text-2xs text-dim">not connected</span>}
                    </Td>
                    <Td>
                      {repo.head_commit ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-2xs text-muted">{shortSha(repo.head_commit.sha)}</span>
                          <span className="max-w-[220px] truncate text-xs text-muted">{repo.head_commit.message}</span>
                        </div>
                      ) : <span className="text-2xs text-dim">empty</span>}
                    </Td>
                    <Td align="right"><span className="tabular text-xs text-muted">{repo.branch_count}</span></Td>
                    <Td align="right"><span className="tabular text-xs text-muted">{repo.commit_count}</span></Td>
                    <Td align="right"><span className="text-2xs text-dim">{relativeTime(repo.head_commit?.committed_at)}</span></Td>
                    <Td align="right">
                      <div onClick={(event) => event.stopPropagation()} className="flex justify-end">
                        <Menu trigger={<IconButton label="Repository actions" icon={MoreHorizontal} />}>
                          <MenuItem icon={GitBranch} to={`/repositories/${repo.id}`}>Browse code</MenuItem>
                          <MenuItem icon={GitCommitHorizontal} to={`/repositories/${repo.id}?tab=commits`}>Commits</MenuItem>
                          <MenuItem icon={Settings} to={`/repositories/${repo.id}?tab=settings`}>Settings</MenuItem>
                          {repo.project ? <MenuItem icon={GitFork} to={`/projects/${repo.project.slug}`}>Open project</MenuItem> : null}
                        </Menu>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <p className="mt-2 px-1 text-2xs text-dim">
          Pushes to a connected repository can trigger deployments through the webhook URL shown in repository settings.
        </p>
      </PageBody>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New repository"
        description="Repositories live in the workspace and can be connected to one project."
        footer={(
          <>
            <Button size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={create} loading={busy} disabled={!form.name.trim()}>Create repository</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field label="Name" required>
            <Input autoFocus value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="atlas-web" />
          </Field>
          <Field label="Description">
            <Textarea rows={2} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Marketing site for Atlas." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Visibility">
              <Select value={form.visibility} onChange={(event) => setForm((prev) => ({ ...prev, visibility: event.target.value }))}>
                <option value="private">Private</option>
                <option value="public">Public</option>
              </Select>
            </Field>
            <Field label="Connect to project" hint="Optional">
              <Select value={form.project_id} onChange={(event) => setForm((prev) => ({ ...prev, project_id: event.target.value }))}>
                <option value="">None</option>
                {(data?.projects || []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </Select>
            </Field>
          </div>
          {formError ? <div className="rounded border border-danger/30 bg-danger/[0.07] px-2.5 py-2 text-xs text-danger">{formError}</div> : null}
        </div>
      </Modal>
    </>
  );
}

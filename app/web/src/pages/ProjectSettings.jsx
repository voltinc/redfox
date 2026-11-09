import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle, GitBranch, Globe, KeyRound, Save, Settings, ShieldAlert, SlidersHorizontal, Trash2, Webhook,
} from 'lucide-react';
import { del, patch } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import EnvVarsManager from '../components/EnvVarsManager.jsx';
import DomainsPanel from '../components/DomainsPanel.jsx';
import {
  Badge, Banner, Button, CopyButton, Field, Input, Panel, PanelHeader, Select, Textarea, useToast,
} from '../ui/index.jsx';
import { cx } from '../lib/format.js';
import { canAdmin, canWrite, useAuth } from '../lib/auth.jsx';

const SECTIONS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'build', label: 'Build & runner', icon: SlidersHorizontal },
  { id: 'domains', label: 'Domains', icon: Globe },
  { id: 'environment', label: 'Environment', icon: KeyRound },
  { id: 'git', label: 'Git', icon: GitBranch },
  { id: 'danger', label: 'Danger zone', icon: ShieldAlert },
];

export default function ProjectSettings() {
  const { project, reload, writable } = useOutletContext();
  const { role } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const meta = useApi('/api/meta/frameworks');
  const repoState = useApi(project.repository?.id ? `/api/repos/${project.repository.id}/webhook` : null, { skip: !project.repository?.id });

  const [general, setGeneral] = useState({ name: project.name, description: project.description || '', status: project.status, production_branch: project.production_branch });
  const [build, setBuild] = useState({
    framework: project.framework, runner: project.runner, install_command: project.install_command,
    build_command: project.build_command, output_dir: project.output_dir, root_dir: project.root_dir,
  });
  const [saving, setSaving] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setGeneral({ name: project.name, description: project.description || '', status: project.status, production_branch: project.production_branch });
    setBuild({
      framework: project.framework, runner: project.runner, install_command: project.install_command,
      build_command: project.build_command, output_dir: project.output_dir, root_dir: project.root_dir,
    });
  }, [project]);

  const save = async (section, payload) => {
    setSaving(section);
    try {
      await patch(`/api/projects/${project.slug}`, payload);
      toast.success('Settings saved');
      reload();
    } catch (err) {
      toast.error('Could not save settings', err.message);
    } finally {
      setSaving(null);
    }
  };

  const removeProject = async () => {
    setDeleting(true);
    try {
      await del(`/api/projects/${project.slug}`, { confirm: confirmText });
      toast.success('Project deleted', project.name);
      navigate('/projects');
    } catch (err) {
      toast.error('Could not delete project', err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageBody>
      <div className="[&>*]:min-w-0 grid gap-2.5 lg:grid-cols-[170px_minmax(0,1fr)]">
        <nav className="hidden lg:block">
          <div className="sticky top-[60px] space-y-[1px]">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm text-muted transition-colors hover:bg-raised hover:text-fg"
              >
                <section.icon size={12} className="text-dim" />
                {section.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="space-y-2.5">
          <Panel id="general">
            <PanelHeader title="General" description="Identity and lifecycle for this project." icon={Settings} />
            <div className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Project name" required>
                  <Input value={general.name} onChange={(event) => setGeneral((prev) => ({ ...prev, name: event.target.value }))} disabled={!writable} />
                </Field>
                <Field label="Slug" hint="Cannot be changed after creation.">
                  <Input value={project.slug} mono disabled />
                </Field>
              </div>
              <Field label="Description">
                <Textarea rows={2} value={general.description} onChange={(event) => setGeneral((prev) => ({ ...prev, description: event.target.value }))} disabled={!writable} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Status" hint="Paused projects cannot be deployed.">
                  <Select value={general.status} onChange={(event) => setGeneral((prev) => ({ ...prev, status: event.target.value }))} disabled={!writable}>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                  </Select>
                </Field>
                <Field label="Production branch">
                  <Input value={general.production_branch} mono onChange={(event) => setGeneral((prev) => ({ ...prev, production_branch: event.target.value }))} disabled={!writable} />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="primary" icon={Save} loading={saving === 'general'} disabled={!writable} onClick={() => save('general', general)}>Save general</Button>
              </div>
            </div>
          </Panel>

          <Panel id="build">
            <PanelHeader title="Build & runner" description="Commands executed by the deployment worker." icon={SlidersHorizontal} />
            <div className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Framework">
                  <Select value={build.framework} onChange={(event) => setBuild((prev) => ({ ...prev, framework: event.target.value }))} disabled={!writable}>
                    {(meta.data?.frameworks || []).map((framework) => <option key={framework.id} value={framework.id}>{framework.label}</option>)}
                  </Select>
                </Field>
                <Field label="Root directory">
                  <Input value={build.root_dir} mono onChange={(event) => setBuild((prev) => ({ ...prev, root_dir: event.target.value }))} disabled={!writable} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Install command" hint="Use none to skip.">
                  <Input value={build.install_command} mono onChange={(event) => setBuild((prev) => ({ ...prev, install_command: event.target.value }))} disabled={!writable} />
                </Field>
                <Field label="Build command">
                  <Input value={build.build_command} mono onChange={(event) => setBuild((prev) => ({ ...prev, build_command: event.target.value }))} disabled={!writable} />
                </Field>
                <Field label="Output directory">
                  <Input value={build.output_dir} mono onChange={(event) => setBuild((prev) => ({ ...prev, output_dir: event.target.value }))} disabled={!writable} />
                </Field>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">Runner</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(meta.data?.runners || []).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      disabled={!writable}
                      onClick={() => setBuild((prev) => ({ ...prev, runner: option.id }))}
                      className={cx('rounded-md border px-3 py-2 text-left transition-colors disabled:opacity-60',
                        build.runner === option.id ? 'border-accent/60 bg-accent/10' : 'border-line bg-base hover:border-strong')}
                    >
                      <span className="flex items-center justify-between text-xs font-medium text-fg">
                        {option.label}
                        {build.runner === option.id ? <Badge tone="accent">selected</Badge> : null}
                      </span>
                      <span className="mt-0.5 block text-2xs leading-4 text-dim">{option.detail}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button size="sm" variant="primary" icon={Save} loading={saving === 'build'} disabled={!writable} onClick={() => save('build', build)}>Save build settings</Button>
              </div>
            </div>
          </Panel>

          <div id="domains"><DomainsPanel projectSlug={project.slug} /></div>

          <div id="environment">
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-medium text-fg"><KeyRound size={13} className="text-dim" /> Environment variables</h2>
              <Button size="xs" variant="ghost" onClick={() => navigate(`/projects/${project.slug}/settings#environment`)}>Permalink</Button>
            </div>
            <EnvVarsManager project={project} />
          </div>

          <Panel id="git">
            <PanelHeader title="Git" description="Repository connection and webhook." icon={GitBranch} />
            <div className="space-y-3 p-4">
              {project.repository ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs text-fg">{project.repository.slug}</span>
                    <Button size="xs" variant="secondary" onClick={() => navigate(`/repositories/${project.repository.id}`)}>Open repository</Button>
                  </div>
                  <Field label="Webhook URL" hint="Point a Gitea or GitHub webhook here to deploy on push.">
                    <div className="flex items-center gap-1">
                      <Input readOnly mono value={repoState.data?.webhook?.url || ''} />
                      <CopyButton value={repoState.data?.webhook?.url || ''} label="" className="px-1" />
                    </div>
                  </Field>
                  <div className="flex flex-wrap items-center gap-1.5 text-2xs text-dim">
                    <Badge tone={repoState.data?.webhook?.active ? 'success' : 'neutral'}>{repoState.data?.webhook?.active ? 'webhook active' : 'webhook disabled'}</Badge>
                    <span>Events: {(repoState.data?.webhook?.events || []).join(', ') || 'none'}</span>
                    <span>Secret {repoState.data?.webhook?.secret_configured ? 'configured' : 'not set'}</span>
                  </div>
                </>
              ) : (
                <Banner tone="warn" title="No repository connected.">
                  A repository is required for deployments. Create one from the Repositories page, then attach it here.
                </Banner>
              )}
              <div className="flex justify-end">
                <Button size="sm" variant="secondary" icon={Webhook} onClick={() => navigate('/repositories')}>Manage repositories</Button>
              </div>
            </div>
          </Panel>

          <Panel id="danger" className="border-danger/30">
            <PanelHeader title="Danger zone" icon={AlertTriangle} description="Destructive actions cannot be undone." />
            <div className="space-y-3 p-4">
              <p className="text-sm text-muted">
                Deleting this project removes its deployments, database, storage buckets, domains and environment variables.
                Repositories are kept in the workspace so their history is not lost.
              </p>
              <div className="grid gap-2 sm:grid-cols-[240px_auto]">
                <Field label={`Type "${project.slug}" to confirm`}>
                  <Input mono value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder={project.slug} disabled={!canAdmin(role)} />
                </Field>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    variant="danger"
                    icon={Trash2}
                    loading={deleting}
                    disabled={confirmText !== project.slug || !canAdmin(role)}
                    onClick={removeProject}
                  >
                    Delete project
                  </Button>
                </div>
              </div>
              {!canAdmin(role) ? <p className="text-2xs text-dim">Only workspace owners and admins can delete projects.</p> : null}
            </div>
          </Panel>
        </div>
      </div>
    </PageBody>
  );
}

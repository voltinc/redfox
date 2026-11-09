import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Box, Check, GitBranch, Info, Plus, Rocket, Server } from 'lucide-react';
import { post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import {
  Badge, Banner, Button, Field, Input, LoadingBlock, PageHeader, Panel, PanelHeader, Select, Textarea, useToast,
} from '../ui/index.jsx';
import { cx } from '../lib/format.js';

export default function ProjectNew() {
  const navigate = useNavigate();
  const toast = useToast();
  const meta = useApi('/api/meta/frameworks');
  const repos = useApi('/api/repos');

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [framework, setFramework] = useState('static');
  const [runner, setRunner] = useState('local');
  const [source, setSource] = useState('new');
  const [repositoryId, setRepositoryId] = useState('');
  const [installCommand, setInstallCommand] = useState('none');
  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [outputDir, setOutputDir] = useState('dist');
  const [productionBranch, setProductionBranch] = useState('main');
  const [commandsTouched, setCommandsTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const frameworks = meta.data?.frameworks || [];
  const availableRepos = (repos.data?.repositories || []).filter((repo) => !repo.project);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48));
    }
  }, [name, slugTouched]);

  const applyFramework = (id) => {
    setFramework(id);
    setCommandsTouched(false);
    const preset = frameworks.find((f) => f.id === id);
    if (preset) {
      setBuildCommand(preset.build);
      setOutputDir(preset.output);
      setInstallCommand(preset.install);
    }
  };

  /* Keep the commands in step with the selected framework until the user edits
     them by hand. The defaults come from the server's framework presets, so a
     static site is never given a build step it has no manifest for. */
  useEffect(() => {
    if (commandsTouched) return;
    const preset = frameworks.find((f) => f.id === framework);
    if (!preset) return;
    setBuildCommand(preset.build);
    setOutputDir(preset.output);
    setInstallCommand(preset.install);
  }, [frameworks.length, framework, commandsTouched]);

  const selectedRepo = useMemo(() => availableRepos.find((repo) => repo.id === repositoryId), [availableRepos, repositoryId]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await post('/api/projects', {
        name: name.trim(),
        slug,
        description: description.trim() || undefined,
        framework,
        runner,
        repository_id: source === 'import' ? repositoryId : undefined,
        create_repository: source === 'new',
        install_command: installCommand,
        build_command: buildCommand,
        output_dir: outputDir,
        production_branch: productionBranch,
      });
      toast.success('Project created', result.project.name);
      navigate(`/projects/${result.project.slug}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const disabled = !name.trim() || !slug || (source === 'import' && !repositoryId);

  return (
    <>
      <PageHeader
        title="New project"
        description="A project connects a repository, a database and a deployment pipeline."
        breadcrumb={<><span className="text-dim">Projects</span><span className="text-line">/</span><span>New</span></>}
      />
      <PageBody>
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-2.5">
            <Panel>
              <PanelHeader title="Details" description="How the project appears across the workspace." />
              <div className="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Project name" required>
                    <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Atlas Web" />
                  </Field>
                  <Field label="Slug" hint="Used in URLs and the database name.">
                    <Input
                      value={slug}
                      mono
                      onChange={(event) => { setSlugTouched(true); setSlug(event.target.value); }}
                      placeholder="atlas-web"
                    />
                  </Field>
                </div>
                <Field label="Description" hint="Optional. Shown on the project overview.">
                  <Textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Marketing site for Atlas. Static output, no runtime dependencies." />
                </Field>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Source" description="Import an existing repository or start with a new one." />
              <div className="p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSource('new')}
                    className={cx('rounded-md border px-3 py-2.5 text-left transition-colors', source === 'new' ? 'border-accent/60 bg-[#181010]' : 'border-line bg-base hover:border-strong')}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium text-fg"><Plus size={12} /> New repository</span>
                    <span className="mt-0.5 block text-xs text-dim">Creates an empty repository with a README and a main branch.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSource('import')}
                    className={cx('rounded-md border px-3 py-2.5 text-left transition-colors', source === 'import' ? 'border-accent/60 bg-[#181010]' : 'border-line bg-base hover:border-strong')}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium text-fg"><GitBranch size={12} /> Import repository</span>
                    <span className="mt-0.5 block text-xs text-dim">Connect one of the repositories already in this workspace.</span>
                  </button>
                </div>

                {source === 'import' ? (
                  <div className="mt-3">
                    {repos.loading ? <LoadingBlock label="Loading repositories" rows={1} /> : availableRepos.length === 0 ? (
                      <Banner tone="neutral">Every repository in this workspace is already connected to a project. Create a new one instead.</Banner>
                    ) : (
                      <Field label="Repository" required>
                        <Select value={repositoryId} onChange={(event) => setRepositoryId(event.target.value)}>
                          <option value="">Select a repository</option>
                          {availableRepos.map((repo) => (
                            <option key={repo.id} value={repo.id}>{repo.name} · {repo.commit_count} commits</option>
                          ))}
                        </Select>
                      </Field>
                    )}
                    {selectedRepo ? (
                      <p className="mt-1.5 text-xs text-dim">
                        {selectedRepo.description || 'No description'} · default branch <span className="font-mono text-muted">{selectedRepo.default_branch}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Build configuration" description="Commands run by the deployment worker." />
              <div className="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Framework">
                    <Select value={framework} onChange={(event) => applyFramework(event.target.value)}>
                      {frameworks.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Production branch">
                    <Input value={productionBranch} mono onChange={(event) => setProductionBranch(event.target.value)} />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Install command" hint="Use none to skip.">
                    <Input value={installCommand} mono onChange={(event) => { setCommandsTouched(true); setInstallCommand(event.target.value); }} />
                  </Field>
                  <Field label="Build command">
                    <Input value={buildCommand} mono placeholder="no build step" onChange={(event) => { setCommandsTouched(true); setBuildCommand(event.target.value); }} />
                  </Field>
                  <Field label="Output directory">
                    <Input value={outputDir} mono onChange={(event) => { setCommandsTouched(true); setOutputDir(event.target.value); }} />
                  </Field>
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Runner" description="Where the build actually happens." />
              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {(meta.data?.runners || []).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRunner(option.id)}
                    className={cx('rounded-md border px-3 py-2.5 text-left transition-colors', runner === option.id ? 'border-accent/60 bg-[#181010]' : 'border-line bg-base hover:border-strong')}
                  >
                    <span className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
                        {option.id === 'local' ? <Server size={12} /> : <Info size={12} />}
                        {option.label}
                      </span>
                      {runner === option.id ? <Check size={12} className="text-accent" /> : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-dim">{option.detail}</span>
                  </button>
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-2.5">
            <Panel>
              <PanelHeader title="Summary" />
              <div className="space-y-2 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-dim">Project</span>
                  <span className="text-fg">{name || 'Untitled'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dim">Slug</span>
                  <span className="font-mono text-xs text-muted">{slug || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dim">Framework</span>
                  <span className="capitalize text-fg">{framework}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dim">Source</span>
                  <span className="text-fg">{source === 'import' ? (selectedRepo?.name || 'not selected') : 'new repository'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dim">Runner</span>
                  <Badge tone={runner === 'local' ? 'success' : 'warn'}>{runner === 'local' ? 'real builds' : 'demonstration'}</Badge>
                </div>
                <div className="border-t border-line pt-2">
                  <p className="text-2xs uppercase tracking-[0.07em] text-dim">Pipeline</p>
                  <p className="mt-1 break-all font-mono text-2xs leading-4 text-muted">{installCommand} → {buildCommand} → {outputDir}/</p>
                </div>
              </div>
            </Panel>

            <Panel className="p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-fg"><Box size={12} className="text-accent" /> What gets provisioned</p>
              <ul className="mt-2 space-y-1.5 text-xs text-muted">
                <li className="flex gap-1.5"><Check size={11} className="mt-[2px] shrink-0 text-success" /> A repository with a protected main branch</li>
                <li className="flex gap-1.5"><Check size={11} className="mt-[2px] shrink-0 text-success" /> An isolated database, separate from every other project</li>
                <li className="flex gap-1.5"><Check size={11} className="mt-[2px] shrink-0 text-success" /> Production and preview environments</li>
                <li className="flex gap-1.5"><Check size={11} className="mt-[2px] shrink-0 text-success" /> A deployment pipeline with build logs</li>
              </ul>
              <p className="mt-2.5 border-t border-line pt-2 text-2xs leading-4 text-dim">
                Storage buckets, custom domains and API keys are added from the project pages once it exists.
              </p>
            </Panel>

            {error ? <Banner tone="danger" title="Could not create project.">{error}</Banner> : null}

            <div className="flex items-center justify-end gap-2">
              <Button size="sm" onClick={() => navigate('/projects')}>Cancel</Button>
              <Button size="sm" variant="primary" icon={Rocket} loading={busy} disabled={disabled} onClick={submit}>
                Create project
              </Button>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { Button, Field, Modal, Select, Banner, useToast } from '../ui/index.jsx';

export function DeployModal({ open, onClose, projects = [], defaultProject }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [projectId, setProjectId] = useState(defaultProject || '');
  const [environment, setEnvironment] = useState('preview');
  const [branch, setBranch] = useState('main');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const project = projects.find((p) => p.slug === projectId || p.id === projectId);
  const repoId = project?.repository?.id || project?.repository_id;
  const { data: repoData } = useApi(repoId ? `/api/repos/${repoId}` : null, { skip: !repoId || !open });

  useEffect(() => {
    if (!open) return;
    const initial = defaultProject || projects[0]?.slug || '';
    setProjectId(initial);
    setEnvironment('preview');
    setError(null);
  }, [open, defaultProject, projects]);

  useEffect(() => {
    if (!repoData?.branches) return;
    const production = project?.production_branch || 'main';
    const preferred = environment === 'production' ? production : (repoData.branches.find((b) => b.name !== production)?.name || production);
    setBranch(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoData?.branches?.length, environment, project?.slug]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await post('/api/deployments', { project: projectId, environment, branch });
      toast.success('Deployment queued', `${project?.name} · ${environment} · ${branch}`);
      onClose();
      navigate(`/deployments/${result.deployment.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create deployment"
      description="A deployment builds the selected commit and publishes it to an environment."
      footer={(
        <>
          <Button size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" icon={Rocket} onClick={submit} loading={busy} disabled={!projectId || !branch}>Deploy</Button>
        </>
      )}
    >
      <div className="space-y-3">
        <Field label="Project" required>
          <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.slug}>{project.name}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Environment" required>
            <Select value={environment} onChange={(event) => setEnvironment(event.target.value)}>
              <option value="preview">Preview</option>
              <option value="production">Production</option>
            </Select>
          </Field>
          <Field label="Branch" hint={repoData ? undefined : 'Connect a repository to choose a branch'}>
            {repoData?.branches?.length ? (
              <Select value={branch} onChange={(event) => setBranch(event.target.value)}>
                {repoData.branches.map((item) => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </Select>
            ) : (
              <Select value={branch} onChange={(event) => setBranch(event.target.value)}>
                <option value="main">main</option>
              </Select>
            )}
          </Field>
        </div>

        {project?.runner === 'demo' ? (
          <Banner tone="warn" title="Simulated runner.">
            This project records the pipeline without executing it. Set the runner to local in project settings to run real builds.
          </Banner>
        ) : project?.runner === 'local' ? (
          <Banner tone="neutral">
            This deployment runs the real install and build commands on this host, then publishes the output directory as a preview URL.
          </Banner>
        ) : null}

        {error ? <Banner tone="danger" title="Deployment rejected.">{error}</Banner> : null}
      </div>
    </Modal>
  );
}

export default DeployModal;

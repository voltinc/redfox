import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { PageBody } from '../components/Shell.jsx';
import { DeploymentsTable } from '../components/DeploymentsTable.jsx';
import { DeployModal } from '../components/DeployModal.jsx';
import { Button, Panel, SearchInput, SegmentedControl } from '../ui/index.jsx';

export default function ProjectDeployments() {
  const { project, deployments, writable } = useOutletContext();
  const [status, setStatus] = useState('all');
  const [environment, setEnvironment] = useState('all');
  const [query, setQuery] = useState('');
  const [deployOpen, setDeployOpen] = useState(false);

  const filtered = deployments.filter((deployment) => {
    if (status !== 'all' && deployment.status !== status) return false;
    if (environment !== 'all' && deployment.environment !== environment) return false;
    if (query && !`${deployment.commit_message} ${deployment.commit_sha} ${deployment.actor}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <PageBody>
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <SearchInput value={query} onChange={setQuery} placeholder="Filter commits and actors" className="w-full sm:w-64" />
        <SegmentedControl
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'ready', label: 'Ready' },
            { value: 'building', label: 'Building' },
            { value: 'failed', label: 'Failed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
        <SegmentedControl
          size="sm"
          value={environment}
          onChange={setEnvironment}
          options={[{ value: 'all', label: 'All envs' }, { value: 'production', label: 'Production' }, { value: 'preview', label: 'Preview' }]}
        />
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-2xs text-dim">{filtered.length} of {deployments.length}</span>
          <Button size="sm" variant="primary" icon={Rocket} disabled={!writable} onClick={() => setDeployOpen(true)}>New deployment</Button>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <DeploymentsTable
          deployments={filtered}
          emptyAction={<Button size="sm" variant="primary" icon={Rocket} disabled={!writable} onClick={() => setDeployOpen(true)}>Create deployment</Button>}
        />
      </Panel>

      <p className="mt-2 px-1 text-2xs text-dim">
        This list shows the ten most recent deployments for the project. Open the global Deployments page to search the full history.
      </p>

      <DeployModal open={deployOpen} onClose={() => setDeployOpen(false)} projects={[project]} defaultProject={project.slug} />
    </PageBody>
  );
}

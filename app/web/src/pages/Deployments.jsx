import React, { useState } from 'react';
import { Rocket } from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import { DeploymentsTable } from '../components/DeploymentsTable.jsx';
import { DeployModal } from '../components/DeployModal.jsx';
import {
  Button, ErrorState, LoadingBlock, Pagination, Panel, SearchInput, SegmentedControl, Select,
} from '../ui/index.jsx';

export default function Deployments() {
  const [status, setStatus] = useState('all');
  const [environment, setEnvironment] = useState('all');
  const [project, setProject] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [deployOpen, setDeployOpen] = useState(false);

  const params = new URLSearchParams({ limit: '25', page: String(page) });
  if (status !== 'all') params.set('status', status);
  if (environment !== 'all') params.set('environment', environment);
  if (project) params.set('project', project);
  if (query) params.set('q', query);

  const { data, loading, error, reload } = useApi(`/api/deployments?${params.toString()}`, { deps: [status, environment, project, query, page] });

  const reset = (setter, value) => { setter(value); setPage(1); };

  return (
    <>
      <PageHeaderWrapper actions={<Button size="sm" variant="primary" icon={Rocket} onClick={() => setDeployOpen(true)}>New deployment</Button>} projectCount={data?.projects?.length} />
      <PageBody>
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <SearchInput value={query} onChange={(value) => reset(setQuery, value)} placeholder="Search commits, shas and ids" className="w-full sm:w-64" />
          <SegmentedControl
            size="sm"
            value={status}
            onChange={(value) => reset(setStatus, value)}
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
            onChange={(value) => reset(setEnvironment, value)}
            options={[{ value: 'all', label: 'All envs' }, { value: 'production', label: 'Production' }, { value: 'preview', label: 'Preview' }]}
          />
          <div className="w-[160px]">
            <Select value={project} onChange={(event) => reset(setProject, event.target.value)}>
              <option value="">All projects</option>
              {(data?.projects || []).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2 text-2xs text-dim">
            {data?.queue ? <span className="tabular">{data.queue.running} running · {data.queue.queued} queued</span> : null}
            {data?.total !== undefined ? <span>{data.total} total</span> : null}
          </div>
        </div>

        <Panel className="overflow-hidden">
          {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <LoadingBlock label="Loading deployments" rows={6} /> : (
            <>
              <DeploymentsTable
                deployments={data?.items || []}
                emptyAction={<Button size="sm" variant="primary" icon={Rocket} onClick={() => setDeployOpen(true)}>Create deployment</Button>}
              />
              {data ? <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={setPage} className="border-t border-line" /> : null}
            </>
          )}
        </Panel>

        <p className="mt-2 px-1 text-2xs text-dim">
          Queued deployments are picked up by the worker pool immediately. Build logs stream live on the deployment page.
        </p>
      </PageBody>

      <DeployModal open={deployOpen} onClose={() => setDeployOpen(false)} projects={data?.projects ? data.projects.map((p) => ({ ...p, repository: null })) : []} />
    </>
  );
}

function PageHeaderWrapper({ actions, projectCount }) {
  return (
    <div className="border-b border-line bg-base/60">
      <div className="mx-auto max-w-[1400px] px-6 pt-4 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">Deployments</h1>
            <p className="mt-0.5 text-sm text-muted">
              Every build across {projectCount ?? 'all'} projects, with logs, artifacts and rollback history.
            </p>
          </div>
          <div className="flex items-center gap-1.5">{actions}</div>
        </div>
      </div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight, Box, GitBranch, MoreHorizontal, Plus, Rocket, Search, Settings, SlidersHorizontal,
} from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import { DeployModal } from '../components/DeployModal.jsx';
import {
  Badge, Button, EmptyState, ErrorState, IconButton, LoadingBlock, Menu, MenuItem, PageHeader,
  Panel, SearchInput, Select, StatusBadge, Table, Td, Th, Tr,
} from '../ui/index.jsx';
import { relativeTime } from '../lib/format.js';

export default function Projects() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi('/api/projects');
  const [query, setQuery] = useState('');
  const [framework, setFramework] = useState('all');
  const [status, setStatus] = useState('all');
  const [deployOpen, setDeployOpen] = useState(false);

  const projects = data?.projects || [];
  const frameworks = useMemo(() => [...new Set(projects.map((p) => p.framework))].sort(), [projects]);

  const filtered = projects.filter((project) => {
    if (framework !== 'all' && project.framework !== framework) return false;
    if (status !== 'all' && project.status !== status) return false;
    if (query && !`${project.name} ${project.slug} ${project.description || ''}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project owns a repository, a database, storage buckets and its own deployment history."
        actions={(
          <>
            <Button size="sm" variant="secondary" icon={Rocket} onClick={() => setDeployOpen(true)}>Deploy</Button>
            <Button size="sm" variant="primary" icon={Plus} onClick={() => navigate('/projects/new')}>New project</Button>
          </>
        )}
      />

      <PageBody>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <SearchInput value={query} onChange={setQuery} placeholder="Filter projects" className="w-full sm:w-64" />
          <div className="w-[150px]">
            <Select value={framework} onChange={(event) => setFramework(event.target.value)}>
              <option value="all">All frameworks</option>
              {frameworks.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </div>
          <div className="w-[130px]">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Any status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
          <span className="ml-auto text-2xs text-dim">{filtered.length} of {projects.length}</span>
        </div>

        <Panel className="overflow-hidden">
          {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <LoadingBlock rows={4} /> : filtered.length === 0 ? (
            <EmptyState
              icon={Box}
              title={projects.length ? 'No projects match these filters' : 'No projects yet'}
              description={projects.length ? 'Clear the filters to see all projects.' : 'Create a project to connect a repository, provision a database and start deploying.'}
              action={projects.length
                ? <Button size="sm" onClick={() => { setQuery(''); setFramework('all'); setStatus('all'); }}>Clear filters</Button>
                : <Button size="sm" variant="primary" icon={Plus} onClick={() => navigate('/projects/new')}>New project</Button>}
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Project</Th>
                  <Th>Framework</Th>
                  <Th>Repository</Th>
                  <Th>Last deployment</Th>
                  <Th>Domains</Th>
                  <Th>Status</Th>
                  <Th align="right"> </Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => (
                  <Tr key={project.id} onClick={() => navigate(`/projects/${project.slug}`)}>
                    <Td>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-fg">{project.name}</span>
                          {project.runner === 'local' ? <Badge tone="success">real builds</Badge> : <Badge tone="neutral">demo runner</Badge>}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 font-mono text-2xs text-dim">
                          {project.slug}
                          <span className="text-dim">·</span>
                          {project.production_branch}
                        </div>
                      </div>
                    </Td>
                    <Td><span className="text-xs capitalize text-muted">{project.framework}</span></Td>
                    <Td>
                      {project.repository ? (
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <GitBranch size={11} className="text-dim" />
                          {project.repository.name}
                        </span>
                      ) : <span className="text-xs text-dim">not connected</span>}
                    </Td>
                    <Td>
                      {project.last_deployment ? (
                        <div className="flex items-center gap-2">
                          <StatusBadge status={project.last_deployment.status} />
                          <span className="text-2xs text-dim">{relativeTime(project.last_deployment.created_at)}</span>
                        </div>
                      ) : <span className="text-2xs text-dim">never</span>}
                    </Td>
                    <Td>
                      <span className="text-xs text-muted">
                        {project.domains?.length
                          ? project.domains[0].hostname + (project.domains.length > 1 ? ` +${project.domains.length - 1}` : '')
                          : '—'}
                      </span>
                    </Td>
                    <Td><StatusBadge status={project.status} /></Td>
                    <Td align="right">
                      <div onClick={(event) => event.stopPropagation()} className="flex justify-end">
                        <Menu
                          trigger={<IconButton label="Project actions" icon={MoreHorizontal} />}
                        >
                          <MenuItem icon={ArrowUpRight} to={`/projects/${project.slug}`}>Open project</MenuItem>
                          <MenuItem icon={Rocket} to={`/projects/${project.slug}/deployments`}>Deployments</MenuItem>
                          <MenuItem icon={GitBranch} to={`/projects/${project.slug}/repository`}>Repository</MenuItem>
                          <MenuItem icon={Settings} to={`/projects/${project.slug}/settings`}>Settings</MenuItem>
                        </Menu>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-2xs text-dim">
          <span className="flex items-center gap-1"><SlidersHorizontal size={10} /> Projects marked <span className="text-success">real builds</span> execute install and build commands on this host.</span>
          <span className="flex items-center gap-1"><Search size={10} /> Use ⌘K to jump to any project, deployment or file.</span>
        </div>
      </PageBody>

      <DeployModal open={deployOpen} onClose={() => setDeployOpen(false)} projects={projects} />
    </>
  );
}

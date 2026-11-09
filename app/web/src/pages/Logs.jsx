import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import LogsView from '../components/LogsView.jsx';
import { ErrorState, LoadingBlock, PageHeader } from '../ui/index.jsx';

export default function Logs() {
  const [params, setParams] = useSearchParams();
  const projectsState = useApi('/api/projects');
  const projects = projectsState.data?.projects || [];
  const slug = params.get('project') || '';
  const project = projects.find((item) => item.slug === slug) || null;

  return (
    <>
      <PageHeader
        title="Logs"
        description="Runtime, data API and build activity in one stream. Live rows are recorded by this server; seeded rows are labelled."
      />
      <PageBody wide>
        {projectsState.error ? <ErrorState error={projectsState.error} onRetry={projectsState.reload} /> : projectsState.loading ? <LoadingBlock label="Loading projects" rows={4} /> : (
          <LogsView
            project={project}
            projects={projects}
            onProjectChange={(next) => setParams(next ? { project: next } : {})}
          />
        )}
      </PageBody>
    </>
  );
}

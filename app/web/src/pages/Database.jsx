import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database as DatabaseIcon } from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import DatabaseView from '../components/DatabaseView.jsx';
import { EmptyState, ErrorState, LoadingBlock, PageHeader } from '../ui/index.jsx';

export default function DatabasePage() {
  const [params, setParams] = useSearchParams();
  const projectsState = useApi('/api/projects');
  const projects = projectsState.data?.projects || [];
  const selectedSlug = params.get('project') || projects[0]?.slug || null;
  const project = projects.find((item) => item.slug === selectedSlug) || null;

  return (
    <>
      <PageHeader
        title="Database"
        description="An isolated database per project, with a table browser, schema explorer, SQL editor and API access."
        badge={project ? <span className="font-mono text-2xs text-dim">{project.slug}</span> : null}
      />
      <PageBody wide>
        {projectsState.error ? <ErrorState error={projectsState.error} onRetry={projectsState.reload} /> : projectsState.loading ? <LoadingBlock label="Loading projects" rows={4} /> : projects.length === 0 ? (
          <EmptyState icon={DatabaseIcon} title="No projects" description="Create a project to provision its database." />
        ) : (
          <DatabaseView
            project={project}
            projects={projects}
            onProjectChange={(slug) => setParams({ project: slug })}
          />
        )}
      </PageBody>
    </>
  );
}

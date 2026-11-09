import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { HardDrive } from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import StorageView from '../components/StorageView.jsx';
import { EmptyState, ErrorState, LoadingBlock, PageHeader } from '../ui/index.jsx';

export default function Storage() {
  const [params, setParams] = useSearchParams();
  const projectsState = useApi('/api/projects');
  const projects = projectsState.data?.projects || [];
  const selectedSlug = params.get('project') || projects[0]?.slug || null;
  const project = projects.find((item) => item.slug === selectedSlug) || null;

  return (
    <>
      <PageHeader
        title="Storage"
        description="Object storage for project assets, with public or private buckets and signed download URLs."
      />
      <PageBody wide>
        {projectsState.error ? <ErrorState error={projectsState.error} onRetry={projectsState.reload} /> : projectsState.loading ? <LoadingBlock label="Loading projects" rows={4} /> : projects.length === 0 ? (
          <EmptyState icon={HardDrive} title="No projects" description="Create a project to create storage buckets." />
        ) : (
          <StorageView
            project={project}
            projects={projects}
            onProjectChange={(slug) => setParams({ project: slug })}
          />
        )}
      </PageBody>
    </>
  );
}

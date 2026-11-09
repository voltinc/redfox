import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import EnvVarsManager from '../components/EnvVarsManager.jsx';
import { EmptyState, ErrorState, LoadingBlock, PageHeader } from '../ui/index.jsx';

export default function Environment() {
  const [params, setParams] = useSearchParams();
  const projectsState = useApi('/api/projects');
  const projects = projectsState.data?.projects || [];
  const slug = params.get('project') || projects[0]?.slug || null;
  const project = projects.find((item) => item.slug === slug) || null;

  return (
    <>
      <PageHeader
        title="Environment variables"
        description="Encrypted configuration for builds and runtimes, scoped by environment and masked in the interface."
      />
      <PageBody wide>
        {projectsState.error ? <ErrorState error={projectsState.error} onRetry={projectsState.reload} /> : projectsState.loading ? <LoadingBlock label="Loading projects" rows={4} /> : projects.length === 0 ? (
          <EmptyState icon={KeyRound} title="No projects" description="Create a project before adding variables." />
        ) : (
          <EnvVarsManager project={project} projects={projects} onProjectChange={(next) => setParams({ project: next })} />
        )}
      </PageBody>
    </>
  );
}

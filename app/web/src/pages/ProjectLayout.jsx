import React, { useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowUpRight, ChevronRight, ExternalLink, Globe, MoreHorizontal, Pause, Play, Rocket, Settings,
  GitBranch, Trash2, RefreshCw,
} from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { patch, post } from '../lib/api.js';
import { PageBody } from '../components/Shell.jsx';
import { DeployModal } from '../components/DeployModal.jsx';
import {
  Badge, Button, ErrorState, IconButton, LoadingBlock, Menu, MenuItem, MenuLabel, PageHeader, StatusBadge,
  TabLink, useToast,
} from '../ui/index.jsx';
import { useAuth, canWrite } from '../lib/auth.jsx';

export function ProjectHeaderSkeleton() {
  return <div className="h-[86px] border-b border-line" />;
}

export default function ProjectLayout() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { role } = useAuth();
  const { data, loading, error, reload } = useApi(`/api/projects/${slug}`);
  const [deployOpen, setDeployOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (error?.status === 404) {
    return (
      <PageBody>
        <ErrorState error={{ message: `No project with the slug "${slug}" exists in this workspace.` }} onRetry={() => navigate('/projects')} />
      </PageBody>
    );
  }
  if (loading && !data) return <ProjectHeaderSkeleton />;
  if (!data) return <PageBody><LoadingBlock label="Loading project" /></PageBody>;

  const project = data.project;
  const last = project.last_deployment;
  const writable = canWrite(role);

  const toggleStatus = async () => {
    setBusy(true);
    try {
      await patch(`/api/projects/${project.slug}`, { status: project.status === 'active' ? 'paused' : 'active' });
      toast.success(project.status === 'active' ? 'Project paused' : 'Project resumed', 'Deployments are blocked while a project is paused.');
      reload();
    } catch (err) {
      toast.error('Could not change status', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        breadcrumb={(
          <>
            <Link to="/projects" className="hover:text-fg">Projects</Link>
            <ChevronRight size={10} />
            <span className="text-muted">{project.name}</span>
          </>
        )}
        title={project.name}
        badge={(
          <span className="flex items-center gap-1.5">
            <StatusBadge status={project.status} />
            {project.runner === 'local' ? <Badge tone="success">real builds</Badge> : <Badge tone="neutral">simulated</Badge>}
          </span>
        )}
        description={(
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs text-dim">{project.slug}</span>
            <span className="text-line">·</span>
            <span className="capitalize">{project.framework}</span>
            <span className="text-line">·</span>
            <a href={project.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-muted hover:text-accent">
              <Globe size={11} /> {project.url.replace('https://', '')}
            </a>
          </span>
        )}
        actions={(
          <>
            {last?.status === 'ready' ? (
              <Button size="sm" variant="secondary" icon={ExternalLink} onClick={() => navigate(`/deployments/${last.id}`)}>
                Last deployment
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={reload}>Refresh</Button>
            <Button size="sm" variant="primary" icon={Rocket} disabled={!writable || project.status === 'archived'} onClick={() => setDeployOpen(true)}>Deploy</Button>
            <Menu trigger={<IconButton label="Project menu" icon={MoreHorizontal} size={15} />}>
              <MenuLabel>{project.name}</MenuLabel>
              <MenuItem icon={GitBranch} to={`/projects/${project.slug}/repository`}>Repository</MenuItem>
              <MenuItem icon={Settings} to={`/projects/${project.slug}/settings`}>Project settings</MenuItem>
              <MenuItem icon={Globe} to={`/projects/${project.slug}/settings#domains`}>Domains</MenuItem>
              <MenuItem icon={ArrowUpRight} onClick={() => navigate('/monitoring')}>Monitoring</MenuItem>
              <MenuItem icon={project.status === 'active' ? Pause : Play} onClick={toggleStatus} disabled={!writable || busy}>
                {project.status === 'active' ? 'Pause project' : 'Resume project'}
              </MenuItem>
              <MenuItem icon={Trash2} danger onClick={() => navigate(`/projects/${project.slug}/settings#danger`)}>Delete project</MenuItem>
            </Menu>
          </>
        )}
        tabs={(
          <>
            <TabLink to={`/projects/${project.slug}`} end>Overview</TabLink>
            <TabLink to={`/projects/${project.slug}/deployments`} count={data.deployments.length}>Deployments</TabLink>
            <TabLink to={`/projects/${project.slug}/repository`}>Repository</TabLink>
            <TabLink to={`/projects/${project.slug}/database`}>Database</TabLink>
            <TabLink to={`/projects/${project.slug}/storage`}>Storage</TabLink>
            <TabLink to={`/projects/${project.slug}/logs`}>Logs</TabLink>
            <TabLink to={`/projects/${project.slug}/settings`}>Settings</TabLink>
          </>
        )}
      />

      <Outlet context={{ ...data, reload, writable }} />

      <DeployModal
        open={deployOpen}
        onClose={() => setDeployOpen(false)}
        projects={[project]}
        defaultProject={project.slug}
      />
    </>
  );
}

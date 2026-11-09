import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ArrowUpRight, GitBranch, GitCommitHorizontal } from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import RepoBrowser from '../components/RepoBrowser.jsx';
import { Badge, Button, EmptyState, LoadingBlock, Panel, PanelHeader, Table, Td, Th, Tr } from '../ui/index.jsx';
import { relativeTime, shortSha } from '../lib/format.js';

export default function ProjectRepository() {
  const { project, repository } = useOutletContext();
  const navigate = useNavigate();
  const repoState = useApi(repository ? `/api/repos/${repository.id}` : null, { skip: !repository });

  if (!repository) {
    return (
      <PageBody>
        <Panel>
          <EmptyState
            icon={GitBranch}
            title="No repository connected"
            description="Import an existing repository or create one from the project settings."
            action={<Button size="sm" variant="primary" onClick={() => navigate(`/projects/${project.slug}/settings`)}>Open settings</Button>}
          />
        </Panel>
      </PageBody>
    );
  }

  const repo = repoState.data?.repository || repository;
  const branches = repoState.data?.branches || [];
  const commits = repoState.data?.commits || [];

  return (
    <PageBody>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1.5 font-mono text-xs text-fg"><GitBranch size={12} className="text-dim" /> {repo.slug}</span>
          <Badge tone="neutral">{repo.visibility}</Badge>
          <span className="text-2xs text-dim">{repoState.data?.files ?? 0} files · {branches.length} branches</span>
        </div>
        <Button size="sm" variant="secondary" icon={ArrowUpRight} onClick={() => navigate(`/repositories/${repo.id}`)}>Open full repository</Button>
      </div>

      {repoState.loading ? <LoadingBlock label="Loading repository" rows={5} /> : (
        <RepoBrowser
          repoId={repo.id}
          branches={branches.length ? branches : [{ name: repo.default_branch }]}
          branch={repo.default_branch}
        />
      )}

      <Panel className="mt-2.5 overflow-hidden">
        <PanelHeader title="Recent commits" icon={GitCommitHorizontal} dense />
        <Table>
          <thead>
            <tr><Th>Commit</Th><Th>Author</Th><Th align="right">Changes</Th><Th align="right">When</Th></tr>
          </thead>
          <tbody>
            {commits.slice(0, 8).map((commit) => (
              <Tr key={commit.sha} onClick={() => navigate(`/repositories/${repo.id}/commits/${commit.sha}`)}>
                <Td>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-2xs text-dim">{shortSha(commit.sha)}</span>
                    <span className="truncate text-xs text-fg">{commit.message}</span>
                  </span>
                </Td>
                <Td><span className="text-2xs text-muted">{commit.author_name}</span></Td>
                <Td align="right">
                  <span className="text-2xs"><span className="text-success">+{commit.additions}</span> <span className="text-danger">-{commit.deletions}</span></span>
                </Td>
                <Td align="right"><span className="text-2xs text-dim">{relativeTime(commit.committed_at)}</span></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </PageBody>
  );
}

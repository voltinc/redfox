import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, GitCommitHorizontal, Rocket } from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import { Badge, ErrorState, LoadingBlock, PageHeader, Panel, PanelHeader, StatusBadge } from '../ui/index.jsx';
import { DiffView } from '../ui/Code.jsx';
import { relativeTime } from '../lib/format.js';

export default function CommitDetail() {
  const { repoId, sha } = useParams();
  const { data, loading, error } = useApi(`/api/repos/${repoId}/commits/${sha}`);

  if (error) return <PageBody><ErrorState error={error} /></PageBody>;
  if (loading && !data) return <PageBody><LoadingBlock label="Loading commit" rows={5} /></PageBody>;

  const commit = data.commit;
  const files = data.files || [];

  return (
    <>
      <PageHeader
        breadcrumb={(
          <>
            <Link to="/repositories" className="hover:text-fg">Repositories</Link><span>/</span>
            <Link to={`/repositories/${repoId}`} className="hover:text-fg">{data.repository?.slug}</Link><span>/</span>
            <span className="font-mono text-muted">{sha?.slice(0, 7)}</span>
          </>
        )}
        title={commit.message}
        badge={<Badge tone="neutral" mono>{commit.sha?.slice(0, 7)}</Badge>}
        description={(
          <span>
            {commit.author_name} committed {relativeTime(commit.committed_at)} on <span className="font-mono">{commit.branch}</span>
          </span>
        )}
        actions={<Link to={`/repositories/${repoId}?tab=commits`} className="inline-flex h-7 items-center gap-1.5 rounded border border-line bg-panel px-2.5 text-sm text-muted hover:border-strong hover:text-fg"><ArrowLeft size={12} /> All commits</Link>}
      />
      <PageBody>
        <div className="[&>*]:min-w-0 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-2.5">
            <Panel className="overflow-hidden">
              <PanelHeader title={`${files.length} file${files.length === 1 ? '' : 's'} changed`} icon={GitCommitHorizontal} dense />
              {files.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-dim">This commit has no recorded file changes.</p>
              ) : (
                <div className="divide-y divide-line">
                  {files.map((file) => (
                    <div key={file.id}>
                      <div className="flex items-center justify-between bg-panel px-3 py-1.5">
                        <span className="font-mono text-2xs text-fg">{file.path}</span>
                        <span className="flex items-center gap-2 text-2xs">
                          <Badge tone="neutral">{file.status}</Badge>
                          <span className="text-success">+{file.additions}</span>
                          <span className="text-danger">-{file.deletions}</span>
                        </span>
                      </div>
                      <DiffView patch={file.patch} className="rounded-none border-0 border-t border-line" />
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="space-y-2.5">
            <Panel>
              <PanelHeader title="Metadata" dense />
              <div className="space-y-2 p-3 text-xs">
                <div><p className="text-2xs uppercase tracking-[0.06em] text-dim">Author</p><p className="mt-0.5 text-muted">{commit.author_name}</p><p className="text-2xs text-dim">{commit.author_email}</p></div>
                <div><p className="text-2xs uppercase tracking-[0.06em] text-dim">Parent</p><p className="mt-0.5 font-mono text-2xs text-muted">{commit.parent_sha ? commit.parent_sha.slice(0, 10) : 'initial commit'}</p></div>
                <div><p className="text-2xs uppercase tracking-[0.06em] text-dim">Full SHA</p><p className="mt-0.5 break-all font-mono text-2xs text-muted">{commit.sha}</p></div>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Deployments" icon={Rocket} dense />
              {data.deployments?.length ? (
                <div className="divide-y divide-line/70">
                  {data.deployments.map((deployment) => (
                    <Link key={deployment.id} to={`/deployments/${deployment.id}`} className="flex items-center justify-between px-3 py-1.5 hover:bg-raised/60">
                      <span className="flex items-center gap-1.5"><StatusBadge status={deployment.status} /><span className="text-2xs text-dim">{deployment.environment}</span></span>
                      <span className="text-2xs text-dim">{relativeTime(deployment.created_at)}</span>
                    </Link>
                  ))}
                </div>
              ) : <p className="px-3 py-3 text-xs text-dim">This commit has not been deployed.</p>}
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}

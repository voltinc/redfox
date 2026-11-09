import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowUpRight, ChevronRight, CircleSlash, Copy, ExternalLink, GitBranch, GitCommitHorizontal, RefreshCw,
  RotateCcw, Rocket, Server, Sparkles, Square, Terminal, Timer, XCircle,
} from 'lucide-react';
import { post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import {
  Badge, Banner, Button, CopyButton, ErrorState, KeyValue, LoadingBlock, Panel, PanelHeader, StatusBadge,
  useToast,
} from '../ui/index.jsx';
import { TerminalLog } from '../ui/Code.jsx';
import { duration, relativeTime, shortSha } from '../lib/format.js';
import { canWrite, useAuth } from '../lib/auth.jsx';

const LIVE = ['queued', 'building', 'deploying'];

export default function DeploymentDetail() {
  const { deploymentId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { role } = useAuth();
  const { data, loading, error, reload } = useApi(`/api/deployments/${deploymentId}`);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const sourceRef = useRef(null);

  const deployment = data?.deployment;
  const effectiveStatus = status || deployment?.status;

  useEffect(() => {
    if (data?.logs) setLogs(data.logs);
    if (data?.deployment?.status) setStatus(data.deployment.status);
  }, [data]);

  useEffect(() => {
    if (!deployment) return undefined;
    if (!LIVE.includes(effectiveStatus)) {
      sourceRef.current?.close();
      setStreaming(false);
      return undefined;
    }
    const source = new EventSource(`/api/deployments/${deploymentId}/stream`);
    sourceRef.current = source;
    setStreaming(true);
    source.addEventListener('snapshot', (event) => {
      const payload = JSON.parse(event.data);
      setLogs(payload.logs || []);
      setStatus(payload.status);
    });
    source.addEventListener('log', (event) => {
      const log = JSON.parse(event.data);
      setLogs((prev) => (prev.some((l) => l.seq === log.seq) ? prev : [...prev, log]));
    });
    source.addEventListener('status', (event) => {
      const payload = JSON.parse(event.data);
      setStatus(payload.status);
      if (!LIVE.includes(payload.status)) {
        source.close();
        setStreaming(false);
        reload();
        if (payload.status === 'ready') toast.success('Deployment ready', deployment.project_name);
        if (payload.status === 'failed') toast.error('Deployment failed', 'Open the analysis panel for the likely cause.');
      }
    });
    source.onerror = () => { setStreaming(false); source.close(); };
    return () => { source.close(); setStreaming(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentId, deployment?.id, LIVE.includes(effectiveStatus)]);

  const act = async (action, label) => {
    setBusy(action);
    try {
      const result = await post(`/api/deployments/${deploymentId}/${action}`);
      if (action === 'cancel') {
        toast.success('Deployment cancelled');
        reload();
      } else if (result.deployment?.id) {
        toast.success(`${label} queued`, 'Opening the new deployment.');
        navigate(`/deployments/${result.deployment.id}`);
      }
    } catch (err) {
      toast.error(`${label} failed`, err.message);
    } finally {
      setBusy(null);
    }
  };

  const runAnalysis = useCallback(async () => {
    setBusy('analysis');
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/analysis`, { credentials: 'same-origin' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setAnalysis(payload.analysis);
    } catch (err) {
      toast.error('Analysis failed', err.message);
    } finally {
      setBusy(null);
    }
  }, [deploymentId, toast]);

  if (error) {
    return <PageBody><ErrorState error={error} onRetry={reload} /></PageBody>;
  }
  if (loading && !deployment) {
    return <PageBody><LoadingBlock label="Loading deployment" rows={6} /></PageBody>;
  }

  const writable = canWrite(role);
  const isLive = LIVE.includes(effectiveStatus);
  const canRollback = effectiveStatus === 'ready' && data?.artifact?.available;
  const repo = data?.repository;

  return (
    <>
      <div className="border-b border-line bg-base/60">
        <div className="mx-auto max-w-[1500px] px-6 pt-3 pb-3">
          <div className="mb-1.5 flex items-center gap-1 text-xs text-dim">
            <Link to="/deployments" className="hover:text-fg">Deployments</Link>
            <ChevronRight size={10} />
            <Link to={`/projects/${deployment.project_slug}`} className="hover:text-fg">{deployment.project_name}</Link>
            <ChevronRight size={10} />
            <span className="font-mono text-muted">{deployment.id}</span>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
                  {deployment.environment === 'production' ? 'Production deployment' : 'Preview deployment'}
                </h1>
                <StatusBadge status={effectiveStatus} />
                {deployment.mode === 'demo' ? <Badge tone="warn">simulated</Badge> : null}
                {deployment.mode === 'local' ? <Badge tone="success">real build</Badge> : null}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-mono">{shortSha(deployment.commit_sha)}</span>
                <span className="truncate">{deployment.commit_message}</span>
                <span className="text-dim">·</span>
                <span className="flex items-center gap-1"><GitBranch size={10} /> {deployment.branch}</span>
                <span className="text-dim">·</span>
                <span>{relativeTime(deployment.created_at)} by {deployment.actor}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {isLive ? (
                <Button size="sm" variant="secondary" icon={Square} loading={busy === 'cancel'} disabled={!writable} onClick={() => act('cancel', 'Cancel')}>Cancel</Button>
              ) : null}
              <Button size="sm" variant="secondary" icon={RotateCcw} loading={busy === 'redeploy'} disabled={!writable} onClick={() => act('redeploy', 'Redeploy')}>Redeploy</Button>
              {deployment.environment === 'preview' && effectiveStatus === 'ready' ? (
                <Button size="sm" variant="secondary" icon={ArrowUpRight} loading={busy === 'promote'} disabled={!writable} onClick={() => act('promote', 'Promotion')}>Promote to production</Button>
              ) : null}
              {canRollback && deployment.environment === 'production' ? (
                <Button size="sm" variant="secondary" icon={RotateCcw} loading={busy === 'rollback'} disabled={!writable} onClick={() => act('rollback', 'Rollback')}>Roll back to this</Button>
              ) : null}
              {data?.artifact?.available ? (
                <a
                  href={data.artifact.public_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 items-center gap-1.5 rounded border border-line bg-raised px-2.5 text-sm text-fg hover:border-strong"
                >
                  <ExternalLink size={12} /> Open preview
                </a>
              ) : null}
              <Button size="sm" variant={effectiveStatus === 'failed' ? 'primary' : 'secondary'} icon={Sparkles} loading={busy === 'analysis'} onClick={runAnalysis}>
                Explain failure
              </Button>
            </div>
          </div>
        </div>
      </div>

      <PageBody wide>
        {effectiveStatus === 'failed' && deployment.error ? (
          <Banner tone="danger" className="mb-2.5" title="Deployment failed.">{deployment.error}</Banner>
        ) : null}
        {deployment.mode === 'demo' && effectiveStatus === 'ready' ? (
          <Banner tone="warn" className="mb-2.5" title="Recorded deployment.">
            This project uses the simulated runner, so the pipeline was recorded rather than executed and no artifact is served at the URL. Switch the project to the local runner to produce real builds.
          </Banner>
        ) : null}

        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_286px]">
          <div className="space-y-2.5">
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <Terminal size={12} className="text-dim" />
                  <span className="text-xs font-medium text-fg">Build log</span>
                  <span className="text-2xs text-dim">{logs.length} lines</span>
                  {streaming ? <Badge tone="success">streaming</Badge> : null}
                </div>
                <div className="flex items-center gap-1">
                  <CopyButton value={logs.map((log) => `${log.ts} ${log.level} ${log.message}`).join('\n')} label="Copy log" />
                  <Button size="xs" variant="ghost" icon={RefreshCw} onClick={reload}>Reload</Button>
                </div>
              </div>
              <div className="p-2">
                <TerminalLog
                  logs={logs}
                  loading={loading}
                  live={streaming}
                  height="h-[440px]"
                  emptyLabel={isLive ? 'Waiting for the runner to emit output…' : 'This deployment has no stored log lines.'}
                />
              </div>
            </Panel>

            {analysis ? (
              <Panel>
                <PanelHeader
                  title="Failure analysis"
                  icon={Sparkles}
                  description="Local analysis engine. Computed from this deployment's stored log lines, not a language model."
                  actions={<Button size="xs" variant="ghost" onClick={() => setAnalysis(null)}>Dismiss</Button>}
                />
                <div className="space-y-3 p-4">
                  <p className="text-sm leading-6 text-muted">{analysis.summary}</p>
                  {analysis.causes.length ? (
                    <div>
                      <p className="text-2xs uppercase tracking-[0.07em] text-dim">Likely cause</p>
                      <ul className="mt-1 space-y-1">
                        {analysis.causes.map((cause) => (
                          <li key={cause.id} className="flex gap-2 text-xs text-muted">
                            <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-danger" />
                            {cause.cause}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-2xs uppercase tracking-[0.07em] text-dim">What to change</p>
                    <ol className="mt-1 space-y-1">
                      {analysis.fixes.map((fix, index) => (
                        <li key={index} className="flex gap-2 text-xs text-muted">
                          <span className="shrink-0 font-mono text-2xs text-dim">{index + 1}.</span>
                          {fix}
                        </li>
                      ))}
                    </ol>
                  </div>
                  {analysis.evidence.length ? (
                    <div>
                      <p className="text-2xs uppercase tracking-[0.07em] text-dim">Evidence</p>
                      <div className="mt-1 space-y-1">
                        {analysis.evidence.map((item) => (
                          <p key={item.seq} className="truncate rounded border border-line bg-[#f8f1e4] px-2 py-1 font-mono text-2xs text-danger">
                            {item.phase}: {item.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <p className="border-t border-line pt-2 text-2xs text-dim">
                    Confidence {analysis.confidence} · {analysis.error_lines} error lines of {analysis.log_lines} total.
                  </p>
                </div>
              </Panel>
            ) : null}

            {repo && data?.commit ? (
              <Panel className="overflow-hidden">
                <PanelHeader title="Commit" icon={GitCommitHorizontal} dense actions={<Link to={`/repositories/${repo.id}/commits/${data.commit.sha}`} className="text-2xs text-dim hover:text-fg">Open in repository</Link>} />
                <div className="flex items-start gap-3 p-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-raised text-2xs text-muted">
                    {data.commit.author_name?.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fg">{data.commit.message}</p>
                    <p className="mt-0.5 text-2xs text-dim">
                      {data.commit.author_name} · {relativeTime(data.commit.committed_at)} · {data.commit.files_changed} files changed
                      <span className="ml-2 text-success">+{data.commit.additions}</span>
                      <span className="ml-1 text-danger">-{data.commit.deletions}</span>
                    </p>
                  </div>
                  <CopyButton value={data.commit.sha} label="Copy SHA" />
                </div>
              </Panel>
            ) : null}
          </div>

          <div className="space-y-2.5">
            <Panel>
              <PanelHeader title="Details" dense />
              <div className="p-3">
                <KeyValue
                  columns={1}
                  items={[
                    { label: 'Deployment', value: <span className="font-mono text-2xs">{deployment.id}</span> },
                    { label: 'Environment', value: deployment.environment },
                    { label: 'Trigger', value: deployment.trigger },
                    { label: 'Runner', value: deployment.mode === 'local' ? 'local sandbox' : deployment.mode === 'demo' ? 'simulated' : 'recorded' },
                    { label: 'Started', value: data?.deployment?.started_at ? relativeTime(data.deployment.started_at) : 'not started' },
                    { label: 'Duration', value: duration(deployment.duration_ms) },
                    { label: 'Branch', value: deployment.branch, mono: true },
                    { label: 'Actor', value: deployment.actor },
                  ]}
                />
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Artifact" dense />
              <div className="space-y-2 p-3">
                {data?.artifact?.available ? (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Published</span>
                      <Badge tone="success">serving</Badge>
                    </div>
                    <p className="break-all font-mono text-2xs text-dim">{data.artifact.public_url}</p>
                    <Button size="xs" variant="secondary" icon={ExternalLink} onClick={() => window.open(data.artifact.public_url, '_blank')}>Open artifact</Button>
                  </>
                ) : (
                  <p className="text-xs leading-5 text-dim">
                    No artifact is stored for this deployment in this installation. Promote or roll back a deployment that has one, or redeploy the commit.
                  </p>
                )}
                {deployment.image ? (
                  <div className="border-t border-line pt-2">
                    <p className="text-2xs uppercase tracking-[0.07em] text-dim">Image reference</p>
                    <p className="mt-0.5 break-all font-mono text-2xs text-muted">{deployment.image}</p>
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Pipeline" dense />
              <div className="space-y-1.5 p-3">
                {['Queue', 'Install', 'Build', 'Publish', 'Routing'].map((phase) => {
                  const phaseLogs = logs.filter((log) => log.phase === phase.toLowerCase() || (phase === 'Queue' && log.phase === 'queue'));
                  const errored = phaseLogs.some((log) => log.level === 'error');
                  const done = phaseLogs.length > 0 && !errored;
                  return (
                    <div key={phase} className="flex items-center gap-2 text-xs">
                      <span className={errored ? 'text-danger' : done ? 'text-success' : 'text-dim'}>
                        {errored ? <XCircle size={11} /> : done ? <span className="text-[10px]">●</span> : <CircleSlash size={11} />}
                      </span>
                      <span className={done || errored ? 'text-muted' : 'text-dim'}>{phase}</span>
                      <span className="ml-auto text-2xs text-dim">{phaseLogs.length} lines</span>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel className="p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-fg"><Server size={11} /> Worker pool</p>
              <p className="mt-1 text-2xs leading-4 text-dim">
                Builds run in the Redfox worker process on this host. The same interface dispatches to isolated Docker build
                containers once a Docker host is connected.
              </p>
              <p className="mt-1.5 flex items-center gap-1 text-2xs text-dim"><Timer size={9} /> Timeout {Math.round((180000) / 1000)}s per command</p>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}

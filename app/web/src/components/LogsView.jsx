import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pause, Play, RefreshCw, ScrollText } from 'lucide-react';
import { useApi, useDebounced } from '../lib/useApi.js';
import {
  Badge, Button, Dot, EmptyState, ErrorState, IconButton, LoadingBlock, Pagination, Panel, SearchInput,
  SegmentedControl, Select, Table, Td, Th, Tr,
} from '../ui/index.jsx';
import { clockTime, cx, duration, relativeTime } from '../lib/format.js';

const SOURCES = [
  { value: '', label: 'All sources' },
  { value: 'runtime', label: 'Runtime' },
  { value: 'edge', label: 'Data API' },
  { value: 'build', label: 'Build' },
];

const RANGES = [
  { value: '1', label: '1h' },
  { value: '24', label: '24h' },
  { value: '168', label: '7d' },
];

export default function LogsView({ project, projects = [], onProjectChange, height = 'max-h-[560px]' }) {
  const [level, setLevel] = useState('');
  const [source, setSource] = useState('');
  const [mode, setMode] = useState('');
  const [hours, setHours] = useState('24');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [live, setLive] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const query = useDebounced(search, 300);

  const params = new URLSearchParams({ limit: '50', page: String(page), hours });
  if (project?.slug) params.set('project', project.slug);
  if (level) params.set('level', level);
  if (source) params.set('source', source);
  if (mode) params.set('mode', mode);
  if (query) params.set('q', query);

  const { data, loading, error, reload } = useApi(`/api/logs?${params.toString()}`, { deps: [project?.slug, level, source, mode, hours, query, page] });

  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(() => reload(), 6000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, project?.slug, level, source, mode, hours, query, page]);

  useEffect(() => { setPage(1); }, [project?.slug, level, source, mode, hours, query]);

  const facets = data?.facets || [];
  const counts = useMemo(() => ({
    error: facets.filter((f) => f.level === 'error').reduce((sum, f) => sum + f.n, 0),
    warn: facets.filter((f) => f.level === 'warn').reduce((sum, f) => sum + f.n, 0),
    total: facets.reduce((sum, f) => sum + f.n, 0),
  }), [facets]);

  const items = data?.items || [];

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {onProjectChange ? (
          <div className="w-[180px]">
            <Select value={project?.slug || ''} onChange={(event) => onProjectChange(event.target.value)}>
              {projects.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </Select>
          </div>
        ) : null}
        <SearchInput value={search} onChange={setSearch} placeholder="Search messages and paths" className="w-full sm:w-64" />
        <SegmentedControl
          size="sm"
          value={level}
          onChange={setLevel}
          options={[{ value: '', label: 'All' }, { value: 'info', label: 'Info' }, { value: 'warn', label: 'Warn' }, { value: 'error', label: 'Error' }]}
        />
        <div className="w-[128px]">
          <Select value={source} onChange={(event) => setSource(event.target.value)}>
            {SOURCES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </div>
        <div className="w-[118px]">
          <Select value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="">All origins</option>
            <option value="live">Live</option>
            <option value="demo">Sample data</option>
          </Select>
        </div>
        <SegmentedControl size="sm" value={hours} onChange={setHours} options={RANGES} />
        <div className="ml-auto flex items-center gap-1">
          <span className="hidden items-center gap-2 px-1 text-2xs text-dim sm:flex">
            <span className="flex items-center gap-1"><Dot tone="danger" /> {counts.error}</span>
            <span className="flex items-center gap-1"><Dot tone="warn" /> {counts.warn}</span>
            <span>{counts.total} stored</span>
          </span>
          <IconButton label={live ? 'Pause live refresh' : 'Resume live refresh'} icon={live ? Pause : Play} onClick={() => setLive((v) => !v)} />
          <IconButton label="Refresh" icon={RefreshCw} onClick={reload} />
        </div>
      </div>

      <Panel className="overflow-hidden">
        {error ? <ErrorState error={error} onRetry={reload} /> : loading && !items.length ? <LoadingBlock label="Loading logs" rows={5} /> : items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No log lines"
            description="Nothing matched these filters in the selected time range. Widen the range or clear the search."
          />
        ) : (
          <>
            <div className={cx('overflow-auto', height)}>
              <Table>
                <thead>
                  <tr>
                    <Th width="88">Time</Th>
                    <Th width="54">Level</Th>
                    <Th width="70">Source</Th>
                    <Th>Message</Th>
                    <Th width="150">Path</Th>
                    <Th align="right" width="60">Status</Th>
                    <Th align="right" width="70">Duration</Th>
                    <Th width="28"> </Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((log) => {
                    const isOpen = expanded === log.id;
                    return (
                      <React.Fragment key={log.id}>
                        <Tr onClick={() => setExpanded(isOpen ? null : log.id)} className={log.level === 'error' ? 'bg-[#140e0f]/60' : undefined}>
                          <Td><span className="font-mono text-2xs text-dim">{clockTime(log.ts)}</span></Td>
                          <Td>
                            <span className={cx('flex items-center gap-1 text-2xs capitalize',
                              log.level === 'error' ? 'text-danger' : log.level === 'warn' ? 'text-warn' : 'text-muted')}
                            >
                              <Dot tone={log.level === 'error' ? 'danger' : log.level === 'warn' ? 'warn' : 'neutral'} />
                              {log.level}
                            </span>
                          </Td>
                          <Td>
                            <span className="flex items-center gap-1 text-2xs text-dim">
                              {log.source}
                              {log.mode === 'demo' ? <span className="text-[9px] text-warn">sample</span> : null}
                            </span>
                          </Td>
                          <Td><span className={cx('block max-w-[520px] truncate text-xs', log.level === 'error' ? 'text-[#ffb3b0]' : 'text-muted')}>{log.message}</span></Td>
                          <Td><span className="block max-w-[150px] truncate font-mono text-2xs text-dim">{log.path || '—'}</span></Td>
                          <Td align="right">
                            {log.status_code ? (
                              <span className={cx('font-mono text-2xs', log.status_code >= 500 ? 'text-danger' : log.status_code >= 400 ? 'text-warn' : 'text-muted')}>
                                {log.status_code}
                              </span>
                            ) : <span className="text-2xs text-dim">—</span>}
                          </Td>
                          <Td align="right"><span className="tabular text-2xs text-dim">{log.duration_ms ? `${Math.round(log.duration_ms)}ms` : '—'}</span></Td>
                          <Td>{isOpen ? <ChevronDown size={11} className="text-dim" /> : <ChevronRight size={11} className="text-dim" />}</Td>
                        </Tr>
                        {isOpen ? (
                          <tr>
                            <td colSpan={8} className="border-b border-line bg-[#0b0b0d] px-3 py-2">
                              <div className="grid gap-3 sm:grid-cols-4">
                                <div><p className="text-2xs uppercase tracking-[0.06em] text-dim">Timestamp</p><p className="mt-0.5 font-mono text-2xs text-muted">{new Date(log.ts).toISOString()}</p></div>
                                <div><p className="text-2xs uppercase tracking-[0.06em] text-dim">Project</p><p className="mt-0.5 text-2xs text-muted">{log.project_name || 'workspace'}</p></div>
                                <div><p className="text-2xs uppercase tracking-[0.06em] text-dim">Source</p><p className="mt-0.5 text-2xs capitalize text-muted">{log.source} · {log.mode === 'demo' ? 'sample data' : 'live request'}</p></div>
                                <div><p className="text-2xs uppercase tracking-[0.06em] text-dim">Age</p><p className="mt-0.5 text-2xs text-muted">{relativeTime(log.ts)}</p></div>
                              </div>
                              <pre className="mt-2 overflow-x-auto rounded border border-line bg-base px-2 py-1.5 font-mono text-2xs leading-5 text-muted">{log.message}</pre>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </Table>
            </div>
            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              limit={data.limit}
              onPage={setPage}
              className="border-t border-line"
            />
          </>
        )}
      </Panel>

      <p className="px-1 text-2xs text-dim">
        Live rows are recorded by this server as requests arrive. Rows marked seed come from the seeded workspace. Build logs live on each deployment.
      </p>
    </div>
  );
}

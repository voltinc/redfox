import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Database as DatabaseIcon, KeyRound, Play, Rows3, Table2, Terminal, Copy, ChevronRight,
} from 'lucide-react';
import { api, post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import {
  Badge, Banner, Button, CopyButton, EmptyState, ErrorState, Field, Input, LoadingBlock, Panel,
  SearchInput, SegmentedControl, Select, Spinner, Table, Td, Th, Tr, Pagination, useToast,
} from '../ui/index.jsx';
import { CodeBlock } from '../ui/Code.jsx';
import { bytes, cx, num } from '../lib/format.js';

const TABS = [
  { id: 'tables', label: 'Tables', icon: Table2 },
  { id: 'schema', label: 'Schema', icon: Rows3 },
  { id: 'sql', label: 'SQL editor', icon: Terminal },
  { id: 'connection', label: 'Connection', icon: KeyRound },
];

const SAMPLE_QUERIES = {
  'Row counts': (tables) => `select '${tables[0]?.name || 'table'}' as table_name, count(*) as rows\nfrom ${tables[0]?.name || 'table'};`,
  'Recent rows': (tables) => `select *\nfrom ${tables[tables.length - 1]?.name || 'table'}\nlimit 20;`,
  'Group by status': (tables) => {
    const table = tables.find((t) => t.columns.some((c) => /status|plan|role/.test(c.name))) || tables[0];
    const column = table?.columns.find((c) => /status|plan|role/.test(c.name))?.name || 'id';
    return `select ${column}, count(*) as rows\nfrom ${table?.name}\nwhere ${column} is not null\ngroup by ${column}\norder by rows desc;`;
  },
};

export default function DatabaseView({ project, onProjectChange, projects = [] }) {
  const slug = project?.slug;
  const toast = useToast();
  const { data, loading, error, reload } = useApi(slug ? `/api/database?project=${slug}` : null, { skip: !slug });
  const [tab, setTab] = useState('tables');
  const [table, setTable] = useState(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState('');
  const [sql, setSql] = useState('');
  const [mode, setMode] = useState('read');
  const [result, setResult] = useState(null);
  const [sqlError, setSqlError] = useState(null);
  const [running, setRunning] = useState(false);

  const tables = data?.tables || [];
  const activeTable = table || tables[0]?.name || null;

  useEffect(() => {
    setTable(null);
    setResult(null);
    setSqlError(null);
    setPage(1);
  }, [slug]);

  const rowsQuery = activeTable && tab === 'tables'
    ? `/api/database/${slug}/tables/${activeTable}/rows?page=${page}&limit=25${query ? `&q=${encodeURIComponent(query)}` : ''}${order ? `&order=${order}` : ''}`
    : null;
  const rowsState = useApi(rowsQuery, { skip: !rowsQuery });

  const runSql = async () => {
    setRunning(true);
    setSqlError(null);
    try {
      const response = await post(`/api/database/${slug}/sql`, { sql, mode });
      setResult(response);
      if (mode === 'write') {
        toast.success('Statement executed', `${response.changes} row${response.changes === 1 ? '' : 's'} affected`);
        reload();
      }
    } catch (err) {
      setResult(null);
      setSqlError(err.message);
    } finally {
      setRunning(false);
    }
  };

  if (!slug) {
    return <EmptyState icon={DatabaseIcon} title="Choose a project" description="Every project has its own isolated database. Select one to browse its tables." />;
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <LoadingBlock label="Loading database" rows={5} />;

  const meta = data.meta;
  const totalRows = data.total_rows;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {onProjectChange ? (
            <div className="w-[200px]">
              <Select value={slug} onChange={(event) => onProjectChange(event.target.value)}>
                {projects.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
              </Select>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 rounded border border-line bg-panel px-2 py-1 text-2xs text-dim">
            <DatabaseIcon size={11} />
            <span className="font-mono text-muted">{meta?.engine} {meta?.engine_version}</span>
            <span className="text-dim">·</span>
            <span>{tables.length} tables</span>
            <span className="text-dim">·</span>
            <span className="tabular">{num(totalRows)} rows</span>
            <span className="text-dim">·</span>
            <span className="tabular">{meta?.size_label}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone="success">{meta?.status || 'healthy'}</Badge>
          <SegmentedControl
            size="sm"
            options={TABS.map((t) => ({ value: t.id, label: t.label }))}
            value={tab}
            onChange={setTab}
          />
        </div>
      </div>

      {tab === 'tables' ? (
        <div className="[&>*]:min-w-0 grid gap-2.5 lg:grid-cols-[210px_minmax(0,1fr)]">
          <Panel className="h-fit">
            <div className="border-b border-line px-3 py-2 text-2xs uppercase tracking-[0.07em] text-dim">Tables</div>
            <div className="max-h-[520px] overflow-y-auto py-1">
              {tables.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => { setTable(item.name); setPage(1); setQuery(''); setOrder(''); }}
                  className={cx(
                    'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                    activeTable === item.name ? 'bg-raised text-fg' : 'text-muted hover:bg-raised/60 hover:text-fg',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {activeTable === item.name ? <ChevronRight size={11} className="shrink-0 text-accent" /> : <Table2 size={11} className="shrink-0 text-dim" />}
                    <span className="truncate font-mono text-xs">{item.name}</span>
                  </span>
                  <span className="shrink-0 text-2xs tabular text-dim">{num(item.rows)}</span>
                </button>
              ))}
              {tables.length === 0 ? <p className="px-3 py-3 text-xs text-dim">No tables yet. Create one with the SQL editor.</p> : null}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
              <span className="font-mono text-xs text-fg">{activeTable || '—'}</span>
              {tables.find((t) => t.name === activeTable) ? (
                <span className="text-2xs text-dim">{tables.find((t) => t.name === activeTable).columns.length} columns</span>
              ) : null}
              <div className="ml-auto flex items-center gap-1.5">
                <SearchInput value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Filter rows" className="w-40" />
                <div className="w-[132px]">
                  <Select value={order} onChange={(event) => { setOrder(event.target.value); setPage(1); }}>
                    <option value="">Default order</option>
                    {tables.find((t) => t.name === activeTable)?.columns.slice(0, 6).map((column) => (
                      <React.Fragment key={column.name}>
                        <option value={column.name}>{column.name} ↑</option>
                        <option value={`-${column.name}`}>{column.name} ↓</option>
                      </React.Fragment>
                    ))}
                  </Select>
                </div>
                <Button size="sm" variant="ghost" icon={Terminal} onClick={() => setTab('sql')}>Query</Button>
              </div>
            </div>

            {rowsState.loading ? <LoadingBlock label="Loading rows" rows={4} /> : rowsState.error ? <ErrorState error={rowsState.error} onRetry={rowsState.reload} /> : !rowsState.data?.items?.length ? (
              <EmptyState icon={Table2} compact title="No rows" description={query ? 'No rows match this filter.' : 'This table is empty. Insert a row from the SQL editor.'} />
            ) : (
              <>
                <div className="max-h-[520px] overflow-auto">
                  <Table>
                    <thead>
                      <tr>
                        {rowsState.data.columns.map((column) => (
                          <Th key={column.name}>
                            <span className="flex items-center gap-1">
                              {column.name}
                              {column.pk ? <span className="text-[9px] text-accentInk">PK</span> : null}
                            </span>
                            <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-dim">{column.type || 'text'}</span>
                          </Th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rowsState.data.items.map((row, index) => (
                        <Tr key={index}>
                          {rowsState.data.columns.map((column) => {
                            const value = row[column.name];
                            return (
                              <Td key={column.name} className="max-w-[260px]">
                                {value === null || value === undefined ? <span className="text-2xs italic text-dim">null</span> : (
                                  <span className={cx('block truncate font-mono text-xs', typeof value === 'number' ? 'tabular text-info' : 'text-muted')} title={String(value)}>
                                    {String(value)}
                                  </span>
                                )}
                              </Td>
                            );
                          })}
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
                <Pagination page={rowsState.data.page} pages={rowsState.data.pages} total={rowsState.data.total} limit={rowsState.data.limit} onPage={setPage} className="border-t border-line" />
              </>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === 'schema' ? (
        <div className="space-y-2.5">
          <Banner tone="neutral" title="Isolated schema.">
            Queries run in this project's database only. There is no path from here to another project's tables, and the connection string is held in the platform secret store rather than the browser.
          </Banner>
          {tables.map((item) => (
            <Panel key={item.name}>
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <span className="font-mono text-xs text-fg">{item.name}</span>
                <span className="text-2xs text-dim">{item.columns.length} columns · {num(item.rows)} rows</span>
              </div>
              <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="border-b border-line md:border-b-0 md:border-r">
                  <Table>
                    <thead>
                      <tr><Th>Column</Th><Th>Type</Th><Th>Constraints</Th></tr>
                    </thead>
                    <tbody>
                      {item.columns.map((column) => (
                        <Tr key={column.name}>
                          <Td mono>{column.name}</Td>
                          <Td><span className="font-mono text-2xs text-dim">{column.type || 'text'}</span></Td>
                          <Td>
                            <span className="flex gap-1">
                              {column.pk ? <Badge tone="accent">primary</Badge> : null}
                              {column.notnull ? <Badge tone="neutral">not null</Badge> : null}
                            </span>
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
                <div className="p-2">
                  <CodeBlock
                    language="sql"
                    filename={`${item.name}.sql`}
                    maxHeight={200}
                    code={`create table ${item.name} (\n${item.columns.map((c) => `  ${c.name} ${c.type || 'text'}${c.pk ? ' primary key' : ''}${c.notnull && !c.pk ? ' not null' : ''}`).join(',\n')}\n);`}
                  />
                </div>
              </div>
            </Panel>
          ))}
        </div>
      ) : null}

      {tab === 'sql' ? (
        <div className="[&>*]:min-w-0 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
              <Terminal size={12} className="text-dim" />
              <span className="text-xs text-muted">SQL editor</span>
              <div className="ml-auto flex items-center gap-1.5">
                <SegmentedControl
                  size="sm"
                  value={mode}
                  onChange={setMode}
                  options={[{ value: 'read', label: 'Read' }, { value: 'write', label: 'Write' }]}
                />
                <Button size="sm" variant="primary" icon={Play} onClick={runSql} loading={running} disabled={!sql.trim()}>Run</Button>
              </div>
            </div>
            <textarea
              value={sql}
              onChange={(event) => setSql(event.target.value)}
              onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') runSql(); }}
              spellCheck={false}
              placeholder="select * from organizations limit 20;"
              className="h-[168px] w-full resize-y bg-[#f8f1e4] px-3 py-2 font-mono text-xs leading-6 text-fg placeholder:text-dim focus:outline-none"
            />
            <div className="border-t border-line">
              {sqlError ? (
                <div className="flex items-start gap-2 bg-[#150d0e] px-3 py-2 text-xs text-danger">
                  <AlertTriangle size={12} className="mt-[3px] shrink-0" />
                  <span className="font-mono leading-5">{sqlError}</span>
                </div>
              ) : result ? (
                result.kind === 'rows' ? (
                  <div>
                    <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-2xs text-dim">
                      <span>{result.row_count} rows · {result.duration_ms}ms</span>
                      <CopyButton value={JSON.stringify(result.rows, null, 2)} label="Copy JSON" />
                    </div>
                    {result.rows.length === 0 ? (
                      <div className="px-3 py-6 text-center text-xs text-dim">Query returned no rows.</div>
                    ) : (
                      <div className="max-h-[340px] overflow-auto">
                        <Table>
                          <thead>
                            <tr>{result.columns.map((column) => <Th key={column}>{column}</Th>)}</tr>
                          </thead>
                          <tbody>
                            {result.rows.map((row, index) => (
                              <Tr key={index}>
                                {result.columns.map((column) => (
                                  <Td key={column} className="max-w-[240px]">
                                    <span className={cx('block truncate font-mono text-xs', typeof row[column] === 'number' ? 'tabular text-info' : 'text-muted')}>
                                      {row[column] === null ? 'null' : String(row[column])}
                                    </span>
                                  </Td>
                                ))}
                              </Tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-3 text-xs">
                    <Badge tone="success">statement executed</Badge>
                    <span className="text-muted">{result.changes} row{result.changes === 1 ? '' : 's'} affected</span>
                    <span className="text-dim">{result.duration_ms}ms</span>
                    <Button size="xs" variant="ghost" className="ml-auto" onClick={reload}>Refresh tables</Button>
                  </div>
                )
              ) : (
                <div className="px-3 py-3 text-xs text-dim">Results appear here. Cmd/Ctrl + Enter runs the statement.</div>
              )}
            </div>
          </Panel>

          <div className="space-y-2.5">
            <Panel>
              <div className="border-b border-line px-3 py-2 text-2xs uppercase tracking-[0.07em] text-dim">Sample queries</div>
              <div className="p-1.5">
                {Object.entries(SAMPLE_QUERIES).map(([label, generator]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => { setSql(generator(tables)); setMode('read'); }}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-raised hover:text-fg"
                  >
                    {label}
                    <ChevronRight size={11} className="text-dim" />
                  </button>
                ))}
              </div>
            </Panel>
            <Panel className="p-3">
              <p className="text-2xs uppercase tracking-[0.07em] text-dim">Safety</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Read mode refuses statements that modify data. Write mode is limited to developer roles and every write is written to the workspace audit log.
              </p>
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === 'connection' ? <ConnectionTab slug={slug} /> : null}
    </div>
  );
}

function ConnectionTab({ slug }) {
  const { data, loading, error } = useApi(`/api/database/${slug}/connection`);
  if (loading) return <LoadingBlock label="Loading connection details" rows={3} />;
  if (error) return <ErrorState error={error} />;
  const connection = data.connection;
  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      <Panel>
        <div className="border-b border-line px-3 py-2 text-sm font-medium text-fg">Direct connection</div>
        <div className="divide-y divide-line/70">
          {[
            ['Engine', `${connection.engine} ${connection.version}`],
            ['Host', connection.host],
            ['Port', String(connection.port)],
            ['Database', connection.database],
            ['User', connection.user],
            ['SSL', connection.ssl],
            ['Pooler', connection.pooler],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 px-3 py-[7px]">
              <span className="text-xs text-dim">{label}</span>
              <span className="flex items-center gap-1 font-mono text-xs text-fg">
                {value}
                <CopyButton value={value} label="" className="px-1" />
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-line px-3 py-2">
          <p className="text-2xs leading-4 text-dim">{connection.note}</p>
        </div>
      </Panel>

      <div className="space-y-2.5">
        <Panel>
          <div className="border-b border-line px-3 py-2 text-sm font-medium text-fg">REST API</div>
          <div className="space-y-2 p-3">
            <div>
              <p className="text-2xs uppercase tracking-[0.07em] text-dim">Base URL</p>
              <p className="mt-1 flex items-center gap-1 font-mono text-xs text-fg">
                {data.postgrest.url}
                <CopyButton value={data.postgrest.url} label="" className="px-1" />
              </p>
            </div>
            <div>
              <p className="text-2xs uppercase tracking-[0.07em] text-dim">Example request</p>
              <CodeBlock
                language="bash"
                className="mt-1"
                maxHeight={120}
                code={`curl "${data.postgrest.url.replace('https://', 'http://localhost:3000/v1/' + slug + '/')}organizations?limit=3" \\\n  -H "apikey: rf_live_..."`}
              />
            </div>
            <p className="text-2xs leading-4 text-dim">
              Create a project API key in API Explorer. Keys are scoped to one project and stored hashed; the plaintext is shown once at creation.
            </p>
          </div>
        </Panel>

        <Panel className="p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-fg"><Copy size={11} /> Credentials</p>
          <p className="mt-1.5 text-xs leading-5 text-muted">
            Passwords and service keys live in the platform secret store and are never returned to the browser. Inject them into builds and runtimes through Environment Variables.
          </p>
        </Panel>
      </div>
    </div>
  );
}

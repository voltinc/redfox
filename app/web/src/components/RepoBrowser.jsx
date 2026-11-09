import React, { useEffect, useState } from 'react';
import {
  ChevronRight, File, FileCode2, FileJson, FileText, Folder, GitBranch, History, Home, WrapText,
} from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import {
  Badge, Button, EmptyState, ErrorState, IconButton, LoadingBlock, Panel, Select, Spinner,
} from '../ui/index.jsx';
import { CodeBlock } from '../ui/Code.jsx';
import { bytes, cx, relativeTime, shortSha } from '../lib/format.js';

function iconFor(entry) {
  if (entry.kind === 'dir') return Folder;
  const name = entry.name.toLowerCase();
  if (name.endsWith('.json')) return FileJson;
  if (/\.(js|jsx|ts|tsx|mjs|astro|sql|css|html)$/.test(name)) return FileCode2;
  if (/\.(md|txt)$/.test(name)) return FileText;
  return File;
}

export default function RepoBrowser({ repoId, branches = [], branch: initialBranch, initialPath, onFileOpen, refreshKey = 0 }) {
  const [branch, setBranch] = useState(initialBranch);
  const [dir, setDir] = useState('');
  const [filePath, setFilePath] = useState(null);
  const [wrap, setWrap] = useState(false);

  useEffect(() => {
    setBranch(initialBranch);
    setDir('');
    setFilePath(initialPath || null);
  }, [repoId, initialBranch, initialPath]);

  const tree = useApi(repoId ? `/api/repos/${repoId}/tree?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(dir)}` : null, {
    skip: !repoId, deps: [branch, dir, refreshKey],
  });
  const file = useApi(repoId && filePath ? `/api/repos/${repoId}/file?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(filePath)}` : null, {
    skip: !filePath, deps: [branch, filePath, refreshKey],
  });

  useEffect(() => { onFileOpen?.(filePath); }, [filePath, onFileOpen]);

  const openEntry = (entry) => {
    if (entry.kind === 'dir') {
      setDir(entry.path);
      setFilePath(null);
    } else {
      setFilePath(entry.path);
    }
  };

  const parts = filePath ? filePath.split('/') : dir ? dir.split('/') : [];

  return (
    <div className="grid gap-2.5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Panel className="h-fit overflow-hidden">
        <div className="border-b border-line px-2 py-1.5">
          <div className="relative">
            <GitBranch size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-dim" />
            <select
              value={branch}
              onChange={(event) => { setBranch(event.target.value); setDir(''); setFilePath(null); }}
              className="h-6 w-full cursor-pointer appearance-none rounded border border-line bg-base pl-6 pr-2 font-mono text-2xs text-fg focus:border-strong focus:outline-none"
            >
              {branches.map((item) => <option key={item.name || item} value={item.name || item}>{item.name || item}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-1 border-b border-line px-2 py-1 text-2xs">
          <button type="button" onClick={() => { setDir(''); setFilePath(null); }} className="flex items-center gap-1 text-dim hover:text-fg">
            <Home size={10} /> root
          </button>
          {parts.slice(0, -1).map((part, index) => (
            <React.Fragment key={part}>
              <ChevronRight size={9} className="text-line" />
              <button
                type="button"
                onClick={() => { setDir(parts.slice(0, index + 1).join('/')); setFilePath(null); }}
                className="truncate text-dim hover:text-fg"
              >
                {part}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="max-h-[520px] overflow-y-auto py-1">
          {tree.loading ? <div className="px-2 py-2 text-2xs text-dim"><Spinner size={10} /> Loading tree…</div>
            : tree.error ? <div className="px-2 py-2 text-2xs text-danger">{tree.error.message}</div>
              : (tree.data?.entries || []).map((entry) => {
                const Icon = iconFor(entry);
                const active = filePath === entry.path || dir === entry.path;
                return (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() => openEntry(entry)}
                    className={cx(
                      'flex w-full items-center gap-1.5 px-2 py-[3px] text-left transition-colors',
                      active ? 'bg-raised text-fg' : 'text-muted hover:bg-raised/60 hover:text-fg',
                    )}
                  >
                    <Icon size={11} className={cx('shrink-0', entry.kind === 'dir' ? 'text-info/70' : 'text-dim')} />
                    <span className="min-w-0 flex-1 truncate font-mono text-2xs">{entry.name}</span>
                    {entry.kind === 'file' && entry.size !== null ? <span className="shrink-0 text-[9px] text-dim">{bytes(entry.size, 0)}</span> : null}
                  </button>
                );
              })}
          {tree.data?.entries?.length === 0 ? <p className="px-2 py-2 text-2xs text-dim">Empty directory.</p> : null}
        </div>
      </Panel>

      <Panel className="min-w-0 overflow-hidden">
        {!filePath ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 py-10 text-center">
            <FileCode2 size={18} className="mb-2 text-dim" />
            <p className="text-sm text-fg">{dir ? dir : 'Repository root'}</p>
            <p className="mt-1 text-xs text-dim">Select a file to read it, or a folder to browse further.</p>
          </div>
        ) : file.error ? (
          <ErrorState error={file.error} onRetry={file.reload} />
        ) : file.loading && !file.data ? (
          <LoadingBlock label="Loading file" rows={6} />
        ) : file.data ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-1.5">
              <span className="flex min-w-0 items-center gap-0.5 font-mono text-2xs">
                {filePath.split('/').map((part, index, all) => (
                  <React.Fragment key={`${part}-${index}`}>
                    {index > 0 ? <ChevronRight size={9} className="text-line" /> : null}
                    <span className={index === all.length - 1 ? 'text-fg' : 'text-dim'}>{part}</span>
                  </React.Fragment>
                ))}
              </span>
              <span className="text-2xs text-dim">{bytes(file.data.file.size)}</span>
              {file.data.file.updated_at ? <span className="text-2xs text-dim">updated {relativeTime(file.data.file.updated_at)}</span> : null}
              <div className="ml-auto flex items-center gap-1">
                <IconButton label={wrap ? 'Disable wrapping' : 'Wrap lines'} icon={WrapText} onClick={() => setWrap((v) => !v)} />
              </div>
            </div>
            <div className="p-2">
              <CodeBlock
                code={file.data.file.content}
                language={file.data.language}
                filename={filePath.split('/').pop()}
                showLineNumbers
                maxHeight={420}
                wrap={wrap}
                className="border-0"
              />
            </div>
            {file.data.history?.length ? (
              <div className="border-t border-line">
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-2xs uppercase tracking-[0.07em] text-dim">
                  <History size={10} /> File history
                </div>
                <div className="divide-y divide-line/60">
                  {file.data.history.slice(0, 5).map((commit) => (
                    <div key={commit.sha} className="flex items-center gap-2 px-3 py-[5px]">
                      <span className="font-mono text-2xs text-dim">{shortSha(commit.sha)}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted">{commit.message}</span>
                      <span className="shrink-0 text-2xs text-dim">
                        <span className="text-success">+{commit.additions}</span> <span className="text-danger">-{commit.deletions}</span>
                      </span>
                      <span className="w-[70px] shrink-0 text-right text-2xs text-dim">{relativeTime(commit.committed_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </Panel>
    </div>
  );
}

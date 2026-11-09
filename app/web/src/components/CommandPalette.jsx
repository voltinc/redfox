import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ArrowRight, BookOpen, Box, CornerDownLeft, Database, FileCode2, GitBranch, Globe, HardDrive,
  KeyRound, LayoutDashboard, Rocket, ScrollText, Search, Server, Settings, Sparkles, UserCog, Container,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useDebounced, useHotkey } from '../lib/useApi.js';
import { cx, shortSha } from '../lib/format.js';
import { Kbd, Spinner } from '../ui/index.jsx';

const NAV = [
  { group: 'Workspace', items: [
    { label: 'Overview', to: '/', icon: LayoutDashboard },
    { label: 'Projects', to: '/projects', icon: Box },
    { label: 'Deployments', to: '/deployments', icon: Rocket },
    { label: 'Repositories', to: '/repositories', icon: GitBranch },
  ] },
  { group: 'Platform', items: [
    { label: 'Data', to: '/data', icon: Database },
    { label: 'Observability', to: '/observability', icon: Activity },
    { label: 'Infrastructure', to: '/infrastructure', icon: Server },
    { label: 'Domains', to: '/domains', icon: Globe },
    { label: 'Documentation', to: '/docs', icon: BookOpen },
  ] },
  { group: 'AI', items: [
    { label: 'Solene', to: '/solene', icon: Sparkles },
  ] },
  { group: 'Settings', items: [
    { label: 'Settings', to: '/settings', icon: Settings },
  ] },
];
export function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounced(query, 180);

  useEffect(() => {
    if (!open) { setQuery(''); setResults(null); setActive(0); }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    if (debounced.trim().length < 2) { setResults(null); setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    api(`/api/search?q=${encodeURIComponent(debounced.trim())}`)
      .then((data) => { if (!cancelled) setResults(data); })
      .catch(() => { if (!cancelled) setResults(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced, open]);

  const pages = useMemo(() => NAV.flatMap((section) => section.items).map((item) => ({ ...item, kind: 'Page' })), []);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [];
    for (const page of pages.filter((p) => !q || p.label.toLowerCase().includes(q)).slice(0, q ? 4 : 8)) {
      list.push({ id: `page-${page.to}`, group: 'Navigate', label: page.label, icon: page.icon, to: page.to });
    }
    if (results) {
      for (const project of results.projects || []) {
        list.push({ id: `project-${project.id}`, group: 'Projects', label: project.name, hint: project.framework, icon: Box, to: `/projects/${project.slug}` });
      }
      for (const repo of results.repositories || []) {
        list.push({ id: `repo-${repo.id}`, group: 'Repositories', label: repo.name, hint: repo.description || '', icon: GitBranch, to: `/repositories/${repo.id}` });
      }
      for (const deployment of results.deployments || []) {
        list.push({ id: `dep-${deployment.id}`, group: 'Deployments', label: `${deployment.project_name} · ${shortSha(deployment.commit_sha)}`, hint: deployment.status, icon: Rocket, to: `/deployments/${deployment.id}` });
      }
      for (const file of results.files || []) {
        list.push({ id: `file-${file.repository_id}-${file.path}`, group: 'Files', label: file.path, hint: file.repo_slug, icon: FileCode2, to: `/repositories/${file.repository_id}?path=${encodeURIComponent(file.path)}` });
      }
    }
    return list;
  }, [pages, query, results]);

  useEffect(() => { setActive(0); }, [entries.length, open]);

  const go = useCallback((entry) => {
    if (!entry) return;
    onClose();
    navigate(entry.to);
  }, [navigate, onClose]);

  useHotkey('meta+k', () => { if (!open) window.dispatchEvent(new CustomEvent('redfox:palette')); });

  if (!open) return null;

  const grouped = entries.reduce((acc, entry) => {
    acc[entry.group] = acc[entry.group] || [];
    acc[entry.group].push(entry);
    return acc;
  }, {});

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 p-4 pt-[10vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[560px] animate-slide-up overflow-hidden rounded-lg border border-line bg-[#0f0f12] shadow-pop">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <Search size={14} className="text-dim" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(i + 1, entries.length - 1)); }
              if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
              if (event.key === 'Enter') { event.preventDefault(); go(entries[active]); }
              if (event.key === 'Escape') onClose();
            }}
            placeholder="Search projects, deployments, repositories, files…"
            className="h-6 flex-1 bg-transparent text-base text-fg placeholder:text-dim focus:outline-none"
          />
          {loading ? <Spinner size={12} /> : <Kbd>esc</Kbd>}
        </div>
        <div className="max-h-[52vh] overflow-y-auto py-1.5">
          {entries.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-dim">
              {query.trim().length < 2 ? 'Type to search your workspace.' : 'No matches found.'}
            </div>
          ) : Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-1">
              <div className="px-3 pb-1 pt-1.5 text-2xs uppercase tracking-[0.08em] text-dim">{group}</div>
              {items.map((entry) => {
                flatIndex += 1;
                const index = flatIndex;
                const Icon = entry.icon || ArrowRight;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(entry)}
                    className={cx(
                      'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors',
                      active === index ? 'bg-raised text-fg' : 'text-muted',
                    )}
                  >
                    <Icon size={13} className="shrink-0 text-dim" />
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                    {entry.hint ? <span className="shrink-0 truncate text-2xs text-dim">{entry.hint}</span> : null}
                    {active === index ? <CornerDownLeft size={11} className="shrink-0 text-dim" /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-2xs text-dim">
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
            <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
          </span>
          <span>Redfox search</span>
        </div>
      </div>
    </div>
  );
}

export { NAV };

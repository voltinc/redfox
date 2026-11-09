import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, Check, Copy, Search } from 'lucide-react';
import { cx, clockTime } from '../lib/format.js';
import { copyText } from '../lib/format.js';
import { IconButton, Badge } from './index.jsx';

/* ------------------------------------------------------------- highlighting */
const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'break', 'continue',
  'import', 'from', 'export', 'default', 'class', 'extends', 'new', 'await', 'async', 'try', 'catch',
  'finally', 'throw', 'typeof', 'instanceof', 'interface', 'type', 'enum', 'implements', 'public',
  'private', 'readonly', 'static', 'null', 'undefined', 'true', 'false', 'this', 'super', 'yield',
  'select', 'from', 'where', 'group', 'by', 'order', 'limit', 'offset', 'insert', 'into', 'values',
  'update', 'set', 'delete', 'create', 'table', 'index', 'join', 'left', 'right', 'inner', 'on', 'as',
  'and', 'or', 'not', 'is', 'in', 'like', 'case', 'when', 'then', 'end', 'desc', 'asc', 'primary',
  'key', 'foreign', 'references', 'default', 'with', 'returning', 'distinct', 'count', 'sum',
  'FROM', 'WORKDIR', 'RUN', 'COPY', 'CMD', 'EXPOSE', 'ENV',
]);

const escapeHtml = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

function commentPattern(lang) {
  if (['sql'].includes(lang)) return '--[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
  if (['bash', 'yaml', 'dockerfile', 'sh', 'toml'].includes(lang)) return '#[^\\n]*';
  if (['html', 'xml', 'md', 'css'].includes(lang)) return '\\/\\*[\\s\\S]*?\\*\\/|<!--[\\s\\S]*?-->';
  return '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
}

export function highlight(code, lang = 'text') {
  if (!code) return '';
  const comments = commentPattern(lang);
  const re = new RegExp(`(${comments})|("(?:[^"\\\\\\n]|\\\\.)*"|'(?:[^'\\\\\\n]|\\\\.)*'|\`(?:[^\`\\\\]|\\\\.)*\`)|\\b(\\d+(?:\\.\\d+)?)\\b|\\b([A-Za-z_$][\\w$]*)\\b`, 'g');
  let out = '';
  let last = 0;
  let match = re.exec(code);
  while (match) {
    out += escapeHtml(code.slice(last, match.index));
    const [full, comment, string, number, word] = match;
    if (comment) out += `<span class="text-[#5b5b64] italic">${escapeHtml(full)}</span>`;
    else if (string) out += `<span class="text-[#a5d6a7]">${escapeHtml(full)}</span>`;
    else if (number) out += `<span class="text-[#d2a8ff]">${escapeHtml(full)}</span>`;
    else if (word && KEYWORDS.has(word)) out += `<span class="text-[#e4593b]">${escapeHtml(full)}</span>`;
    else if (word && code[match.index + full.length] === '(') out += `<span class="text-[#79c0ff]">${escapeHtml(full)}</span>`;
    else out += escapeHtml(full);
    last = match.index + full.length;
    match = re.exec(code);
  }
  out += escapeHtml(code.slice(last));
  return out;
}

export function CodeBlock({
  code, language = 'text', filename, maxHeight = 420, showLineNumbers = false, className, actions, wrap = false,
}) {
  const [copied, setCopied] = useState(false);
  const lines = String(code ?? '').split('\n');
  return (
    <div className={cx('overflow-hidden rounded-md border border-line bg-[#0b0b0d]', className)}>
      <div className="flex items-center justify-between border-b border-line bg-panel px-2.5 py-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-xs text-muted">{filename || language}</span>
          {language && language !== 'text' ? <span className="text-2xs uppercase tracking-wide text-dim">{language}</span> : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {actions}
          <IconButton
            label={copied ? 'Copied' : 'Copy code'}
            icon={copied ? Check : Copy}
            size={12}
            onClick={async () => {
              await copyText(String(code ?? ''));
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          />
        </div>
      </div>
      <div className="overflow-auto terminal-scroll" style={{ maxHeight }}>
        <pre className={cx('px-3 py-2 font-mono text-[11.5px] leading-[1.65]', wrap ? 'whitespace-pre-wrap' : '')}>
          {showLineNumbers ? (
            <code className="block">
              {lines.map((line, index) => (
                <div key={index} className="flex">
                  <span className="mr-3 inline-block w-8 shrink-0 select-none text-right text-dim">{index + 1}</span>
                  <span className="min-w-0 flex-1 whitespace-pre" dangerouslySetInnerHTML={{ __html: highlight(line, language) || '&nbsp;' }} />
                </div>
              ))}
            </code>
          ) : (
            <code dangerouslySetInnerHTML={{ __html: highlight(String(code ?? ''), language) }} />
          )}
        </pre>
      </div>
    </div>
  );
}

export function DiffView({ patch, className }) {
  if (!patch) return null;
  const lines = String(patch).split('\n');
  return (
    <div className={cx('overflow-x-auto rounded-md border border-line bg-[#0b0b0d] font-mono text-[11.5px] leading-[1.7]', className)}>
      {lines.map((line, index) => {
        const added = line.startsWith('+');
        const removed = line.startsWith('-');
        const hunk = line.startsWith('@@');
        return (
          <div
            key={index}
            className={cx(
              'whitespace-pre px-3',
              added && 'bg-[#0e1f13] text-[#7ee787]',
              removed && 'bg-[#1f1214] text-[#ff9492]',
              hunk && 'bg-raised text-dim',
              !added && !removed && !hunk && 'text-muted',
            )}
          >
            {line || ' '}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- markdown */
function renderInline(text) {
  const nodes = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match = pattern.exec(text);
  let key = 0;
  while (match) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('`')) nodes.push(<code key={key++}>{token.slice(1, -1)}</code>);
    else if (token.startsWith('**')) nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('_')) nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    else {
      const link = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      nodes.push(<a key={key++} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>);
    }
    last = match.index + token.length;
    match = pattern.exec(text);
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ content, className }) {
  const blocks = useMemo(() => {
    const lines = String(content || '').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith('```')) {
        const lang = line.slice(3).trim();
        const body = [];
        i += 1;
        while (i < lines.length && !lines[i].startsWith('```')) { body.push(lines[i]); i += 1; }
        i += 1;
        out.push({ kind: 'code', lang, body: body.join('\n') });
        continue;
      }
      if (/^#{1,3}\s/.test(line)) {
        out.push({ kind: 'heading', level: line.match(/^#+/)[0].length, text: line.replace(/^#+\s/, '') });
        i += 1;
        continue;
      }
      if (/^[-*]\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^[-*]\s/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s/, '')); i += 1; }
        out.push({ kind: 'ul', items });
        continue;
      }
      if (/^\d+\.\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, '')); i += 1; }
        out.push({ kind: 'ol', items });
        continue;
      }
      if (!line.trim()) { i += 1; continue; }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|[-*]\s|\d+\.\s|```)/.test(lines[i])) { para.push(lines[i]); i += 1; }
      out.push({ kind: 'p', text: para.join(' ') });
    }
    return out;
  }, [content]);

  return (
    <div className={cx('md text-sm leading-[1.65] text-[#d6d6da]', className)}>
      {blocks.map((block, index) => {
        if (block.kind === 'code') {
          return <CodeBlock key={index} code={block.body} language={block.lang || 'text'} maxHeight={320} className="my-2" />;
        }
        if (block.kind === 'heading') {
          const Tag = block.level === 1 ? 'h2' : 'h3';
          return <Tag key={index}>{renderInline(block.text)}</Tag>;
        }
        if (block.kind === 'ul') {
          return <ul key={index}>{block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ul>;
        }
        if (block.kind === 'ol') {
          return <ol key={index}>{block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ol>;
        }
        return <p key={index}>{renderInline(block.text)}</p>;
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- terminal */
const LEVEL_STYLE = {
  error: 'text-[#ff9492]',
  warn: 'text-[#e3b341]',
  info: 'text-[#b9b9c0]',
  debug: 'text-dim',
};

export function TerminalLog({
  logs = [], loading, live, emptyLabel = 'No log output yet', height = 'h-[460px]', showPhase = true, onFollowChange,
}) {
  const [filter, setFilter] = useState('');
  const [level, setLevel] = useState('all');
  const [follow, setFollow] = useState(true);
  const boxRef = useRef(null);

  useEffect(() => { onFollowChange?.(follow); }, [follow, onFollowChange]);

  const filtered = logs.filter((log) => {
    if (level !== 'all' && log.level !== level) return false;
    if (filter && !`${log.message} ${log.phase}`.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  useEffect(() => {
    if (follow && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [filtered.length, follow]);

  const errorCount = logs.filter((l) => l.level === 'error').length;

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-line bg-[#08080a]">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-panel px-2 py-1.5">
        <div className="relative">
          <Search size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-dim" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter output"
            className="h-6 w-40 rounded border border-line bg-base pl-6 pr-2 font-mono text-2xs text-fg placeholder:text-dim focus:border-strong focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-0.5 rounded border border-line bg-base p-0.5">
          {['all', 'info', 'warn', 'error'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLevel(option)}
              className={cx(
                'rounded px-1.5 py-0.5 text-2xs capitalize transition-colors',
                level === option ? 'bg-raised text-fg' : 'text-dim hover:text-muted',
              )}
            >
              {option}
              {option === 'error' && errorCount ? ` ${errorCount}` : ''}
            </button>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-2 text-2xs text-dim">
          <span className="tabular">{filtered.length} lines</span>
          {live ? <span className="flex items-center gap-1 text-success"><span className="h-1 w-1 animate-pulse2 rounded-full bg-success" /> live</span> : null}
          <button
            type="button"
            onClick={() => setFollow((v) => !v)}
            className={cx('flex items-center gap-1 rounded border px-1.5 py-0.5 transition-colors',
              follow ? 'border-line bg-raised text-muted' : 'border-line text-dim hover:text-muted')}
          >
            <ArrowDownToLine size={10} /> follow
          </button>
        </span>
      </div>
      <div ref={boxRef} className={cx('overflow-auto terminal-scroll px-0 py-1 font-mono text-[11.5px] leading-[1.75]', height)}>
        {loading && !logs.length ? (
          <div className="px-3 py-2 text-dim">Loading log stream…</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-2 text-dim">{logs.length ? 'No lines match this filter.' : emptyLabel}</div>
        ) : (
          filtered.map((log) => (
            <div key={`${log.seq}-${log.level}`} className="flex gap-2 px-2 hover:bg-[#101013]">
              <span className="w-[86px] shrink-0 select-none tabular text-[#4d4d55]">{clockTime(log.ts)}</span>
              {showPhase ? <span className="w-[52px] shrink-0 select-none truncate text-[#4d4d55]">{log.phase}</span> : null}
              <span className={cx('min-w-0 flex-1 whitespace-pre-wrap break-words', LEVEL_STYLE[log.level] || LEVEL_STYLE.info)}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function InlineCode({ children, className }) {
  return <code className={cx('rounded border border-line bg-raised px-1 py-[1px] font-mono text-[11.5px] text-muted', className)}>{children}</code>;
}

export function StatusList({ items }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => <Badge key={item.label} tone={item.tone}>{item.label}</Badge>)}
    </div>
  );
}

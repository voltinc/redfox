import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowUp, Bot, Cpu, Plus, Sparkles, Trash2, User, Wand2, X,
} from 'lucide-react';
import { api, del, post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import {
  Badge, Banner, Button, EmptyState, IconButton, LoadingBlock, Panel, Select, Spinner, useToast, ErrorState,
} from '../ui/index.jsx';
import { Markdown } from '../ui/Code.jsx';
import { cx, relativeTime } from '../lib/format.js';
import { useAuth } from '../lib/auth.jsx';

export default function Solene() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const list = useApi('/api/solene/conversations');
  const status = useApi('/api/solene/status');
  const [activeId, setActiveId] = useState(params.get('c') || null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [projectSlug, setProjectSlug] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const scrollRef = useRef(null);

  const conversations = list.data?.conversations || [];
  const projects = list.data?.projects || [];
  const mode = status.data?.mode;

  useEffect(() => {
    if (!activeId && conversations.length && !params.get('new')) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId, params]);

  useEffect(() => {
    if (!activeId) { setConversation(null); setMessages([]); return; }
    let cancelled = false;
    setLoadingConversation(true);
    api(`/api/solene/conversations/${activeId}`)
      .then((payload) => {
        if (cancelled) return;
        setConversation(payload.conversation);
        setMessages(payload.messages);
        setProjectSlug(payload.project?.slug || '');
        setParams({ c: activeId }, { replace: true });
      })
      .catch((error) => {
        if (!cancelled) toast.error('Could not open conversation', error.message);
      })
      .finally(() => { if (!cancelled) setLoadingConversation(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, sending]);

  const newConversation = async () => {
    try {
      const result = await post('/api/solene/conversations', { project_id: projectSlug || undefined });
      list.reload();
      setActiveId(result.conversation.id);
      setMessages([]);
      setConversation(result.conversation);
    } catch (error) {
      toast.error('Could not start conversation', error.message);
    }
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content) return;
    let conversationId = activeId;
    if (!conversationId) {
      try {
        const created = await post('/api/solene/conversations', { project_id: projectSlug || undefined });
        conversationId = created.conversation.id;
        setActiveId(conversationId);
        setConversation(created.conversation);
      } catch (error) {
        toast.error('Could not start conversation', error.message);
        return;
      }
    }
    setSending(true);
    setInput('');
    const userMessage = { id: `local-${Date.now()}`, role: 'user', content, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMessage]);
    try {
      const result = await post(`/api/solene/conversations/${conversationId}/messages`, { content, project_id: projectSlug || undefined });
      setMessages((prev) => [...prev, result.message]);
      list.reload();
    } catch (error) {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: `The request failed: ${error.message}`, meta: { source: 'error' } }]);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    try {
      await del(`/api/solene/conversations/${id}`);
      list.reload();
      if (id === activeId) { setActiveId(null); setMessages([]); setConversation(null); }
      toast.success('Conversation deleted');
    } catch (error) {
      toast.error('Could not delete conversation', error.message);
    }
  };

  const activeProject = projects.find((project) => project.slug === projectSlug);

  return (
    <div className="flex h-[calc(100vh-44px)]">
      <aside className="hidden w-[230px] shrink-0 flex-col border-r border-line bg-[#0a0a0c] md:flex">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-fg"><Sparkles size={12} className="text-accent" /> Solene</span>
          <IconButton label="New conversation" icon={Plus} onClick={newConversation} />
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {list.loading && !conversations.length ? <div className="px-3 py-2 text-2xs text-dim">Loading…</div> : conversations.length === 0 ? (
            <p className="px-3 py-3 text-2xs text-dim">No conversations yet.</p>
          ) : conversations.map((item) => (
            <div
              key={item.id}
              className={cx('group flex items-start gap-1 px-2 py-1.5 transition-colors',
                activeId === item.id ? 'bg-raised' : 'hover:bg-raised/60')}
            >
              <button type="button" onClick={() => setActiveId(item.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-xs text-fg">{item.title}</span>
                <span className="mt-0.5 block truncate text-2xs text-dim">
                  {item.project_name ? `${item.project_name} · ` : ''}{item.message_count} messages · {relativeTime(item.updated_at)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="mt-0.5 shrink-0 text-dim opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                aria-label="Delete conversation"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-line p-2">
          <div className="flex items-center gap-1.5 text-2xs text-dim">
            <Cpu size={10} />
            {mode === 'model' ? `${status.data?.provider?.label} ${status.data?.provider?.model}` : 'Local analysis engine'}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-fg">{conversation?.title || 'New conversation'}</span>
            {mode === 'local' ? <Badge tone="warn">local analysis</Badge> : <Badge tone="success">{status.data?.provider?.label}</Badge>}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-2xs text-dim">Context</span>
            <div className="w-[180px]">
              <Select value={projectSlug} onChange={(event) => setProjectSlug(event.target.value)}>
                <option value="">Workspace only</option>
                {projects.map((project) => <option key={project.id} value={project.slug}>{project.name}</option>)}
              </Select>
            </div>
            <IconButton label="New conversation" icon={Plus} onClick={newConversation} />
          </div>
        </div>

        {mode === 'local' ? (
          <div className="border-b border-[#3a2f16] bg-[#17140d] px-3 py-1.5 text-2xs text-warn">
            No model provider is connected. Answers come from the deterministic analysis engine over your real logs, schema and configuration.
            Set <span className="font-mono">OPENAI_API_KEY</span>, <span className="font-mono">ANTHROPIC_API_KEY</span> or <span className="font-mono">OPENROUTER_API_KEY</span> to switch to a model.
          </div>
        ) : null}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {loadingConversation ? <LoadingBlock label="Loading conversation" rows={3} /> : messages.length === 0 ? (
            <div className="mx-auto max-w-[640px] pt-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel text-accent"><Sparkles size={14} /></span>
                <div>
                  <h2 className="text-sm font-medium text-fg">How can I help?</h2>
                  <p className="text-xs text-dim">
                    {activeProject ? `Context: ${activeProject.name}` : 'No project selected. Pick one above for project-specific answers.'}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(status.data?.suggestions || []).map((suggestion) => (
                  <button
                    key={suggestion.label}
                    type="button"
                    onClick={() => send(suggestion.prompt)}
                    className="rounded-md border border-line bg-panel px-3 py-2.5 text-left text-xs text-muted transition-colors hover:border-strong hover:text-fg"
                  >
                    <span className="flex items-center gap-1.5"><Wand2 size={11} className="text-dim" /> {suggestion.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-2xs leading-4 text-dim">{status.data?.detail}</p>
            </div>
          ) : (
            <div className="mx-auto max-w-[720px] space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="flex gap-2.5">
                  <span className={cx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded',
                    message.role === 'user' ? 'bg-raised text-muted' : 'border border-line bg-panel text-accent')}
                  >
                    {message.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-2xs font-medium text-fg">{message.role === 'user' ? (user?.name || 'You') : 'Solene'}</span>
                      <span className="text-2xs text-dim">{relativeTime(message.created_at)}</span>
                      {message.meta?.source === 'local' ? <Badge tone="neutral">local analysis</Badge> : null}
                      {message.meta?.source === 'model' ? <Badge tone="success">{message.meta.provider}</Badge> : null}
                    </div>
                    {message.role === 'user' ? (
                      <p className="whitespace-pre-wrap text-sm leading-6 text-muted">{message.content}</p>
                    ) : (
                      <Markdown content={message.content} />
                    )}
                  </div>
                </div>
              ))}
              {sending ? (
                <div className="flex items-center gap-2 text-xs text-dim">
                  <Spinner size={12} /> Analysing your workspace data…
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-t border-line p-3">
          <div className="mx-auto max-w-[720px]">
            <div className="flex items-end gap-2 rounded-md border border-line bg-panel p-1.5 focus-within:border-strong">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
                }}
                rows={Math.min(4, Math.max(1, input.split('\n').length))}
                placeholder="Ask about a failed build, your schema, environment variables or configuration…"
                className="max-h-32 flex-1 resize-none bg-transparent px-1.5 py-1 text-sm text-fg placeholder:text-dim focus:outline-none"
              />
              <Button size="sm" variant="primary" icon={ArrowUp} onClick={() => send()} loading={sending} disabled={!input.trim()}>Send</Button>
            </div>
            <p className="mt-1.5 flex items-center justify-between text-2xs text-dim">
              <span>Enter sends · Shift + Enter adds a line</span>
              <span>{messages.length} messages in this conversation</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

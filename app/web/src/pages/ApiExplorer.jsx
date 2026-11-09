import React, { useEffect, useState } from 'react';
import { Copy, ExternalLink, KeyRound, Play, Plus, Send, Terminal, Trash2 } from 'lucide-react';
import { post, del } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { PageBody } from '../components/Shell.jsx';
import {
  Badge, Banner, Button, CopyButton, EmptyState, ErrorState, Field, IconButton, Input, LoadingBlock,
  Modal, PageHeader, Panel, PanelHeader, Select, Table, Td, Th, Tr, useToast,
} from '../ui/index.jsx';
import { CodeBlock } from '../ui/Code.jsx';
import { cx, formatDateTime, relativeTime } from '../lib/format.js';

const METHOD_TONE = { GET: 'info', POST: 'success', PATCH: 'warn', DELETE: 'danger' };

export default function ApiExplorer() {
  const toast = useToast();
  const endpoints = useApi('/api/explorer/endpoints');
  const keys = useApi('/api/explorer/keys');
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/api/projects');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyForm, setKeyForm] = useState({ project: '', name: '', scopes: 'read' });
  const [newKey, setNewKey] = useState(null);
  const [deleteKey, setDeleteKey] = useState(null);

  const groups = (endpoints.data?.endpoints || []).reduce((acc, endpoint) => {
    acc[endpoint.group] = acc[endpoint.group] || [];
    acc[endpoint.group].push(endpoint);
    return acc;
  }, {});

  useEffect(() => {
    if (endpoints.data?.projects?.length && !keyForm.project) {
      setKeyForm((prev) => ({ ...prev, project: endpoints.data.projects[0].slug }));
    }
  }, [endpoints.data?.projects, keyForm.project]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      let parsed = null;
      if (body.trim()) {
        try {
          parsed = JSON.parse(body);
        } catch {
          throw new Error('Request body is not valid JSON');
        }
      }
      const result = await post('/api/explorer/request', { method, path, body: parsed });
      setResponse(result);
    } catch (err) {
      setError(err.message);
      setResponse(null);
    } finally {
      setBusy(false);
    }
  };

  const chooseEndpoint = (endpoint) => {
    setMethod(endpoint.method);
    setPath(endpoint.path.replace('{slug}', endpoints.data?.projects?.[0]?.slug || 'atlas-web').replace('{id}', 'dpl_').replace('{project}', endpoints.data?.projects?.[0]?.slug || 'atlas-web').replace('{table}', 'leads'));
    setBody(endpoint.body ? JSON.stringify(endpoint.body, null, 2) : '');
    setResponse(null);
    setError(null);
  };

  const createKey = async () => {
    setBusy(true);
    try {
      const result = await post('/api/explorer/keys', keyForm);
      setNewKey(result.key);
      keys.reload();
    } catch (err) {
      toast.error('Could not create key', err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeKey = async () => {
    setBusy(true);
    try {
      await del(`/api/explorer/keys/${deleteKey.id}`);
      toast.success('Key revoked', deleteKey.name);
      setDeleteKey(null);
      keys.reload();
    } catch (err) {
      toast.error('Could not revoke key', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="API Explorer"
        description="Call the Redfox API as the signed-in user, or issue project keys for the public data API."
        actions={<Button size="sm" variant="secondary" icon={KeyRound} onClick={() => setKeyOpen(true)}>Create API key</Button>}
      />
      <PageBody wide>
        <div className="grid gap-2.5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <Panel className="h-fit overflow-hidden">
            <div className="border-b border-line px-3 py-2 text-2xs uppercase tracking-[0.07em] text-dim">Endpoints</div>
            <div className="max-h-[440px] overflow-y-auto py-1">
              {endpoints.loading ? <div className="px-3 py-2 text-2xs text-dim">Loading…</div> : Object.entries(groups).map(([group, items]) => (
                <div key={group} className="mb-1">
                  <div className="px-3 pb-1 pt-1.5 text-2xs text-dim">{group}</div>
                  {items.map((endpoint) => (
                    <button
                      key={`${endpoint.method}-${endpoint.path}`}
                      type="button"
                      onClick={() => chooseEndpoint(endpoint)}
                      className={cx('flex w-full items-center gap-1.5 px-3 py-[5px] text-left transition-colors hover:bg-raised',
                        path === endpoint.path ? 'bg-raised' : '')}
                    >
                      <span className={cx('w-9 shrink-0 font-mono text-[9px] font-medium',
                        endpoint.method === 'GET' ? 'text-info' : endpoint.method === 'POST' ? 'text-success' : 'text-warn')}
                      >
                        {endpoint.method}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-2xs text-muted">{endpoint.path}</span>
                      {endpoint.public ? <Badge tone="neutral">key</Badge> : null}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </Panel>

          <div className="space-y-2.5">
            <Panel className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-2 py-2">
                <div className="w-[92px]">
                  <Select value={method} onChange={(event) => setMethod(event.target.value)}>
                    {['GET', 'POST', 'PATCH', 'DELETE'].map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </div>
                <Input mono value={path} onChange={(event) => setPath(event.target.value)} className="min-w-0 flex-1" onKeyDown={(event) => { if (event.key === 'Enter') send(); }} />
                <Button size="sm" variant="primary" icon={Send} onClick={send} loading={busy}>Send</Button>
              </div>
              {method !== 'GET' ? (
                <div className="border-b border-line">
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder='{ "project": "atlas-web", "environment": "preview" }'
                    spellCheck={false}
                    className="h-[92px] w-full resize-y bg-[#f8f1e4] px-3 py-2 font-mono text-xs leading-5 text-fg placeholder:text-dim focus:outline-none"
                  />
                </div>
              ) : null}

              <div className="p-2">
                {error ? <Banner tone="danger" title="Request failed.">{error}</Banner> : !response ? (
                  <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                    <Terminal size={16} className="mb-2 text-dim" />
                    <p className="text-sm text-fg">Nothing sent yet</p>
                    <p className="mt-1 max-w-sm text-xs text-dim">
                      Requests run against this server with your session cookie, so role permissions apply exactly as they do in the interface.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone={response.status < 300 ? 'success' : response.status < 400 ? 'info' : response.status < 500 ? 'warn' : 'danger'}>
                        {response.status} {response.status_text}
                      </Badge>
                      <span className="text-2xs text-dim">{response.duration_ms}ms</span>
                      <span className="text-2xs text-dim">{response.size_bytes} bytes</span>
                      <span className="ml-auto">
                        <CopyButton value={typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2)} label="Copy response" />
                      </span>
                    </div>
                    <CodeBlock
                      language="json"
                      filename={`${response.method} ${response.url}`}
                      code={typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2)}
                      maxHeight={340}
                    />
                    <details className="mt-2">
                      <summary className="cursor-pointer text-2xs text-dim">Response headers</summary>
                      <div className="mt-1 space-y-0.5">
                        {Object.entries(response.headers || {}).map(([key, value]) => (
                          <p key={key} className="font-mono text-2xs text-muted"><span className="text-dim">{key}:</span> {value}</p>
                        ))}
                      </div>
                    </details>
                  </>
                )}
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <PanelHeader
                title="Project API keys"
                icon={KeyRound}
                description="Keys authenticate the public data API at /v1/{project}/{table}."
                actions={<Button size="sm" variant="secondary" icon={Plus} onClick={() => setKeyOpen(true)}>Create key</Button>}
              />
              {keys.error ? <ErrorState error={keys.error} onRetry={keys.reload} /> : keys.loading ? <LoadingBlock rows={3} /> : !keys.data?.keys?.length ? (
                <EmptyState icon={KeyRound} compact title="No API keys" description="Create a key to read a project's data from outside Redfox." />
              ) : (
                <Table>
                  <thead>
                    <tr><Th>Name</Th><Th>Project</Th><Th>Prefix</Th><Th>Scopes</Th><Th align="right">Last used</Th><Th align="right"> </Th></tr>
                  </thead>
                  <tbody>
                    {keys.data.keys.map((key) => (
                      <Tr key={key.id}>
                        <Td><span className="text-xs text-fg">{key.name}</span></Td>
                        <Td><span className="text-xs text-muted">{key.project_name}</span></Td>
                        <Td><span className="font-mono text-2xs text-dim">{key.prefix}…</span></Td>
                        <Td><Badge tone={key.scopes.includes('write') ? 'warn' : 'neutral'}>{key.scopes}</Badge></Td>
                        <Td align="right"><span className="text-2xs text-dim">{key.last_used ? relativeTime(key.last_used) : 'never'}</span></Td>
                        <Td align="right"><IconButton label="Revoke key" icon={Trash2} size={12} tone="danger" onClick={() => setDeleteKey(key)} /></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <div className="border-t border-line px-3 py-2 text-2xs text-dim">
                Keys are stored as SHA-256 hashes and scoped to one project. A key for one project cannot read another project's tables.
              </div>
            </Panel>
          </div>
        </div>
      </PageBody>

      <Modal
        open={keyOpen}
        onClose={() => { setKeyOpen(false); setNewKey(null); }}
        title={newKey ? 'Copy this key now' : 'Create API key'}
        description={newKey ? 'The full key is shown once. Redfox stores only its hash.' : 'Scope the key to a single project.'}
        footer={newKey ? <Button size="sm" variant="primary" onClick={() => { setKeyOpen(false); setNewKey(null); }}>Done</Button> : (
          <>
            <Button size="sm" onClick={() => setKeyOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={createKey} loading={busy} disabled={!keyForm.project || !keyForm.name}>Create key</Button>
          </>
        )}
      >
        {newKey ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1 rounded border border-line bg-base px-2 py-1.5">
              <code className="min-w-0 flex-1 break-all font-mono text-xs text-fg">{newKey}</code>
              <CopyButton value={newKey} label="" className="px-1" />
            </div>
            <p className="text-2xs text-dim">Store it in your secret manager. Test it with:</p>
            <CodeBlock
              language="bash"
              maxHeight={90}
              code={`curl "${window.location.origin}/v1/atlas-web/leads?limit=3" \\\n  -H "apikey: ${newKey}"`}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Project" required>
              <Select value={keyForm.project} onChange={(event) => setKeyForm((prev) => ({ ...prev, project: event.target.value }))}>
                <option value="">Select a project</option>
                {(endpoints.data?.projects || []).map((project) => <option key={project.id} value={project.slug}>{project.name}</option>)}
              </Select>
            </Field>
            <Field label="Key name" required>
              <Input value={keyForm.name} onChange={(event) => setKeyForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Production read" />
            </Field>
            <Field label="Scopes">
              <Select value={keyForm.scopes} onChange={(event) => setKeyForm((prev) => ({ ...prev, scopes: event.target.value }))}>
                <option value="read">read</option>
                <option value="read,write">read, write</option>
              </Select>
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

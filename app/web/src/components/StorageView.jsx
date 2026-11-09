import React, { useRef, useState } from 'react';
import {
  Archive, Download, FileText, Globe, HardDrive, Link2, Lock, Plus, Trash2, Upload, FolderOpen,
} from 'lucide-react';
import { api, del, patch, post } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import {
  Badge, Banner, Button, ConfirmDialog, CopyButton, EmptyState, ErrorState, Field, IconButton, Input,
  LoadingBlock, Menu, MenuItem, Modal, Panel, Select, Table, Td, Th, Tr, useToast,
} from '../ui/index.jsx';
import { bytes, cx, formatDateTime, relativeTime } from '../lib/format.js';
import { canWrite } from '../lib/auth.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function StorageView({ project, projects = [], onProjectChange }) {
  const toast = useToast();
  const { role } = useAuth();
  const writable = canWrite(role);
  const query = project?.slug ? `?project=${project.slug}` : '';
  const { data, loading, error, reload } = useApi(`/api/storage${query}`, { deps: [project?.slug] });
  const [activeBucketId, setActiveBucketId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bucketName, setBucketName] = useState('');
  const [bucketProject, setBucketProject] = useState(project?.slug || projects[0]?.slug || '');
  const [visibility, setVisibility] = useState('private');
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);

  const buckets = data?.buckets || [];
  const activeBucket = buckets.find((b) => b.id === activeBucketId) || buckets[0] || null;
  const objectsState = useApi(activeBucket ? `/api/storage/${activeBucket.id}/objects` : null, { skip: !activeBucket });

  const createBucket = async () => {
    setBusy(true);
    try {
      await post('/api/storage/buckets', { project: bucketProject, name: bucketName, visibility });
      toast.success('Bucket created', bucketName);
      setCreateOpen(false);
      setBucketName('');
      reload();
    } catch (err) {
      toast.error('Could not create bucket', err.message);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file) => {
    if (!file || !activeBucket) return;
    setUploading(true);
    try {
      const response = await fetch(`/api/storage/${activeBucket.id}/upload?path=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'content-type': file.type || 'application/octet-stream', 'x-file-name': file.name },
        body: file,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Upload failed');
      toast.success('File uploaded', `${file.name} · ${bytes(file.size)}`);
      objectsState.reload();
      reload();
    } catch (err) {
      toast.error('Upload failed', err.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const removeObject = async () => {
    setBusy(true);
    try {
      await del(`/api/storage/objects/${deleteTarget.id}`);
      toast.success('File deleted', deleteTarget.path);
      setDeleteTarget(null);
      objectsState.reload();
      reload();
    } catch (err) {
      toast.error('Could not delete file', err.message);
    } finally {
      setBusy(false);
    }
  };

  const signedLink = async (object) => {
    try {
      const result = await post(`/api/storage/objects/${object.id}/signed`);
      await navigator.clipboard.writeText(window.location.origin + result.url);
      toast.success('Signed URL copied', 'Valid for 5 minutes');
    } catch (err) {
      toast.error('Could not sign URL', err.message);
    }
  };

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <LoadingBlock label="Loading buckets" rows={4} />;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {onProjectChange ? (
            <div className="w-[200px]">
              <Select value={project?.slug || ''} onChange={(event) => onProjectChange(event.target.value)}>
                {projects.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
              </Select>
            </div>
          ) : null}
          <span className="rounded border border-line bg-panel px-2 py-1 text-2xs text-dim">
            <span className="tabular text-muted">{data?.buckets?.length || 0}</span> buckets · <span className="tabular text-muted">{data?.total_label}</span> stored
          </span>
        </div>
        <Button size="sm" variant="primary" icon={Plus} disabled={!writable} onClick={() => { setBucketProject(project?.slug || projects[0]?.slug || ''); setCreateOpen(true); }}>
          New bucket
        </Button>
      </div>

      {buckets.length === 0 ? (
        <Panel>
          <EmptyState
            icon={HardDrive}
            title="No storage buckets"
            description="Create a bucket to upload files. Buckets are scoped to a single project and can be public or private."
            action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setCreateOpen(true)} disabled={!writable}>New bucket</Button>}
          />
        </Panel>
      ) : (
        <div className="[&>*]:min-w-0 grid gap-2.5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <Panel className="h-fit">
            <div className="border-b border-line px-3 py-2 text-2xs uppercase tracking-[0.07em] text-dim">Buckets</div>
            <div className="py-1">
              {buckets.map((bucket) => (
                <button
                  key={bucket.id}
                  type="button"
                  onClick={() => setActiveBucketId(bucket.id)}
                  className={cx(
                    'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors',
                    activeBucket?.id === bucket.id ? 'bg-raised' : 'hover:bg-raised/60',
                  )}
                >
                  <Archive size={12} className={cx('mt-[3px] shrink-0', activeBucket?.id === bucket.id ? 'text-accent' : 'text-dim')} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span className="truncate text-xs text-fg">{bucket.name}</span>
                      {bucket.visibility === 'public' ? <Globe size={9} className="text-dim" /> : <Lock size={9} className="text-dim" />}
                    </span>
                    <span className="mt-0.5 block text-2xs text-dim">
                      {!project ? `${bucket.project.name} · ` : ''}{bucket.file_count} files · {bucket.size_label}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
              <FolderOpen size={12} className="text-dim" />
              <span className="text-xs font-medium text-fg">{activeBucket?.name}</span>
              {activeBucket ? <Badge tone={activeBucket.visibility === 'public' ? 'info' : 'neutral'}>{activeBucket.visibility}</Badge> : null}
              {activeBucket && !project ? <span className="text-2xs text-dim">{activeBucket.project.name}</span> : null}
              <div className="ml-auto flex items-center gap-1">
                <Menu
                  trigger={<IconButton label="Bucket settings" icon={Trash2} tone="muted" />}
                >
                  <MenuItem
                    icon={activeBucket?.visibility === 'public' ? Lock : Globe}
                    disabled={!writable}
                    onClick={async () => {
                      try {
                        await patch(`/api/storage/buckets/${activeBucket.id}`, { visibility: activeBucket.visibility === 'public' ? 'private' : 'public' });
                        toast.success('Bucket visibility updated');
                        reload();
                      } catch (err) {
                        toast.error('Could not update bucket', err.message);
                      }
                    }}
                  >
                    Make {activeBucket?.visibility === 'public' ? 'private' : 'public'}
                  </MenuItem>
                  <MenuItem
                    icon={Trash2}
                    danger
                    disabled={!writable}
                    onClick={async () => {
                      try {
                        await del(`/api/storage/buckets/${activeBucket.id}`);
                        toast.success('Bucket deleted');
                        setActiveBucketId(null);
                        reload();
                      } catch (err) {
                        toast.error('Could not delete bucket', err.message);
                      }
                    }}
                  >
                    Delete bucket
                  </MenuItem>
                </Menu>
                <input
                  ref={fileInput}
                  type="file"
                  className="hidden"
                  onChange={(event) => upload(event.target.files?.[0])}
                />
                <Button size="sm" variant="secondary" icon={Upload} loading={uploading} disabled={!writable} onClick={() => fileInput.current?.click()}>
                  Upload
                </Button>
              </div>
            </div>

            {objectsState.error ? <ErrorState error={objectsState.error} onRetry={objectsState.reload} /> : objectsState.loading ? <LoadingBlock label="Loading objects" rows={3} /> : !objectsState.data?.items?.length ? (
              <EmptyState
                icon={FileText}
                compact
                title="Bucket is empty"
                description="Upload a file to see it listed with its size, checksum and access controls."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Path</Th>
                    <Th>Type</Th>
                    <Th align="right">Size</Th>
                    <Th>Uploaded</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {objectsState.data.items.map((object) => (
                    <Tr key={object.id}>
                      <Td><span className="block max-w-[280px] truncate font-mono text-xs text-fg">{object.path}</span></Td>
                      <Td><span className="text-2xs text-dim">{object.mime}</span></Td>
                      <Td align="right"><span className="tabular text-xs text-muted">{object.size_label}</span></Td>
                      <Td><span className="text-2xs text-dim">{relativeTime(object.created_at)}</span></Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconButton label="Copy signed URL" icon={Link2} size={12} onClick={() => signedLink(object)} />
                          <a
                            href={`/api/storage/objects/${object.id}/content`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-dim transition-colors hover:bg-raised hover:text-fg"
                            title="Open file"
                          >
                            <Download size={12} />
                          </a>
                          <IconButton label="Delete file" icon={Trash2} size={12} tone="danger" disabled={!writable} onClick={() => setDeleteTarget(object)} />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            <div className="flex items-center justify-between border-t border-line px-3 py-2 text-2xs text-dim">
              <span>{objectsState.data?.items?.length || 0} objects</span>
              <span>Uploads are stored on this host. Point the storage adapter at any S3-compatible provider to move them.</span>
            </div>
          </Panel>
        </div>
      )}

      <Banner tone="neutral" title="Integration boundary.">
        Redfox stores objects through a driver interface (<span className="font-mono text-muted">server/routes/data.js</span>). The default driver is local disk; an S3-compatible driver reads the same bucket and object records, so the interface does not change.
      </Banner>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New bucket"
        description="Buckets group files inside one project."
        footer={(
          <>
            <Button size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={createBucket} loading={busy} disabled={!bucketName.trim() || !bucketProject}>Create bucket</Button>
          </>
        )}
      >
        <div className="space-y-3">
          {!project ? (
            <Field label="Project" required>
              <Select value={bucketProject} onChange={(event) => setBucketProject(event.target.value)}>
                {projects.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
              </Select>
            </Field>
          ) : null}
          <Field label="Bucket name" required hint="Lowercase letters, numbers, dashes and underscores.">
            <Input autoFocus mono value={bucketName} onChange={(event) => setBucketName(event.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))} placeholder="public-assets" />
          </Field>
          <Field label="Visibility" hint="Public buckets serve files without a signed URL.">
            <Select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
              <option value="private">Private</option>
              <option value="public">Public</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={removeObject}
        loading={busy}
        danger
        title="Delete file"
        description={`Delete ${deleteTarget?.path}? This removes the object from storage and cannot be undone.`}
        confirmLabel="Delete file"
      />
    </div>
  );
}

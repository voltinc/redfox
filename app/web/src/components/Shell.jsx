import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Check, ChevronsUpDown, LogOut, Menu as MenuIcon, Plus, Search, Settings, Sparkles, UserCog, X, Building2, Box, Command,
} from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { post } from '../lib/api.js';
import { cx, relativeTime } from '../lib/format.js';
import {
  Avatar, Badge, Button, Dot, IconButton, Kbd, Menu as DropdownMenu, MenuLabel, MenuItem, MenuSeparator,
  Modal, useToast, Field, Input,
} from '../ui/index.jsx';
import { CommandPalette, NAV } from './CommandPalette.jsx';

export function Logo({ size = 20, withWordmark = true, className }) {
  return (
    <span className={cx('flex items-center gap-2', className)}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 3.6 12 8.8l8-5.2v7.6c0 4.7-3.4 8.4-8 9.6-4.6-1.2-8-4.9-8-9.6V3.6Z" fill="var(--accent)" fillOpacity="0.14" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M9.2 12.2h1.7M13.1 12.2h1.7" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M10.6 16.2h2.8" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
      </svg>
      {withWordmark ? <span className="text-[14px] font-semibold tracking-[-0.02em] text-fg">Redfox</span> : null}
    </span>
  );
}

function WorkspaceSwitcher() {
  const { workspace, workspaces, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const result = await post('/api/workspaces', { name: name.trim() });
      toast.success('Workspace created', result.workspace.name);
      setName('');
      setOpen(false);
      await refresh();
      window.location.reload();
    } catch (error) {
      toast.error('Could not create workspace', error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu
        width="w-60"
        trigger={(
          <button type="button" className="flex w-full items-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 text-left transition-colors hover:border-strong">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#1d1d22] text-[10px] font-semibold text-muted">
              {workspace?.name?.slice(0, 1) || 'R'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium leading-4 text-fg">{workspace?.name || 'Workspace'}</span>
              <span className="block truncate text-2xs leading-3 text-dim">{workspace?.plan ? `${workspace.plan} plan` : ''}{workspace?.region ? ` · ${workspace.region}` : ''}</span>
            </span>
            <ChevronsUpDown size={12} className="shrink-0 text-dim" />
          </button>
        )}
      >
        <MenuLabel>Workspaces</MenuLabel>
        {workspaces.map((item) => (
          <MenuItem
            key={item.id}
            icon={Building2}
            hint={item.role}
            onClick={() => { if (item.slug !== workspace?.slug) toast.push({ title: 'Single workspace installation', description: 'Switch workspaces from Workspace Settings once more than one exists.' }); }}
          >
            {item.name}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem icon={Plus} onClick={() => setOpen(true)}>Create workspace</MenuItem>
        <MenuItem icon={Settings} to="/settings/workspace">Workspace settings</MenuItem>
      </DropdownMenu>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create workspace"
        description="Workspaces isolate projects, repositories and infrastructure."
        footer={(
          <>
            <Button size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={create} loading={busy} disabled={!name.trim()}>Create workspace</Button>
          </>
        )}
      >
        <Field label="Workspace name" required>
          <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Acme Platform" onKeyDown={(event) => { if (event.key === 'Enter') create(); }} />
        </Field>
      </Modal>
    </>
  );
}

function NotificationsMenu() {
  const { notifications, markAllRead, markRead } = useAuth();
  const navigate = useNavigate();
  const items = notifications.items || [];
  return (
    <DropdownMenu
      width="w-[330px]"
      trigger={(
        <button type="button" className="relative flex h-7 w-7 items-center justify-center rounded text-muted transition-colors hover:bg-raised hover:text-fg" aria-label="Notifications">
          <Bell size={14} strokeWidth={1.9} />
          {notifications.unread ? (
            <span className="absolute right-1 top-1 h-[5px] w-[5px] rounded-full bg-accent ring-2 ring-[#0b0b0d]" />
          ) : null}
        </button>
      )}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <span className="text-xs font-medium text-fg">Notifications</span>
        {notifications.unread ? (
          <button type="button" onClick={markAllRead} className="text-2xs text-dim hover:text-fg">Mark all read</button>
        ) : null}
      </div>
      <MenuSeparator />
      {items.length === 0 ? (
        <div className="px-2.5 py-6 text-center text-xs text-dim">Nothing yet.</div>
      ) : items.slice(0, 6).map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => { markRead(item.id); if (item.href) navigate(item.href); }}
          className="flex w-full items-start gap-2 px-2.5 py-2 text-left transition-colors hover:bg-raised"
        >
          <Dot tone={item.level === 'error' ? 'danger' : item.level === 'warn' ? 'warn' : 'success'} className="mt-[6px]" />
          <span className="min-w-0 flex-1">
            <span className={cx('block truncate text-xs', item.read_at ? 'text-muted' : 'font-medium text-fg')}>{item.title}</span>
            {item.body ? <span className="mt-0.5 block line-clamp-2 text-2xs leading-4 text-dim">{item.body}</span> : null}
            <span className="mt-1 block text-2xs text-dim">{relativeTime(item.created_at)}</span>
          </span>
        </button>
      ))}
    </DropdownMenu>
  );
}

function ProfileMenu() {
  const { user, logout, workspace } = useAuth();
  return (
    <DropdownMenu
      width="w-56"
      trigger={(
        <button type="button" className="flex items-center gap-1.5 rounded p-0.5 transition-colors hover:bg-raised" aria-label="Account menu">
          <Avatar name={user?.name} color={user?.avatar_color} size={22} />
        </button>
      )}
    >
      <div className="px-2.5 py-2">
        <p className="truncate text-xs font-medium text-fg">{user?.name}</p>
        <p className="truncate text-2xs text-dim">{user?.email}</p>
        <p className="mt-1 text-2xs text-dim">{workspace?.name} · {workspace?.plan} plan</p>
      </div>
      <MenuSeparator />
      <MenuItem icon={UserCog} to="/settings/account">Account settings</MenuItem>
      <MenuItem icon={Settings} to="/settings/workspace">Workspace settings</MenuItem>
      <MenuItem icon={Sparkles} to="/solene">Ask Solene</MenuItem>
      <MenuSeparator />
      <MenuItem icon={LogOut} danger onClick={logout}>Sign out</MenuItem>
    </DropdownMenu>
  );
}

function SidebarContent({ onNavigate }) {
  const location = useLocation();
  return (
    <>
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <Link to="/" onClick={onNavigate} className="flex items-center"><Logo /></Link>
        <Badge tone="neutral" className="ml-1">v0.9</Badge>
      </div>
      <div className="px-2.5 pb-2">
        <WorkspaceSwitcher />
      </div>
      <div className="px-2.5 pb-3">
        <Button variant="primary" size="sm" icon={Plus} className="w-full justify-start" onClick={() => { window.location.href = '/projects/new'; }}>
          Create project
        </Button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {NAV.map((section) => (
          <div key={section.group} className="mb-3">
            <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[#55555d]">{section.group}</div>
            <div className="space-y-[1px]">
              {section.items.map((item) => {
                const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={cx(
                      'group relative flex items-center gap-2 rounded px-2 py-[5px] text-sm transition-colors',
                      active ? 'bg-[#17171b] text-fg' : 'text-muted hover:bg-[#131316] hover:text-fg',
                    )}
                  >
                    {active ? <span className="absolute left-0 top-1/2 h-[13px] w-[2px] -translate-y-1/2 rounded-r bg-accent" /> : null}
                    <Icon size={14} strokeWidth={active ? 2 : 1.8} className={active ? 'text-fg' : 'text-dim group-hover:text-muted'} />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}

function Topbar({ onOpenPalette, onOpenMobile }) {
  const { server, role } = useAuth();
  return (
    <header className="sticky top-0 z-30 flex h-[44px] shrink-0 items-center gap-2 border-b border-line bg-[#0b0b0d]/95 px-3 backdrop-blur">
      <button type="button" onClick={onOpenMobile} className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-raised hover:text-fg lg:hidden" aria-label="Open navigation">
        <MenuIcon size={15} />
      </button>
      <button
        type="button"
        onClick={onOpenPalette}
        className="flex h-7 w-full max-w-[280px] items-center gap-2 rounded-md border border-line bg-panel px-2 text-left text-muted transition-colors hover:border-strong"
      >
        <Search size={12} className="text-dim" />
        <span className="flex-1 truncate text-xs">Search or jump to…</span>
        <span className="flex items-center gap-0.5 text-dim"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
      </button>
      <div className="ml-auto flex items-center gap-1">
        <span className="hidden items-center gap-1.5 rounded border border-line bg-panel px-1.5 py-1 text-2xs text-dim sm:flex" title="Role in this workspace">
          <Dot tone="success" />
          {role || 'member'}
        </span>
        {server?.version ? <span className="hidden px-1 text-2xs text-dim md:inline">v{server.version}</span> : null}
        <NotificationsMenu />
        <div className="mx-0.5 h-4 w-px bg-line" />
        <ProfileMenu />
      </div>
    </header>
  );
}

export function Shell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handler = () => setPaletteOpen(true);
    window.addEventListener('redfox:palette', handler);
    const keydown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('redfox:palette', handler);
      window.removeEventListener('keydown', keydown);
    };
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <div className="flex h-full min-h-screen bg-base">
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-line bg-[#0a0a0c] lg:flex">
        <SidebarContent />
        <SidebarFooter />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-[250px] animate-slide-up flex-col border-r border-line bg-[#0a0a0c]">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter />
            <button type="button" onClick={() => setMobileOpen(false)} className="absolute right-2 top-2 text-dim" aria-label="Close navigation"><X size={15} /></button>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenPalette={() => setPaletteOpen(true)} onOpenMobile={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function SidebarFooter() {
  const { user, workspace, llm } = useAuth();
  return (
    <div className="border-t border-line px-2.5 py-2">
      <div className="flex items-center gap-2">
        <Avatar name={user?.name} color={user?.avatar_color} size={22} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs leading-4 text-fg">{user?.name}</p>
          <p className="truncate text-2xs leading-3 text-dim">{workspace?.name}</p>
        </div>
        {llm?.configured ? <Badge tone="success">AI</Badge> : <Badge tone="neutral">local</Badge>}
      </div>
    </div>
  );
}

export function PageBody({ children, className, wide }) {
  return <div className={cx('mx-auto w-full px-4 py-4 sm:px-6', wide ? 'max-w-[1500px]' : 'max-w-[1360px]', className)}>{children}</div>;
}

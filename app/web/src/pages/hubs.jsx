import React from 'react';
import { Outlet } from 'react-router-dom';
import { Activity, Boxes, Database, FileCode2, HardDrive, KeyRound, ScrollText, Server, Settings, UserCog } from 'lucide-react';
import HubTabs from '../components/HubTabs.jsx';

export function DataHub() {
  return (
    <>
      <HubTabs items={[
        { label: 'SQL databases', to: '/data', icon: Database, end: true },
        { label: 'Object storage', to: '/data/storage', icon: HardDrive },
      ]} />
      <Outlet />
    </>
  );
}

export function ObservabilityHub() {
  return (
    <>
      <HubTabs items={[
        { label: 'Logs', to: '/observability', icon: ScrollText, end: true },
        { label: 'Metrics', to: '/observability/metrics', icon: Activity },
      ]} />
      <Outlet />
    </>
  );
}

export function InfrastructureHub() {
  return (
    <>
      <HubTabs items={[
        { label: 'Servers', to: '/infrastructure', icon: Server, end: true },
        { label: 'Containers', to: '/infrastructure/containers', icon: Boxes },
        { label: 'Environment', to: '/infrastructure/environment', icon: KeyRound },
      ]} />
      <Outlet />
    </>
  );
}

export function SettingsHub() {
  return (
    <>
      <HubTabs items={[
        { label: 'Workspace', to: '/settings', icon: Settings, end: true },
        { label: 'Account', to: '/settings/account', icon: UserCog },
      ]} />
      <Outlet />
    </>
  );
}

export function DocsHub() {
  return (
    <>
      <HubTabs items={[
        { label: 'Guide', to: '/docs', icon: ScrollText, end: true },
        { label: 'API reference', to: '/docs/api', icon: FileCode2 },
      ]} />
      <Outlet />
    </>
  );
}

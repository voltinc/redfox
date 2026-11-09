import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Database, GitBranch, HardDrive, Rocket, ScrollText, Users } from 'lucide-react';
import { Button, Panel } from '../ui/index.jsx';

const STEPS = [
  {
    key: 'project',
    title: 'Create a project',
    body: 'Every project gets its own repository, isolated database, storage bucket and environment. A static starter page is committed for you, so the first deployment works.',
    action: 'Create project',
    to: '/projects/new',
    icon: Rocket,
  },
  {
    key: 'deploy',
    title: 'Ship the first deployment',
    body: 'The local runner checks out the branch, injects environment variables, runs the build and publishes an artifact at a preview URL you can open.',
    action: 'Read the deployment docs',
    to: '/docs',
    icon: GitBranch,
  },
  {
    key: 'team',
    title: 'Bring your team in',
    body: 'Invite people by link with an admin, developer or viewer role. Every API call is checked against the role, and every change lands in the audit log.',
    action: 'Invite a teammate',
    to: '/settings',
    icon: Users,
  },
];

const CAPABILITIES = [
  { icon: GitBranch, label: 'Git repositories with commits, branches and diffs' },
  { icon: Rocket, label: 'Real builds with preview URLs and streaming logs' },
  { icon: Database, label: 'One SQL database per project, with a SQL editor' },
  { icon: HardDrive, label: 'Object storage with signed download URLs' },
  { icon: ScrollText, label: 'Structured logs and request analytics' },
];

export default function GettingStarted({ firstName, workspace }) {
  const navigate = useNavigate();

  return (
    <div className="[&>*]:min-w-0 grid gap-2.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Panel className="overflow-hidden">
        <div className="border-b border-line px-4 py-4">
          <p className="text-2xs uppercase tracking-[0.1em] text-dim">Getting started</p>
          <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-fg">
            Welcome{firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="mt-1 max-w-[52ch] text-sm leading-6 text-muted">
            {workspace?.name || 'Your workspace'} is ready and empty. Three steps take you from here to a
            running deployment with a team behind it.
          </p>
        </div>

        <ol className="divide-y divide-line">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.key} className="flex gap-3 px-4 py-3.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-panel-2 text-2xs font-medium text-muted">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon size={13} className="text-dim" />
                    <p className="text-sm font-medium text-fg">{step.title}</p>
                  </div>
                  <p className="mt-1 max-w-[62ch] text-xs leading-5 text-muted">{step.body}</p>
                  <Button
                    size="xs"
                    variant={index === 0 ? 'primary' : 'secondary'}
                    className="mt-2"
                    iconRight={ArrowRight}
                    onClick={() => navigate(step.to)}
                  >
                    {step.action}
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-panel-2/40 px-4 py-2.5">
          <p className="text-2xs text-dim">No credit card. Self-hosted, so the data stays on your host.</p>
          <Link to="/docs" className="text-2xs text-muted underline decoration-line-strong underline-offset-2 hover:text-fg">
            Read the docs
          </Link>
        </div>
      </Panel>

      <Panel className="h-fit overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <p className="text-xs font-medium text-fg">What you get</p>
          <p className="mt-0.5 text-2xs text-dim">Included in every workspace, no add-ons.</p>
        </div>
        <ul className="space-y-2.5 px-4 py-3.5">
          {CAPABILITIES.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label} className="flex gap-2">
                <Check size={12} className="mt-1 shrink-0 text-success" />
                <span className="text-xs leading-5 text-muted">{item.label}</span>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-line px-4 py-3">
          <p className="text-2xs leading-5 text-dim">
            Deployments run on this host. Container and multi-region routing controls appear once a Docker
            endpoint or an edge provider is configured.
          </p>
        </div>
      </Panel>
    </div>
  );
}

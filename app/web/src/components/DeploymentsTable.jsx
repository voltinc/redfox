import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { EmptyState, StatusBadge, Table, Td, Th, Tr } from '../ui/index.jsx';
import { duration, relativeTime, shortSha } from '../lib/format.js';

export function DeploymentsTable({ deployments, emptyAction }) {
  const navigate = useNavigate();
  if (!deployments.length) {
    return (
      <EmptyState
        icon={Rocket}
        title="No deployments yet"
        description="Trigger a deployment to build a commit and publish it to an environment."
        action={emptyAction}
      />
    );
  }
  return (
    <Table>
      <thead>
        <tr>
          <Th>Status</Th>
          <Th>Project</Th>
          <Th>Commit</Th>
          <Th>Environment</Th>
          <Th>Trigger</Th>
          <Th align="right">Duration</Th>
          <Th align="right">Created</Th>
        </tr>
      </thead>
      <tbody>
        {deployments.map((deployment) => (
          <Tr key={deployment.id} onClick={() => navigate(`/deployments/${deployment.id}`)}>
            <Td><StatusBadge status={deployment.status} /></Td>
            <Td>
              <span className="flex items-center gap-1.5">
                <span className="font-medium text-fg">{deployment.project_name}</span>
                {deployment.mode === 'demo' ? <span className="text-2xs text-warn">demo</span> : null}
              </span>
            </Td>
            <Td>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-2xs text-muted">{shortSha(deployment.commit_sha)}</span>
                  <span className="truncate text-xs text-muted">{deployment.commit_message}</span>
                </div>
                <span className="font-mono text-2xs text-dim">{deployment.branch}</span>
              </div>
            </Td>
            <Td>
              <span className={deployment.environment === 'production' ? 'text-xs text-fg' : 'text-xs text-muted'}>
                {deployment.environment}
              </span>
            </Td>
            <Td><span className="text-2xs text-dim">{deployment.trigger}</span></Td>
            <Td align="right"><span className="tabular text-xs text-muted">{duration(deployment.duration_ms)}</span></Td>
            <Td align="right"><span className="text-2xs text-dim">{relativeTime(deployment.created_at)}</span></Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

export default DeploymentsTable;

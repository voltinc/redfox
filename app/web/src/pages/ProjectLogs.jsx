import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageBody } from '../components/Shell.jsx';
import LogsView from '../components/LogsView.jsx';

export default function ProjectLogs() {
  const { project } = useOutletContext();
  return (
    <PageBody wide>
      <LogsView project={project} />
    </PageBody>
  );
}

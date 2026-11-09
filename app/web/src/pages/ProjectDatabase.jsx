import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageBody } from '../components/Shell.jsx';
import DatabaseView from '../components/DatabaseView.jsx';

export default function ProjectDatabase() {
  const { project } = useOutletContext();
  return (
    <PageBody wide>
      <DatabaseView project={project} />
    </PageBody>
  );
}

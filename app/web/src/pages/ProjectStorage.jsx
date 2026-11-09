import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageBody } from '../components/Shell.jsx';
import StorageView from '../components/StorageView.jsx';

export default function ProjectStorage() {
  const { project } = useOutletContext();
  return (
    <PageBody wide>
      <StorageView project={project} />
    </PageBody>
  );
}

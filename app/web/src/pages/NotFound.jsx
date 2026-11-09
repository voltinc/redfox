import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { PageBody } from '../components/Shell.jsx';
import { EmptyState, Button } from '../ui/index.jsx';

export default function NotFound() {
  return (
    <PageBody>
      <h1 className="sr-only">Page not found</h1>
      <div className="mt-16">
        <EmptyState
          icon={Compass}
          title="This page does not exist"
          description="The route you followed is not part of this Redfox installation. It may have been renamed or removed."
          action={<Button as="a" variant="secondary" size="sm" onClick={() => window.history.back()}>Go back</Button>}
        />
        <div className="text-center">
          <Link to="/" className="text-xs text-dim hover:text-fg">Return to overview</Link>
        </div>
      </div>
    </PageBody>
  );
}

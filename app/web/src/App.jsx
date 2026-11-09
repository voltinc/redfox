import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { ToastProvider, Spinner } from './ui/index.jsx';
import { Shell } from './components/Shell.jsx';
import { Logo } from './components/Brand.jsx';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Overview from './pages/Overview.jsx';
import Projects from './pages/Projects.jsx';
import ProjectNew from './pages/ProjectNew.jsx';
import ProjectLayout from './pages/ProjectLayout.jsx';
import ProjectOverview from './pages/ProjectOverview.jsx';
import ProjectDeployments from './pages/ProjectDeployments.jsx';
import ProjectRepository from './pages/ProjectRepository.jsx';
import ProjectDatabase from './pages/ProjectDatabase.jsx';
import ProjectStorage from './pages/ProjectStorage.jsx';
import ProjectLogs from './pages/ProjectLogs.jsx';
import ProjectSettings from './pages/ProjectSettings.jsx';
import Deployments from './pages/Deployments.jsx';
import DeploymentDetail from './pages/DeploymentDetail.jsx';
import Domains from './pages/Domains.jsx';
import Repositories from './pages/Repositories.jsx';
import Repository from './pages/Repository.jsx';
import CommitDetail from './pages/CommitDetail.jsx';
import DatabasePage from './pages/Database.jsx';
import Storage from './pages/Storage.jsx';
import ApiExplorer from './pages/ApiExplorer.jsx';
import Docs from './pages/Docs.jsx';
import Servers from './pages/Servers.jsx';
import ServerDetail from './pages/ServerDetail.jsx';
import Containers from './pages/Containers.jsx';
import Environment from './pages/Environment.jsx';
import Logs from './pages/Logs.jsx';
import Monitoring from './pages/Monitoring.jsx';
import Solene from './pages/Solene.jsx';
import WorkspaceSettings from './pages/WorkspaceSettings.jsx';
import AccountSettings from './pages/AccountSettings.jsx';
import NotFound from './pages/NotFound.jsx';

function BootScreen({ label = 'Loading workspace' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-base">
      <Logo size={26} />
      <div className="flex items-center gap-2 text-xs text-dim"><Spinner size={12} /> {label}</div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <BootScreen label="Checking session" />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

/* The landing page and the console share the root path: signed-out visitors get
   the marketing page, everyone else gets the app. Any other console route sends
   an anonymous visitor to sign in, remembering where they were going. */
function RootRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <BootScreen />;
  if (!user) {
    if (location.pathname === '/') return <Landing />;
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Shell />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Suspense fallback={<BootScreen />}>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
            <Route element={<RootRoute />}>
              <Route index element={<Overview />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/new" element={<ProjectNew />} />
              <Route path="projects/:slug" element={<ProjectLayout />}>
                <Route index element={<ProjectOverview />} />
                <Route path="deployments" element={<ProjectDeployments />} />
                <Route path="repository" element={<ProjectRepository />} />
                <Route path="database" element={<ProjectDatabase />} />
                <Route path="storage" element={<ProjectStorage />} />
                <Route path="logs" element={<ProjectLogs />} />
                <Route path="settings" element={<ProjectSettings />} />
              </Route>
              <Route path="deployments" element={<Deployments />} />
              <Route path="deployments/:deploymentId" element={<DeploymentDetail />} />
              <Route path="domains" element={<Domains />} />
              <Route path="repositories" element={<Repositories />} />
              <Route path="repositories/:repoId" element={<Repository />} />
              <Route path="repositories/:repoId/commits/:sha" element={<CommitDetail />} />
              <Route path="database" element={<DatabasePage />} />
              <Route path="storage" element={<Storage />} />
              <Route path="explorer" element={<ApiExplorer />} />
              <Route path="docs" element={<Docs />} />
              <Route path="servers" element={<Servers />} />
              <Route path="servers/:serverId" element={<ServerDetail />} />
              <Route path="containers" element={<Containers />} />
              <Route path="environment" element={<Environment />} />
              <Route path="logs" element={<Logs />} />
              <Route path="monitoring" element={<Monitoring />} />
              <Route path="solene" element={<Solene />} />
              <Route path="settings/workspace" element={<WorkspaceSettings />} />
              <Route path="settings/account" element={<AccountSettings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  );
}

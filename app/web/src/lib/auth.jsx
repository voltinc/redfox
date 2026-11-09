import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, post } from './api.js';
import { useApi } from './useApi.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { data, loading, error, reload } = useApi('/api/auth/me');
  const [notifications, setNotifications] = useState({ items: [], unread: 0 });

  const loadNotifications = useCallback(async () => {
    try {
      const result = await api('/api/notifications');
      setNotifications(result);
    } catch { /* signed out */ }
  }, []);

  useEffect(() => {
    if (data?.user) loadNotifications();
  }, [data?.user?.id, loadNotifications]);

  const login = useCallback(async (email, password) => {
    await post('/api/auth/login', { email, password });
    reload();
  }, [reload]);

  const logout = useCallback(async () => {
    await post('/api/auth/logout');
    window.location.href = '/login';
  }, []);

  const markAllRead = useCallback(async () => {
    await post('/api/notifications/read-all');
    await loadNotifications();
  }, [loadNotifications]);

  const markRead = useCallback(async (id) => {
    await post(`/api/notifications/${id}/read`);
    await loadNotifications();
  }, [loadNotifications]);

  const value = {
    user: data?.user || null,
    workspace: data?.workspace || null,
    workspaces: data?.workspaces || [],
    role: data?.role || null,
    llm: data?.llm || null,
    llmProviders: data?.llm_providers || [],
    server: data?.server || null,
    loading,
    error,
    login,
    logout,
    refresh: reload,
    notifications,
    loadNotifications,
    markAllRead,
    markRead,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function canWrite(role) {
  return ['owner', 'admin', 'developer'].includes(role);
}

export function canAdmin(role) {
  return ['owner', 'admin'].includes(role);
}

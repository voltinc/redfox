import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/* Small data hook: one fetch per path+deps, abort on unmount, manual reload. */
export function useApi(path, { deps = [], skip = false } = {}) {
  const [state, setState] = useState({ data: null, loading: !skip, error: null, status: null });
  const [nonce, setNonce] = useState(0);
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    if (skip || !pathRef.current) {
      setState((prev) => ({ ...prev, loading: false }));
      return undefined;
    }
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true }));
    api(pathRef.current, { signal: controller.signal })
      .then((data) => setState({ data, loading: false, error: null, status: 200 }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ data: null, loading: false, error, status: error.status ?? 0 });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, skip, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((updater) => {
    setState((prev) => ({ ...prev, data: typeof updater === 'function' ? updater(prev.data) : updater }));
  }, []);
  return { ...state, reload, setData };
}

/* Mutation helper with pending + error state. */
export function useMutation() {
  const [state, setState] = useState({ loading: false, error: null });
  const run = useCallback(async (fn, { onSuccess, onError } = {}) => {
    setState({ loading: true, error: null });
    try {
      const result = await fn();
      setState({ loading: false, error: null });
      onSuccess?.(result);
      return { ok: true, result };
    } catch (error) {
      setState({ loading: false, error });
      onError?.(error);
      return { ok: false, error };
    }
  }, []);
  return { ...state, run };
}

export function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useClickOutside(onOutside) {
  const ref = useRef(null);
  const handlerRef = useRef(onOutside);
  handlerRef.current = onOutside;
  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) handlerRef.current();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return ref;
}

export function useHotkey(combo, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const onKey = (event) => {
      const parts = combo.toLowerCase().split('+');
      const key = parts.at(-1);
      const needsMeta = parts.includes('meta');
      const needsShift = parts.includes('shift');
      const matchKey = event.key.toLowerCase() === key;
      const matchMeta = needsMeta ? event.metaKey || event.ctrlKey : !(event.metaKey || event.ctrlKey);
      if (matchKey && matchMeta && event.shiftKey === needsShift) {
        event.preventDefault();
        handlerRef.current(event);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo]);
}

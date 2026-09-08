'use client';

import { useEffect, useRef, useState } from 'react';

import { readWorkspaceSnapshot, writeWorkspaceSnapshot } from '@/lib/packing/workspace-storage';
import type { WorkspaceSnapshot } from '@/lib/packing/workspace-storage';

export function useWorkspacePersistence(snapshot: WorkspaceSnapshot, onRestore: (saved: WorkspaceSnapshot) => void) {
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading');
  const latest = useRef(snapshot);
  const restore = useRef(onRestore);

  useEffect(() => {
    try {
      const saved = readWorkspaceSnapshot(window.localStorage);
      if (saved) restore.current(saved);
    } catch {
      setStatus('error');
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    latest.current = snapshot;
    if (!hydrated) return;
    setStatus('saving');
    const timer = window.setTimeout(() => {
      try {
        writeWorkspaceSnapshot(snapshot, window.localStorage);
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [hydrated, snapshot]);

  useEffect(() => {
    if (!hydrated) return;
    const flush = () => {
      try {
        writeWorkspaceSnapshot(latest.current, window.localStorage);
      } catch {
        setStatus('error');
      }
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [hydrated]);

  return { hydrated, status };
}

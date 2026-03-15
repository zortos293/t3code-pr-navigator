'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SyncToastType = 'issue' | 'pr';

export type SyncToastData = {
  id: string;
  repoName: string;
  type: SyncToastType;
  current: number;
  total: number;
  number: number;
  dismissing?: boolean;
};

const COMPLETION_DELAY_MS = 3000;
const EXIT_ANIMATION_MS = 250;
const MAX_TOASTS = 5;

export function useSyncProgress() {
  const [toasts, setToasts] = useState<SyncToastData[]>([]);
  const cleanupTimers = useRef<Map<string, number>>(new Map());
  const removeTimers = useRef<Map<string, number>>(new Map());

  const clearTimers = useCallback((id: string) => {
    const cleanupTimer = cleanupTimers.current.get(id);
    if (cleanupTimer) {
      window.clearTimeout(cleanupTimer);
      cleanupTimers.current.delete(id);
    }

    const removeTimer = removeTimers.current.get(id);
    if (removeTimer) {
      window.clearTimeout(removeTimer);
      removeTimers.current.delete(id);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    clearTimers(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, [clearTimers]);

  const dismissToast = useCallback((id: string) => {
    clearTimers(id);
    setToasts((prev) => prev.map((toast) => (
      toast.id === id ? { ...toast, dismissing: true } : toast
    )));

    const removeTimer = window.setTimeout(() => {
      removeToast(id);
    }, EXIT_ANIMATION_MS);

    removeTimers.current.set(id, removeTimer);
  }, [clearTimers, removeToast]);

  const scheduleCleanup = useCallback((id: string) => {
    const existing = cleanupTimers.current.get(id);
    if (existing) {
      window.clearTimeout(existing);
    }

    const cleanupTimer = window.setTimeout(() => {
      dismissToast(id);
    }, COMPLETION_DELAY_MS);

    cleanupTimers.current.set(id, cleanupTimer);
  }, [dismissToast]);

  const showSyncToast = useCallback((toast: SyncToastData) => {
    clearTimers(toast.id);
    setToasts((prev) => {
      const next = [toast, ...prev.filter((item) => item.id !== toast.id)];
      return next.slice(0, MAX_TOASTS);
    });

    if (toast.total > 0 && toast.current >= toast.total) {
      scheduleCleanup(toast.id);
    }
  }, [clearTimers, scheduleCleanup]);

  const updateSyncToast = useCallback((toast: SyncToastData) => {
    clearTimers(toast.id);
    setToasts((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === toast.id);
      const nextToast = { ...toast, dismissing: false };

      if (existingIndex === -1) {
        return [nextToast, ...prev].slice(0, MAX_TOASTS);
      }

      const next = [...prev];
      next[existingIndex] = nextToast;
      return next;
    });

    if (toast.total > 0 && toast.current >= toast.total) {
      scheduleCleanup(toast.id);
    }
  }, [clearTimers, scheduleCleanup]);

  useEffect(() => {
    return () => {
      cleanupTimers.current.forEach((timer) => window.clearTimeout(timer));
      removeTimers.current.forEach((timer) => window.clearTimeout(timer));
      cleanupTimers.current.clear();
      removeTimers.current.clear();
    };
  }, []);

  return {
    toasts,
    showSyncToast,
    updateSyncToast,
    dismissToast,
  };
}

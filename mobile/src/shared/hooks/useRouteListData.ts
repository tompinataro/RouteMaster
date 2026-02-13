import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus, Linking, Platform } from 'react-native';
import { fetchTodayRoutes, resetMyVisitState, TodayRoute } from '../api/client';
import { flushQueue, getQueueStats } from '../utils/offlineQueue';
import { ensureToday, getCompleted, getInProgress, pruneToIds, syncServerTruth } from '../utils/completed';
import { showBanner } from '../components/globalBannerBus';

type LoadOptions = { reset?: boolean };

const dedupeRoutes = (items: TodayRoute[]) => {
  // Always collapse by visit id first (protects legitimate duplicates)
  const byId = Array.from(new Map(items.map(r => [r.id, r])).values());
  if (byId.length <= 12) {
    return byId;
  }

  // If we still have an unusually large set, drop repeats by client/address/time
  const counts = new Map<string, number>();
  for (const item of byId) {
    const key = `${item.clientName?.trim().toLowerCase()}__${item.address?.trim().toLowerCase()}__${item.scheduledTime ?? ''}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const hasHeavyDupes = Array.from(counts.values()).some((n) => n >= 3);
  if (!hasHeavyDupes) {
    return byId;
  }

  const seenKeys = new Set<string>();
  const trimmed: TodayRoute[] = [];
  for (const item of byId) {
    const key = `${item.clientName?.trim().toLowerCase()}__${item.address?.trim().toLowerCase()}__${item.scheduledTime ?? ''}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    trimmed.push(item);
  }
  return trimmed.length > 0 ? trimmed : byId;
};

export function useRouteListData(token?: string | null) {
  const [routes, setRoutes] = useState<TodayRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [inProgress, setInProgress] = useState<Set<number>>(new Set());
  const [resetRequested, setResetRequested] = useState(false);

  const refreshLocalState = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([getCompleted(), getInProgress()]);
      setCompleted(c);
      setInProgress(p);
    } catch {
      setCompleted(new Set());
      setInProgress(new Set());
    }
  }, []);

  const load = useCallback(async (opts?: LoadOptions) => {
    if (!token) return;
    setLoading(true);
    try {
      setError(null);
      try { await flushQueue(token); } catch {}
      try {
        const stats = await getQueueStats();
        if (stats.pending > 0 && stats.maxAttempts >= 3) {
          showBanner({ type: 'info', message: `Retrying ${stats.pending} submission${stats.pending > 1 ? 's' : ''} - will auto-resend` });
        }
      } catch {}
      const res = await fetchTodayRoutes(token);
      const deduped = dedupeRoutes(res.routes);
      deduped.sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''));
      setRoutes(deduped);
      try {
        await ensureToday();
        await pruneToIds(deduped.map(r => r.id));
        const reset = !!opts?.reset || resetRequested;
        const serverCompleted = reset ? new Set<number>() : new Set<number>();
        const serverInProg = reset ? new Set<number>() : new Set<number>();
        if (!reset) {
          for (const r of deduped as any[]) {
            if (r.completedToday) serverCompleted.add(r.id);
            if (r.inProgress) serverInProg.add(r.id);
          }
        }
        if (serverCompleted.size || serverInProg.size) {
          try { await syncServerTruth(Array.from(serverCompleted), Array.from(serverInProg)); } catch {}
          setCompleted(serverCompleted);
          setInProgress(serverInProg);
        } else {
          await refreshLocalState();
        }
        if (resetRequested) setResetRequested(false);
      } catch {}
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to load routes';
      setError(msg);
      showBanner({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  }, [token, resetRequested, refreshLocalState]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const triggerReset = useCallback(async () => {
    try {
      if (token) {
        try { await resetMyVisitState(token); } catch {}
      }
      setResetRequested(true);
      setCompleted(new Set());
      setInProgress(new Set());
      await ensureToday();
      await pruneToIds([]);
      await syncServerTruth([], []);
      await load({ reset: true });
      showBanner({ type: 'info', message: 'Route state reset' });
    } catch {}
  }, [token, load]);

  const openMaps = useCallback(async (address?: string | null) => {
    if (!address?.trim()) {
      showBanner({ type: 'error', message: 'No address available for maps' });
      return;
    }

    const q = encodeURIComponent(address);
    if (Platform.OS === 'ios') {
      const googleScheme = `comgooglemaps://?daddr=${q}&directionsmode=driving`;
      const appleScheme = `maps://?daddr=${q}&dirflg=d`;
      const appleWeb = `https://maps.apple.com/?daddr=${q}&dirflg=d`;
      const googleWeb = `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
      try {
        if (await Linking.canOpenURL(googleScheme)) {
          await Linking.openURL(googleScheme);
          return;
        }
        if (await Linking.canOpenURL(appleScheme)) {
          await Linking.openURL(appleScheme);
          return;
        }
        await Linking.openURL(appleWeb);
        return;
      } catch {
        await Linking.openURL(googleWeb).catch(() => {
          showBanner({ type: 'error', message: 'Unable to open maps' });
        });
      }
      return;
    }
    if (Platform.OS === 'android') {
      const intent = `google.navigation:q=${q}&mode=d`;
      const web = `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
      await Linking.openURL(intent).catch(async () => {
        await Linking.openURL(web).catch(() => {
          showBanner({ type: 'error', message: 'Unable to open maps' });
        });
      });
      return;
    }
    const web = `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
    Linking.openURL(web).catch(() => {
      showBanner({ type: 'error', message: 'Unable to open maps' });
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        if (token) {
          flushQueue(token).then(async () => {
            try {
              const stats = await getQueueStats();
              if (stats.pending > 0 && stats.maxAttempts >= 3) {
                showBanner({ type: 'info', message: `Retrying ${stats.pending} submission${stats.pending > 1 ? 's' : ''} - will auto-resend` });
              }
            } catch {}
          }).catch(() => {});
        }
        load();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [token, load]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = () => {
      if (token) {
        flushQueue(token).then(async () => {
          try {
            const stats = await getQueueStats();
            if (stats.pending > 0 && stats.maxAttempts >= 3) {
              showBanner({ type: 'info', message: `Retrying ${stats.pending} submission${stats.pending > 1 ? 's' : ''} - will auto-resend` });
            }
          } catch {}
        }).catch(() => {});
      }
      load();
    };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [token, load]);

  return {
    routes,
    loading,
    refreshing,
    error,
    completed,
    inProgress,
    load,
    refresh,
    triggerReset,
    refreshLocalState,
    openMaps,
  };
}

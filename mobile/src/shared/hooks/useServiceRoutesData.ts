import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetchClients, adminFetchServiceRoutes, AdminClient, ServiceRoute } from '../api/client';
import { showBanner } from '../components/globalBannerBus';

type Options = {
  token?: string | null;
  focusRouteId?: number | null;
};

export function useServiceRoutesData(options: Options) {
  const { token, focusRouteId } = options;
  const [serviceRoutes, setServiceRoutes] = useState<ServiceRoute[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);

  const reorderRoutes = useCallback((list: ServiceRoute[]) => {
    if (!focusRouteId) return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return [...list].sort((a, b) => {
      if (a.id === focusRouteId) return -1;
      if (b.id === focusRouteId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [focusRouteId]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [routeRes, clientRes] = await Promise.all([
        adminFetchServiceRoutes(token),
        adminFetchClients(token),
      ]);
      setServiceRoutes(reorderRoutes(routeRes?.routes || []));
      setClients(clientRes?.clients || []);
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to load service routes.' });
    }
  }, [token, reorderRoutes]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (focusRouteId) {
      setServiceRoutes(prev => reorderRoutes(prev));
    }
  }, [focusRouteId, reorderRoutes]);

  const appendRoute = useCallback((route: ServiceRoute) => {
    setServiceRoutes(prev => reorderRoutes([...prev, route]));
  }, [reorderRoutes]);

  const clientsByRoute = useMemo(() => {
    const map = new Map<number, AdminClient[]>();
    const seen = new Set<string>();
    clients.forEach(client => {
      const key = client.service_route_id || 0;
      const dedupKey = `${key}:${client.name}|${client.address}`;
      if (seen.has(dedupKey)) return;
      seen.add(dedupKey);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(client);
    });
    map.forEach((clientList) => {
      clientList.sort((a, b) => a.name.localeCompare(b.name));
    });
    return map;
  }, [clients]);

  const unassignedClients = clientsByRoute.get(0) || [];
  const unassignedRoutes = serviceRoutes.filter(route => !route.user_id);

  return {
    serviceRoutes,
    clientsByRoute,
    unassignedClients,
    unassignedRoutes,
    load,
    appendRoute,
  };
}

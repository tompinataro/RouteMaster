import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { adminFetchClients, adminFetchServiceRoutes, adminSetClientRoute, AdminClient, ServiceRoute } from '../api/client';
import { showBanner } from '../components/globalBannerBus';
import { shareEmail } from '../utils/email';

export type UniqueClient = AdminClient & { duplicateIds: number[] };

export function useUniqueClients(clients: AdminClient[]) {
  return useMemo<UniqueClient[]>(() => {
    const seen = new Map<string, UniqueClient>();
    clients.forEach(client => {
      const key = `${client.name}|${client.address}`;
      const existing = seen.get(key);
      if (existing) {
        existing.duplicateIds.push(client.id);
        if (!existing.service_route_name && client.service_route_name) {
          existing.service_route_name = client.service_route_name;
          existing.service_route_id = client.service_route_id;
        }
      } else {
        seen.set(key, { ...client, duplicateIds: [client.id] });
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);
}

type Options = {
  token?: string | null;
};

export function useClientLocationsData(options: Options) {
  const { token } = options;
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [serviceRoutes, setServiceRoutes] = useState<ServiceRoute[]>([]);
  const uniqueClients = useUniqueClients(clients);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [clientRes, routeRes] = await Promise.all([
        adminFetchClients(token),
        adminFetchServiceRoutes(token),
      ]);
      setClients(clientRes?.clients || []);
      setServiceRoutes(routeRes?.routes || []);
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to load clients.' });
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

  const assignRoute = useCallback(async (client: UniqueClient | null, routeId: number | null) => {
    if (!token || !client) return;
    try {
      await Promise.all(
        client.duplicateIds.map(id =>
          adminSetClientRoute(token, { clientId: id, serviceRouteId: routeId })
        )
      );
      await load();
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to place client in route.' });
    }
  }, [token, load]);

  const shareClients = useCallback(async () => {
    if (!uniqueClients.length) {
      showBanner({ type: 'info', message: 'No client locations to share yet.' });
      return;
    }
    const lines = uniqueClients.map(client => {
      const routeName = client.service_route_name || 'Unassigned';
      return `${client.name}\nRoute: ${routeName}`;
    });
    const subject = 'Client Locations';
    const body = `Client Locations:\n\n${lines.join('\n\n')}`;
    await shareEmail(subject, body);
  }, [uniqueClients]);

  return {
    clients,
    serviceRoutes,
    uniqueClients,
    load,
    assignRoute,
    shareClients,
  };
}

import { useCallback, useEffect, useState } from 'react';
import { adminFetchServiceRoutes, adminFetchUsers, AdminUser, ServiceRoute } from '../api/client';
import { showBanner } from '../components/globalBannerBus';
import { sortByLastName } from '../utils/sort';

type Options = {
  token?: string | null;
};

export function useFieldTechniciansData(options: Options) {
  const { token } = options;
  const [techUsers, setTechUsers] = useState<AdminUser[]>([]);
  const [serviceRoutes, setServiceRoutes] = useState<ServiceRoute[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [usersRes, routesRes] = await Promise.all([
        adminFetchUsers(token),
        adminFetchServiceRoutes(token),
      ]);
      const techs = (usersRes?.users || []).filter(u => u.role === 'tech');
      const sortedTechs = sortByLastName(techs);
      if (!sortedTechs.length) {
        setTechUsers([
          { id: 9001, name: 'Jacob Daniels', email: 'jacob@b.com', role: 'tech' },
          { id: 9002, name: 'Sadie Percontra', email: 'sadie@b.com', role: 'tech' },
          { id: 9003, name: 'Chris Lane', email: 'chris@b.com', role: 'tech' },
        ] as any);
      } else {
        setTechUsers(sortedTechs);
      }
      setServiceRoutes(routesRes?.routes || []);
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to load field techs.' });
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    techUsers,
    serviceRoutes,
    load,
  };
}

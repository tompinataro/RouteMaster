export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5100';

// Allows AuthProvider to register a handler for 401s
let unauthorizedHandler: (() => void) | null = null;
let tokenRefreshedHandler: ((token: string, user: any) => void | Promise<void>) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}
export function setTokenRefreshedHandler(handler: ((token: string, user: any) => void | Promise<void>) | null) {
  tokenRefreshedHandler = handler;
}

function withBase(path: string) {
  return `${API_BASE.replace(/\/$/, '')}${path}`;
}

async function fetchJson(input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }, _allowRetry = true) {
  const { timeoutMs = 30000, ...rest } = init || {};
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const originalBody = (rest as any)?.body;
    const res = await fetch(input, { ...rest, signal: ac.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401) {
        try {
          // Attempt a one-time refresh+retry if caller used Bearer token
          const hdr = (rest.headers || {}) as any;
          const auth = (hdr['Authorization'] || hdr['authorization']) as string | undefined;
          const isAuthReq = typeof input === 'string' ? input.includes('/api/auth/') : false;
          if (_allowRetry && auth && /Bearer\s+/.test(auth) && !isAuthReq) {
            // Try refresh with current token
            const refreshRes = await fetch(withBase('/api/auth/refresh'), {
              method: 'POST',
              headers: { Authorization: auth },
            });
            if (refreshRes.ok) {
              const rr = await refreshRes.json();
              const newToken: string | undefined = rr?.token;
              const user = rr?.user;
              if (newToken) {
                try { await tokenRefreshedHandler?.(newToken, user); } catch {}
                const headers = new Headers(rest.headers as any);
                headers.set('Authorization', `Bearer ${newToken}`);
                // Retry original request once with new token
                const retryRes = await fetchJson(input, { ...(rest as any), headers, body: originalBody }, false);
                return retryRes;
              }
            }
          }
        } catch {}
        try { unauthorizedHandler?.(); } catch {}
      }
      throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function health(): Promise<{ ok: boolean; ts?: string; message?: string }> {
  return fetchJson(withBase('/health'));
}

export type LoginResponse = { ok: boolean; token: string; user: { id: number; name: string; email: string; role?: 'admin' | 'tech' } };
export async function login(email: string, password: string): Promise<LoginResponse> {
  return fetchJson(withBase('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
}

export async function refresh(token: string): Promise<LoginResponse> {
  return fetchJson(withBase('/api/auth/refresh'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function postStartOdometer(token: string, odometerReading: number | string): Promise<{ ok: boolean; odometerReading?: number }> {
  return fetchJson(withBase('/api/auth/start-odometer'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ odometerReading: Number(odometerReading) })
  });
}

export type DeleteAccountResponse = { ok: boolean; deleted?: boolean; requiresManualCleanup?: boolean };
export async function deleteAccount(token: string, options?: { reason?: string }): Promise<DeleteAccountResponse> {
  return fetchJson(withBase('/api/auth/account'), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ reason: options?.reason ?? null })
  });
}

export type TodayRoute = {
  id: number;
  clientName: string;
  address: string;
  scheduledTime: string;
  // Server truth flags (optional; present when server supports Sprint 5)
  completedToday?: boolean;
  inProgress?: boolean;
};
export async function fetchTodayRoutes(token: string): Promise<{ ok: boolean; routes: TodayRoute[] }> {
  return fetchJson(withBase('/api/routes/today'), {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export type Visit = {
  id: number;
  clientName: string;
  checklist: { key: string; label: string; done: boolean }[];
  timelyNote?: string | null;
  address?: string | null;
  checkInTs?: string | null;
};
export async function fetchVisit(id: number, token: string): Promise<{ ok: boolean; visit: Visit }> {
  return fetchJson(withBase(`/api/visits/${id}`), {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function markVisitInProgress(id: number, token: string): Promise<{ ok: boolean; id: number }> {
  return fetchJson(withBase(`/api/visits/${id}/in-progress`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function submitVisit(
  id: number,
  data: {
    notes?: string;
    checklist: { key: string; done: boolean }[];
    timelyAck?: boolean;
    checkInTs?: string;
    checkOutTs?: string;
    checkInLoc?: { lat: number; lng: number };
    checkOutLoc?: { lat: number; lng: number };
    noteToOffice?: string;
    techNotes?: string;
    onSiteContact?: string;
    odometerReading?: number | string;
  },
  token: string
): Promise<{ ok: boolean; id: number } & any> {
  return fetchJson(withBase(`/api/visits/${id}/submit`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
}

// Admin utilities (dev/Staging only)
export async function adminResetVisitState(date: string | undefined, token: string): Promise<{ ok: boolean } & any> {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  return fetchJson(withBase(`/api/admin/visit-state/reset${q}`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function resetMyVisitState(token: string): Promise<{ ok: boolean } & any> {
  return fetchJson(withBase('/api/visit-state/reset'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type AdminUser = { id: number; name: string; email: string; role: 'admin' | 'tech'; managed_password?: string | null; phone?: string | null };
export async function adminFetchUsers(token: string): Promise<{ ok: boolean; users: AdminUser[] }> {
  return fetchJson(withBase('/api/admin/users'), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type AdminClient = {
  id: number;
  name: string;
  address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  assigned_user_id?: number | null;
  assigned_user_name?: string | null;
  assigned_user_email?: string | null;
  scheduled_time?: string | null;
  timely_note?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};
export async function adminFetchClients(token: string): Promise<{ ok: boolean; clients: AdminClient[] }> {
  return fetchJson(withBase('/api/admin/clients'), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminCreateUser(
  token: string,
  data: { name: string; email: string; role?: 'admin' | 'tech'; phone?: string }
): Promise<{ ok: boolean; user: AdminUser; tempPassword: string }> {
  return fetchJson(withBase('/api/admin/users'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function adminUpdateUser(
  token: string,
  userId: number,
  data: { name?: string; email?: string; phone?: string; managed_password?: string }
): Promise<{ ok: boolean; user: AdminUser }> {
  return fetchJson(withBase(`/api/admin/users/${userId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function adminDeleteUser(
  token: string,
  userId: number
): Promise<{ ok: boolean; id?: number }> {
  return fetchJson(withBase(`/api/admin/users/${userId}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminCreateClient(
  token: string,
  data: {
    name: string;
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    contactName?: string;
    contactPhone?: string;
    latitude?: number;
    longitude?: number;
  }
): Promise<{ ok: boolean; client: AdminClient }> {
  return fetchJson(withBase('/api/admin/clients'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export type ServiceRoute = {
  id: number;
  name: string;
  user_id?: number | null;
  user_name?: string | null;
  user_email?: string | null;
};
export async function adminFetchServiceRoutes(token: string): Promise<{ ok: boolean; routes: ServiceRoute[] }> {
  return fetchJson(withBase('/api/admin/service-routes'), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Lightweight reachability probe used to distinguish server errors from connectivity loss
export async function isApiReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(withBase('/health'), { signal: controller.signal });
    clearTimeout(t);
    return !!res.ok;
  } catch {
    return false;
  }
}

export async function adminCreateServiceRoute(
  token: string,
  data: { name: string }
): Promise<{ ok: boolean; route: ServiceRoute }> {
  return fetchJson(withBase('/api/admin/service-routes'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function adminSetClientRoute(
  token: string,
  data: { clientId: number; serviceRouteId: number | null }
): Promise<{ ok: boolean }> {
  return fetchJson(withBase(`/api/admin/clients/${data.clientId}/service-route`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ serviceRouteId: data.serviceRouteId }),
  });
}

export async function adminUpdateClient(
  token: string,
  data: {
    id: number;
    name: string;
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    contact_name?: string;
    contact_phone?: string;
    latitude?: number;
    longitude?: number;
  }
): Promise<{ ok: boolean }> {
  const { id, ...payload } = data;
  return fetchJson(withBase(`/api/admin/clients/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteClient(
  token: string,
  clientId: number
): Promise<{ ok: boolean; id?: number }> {
  return fetchJson(withBase(`/api/admin/clients/${clientId}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type ReportSummaryRow = {
  techId: number;
  techName: string;
  routeName: string | null;
  clientName: string;
  address: string;
  techNotes?: string | null;
  checkInTs: string | null;
  checkOutTs: string | null;
  visitDate?: string | null;
  rowType?: 'data' | 'total' | 'spacer';
  durationFormatted: string;
  durationMinutes?: number;
  mileageDelta: number;
  onSiteContact?: string | null;
  odometerReading?: number | null;
  geoValidated?: boolean;
  distanceFromClientFeet?: number | null;
  durationFlag?: boolean;
  geoFlag?: boolean;
};

export type ReportSummaryResponse = {
  ok: boolean;
  range: { start: string; end: string; frequency: string };
  rows: ReportSummaryRow[];
};

export async function adminFetchReportSummary(
  token: string,
  data: { frequency: string; startDate?: string; endDate?: string }
): Promise<ReportSummaryResponse> {
  return fetchJson(withBase('/api/admin/reports/summary'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function adminSendReport(
  token: string,
  data: { frequency: string; emails: string[]; startDate?: string; endDate?: string }
): Promise<{ ok: boolean }> {
  return fetchJson(withBase('/api/admin/reports/email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function adminAssignServiceRoute(
  token: string,
  data: { routeId: number; userId: number | null }
): Promise<{ ok: boolean }> {
  return fetchJson(withBase(`/api/admin/service-routes/${data.routeId}/tech`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId: data.userId }),
  });
}

export async function adminSetUserPassword(
  token: string,
  data: { userId: number; newPassword: string }
): Promise<{ ok: boolean }> {
  return fetchJson(withBase(`/api/admin/users/${data.userId}/password`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ newPassword: data.newPassword }),
  });
}

export async function adminClearRoutesForTech(
  token: string,
  userId: number
): Promise<{ ok: boolean }> {
  return fetchJson(withBase('/api/admin/routes/clear-for-tech'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId }),
  });
}

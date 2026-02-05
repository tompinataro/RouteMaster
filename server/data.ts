import { dbQuery, hasDb } from './db';

export type TodayRoute = { id: number; clientName: string; address: string; scheduledTime: string };
export type ChecklistItem = { key: string; label: string; done: boolean };
export type Visit = { id: number; clientName: string; checklist: ChecklistItem[]; timelyNote?: string | null; address?: string | null; checkInTs?: string | null };

const FALLBACK_ROUTES: TodayRoute[] = [
  { id: 104, clientName: 'Club 9625', address: '1919 Coon Rapids Blvd NW, Coon Rapids, MN 55433', scheduledTime: '12:30' },
  { id: 105, clientName: 'Palm Vista', address: '910 Sago Palm Way, Apollo Beach, FL 33572', scheduledTime: '14:00' },
  { id: 106, clientName: 'Riverwalk Lofts', address: '225 3rd Ave S', scheduledTime: '15:15' },
  { id: 101, clientName: 'Acme HQ', address: '761 58th Ave NE, Fridley, MN 55432', scheduledTime: '08:30' },
  { id: 102, clientName: 'Marco Polo, LLC', address: '2017 103rd Lane NW, Coon Rapids, MN 55433', scheduledTime: '09:45' },
  { id: 103, clientName: 'Sunset Mall', address: '789 University Ave NE, Minneapolis, MN 55413', scheduledTime: '11:15' }
];
const DEFAULT_TIME_SLOTS = ['08:00', '09:15', '10:30', '11:45', '13:00', '14:15', '15:30'];
const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { key: 'watered', label: 'Watered Plants', done: false },
  { key: 'pruned', label: 'Pruned and cleaned', done: false },
  { key: 'replaced', label: 'Replaced unhealthy plants', done: false },
];

function fallbackTimeFor(order: number) {
  const idx = Math.max(order - 1, 0) % DEFAULT_TIME_SLOTS.length;
  return DEFAULT_TIME_SLOTS[idx];
}

async function ensureVisitForClient(clientId: number, scheduledTime: string) {
  const existing = await dbQuery<{ id: number; scheduled_time: string }>(
    `select id, scheduled_time from visits where client_id = $1 order by id desc limit 1`,
    [clientId]
  );
  const last = existing?.rows?.[0];
  if (last && last.scheduled_time === scheduledTime) {
    await ensureChecklistForVisit(last.id);
    return last;
  }
  const created = await dbQuery<{ id: number; scheduled_time: string }>(
    `insert into visits (client_id, scheduled_time) values ($1, $2) returning id, scheduled_time`,
    [clientId, scheduledTime]
  );
  const visit = created?.rows?.[0] || { id: clientId, scheduled_time: scheduledTime };
  await ensureChecklistForVisit(visit.id);
  return visit;
}

async function ensureChecklistForVisit(visitId: number) {
  if (!hasDb()) return;
  const existing = await dbQuery<{ key: string }>(
    `select key from visit_checklist where visit_id = $1 limit 1`,
    [visitId]
  );
  if (existing?.rows?.length) return;
  const values: any[] = [];
  const placeholders: string[] = [];
  DEFAULT_CHECKLIST.forEach((item, idx) => {
    const base = idx * 4;
    values.push(visitId, item.key, item.label, item.done);
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
  });
  await dbQuery(
    `insert into visit_checklist (visit_id, key, label, done) values ${placeholders.join(', ')}`,
    values
  );
}

function normalizeKey(route: TodayRoute): string {
  const name = (route.clientName || '').trim().toLowerCase();
  const address = (route.address || '').trim().toLowerCase();
  const time = route.scheduledTime || '';
  return `${name}__${address}__${time}`;
}

function dedupeById(routes: TodayRoute[]): TodayRoute[] {
  const map = new Map<number, TodayRoute>();
  for (const route of routes) {
    if (!map.has(route.id)) map.set(route.id, route);
  }
  return Array.from(map.values());
}

function dedupeByKey(routes: TodayRoute[]): TodayRoute[] {
  const seen = new Set<string>();
  const result: TodayRoute[] = [];
  for (const route of routes) {
    const key = normalizeKey(route);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(route);
  }
  return result;
}

function ensureMinimumRoutes(routes: TodayRoute[], min = 6): TodayRoute[] {
  if (routes.length >= min) return routes;
  const existing = new Set(routes.map(normalizeKey));
  const next = routes.slice();
  for (const fallback of FALLBACK_ROUTES) {
    const key = normalizeKey(fallback);
    if (existing.has(key)) continue;
    next.push(fallback);
    existing.add(key);
    if (next.length >= min) break;
  }
  return next;
}

async function routesFromServiceAssignments(userId: number): Promise<TodayRoute[]> {
  const res = await dbQuery<{
    client_id: number;
    client_name: string;
    address: string;
    created_at: string;
    row_order: number;
  }>(
    `select
       c.id as client_id,
       c.name as client_name,
       c.address,
       c.created_at,
       row_number() over (order by c.created_at asc, c.id asc) as row_order
     from service_routes sr
     join clients c on c.service_route_id = sr.id
     where sr.user_id = $1
     order by c.created_at asc, c.id asc`,
    [userId]
  );
  const rows = res?.rows ?? [];
  if (!rows.length) return [];
  return rows.map(row => ({
    id: row.client_id,
    clientName: row.client_name,
    address: row.address,
    scheduledTime: fallbackTimeFor(row.row_order),
  }));
}

export async function getTodayRoutes(userId: number): Promise<TodayRoute[]> {
  if (hasDb()) {
    const res = await dbQuery<{
      client_id: number;
      client_name: string;
      address: string;
      scheduled_time: string;
    }>(
      `select rt.client_id, c.name as client_name, c.address, rt.scheduled_time
       from routes_today rt
       join clients c on c.id = rt.client_id
       where rt.user_id = $1
       order by rt.scheduled_time asc`,
      [userId]
    );
    const rows = res?.rows ?? [];
    if (rows.length > 0) {
      const mapped: TodayRoute[] = [];
      for (const row of rows) {
        const visit = await ensureVisitForClient(row.client_id, row.scheduled_time || fallbackTimeFor(1));
        mapped.push({
          id: visit.id,
          clientName: row.client_name,
          address: row.address,
          scheduledTime: row.scheduled_time || visit.scheduled_time || fallbackTimeFor(1),
        });
      }
      const deduped = dedupeByKey(dedupeById(mapped));
      try { console.log(`[getTodayRoutes] routes_today for user ${userId}: ${deduped.length}`); } catch {}
      return ensureMinimumRoutes(deduped);
    }
    // No routes_today entries; do not fall back to service_routes ownership.
    // Return empty to reflect "unassigned" state accurately.
    try { console.log(`[getTodayRoutes] no routes_today entries for user ${userId} -> empty`); } catch {}
    return [];
  }
  return FALLBACK_ROUTES;
}

export async function getVisit(id: number): Promise<Visit> {
  if (hasDb()) {
    const visit = await dbQuery<{ id: number; client_name: string; address: string | null; timely_note: string | null }>(
      `select
         v.id,
         c.name as client_name,
         c.address,
         tn.note as timely_note
       from visits v
       join clients c on c.id = v.client_id
       left join lateral (
         select note
         from timely_notes t
         where t.client_id = c.id and t.active
         order by t.created_at desc
         limit 1
       ) tn on true
       where v.id = $1`,
      [id]
    );
    const items = await dbQuery<{ key: string; label: string; done: boolean }>(
      `select key, label, done
       from visit_checklist
       where visit_id = $1
       order by array_position(array['watered','pruned','replaced'], key), key asc`,
      [id]
    );
    if (visit && visit.rows[0]) {
      return {
        id,
        clientName: visit.rows[0].client_name,
        checklist: items?.rows ?? [],
        timelyNote: visit.rows[0].timely_note,
        address: visit.rows[0].address,
        checkInTs: null,
      };
    }
  }
  const clientName =
    id === 101 ? 'Acme HQ' :
    id === 102 ? 'Marco Polo, LLC' :
    id === 103 ? 'Sunset Mall' :
    id === 104 ? 'Club 9625' :
    id === 105 ? 'Palm Vista Resort' :
    id === 106 ? 'Riverwalk Lofts' : 'Client';
  return {
    id,
    clientName,
    checklist: [
      { key: 'watered', label: 'Watered Plants', done: false },
      { key: 'pruned', label: 'Pruned and cleaned', done: false },
      { key: 'replaced', label: 'Replaced unhealthy plants', done: false }
    ],
    timelyNote: null,
    checkInTs: null
  };
}

export async function saveVisit(id: number, data: any) {
  if (hasDb()) {
    await dbQuery(
      `insert into visit_submissions (visit_id, notes, payload, created_at) values ($1, $2, $3, now())`,
      [id, data?.notes ?? null, JSON.stringify(data)]
    );
    return { ok: true } as any;
  }
  return { ok: true } as any;
}

export async function buildReportRows(startDate: Date, endDate: Date) {
  if (!hasDb()) return [];
  
  // Fetch submissions within date range
  const submissionsRes = await dbQuery<{
    submission_id: number;
    created_at: string;
    visit_time: string;
    visit_id: number;
    client_name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    route_name: string | null;
    tech_id: number | null;
    tech_name: string | null;
    payload: any;
  }>(
    `select
       vs.id as submission_id,
       vs.created_at,
       nullif(vs.payload->>'checkOutTs', '')::timestamptz as visit_time,
       v.id as visit_id,
       c.name as client_name,
       c.address,
       c.latitude,
       c.longitude,
       sr.name as route_name,
       u.id as tech_id,
       u.name as tech_name,
       vs.payload
     from visit_submissions vs
     join visits v on v.id = vs.visit_id
     join clients c on c.id = v.client_id
     left join service_routes sr on sr.id = c.service_route_id
     left join users u on u.id = sr.user_id
     where nullif(vs.payload->>'checkOutTs', '')::timestamptz between $1 and $2
     order by u.id nulls last, visit_time asc`,
    [startDate.toISOString(), endDate.toISOString()]
  );
  const submissionRows = submissionsRes?.rows ?? [];
  return submissionRows;
}

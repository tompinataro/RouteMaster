import express from 'express';
import { getTodayRoutes, getVisit, saveVisit } from '../data';
import { dbQuery, hasDb } from '../db';
import { IS_TEST } from '../config';

type AuthMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => void;

// In-memory visit state (test-only)
// Keyed by day + visit id + user id. Example: 2025-09-09:101:1
type VisitState = { completed?: boolean; inProgress?: boolean; updatedAt: string };
type VisitStateStore = 'db' | 'memory';
const stateMap = new Map<string, VisitState>();
const allowMemoryVisitState = IS_TEST;

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function keyFor(visitId: number, userId?: number, d = new Date()) {
  return `${dayKey(d)}:${visitId}:${userId ?? 'anon'}`;
}

function resolveVisitStateStore(res?: express.Response): VisitStateStore | null {
  if (hasDb()) return 'db';
  if (allowMemoryVisitState) return 'memory';
  if (res) {
    res.status(503).json({ ok: false, error: 'visit state requires database' });
  }
  return null;
}

function markInProgress(visitId: number, userId: number | undefined, store: VisitStateStore) {
  if (store === 'memory') {
    const k = keyFor(visitId, userId);
    const cur = stateMap.get(k) || { updatedAt: new Date().toISOString() } as VisitState;
    cur.inProgress = true;
    cur.updatedAt = new Date().toISOString();
    stateMap.set(k, cur);
    return;
  }
  dbQuery(
    `insert into visit_state (visit_id, date, user_id, status)
     values ($1, $2, $3, 'in_progress')
     on conflict (visit_id, date, user_id) do update set status = excluded.status, created_at = now()`,
    [visitId, dayKey(), userId || 0]
  ).catch(() => {});
}

function markCompleted(visitId: number, userId: number | undefined, store: VisitStateStore) {
  if (store === 'memory') {
    const k = keyFor(visitId, userId);
    const cur = stateMap.get(k) || { updatedAt: new Date().toISOString() } as VisitState;
    cur.completed = true;
    cur.inProgress = false;
    cur.updatedAt = new Date().toISOString();
    stateMap.set(k, cur);
    return;
  }
  dbQuery(
    `insert into visit_state (visit_id, date, user_id, status)
     values ($1, $2, $3, 'completed')
     on conflict (visit_id, date, user_id) do update set status = excluded.status, created_at = now()`,
    [visitId, dayKey(), userId || 0]
  ).catch(() => {});
}

async function isCompletedToday(visitId: number, userId: number | undefined, store: VisitStateStore): Promise<boolean> {
  if (store === 'db' && userId) {
    try {
      const rows = await dbQuery<{ status: string }>(
        `select status from visit_state where visit_id = $1 and date = $2 and user_id = $3 limit 1`,
        [visitId, dayKey(), userId]
      );
      const st = rows?.rows?.[0]?.status;
      if (st) return st === 'completed';
      return false;
    } catch (err) {
      console.error('[visit-state] failed to read status', err);
      return false;
    }
  }
  if (store === 'memory') {
    const k = keyFor(visitId, userId);
    return !!stateMap.get(k)?.completed;
  }
  return false;
}

function getFlags(visitId: number, userId: number | undefined, store: VisitStateStore) {
  if (store !== 'memory') {
    return { completedToday: false, inProgress: false };
  }
  const k = keyFor(visitId, userId);
  const cur = stateMap.get(k);
  return { completedToday: !!cur?.completed, inProgress: !!cur?.inProgress };
}

export function createVisitsRouter(requireAuth: AuthMiddleware, requireAdmin: AuthMiddleware) {
  const router = express.Router();

  router.get('/routes/today', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      const routes = await getTodayRoutes(userId || 0);
      try {
        console.log(`[routes/today] userId=${userId} count=${routes.length}`);
      } catch {}
      let withFlags = routes.map(r => ({ ...r, completedToday: false, inProgress: false }));
      const day = dayKey();
      const store = resolveVisitStateStore(res);
      if (!store) return;
      if (store === 'db' && userId) {
        try {
          const rows = await dbQuery<{ visit_id: number; status: string }>(
            `select visit_id, status from visit_state where date = $1 and user_id = $2`,
            [day, userId]
          );
          const map = new Map<number, string>();
          (rows?.rows || []).forEach(r => map.set(r.visit_id, r.status));
          withFlags = routes.map(r => {
            const st = map.get(r.id);
            return { ...r, completedToday: st === 'completed', inProgress: st === 'in_progress' };
          });
        } catch (err) {
          console.error('[visit-state] failed to load flags', err);
        }
      } else if (store === 'memory') {
        withFlags = routes.map(r => ({ ...r, ...getFlags(r.id, userId, store) }));
      }
      res.json({ ok: true, routes: withFlags });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? 'routes error' });
    }
  });

  router.get('/visits/:id', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const visit = await getVisit(id);
      res.json({ ok: true, visit });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? 'visit error' });
    }
  });

  router.post('/visits/:id/in-progress', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const store = resolveVisitStateStore(res);
      if (!store) return;
      markInProgress(id, req.user?.id, store);
      res.json({ ok: true, id });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? 'in-progress error' });
    }
  });

  router.post('/visits/:id/submit', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const data = req.body ?? {};
      const userId = req.user?.id;
      const store = resolveVisitStateStore(res);
      if (!store) return;
      const alreadyCompleted = await isCompletedToday(id, userId, store);
      const result = await saveVisit(id, data);
      if (hasDb() && userId) {
        const rawOdo = data?.odometerReading;
        const rawStr = rawOdo === null || rawOdo === undefined ? '' : String(rawOdo).trim();
        const numericOdo = Number(rawStr.replace(/[^0-9.]/g, ''));
        const ts = data?.checkOutTs || data?.checkInTs;
        let dateStr = dayKey();
        if (ts) {
          const parsed = new Date(String(ts).replace(' ', 'T'));
          if (!Number.isNaN(parsed.getTime())) {
            dateStr = parsed.toISOString().split('T')[0];
          } else {
            dateStr = String(ts).includes('T') ? String(ts).split('T')[0] : String(ts).split(' ')[0];
          }
        }
        if (rawStr && Number.isFinite(numericOdo)) {
          try {
            await dbQuery(
              `insert into daily_start_odometer (user_id, date, odometer_reading)
               values ($1, $2, $3)
               on conflict (user_id, date) do nothing`,
              [userId, dateStr, numericOdo]
            );
          } catch {}
        }
      }
      markCompleted(id, userId, store);
      res.json({ ok: true, id, idempotent: alreadyCompleted, result });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? 'submit error' });
    }
  });

  router.post('/visit-state/reset', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      const store = resolveVisitStateStore(res);
      if (!store) return;
      const d = dayKey();
      if (store === 'memory') {
        for (const key of Array.from(stateMap.keys())) {
          if (key.startsWith(`${d}:`) && key.endsWith(`:${userId}`)) {
            stateMap.delete(key);
          }
        }
      }
      if (store === 'db') {
        await dbQuery('delete from visit_state where date = $1 and user_id = $2', [d, userId]);
        await dbQuery(
          `delete from visit_submissions vs
           using visits v
           join clients c on c.id = v.client_id
           join service_routes sr on sr.id = c.service_route_id
           where vs.visit_id = v.id
             and sr.user_id = $2
             and vs.created_at::date = $1`,
          [d, userId]
        );
        await dbQuery('delete from daily_start_odometer where date = $1 and user_id = $2', [d, userId]);
      }
      res.json({ ok: true, date: d, userId });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? 'reset error' });
    }
  });

  // Reassign a client's routes to a field tech (user)
  router.put('/visits/field-tech', requireAuth, requireAdmin, async (req, res) => {
    const { clientName, fieldTechId } = req.body ?? {};
    if (!clientName || !fieldTechId) return res.status(400).json({ ok: false, error: 'missing clientName or fieldTechId' });
    try {
      // Look up client id
      const clientRes = await dbQuery<{ id: number }>('select id from clients where name = $1', [clientName]);
      const clientId = clientRes?.rows?.[0]?.id;
      if (!clientId) return res.status(404).json({ ok: false, error: 'client not found' });

      // Update routes_today entries for this client
      await dbQuery('update routes_today set user_id = $1 where client_id = $2', [fieldTechId, clientId]);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? 'update error' });
    }
  });

  router.post('/admin/visit-state/reset', requireAuth, requireAdmin, async (req, res) => {
    const d = (req.query.date as string) || dayKey();
    try {
      let clearedKeys = 0;
      const store = resolveVisitStateStore(res);
      if (!store) return;
      if (store === 'memory') {
        const toDel: string[] = [];
        stateMap.forEach((_v, k) => { if (k.startsWith(`${d}:`)) toDel.push(k); });
        toDel.forEach(k => stateMap.delete(k));
        clearedKeys = toDel.length;
      }

      if (store === 'db') {
        await dbQuery('delete from visit_state where date = $1', [d]);
      }
      res.json({ ok: true, date: d, clearedKeys });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? 'reset error' });
    }
  });

  return router;
}

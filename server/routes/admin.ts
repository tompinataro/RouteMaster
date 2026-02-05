import express from 'express';
import { randomBytes } from 'crypto';
import { dbQuery, hasDb } from '../db';
import { AuthMiddleware, UserRole } from '../auth';

const encryptLib = require('../modules/encryption') as {
  encryptPassword: (password: string) => string;
};

function ensureDatabase(res: express.Response): boolean {
  if (!hasDb()) {
    res.status(503).json({ ok: false, error: 'database not configured' });
    return false;
  }
  return true;
}

function generatePassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const bytes = randomBytes(6);
  let out = '';
  for (let i = 0; i < 3; i += 1) {
    out += letters[bytes[i] % letters.length];
  }
  for (let i = 3; i < 6; i += 1) {
    out += digits[bytes[i] % digits.length];
  }
  return out;
}

function buildFullAddress(streetRaw: string, cityRaw: string, stateRaw: string, zipRaw: string) {
  const street = streetRaw.trim();
  const city = cityRaw.trim();
  const state = stateRaw.trim();
  const zip = zipRaw.trim();
  let line2 = '';
  if (city) {
    line2 += city;
  }
  if (state) {
    line2 += line2 ? `, ${state}` : state;
  }
  if (zip) {
    line2 += line2 ? ` ${zip}` : zip;
  }
  return line2 ? `${street}, ${line2}` : street;
}

export function createAdminRouter(requireAuth: AuthMiddleware, requireAdmin: AuthMiddleware) {
  const router = express.Router();
  router.use(requireAuth, requireAdmin);

  router.get('/users', async (_req, res) => {
    if (!ensureDatabase(res)) return;
    try {
      const q = await dbQuery<{ id: number; email: string; name: string; role: string; managed_password: string | null; phone: string | null }>(
        'select id, email, name, coalesce(role, \'tech\') as role, managed_password, phone from users order by id asc'
      );
      const users = (q?.rows ?? []).map((u) => ({ ...u, role: u.role === 'admin' ? 'admin' : 'tech' }));
      res.json({ ok: true, users });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? 'users error' });
    }
  });

  router.get('/clients', async (_req, res) => {
    if (!ensureDatabase(res)) return;
    try {
      const columns = await dbQuery<{ column_name: string }>(
        `select column_name
           from information_schema.columns
          where table_name = 'clients'
            and column_name in ('latitude','longitude','city','state','zip')`
      );
      const hasLatitude = (columns?.rows || []).some(col => col.column_name === 'latitude');
      const hasLongitude = (columns?.rows || []).some(col => col.column_name === 'longitude');
      const hasCity = (columns?.rows || []).some(col => col.column_name === 'city');
      const hasState = (columns?.rows || []).some(col => col.column_name === 'state');
      const hasZip = (columns?.rows || []).some(col => col.column_name === 'zip');
      const select = `
         select
           c.id,
           c.name,
           c.address,
           ${hasCity ? 'c.city' : 'null as city'},
           ${hasState ? 'c.state' : 'null as state'},
           ${hasZip ? 'c.zip' : 'null as zip'},
           c.contact_name,
           c.contact_phone,
           sr.id as service_route_id,
           sr.name as service_route_name,
           ${hasLatitude ? 'c.latitude' : 'null as latitude'},
           ${hasLongitude ? 'c.longitude' : 'null as longitude'},
           rt.scheduled_time
         from clients c
         left join service_routes sr on sr.id = c.service_route_id
         left join routes_today rt on rt.client_id = c.id
         order by c.service_route_id asc nulls last, rt.scheduled_time asc nulls last, c.name asc`;
      const q = await dbQuery<{
        id: number;
        name: string;
        address: string;
        city: string | null;
        state: string | null;
        zip: string | null;
        contact_name: string | null;
        contact_phone: string | null;
        service_route_id: number | null;
        service_route_name: string | null;
        latitude: number | null;
        longitude: number | null;
        scheduled_time: string | null;
      }>(select);
      res.json({ ok: true, clients: q?.rows ?? [] });
    } catch (e: any) {
      console.error('[admin/clients] error', e);
      res.status(500).json({ ok: false, error: e?.message ?? 'clients error' });
    }
  });

  router.get('/service-routes', async (_req, res) => {
    if (!ensureDatabase(res)) return;
    try {
      const q = await dbQuery<{
        id: number;
        name: string;
        user_id: number | null;
        user_name: string | null;
        user_email: string | null;
      }>(
        `select sr.id, sr.name, sr.user_id, u.name as user_name, u.email as user_email
         from service_routes sr
         left join users u on u.id = sr.user_id
         order by sr.name asc`
      );
      res.json({ ok: true, routes: q?.rows ?? [] });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? 'service routes error' });
    }
  });

  router.post('/service-routes', async (req, res) => {
    if (!ensureDatabase(res)) return;
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!rawName) {
      return res.status(400).json({ ok: false, error: 'route name required' });
    }
    try {
      const insert = await dbQuery<{ id: number; name: string }>(
        `insert into service_routes (name) values ($1) returning id, name`,
        [rawName]
      );
      const route = insert?.rows?.[0];
      return res.json({ ok: true, route });
    } catch (e: any) {
      const message = String(e?.message ?? '');
      if (/duplicate key value violates unique constraint/i.test(message)) {
        return res.status(409).json({ ok: false, error: 'route name already exists' });
      }
      console.error('[service-routes] create error', e);
      return res.status(500).json({ ok: false, error: 'failed to create route' });
    }
  });

  router.post('/users', async (req, res) => {
    if (!ensureDatabase(res)) return;
    const { name, email, role } = req.body ?? {};
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const phone = rawPhone || null;
    if (!trimmedName || !trimmedEmail) {
      return res.status(400).json({ ok: false, error: 'name and email required' });
    }
    const normalizedEmail = trimmedEmail.toLowerCase();
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(normalizedEmail)) {
      return res.status(400).json({ ok: false, error: 'invalid email address' });
    }
    const normalizedRole: UserRole = role === 'admin' ? 'admin' : 'tech';
    const tempPassword = generatePassword();
    const passwordHash = encryptLib.encryptPassword(tempPassword);
    try {
      const result = await dbQuery<{ id: number; name: string; email: string; role: string; must_change_password: boolean; managed_password: string | null; phone: string | null }>(
        `insert into users (name, email, password_hash, role, must_change_password, managed_password, phone)
         values ($1, $2, $3, $4, true, $5, $6)
         returning id, name, email, coalesce(role, 'tech') as role, must_change_password, managed_password, phone`,
        [trimmedName, normalizedEmail, passwordHash, normalizedRole, tempPassword, phone]
      );
      const user = result?.rows?.[0];
      return res.json({
        ok: true,
        user: user ? { ...user, role: user.role === 'admin' ? 'admin' : 'tech', mustChangePassword: !!user.must_change_password } : null,
        tempPassword
      });
    } catch (e: any) {
      const message = String(e?.message ?? '');
      if (/duplicate key value violates unique constraint/i.test(message)) {
        return res.status(409).json({ ok: false, error: 'email already exists' });
      }
      console.error('[admin/users] create error', e);
      return res.status(500).json({ ok: false, error: 'failed to create user' });
    }
  });

  router.post('/users/:id/password', async (req, res) => {
    if (!ensureDatabase(res)) return;
    const userId = Number(req.params.id);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ ok: false, error: 'invalid user id' });
    }
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword.trim() : '';
    if (newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: 'password must be at least 8 characters' });
    }
    try {
      const hash = encryptLib.encryptPassword(newPassword);
      await dbQuery('update users set password_hash = $1, managed_password = $2, must_change_password = false where id = $3', [hash, newPassword, userId]);
      res.json({ ok: true });
    } catch (err: any) {
      console.error('[admin/users/password] update error', err);
      res.status(500).json({ ok: false, error: 'failed to update password' });
    }
  });

  router.patch('/users/:id', async (req, res) => {
    if (!ensureDatabase(res)) return;
    const userId = Number(req.params.id);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ ok: false, error: 'invalid user id' });
    }
    const { name, email, phone, managed_password } = req.body ?? {};
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (typeof name === 'string' && name.trim()) {
      updates.push(`name = $${idx++}`);
      values.push(name.trim());
    }
    if (typeof email === 'string' && email.trim()) {
      updates.push(`email = $${idx++}`);
      values.push(email.trim());
    }
    if (typeof phone === 'string') {
      updates.push(`phone = $${idx++}`);
      values.push(phone.trim() || null);
    }
    if (typeof managed_password === 'string' && managed_password.trim()) {
      const hash = encryptLib.encryptPassword(managed_password.trim());
      updates.push(`password_hash = $${idx++}`);
      values.push(hash);
      updates.push(`managed_password = $${idx++}`);
      values.push(managed_password.trim());
      updates.push(`must_change_password = false`);
    }

    if (!updates.length) {
      return res.status(400).json({ ok: false, error: 'no fields to update' });
    }

    values.push(userId);
    try {
      const result = await dbQuery<{ id: number; name: string; email: string; role: string; managed_password: string | null; phone: string | null }>(
        `update users set ${updates.join(', ')} where id = $${idx} returning id, name, email, role, managed_password, phone`,
        values
      );
      if (!result?.rows?.length) {
        return res.status(404).json({ ok: false, error: 'user not found' });
      }
      res.json({ ok: true, user: result.rows[0] });
    } catch (err: any) {
      console.error('[admin/users/update] error', err);
      res.status(500).json({ ok: false, error: 'failed to update user' });
    }
  });

  router.delete('/users/:id', async (req, res) => {
    if (!ensureDatabase(res)) return;
    const userId = Number(req.params.id);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ ok: false, error: 'invalid user id' });
    }
    try {
      const roleRes = await dbQuery<{ role: string }>('select coalesce(role, \'tech\') as role from users where id = $1', [userId]);
      const role = roleRes?.rows?.[0]?.role === 'admin' ? 'admin' : 'tech';
      if (role === 'admin') {
        return res.status(400).json({ ok: false, error: 'cannot delete admin user' });
      }
      const result = await dbQuery<{ id: number }>('delete from users where id = $1 returning id', [userId]);
      if (!result?.rows?.length) {
        return res.status(404).json({ ok: false, error: 'user not found' });
      }
      return res.json({ ok: true, id: userId });
    } catch (e: any) {
      console.error('[admin/users] delete error', e);
      return res.status(500).json({ ok: false, error: 'failed to delete user' });
    }
  });

  router.post('/clients', async (req, res) => {
    if (!ensureDatabase(res)) return;
    const { name, address, contactName, contactPhone, latitude, longitude } = req.body ?? {};
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedAddress = typeof address === 'string' ? address.trim() : '';
    if (!trimmedName || !trimmedAddress) {
      return res.status(400).json({ ok: false, error: 'name and address required' });
    }
    const city = typeof req.body?.city === 'string' ? req.body.city.trim() : '';
    const stateCode = typeof req.body?.state === 'string' ? req.body.state.trim() : '';
    const zip = typeof req.body?.zip === 'string' ? req.body.zip.trim() : '';
    const formattedAddress = buildFullAddress(trimmedAddress, city, stateCode, zip);
    const latValue = latitude !== undefined && latitude !== null ? Number(latitude) : null;
    const lngValue = longitude !== undefined && longitude !== null ? Number(longitude) : null;
    const result = await dbQuery<{
      id: number;
      name: string;
      address: string;
      city: string | null;
      state: string | null;
      zip: string | null;
      contact_name: string | null;
      contact_phone: string | null;
      latitude: number | null;
      longitude: number | null;
    }>(
      `insert into clients (name, address, city, state, zip, contact_name, contact_phone, latitude, longitude)
       values ($1, $2, nullif($3, ''), nullif($4, ''), nullif($5, ''), nullif($6, ''), nullif($7, ''), $8, $9)
       returning id, name, address, city, state, zip, contact_name, contact_phone, latitude, longitude`,
      [trimmedName, formattedAddress, city, stateCode, zip, contactName || null, contactPhone || null, latValue, lngValue]
    ).catch((e: any) => {
      const message = String(e?.message ?? '');
      if (/duplicate key value violates unique constraint/i.test(message)) {
        return { error: 'duplicate' };
      }
      console.error('[admin/clients] create error', e);
      return { error: 'unknown' };
    });
    if ((result as any)?.error === 'duplicate') {
      return res.status(409).json({ ok: false, error: 'client already exists' });
    }
    if ((result as any)?.error) {
      return res.status(500).json({ ok: false, error: 'failed to create client' });
    }
    const client = (result as any)?.rows?.[0];
    return res.json({ ok: true, client });
  });

  router.patch('/clients/:id', async (req, res) => {
    if (!ensureDatabase(res)) return;
    const clientId = Number(req.params.id);
    if (!clientId || Number.isNaN(clientId)) {
      return res.status(400).json({ ok: false, error: 'invalid client id' });
    }
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const address = typeof req.body?.address === 'string' ? req.body.address.trim() : '';
    const city = typeof req.body?.city === 'string' ? req.body.city.trim() : '';
    const stateCode = typeof req.body?.state === 'string' ? req.body.state.trim() : '';
    const zip = typeof req.body?.zip === 'string' ? req.body.zip.trim() : '';
    const contactName = typeof req.body?.contact_name === 'string' ? req.body.contact_name.trim() : '';
    const contactPhone = typeof req.body?.contact_phone === 'string' ? req.body.contact_phone.trim() : '';
    const latInput = req.body?.latitude;
    const lngInput = req.body?.longitude;
    const latitude = latInput === null || latInput === undefined || latInput === '' ? null : Number(latInput);
    const longitude = lngInput === null || lngInput === undefined || lngInput === '' ? null : Number(lngInput);
    if (!name || !address) {
      return res.status(400).json({ ok: false, error: 'name and address required' });
    }
    const formattedAddress = city || stateCode || zip ? buildFullAddress(address, city, stateCode, zip) : address;
    if ((latitude !== null && Number.isNaN(latitude)) || (longitude !== null && Number.isNaN(longitude))) {
      return res.status(400).json({ ok: false, error: 'invalid latitude/longitude' });
    }
    try {
      const result = await dbQuery<{
        id: number;
        name: string;
        address: string;
        city: string | null;
        state: string | null;
        zip: string | null;
        contact_name: string | null;
        contact_phone: string | null;
        latitude: number | null;
        longitude: number | null;
      }>(
        `update clients
           set name = $1,
               address = $2,
               city = nullif($3, ''),
               state = nullif($4, ''),
               zip = nullif($5, ''),
               contact_name = $6,
               contact_phone = $7,
               latitude = $8,
               longitude = $9
         where id = $10
         returning id, name, address, city, state, zip, contact_name, contact_phone, latitude, longitude`,
        [name, formattedAddress, city, stateCode, zip, contactName || null, contactPhone || null, latitude, longitude, clientId]
      );
      const client = result?.rows?.[0];
      if (!client) return res.status(404).json({ ok: false, error: 'client not found' });
      return res.json({ ok: true, client });
    } catch (e: any) {
      console.error('[admin/clients] update error', e);
      return res.status(500).json({ ok: false, error: 'failed to update client' });
    }
  });

  router.delete('/clients/:id', async (req, res) => {
    if (!ensureDatabase(res)) return;
    const clientId = Number(req.params.id);
    if (!clientId || Number.isNaN(clientId)) {
      return res.status(400).json({ ok: false, error: 'invalid client id' });
    }
    try {
      const result = await dbQuery<{ id: number }>('delete from clients where id = $1 returning id', [clientId]);
      if (!result?.rows?.length) {
        return res.status(404).json({ ok: false, error: 'client not found' });
      }
      return res.json({ ok: true, id: clientId });
    } catch (e: any) {
      console.error('[admin/clients] delete error', e);
      return res.status(500).json({ ok: false, error: 'failed to delete client' });
    }
  });

  router.post('/routes/assign', async (req, res) => {
    if (!ensureDatabase(res)) return;
    const { clientId, userId, scheduledTime } = req.body ?? {};
    const cid = Number(clientId);
    if (!cid || Number.isNaN(cid)) {
      return res.status(400).json({ ok: false, error: 'invalid client' });
    }
    const clientCheck = await dbQuery<{ id: number }>('select id from clients where id = $1', [cid]);
    if (!clientCheck?.rows?.length) {
      return res.status(404).json({ ok: false, error: 'client not found' });
    }
    if (userId === null || userId === undefined || userId === '') {
      try {
        await dbQuery('delete from routes_today where client_id = $1', [cid]);
        return res.json({ ok: true, removed: true });
      } catch (e: any) {
        console.error('[admin/routes] delete error', e);
        return res.status(500).json({ ok: false, error: 'failed to remove assignment' });
      }
    }
    const uid = Number(userId);
    if (!uid || Number.isNaN(uid)) {
      return res.status(400).json({ ok: false, error: 'invalid user' });
    }
    const userCheck = await dbQuery<{ role: string }>('select coalesce(role, \'tech\') as role from users where id = $1', [uid]);
    if (!userCheck?.rows?.length) {
      return res.status(404).json({ ok: false, error: 'user not found' });
    }
    const userRole = userCheck.rows[0].role;
    if (userRole !== 'tech') {
      return res.status(400).json({ ok: false, error: 'assignment requires a field tech account' });
    }
    const time =
      typeof scheduledTime === 'string' && scheduledTime.trim()
        ? scheduledTime.trim()
        : '08:30';
    try {
      await dbQuery(
        `insert into routes_today (user_id, client_id, scheduled_time)
         values ($1, $2, $3)
         on conflict (client_id) do update set user_id = excluded.user_id, scheduled_time = excluded.scheduled_time`,
        [uid, cid, time]
      );
      return res.json({ ok: true });
    } catch (e: any) {
      console.error('[admin/routes] assign error', e);
      return res.status(500).json({ ok: false, error: 'failed to assign client' });
    }
  });

  router.post('/clients/:id/service-route', async (req, res) => {
    if (!ensureDatabase(res)) return;
    const clientId = Number(req.params.id);
    if (!clientId || Number.isNaN(clientId)) {
      return res.status(400).json({ ok: false, error: 'invalid client id' });
    }
    const routeInput = req.body?.serviceRouteId;
    const routeId = routeInput === null || routeInput === undefined ? null : Number(routeInput);
    if (routeId !== null && Number.isNaN(routeId)) {
      return res.status(400).json({ ok: false, error: 'invalid route id' });
    }
    try {
      await dbQuery('update clients set service_route_id = $1 where id = $2', [routeId, clientId]);
      if (routeId === null) {
        await dbQuery('delete from routes_today where client_id = $1', [clientId]);
        return res.json({ ok: true });
      }
      const routeRes = await dbQuery<{ user_id: number | null }>(
        'select user_id from service_routes where id = $1',
        [routeId]
      );
      const assignedUserId = routeRes?.rows?.[0]?.user_id ?? null;
      if (!assignedUserId) {
        await dbQuery('delete from routes_today where client_id = $1', [clientId]);
        return res.json({ ok: true });
      }
      const timeRes = await dbQuery<{ scheduled_time: string }>(
        `select coalesce(rt.scheduled_time, v.scheduled_time, '08:30') as scheduled_time
         from clients c
         left join routes_today rt on rt.client_id = c.id
         left join lateral (
           select scheduled_time
           from visits
           where client_id = c.id
           order by id desc
           limit 1
         ) v on true
         where c.id = $1`,
        [clientId]
      );
      const scheduledTime = timeRes?.rows?.[0]?.scheduled_time || '08:30';
      await dbQuery(
        `insert into routes_today (user_id, client_id, scheduled_time)
         values ($1, $2, $3)
         on conflict (client_id) do update set user_id = excluded.user_id, scheduled_time = excluded.scheduled_time`,
        [assignedUserId, clientId, scheduledTime]
      );
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[clients/service-route] update error', e);
      res.status(500).json({ ok: false, error: 'failed to update client route' });
    }
  });

  router.post('/routes/clear-for-tech', async (req, res) => {
    if (!ensureDatabase(res)) return;
    const raw = req.body?.userId;
    const userId = raw === null || raw === undefined ? null : Number(raw);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ ok: false, error: 'invalid user id' });
    }
    try {
      await dbQuery<{ deleted: number }>(`delete from routes_today where user_id = $1`, [userId]);
      return res.json({ ok: true });
    } catch (e: any) {
      console.error('[admin/routes] clear-for-tech error', e);
      return res.status(500).json({ ok: false, error: 'failed to clear routes_today for tech' });
    }
  });

  router.post('/service-routes/:id/tech', async (req, res) => {
    if (!ensureDatabase(res)) return;
    const routeId = Number(req.params.id);
    if (!routeId || Number.isNaN(routeId)) {
      return res.status(400).json({ ok: false, error: 'invalid route id' });
    }
    const userInput = req.body?.userId;
    const userId = userInput === null || userInput === undefined ? null : Number(userInput);
    if (userId !== null && Number.isNaN(userId)) {
      return res.status(400).json({ ok: false, error: 'invalid user id' });
    }
    try {
      await dbQuery('update service_routes set user_id = $1 where id = $2', [userId, routeId]);
      const clientRows = await dbQuery<{ client_id: number; scheduled_time: string }>(
        `select
           c.id as client_id,
           coalesce(rt.scheduled_time, v.scheduled_time, '08:30') as scheduled_time
         from clients c
         left join routes_today rt on rt.client_id = c.id
         left join lateral (
           select scheduled_time
           from visits
           where client_id = c.id
           order by id desc
           limit 1
         ) v on true
         where c.service_route_id = $1`,
        [routeId]
      );
      const clientIds = clientRows?.rows?.map(r => r.client_id) ?? [];
      if (clientIds.length > 0) {
        if (userId === null) {
          await dbQuery('delete from routes_today where client_id = any($1::int[])', [clientIds]);
        } else {
          await dbQuery(
            `insert into routes_today (user_id, client_id, scheduled_time)
             select $1 as user_id, c.id as client_id,
                    coalesce(rt.scheduled_time, v.scheduled_time, '08:30') as scheduled_time
             from clients c
             left join routes_today rt on rt.client_id = c.id
             left join lateral (
               select scheduled_time
               from visits
               where client_id = c.id
               order by id desc
               limit 1
             ) v on true
             where c.service_route_id = $2
             on conflict (client_id) do update set user_id = excluded.user_id, scheduled_time = excluded.scheduled_time`,
            [userId, routeId]
          );
        }
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[service-routes/tech] update error', e);
      res.status(500).json({ ok: false, error: 'failed to assign tech' });
    }
  });

  router.get('/routes/overview', async (_req, res) => {
    if (!ensureDatabase(res)) return;
    try {
      const result = await dbQuery<{
        user_id: number;
        user_name: string;
        user_email: string;
        client_id: number;
        client_name: string;
        address: string;
        scheduled_time: string;
      }>(
        `select
           rt.user_id,
           u.name as user_name,
           u.email as user_email,
           rt.client_id,
           c.name as client_name,
           c.address,
           rt.scheduled_time
         from routes_today rt
         join users u on u.id = rt.user_id
         join clients c on c.id = rt.client_id
         order by u.name asc, rt.scheduled_time asc, c.name asc`
      );
      res.json({ ok: true, assignments: result?.rows ?? [] });
    } catch (e: any) {
      console.error('[admin/routes] overview error', e);
      res.status(500).json({ ok: false, error: e?.message ?? 'routes overview error' });
    }
  });

  router.post('/timely-notes', async (req, res) => {
    if (!ensureDatabase(res)) return;
    const { clientId, note, active } = req.body ?? {};
    const cid = Number(clientId);
    if (!cid || Number.isNaN(cid)) {
      return res.status(400).json({ ok: false, error: 'invalid client' });
    }
    const shouldActivate = active !== false;
    const trimmedNote = typeof note === 'string' ? note.trim() : '';
    if (!trimmedNote) {
      try {
        await dbQuery('update timely_notes set active = false where client_id = $1 and active', [cid]);
        return res.json({ ok: true, note: null });
      } catch (e: any) {
        console.error('[admin/timely-notes] clear error', e);
        return res.status(500).json({ ok: false, error: 'failed to clear note' });
      }
    }
    try {
      await dbQuery('update timely_notes set active = false where client_id = $1 and active', [cid]);
      const result = await dbQuery<{ id: number; note: string; created_at: string }>(
        `insert into timely_notes (client_id, note, created_by, active)
         values ($1, $2, $3, $4)
         returning id, note, created_at`,
        [cid, trimmedNote, req.user?.id ?? null, shouldActivate]
      );
      return res.json({ ok: true, note: result?.rows?.[0] ?? null });
    } catch (e: any) {
      console.error('[admin/timely-notes] create error', e);
      return res.status(500).json({ ok: false, error: 'failed to save note' });
    }
  });

  router.post('/run-seed', async (req, res) => {
    if (!ensureDatabase(res)) return;
    const fs = require('fs');
    const path = require('path');
    try {
      const seedPath = path.join(__dirname, 'sql', 'seed.sql');
      const raw = fs.readFileSync(seedPath, 'utf8');
      const cleaned = raw.replace(/--.*$/gm, '\n');
      const parts = cleaned.split(/;\\s*\\n/).map((s: string) => s.trim()).filter(Boolean);
      await dbQuery('BEGIN');
      for (const stmt of parts) {
        if (!stmt) continue;
        await dbQuery(stmt);
      }
      await dbQuery('COMMIT');
      res.json({ ok: true, appliedStatements: parts.length });
    } catch (e: any) {
      try { await dbQuery('ROLLBACK'); } catch {}
      console.error('[admin/run-seed] error', e);
      res.status(500).json({ ok: false, error: e?.message ?? 'failed to run seed' });
    }
  });

  return router;
}

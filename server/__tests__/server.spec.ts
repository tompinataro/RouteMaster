import request from 'supertest';
import { app } from '../server';

// Ensure deterministic demo creds
process.env.DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@example.com';
process.env.DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'password';

describe('Server API', () => {
  it('health returns ok with version/uptime', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.version).toBe('string');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('auth login + me works', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: process.env.DEMO_EMAIL, password: process.env.DEMO_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.ok).toBe(true);
    const token = login.body.token as string;
    expect(typeof token).toBe('string');

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.ok).toBe(true);
    expect(me.body.user?.email).toBe(process.env.DEMO_EMAIL);
  });

  it('routes today and visit submit are functional and idempotent', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: process.env.DEMO_EMAIL, password: process.env.DEMO_PASSWORD });
    const token = login.body.token as string;

    const routes = await request(app)
      .get('/api/routes/today')
      .set('Authorization', `Bearer ${token}`);
    expect(routes.status).toBe(200);
    expect(routes.body.ok).toBe(true);
    expect(Array.isArray(routes.body.routes)).toBe(true);
    expect(routes.body.routes.length).toBeGreaterThan(0);

    const id = routes.body.routes[0].id as number;

    // Mark in-progress
    const mark = await request(app)
      .post(`/api/visits/${id}/in-progress`)
      .set('Authorization', `Bearer ${token}`);
    expect(mark.status).toBe(200);
    expect(mark.body.ok).toBe(true);

    // First submit
    const payload = { notes: 'test', checklist: [], checkOutTs: new Date().toISOString() };
    const submit1 = await request(app)
      .post(`/api/visits/${id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(submit1.status).toBe(200);
    expect(submit1.body.ok).toBe(true);
    expect(submit1.body.idempotent).toBe(false);

    // Second submit should be idempotent
    const submit2 = await request(app)
      .post(`/api/visits/${id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(submit2.status).toBe(200);
    expect(submit2.body.ok).toBe(true);
    expect(submit2.body.idempotent).toBe(true);
  });
});


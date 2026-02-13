import request from 'supertest';
import { app } from '../server';

process.env.DEMO_EMAIL = 'demo@example.com';
process.env.DEMO_PASSWORD = 'password';
process.env.ADMIN_EMAIL = 'demo@example.com'; // make demo an admin for reset endpoint

describe('Visit state flags (memory mode)', () => {
  let token: string;
  let visitId: number;

  beforeAll(async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'demo@example.com', password: 'password' });
    token = login.body.token;
    const routes = await request(app).get('/api/routes/today').set('Authorization', `Bearer ${token}`);
    visitId = routes.body.routes[0].id;
  });

  it('marks in-progress and reflects in GET /api/routes/today', async () => {
    const mark = await request(app).post(`/api/visits/${visitId}/in-progress`).set('Authorization', `Bearer ${token}`);
    expect(mark.status).toBe(200);
    const routes = await request(app).get('/api/routes/today').set('Authorization', `Bearer ${token}`);
    const item = routes.body.routes.find((r: any) => r.id === visitId);
    expect(item.inProgress).toBe(true);
  });

  it('submit completes and returns idempotent on repeat', async () => {
    const payload = { notes: 'done', checklist: [], checkOutTs: new Date().toISOString() };
    const submit1 = await request(app).post(`/api/visits/${visitId}/submit`).set('Authorization', `Bearer ${token}`).send(payload);
    expect(submit1.body.idempotent).toBe(false);
    const submit2 = await request(app).post(`/api/visits/${visitId}/submit`).set('Authorization', `Bearer ${token}`).send(payload);
    expect(submit2.body.idempotent).toBe(true);
    const routes = await request(app).get('/api/routes/today').set('Authorization', `Bearer ${token}`);
    const item = routes.body.routes.find((r: any) => r.id === visitId);
    expect(item.completedToday).toBe(true);
  });

  it('tech reset clears server flags for today', async () => {
    const reset = await request(app)
      .post('/api/visit-state/reset')
      .set('Authorization', `Bearer ${token}`);
    expect(reset.status).toBe(200);
    const routes = await request(app).get('/api/routes/today').set('Authorization', `Bearer ${token}`);
    const item = routes.body.routes.find((r: any) => r.id === visitId);
    expect(item.completedToday).toBeFalsy();
    expect(item.inProgress).toBeFalsy();
  });

  it('admin reset clears server flags for today', async () => {
    await request(app)
      .post(`/api/visits/${visitId}/in-progress`)
      .set('Authorization', `Bearer ${token}`);
    const reset = await request(app)
      .post('/api/admin/visit-state/reset')
      .set('Authorization', `Bearer ${token}`);
    expect(reset.status).toBe(200);
    const routes = await request(app).get('/api/routes/today').set('Authorization', `Bearer ${token}`);
    const item = routes.body.routes.find((r: any) => r.id === visitId);
    expect(item.completedToday).toBeFalsy();
    expect(item.inProgress).toBeFalsy();
  });
});

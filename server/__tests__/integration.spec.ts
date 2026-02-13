import request from 'supertest';
import { app } from '../server';

const demoEmail = 'demo@example.com';
const demoPassword = 'password';

describe('Integration: auth/admin/report endpoints', () => {
  let token: string;
  const originalDemoEmail = process.env.DEMO_EMAIL;
  const originalDemoPassword = process.env.DEMO_PASSWORD;
  const originalAdminEmail = process.env.ADMIN_EMAIL;

  beforeAll(async () => {
    process.env.DEMO_EMAIL = demoEmail;
    process.env.DEMO_PASSWORD = demoPassword;
    process.env.ADMIN_EMAIL = demoEmail;

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: demoEmail, password: demoPassword });
    token = login.body.token;
  });

  afterAll(() => {
    process.env.DEMO_EMAIL = originalDemoEmail;
    process.env.DEMO_PASSWORD = originalDemoPassword;
    process.env.ADMIN_EMAIL = originalAdminEmail;
  });

  it('login validation rejects missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('login rejects invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: demoEmail, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('refresh returns a new token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user?.email).toBe(demoEmail);
  });

  it('start-odometer returns 503 when DB is unavailable', async () => {
    const res = await request(app)
      .post('/api/auth/start-odometer')
      .set('Authorization', `Bearer ${token}`)
      .send({ odometerReading: 12345 });
    expect(res.status).toBe(503);
  });

  it('admin users returns 503 when DB is unavailable', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(503);
  });

  it('report summary returns 503 when DB is unavailable', async () => {
    const res = await request(app)
      .post('/api/admin/reports/summary')
      .set('Authorization', `Bearer ${token}`)
      .send({ frequency: 'daily' });
    expect(res.status).toBe(503);
  });

  it('report email returns 503 when DB is unavailable', async () => {
    const res = await request(app)
      .post('/api/admin/reports/email')
      .set('Authorization', `Bearer ${token}`)
      .send({ emails: ['test@example.com'], frequency: 'daily' });
    expect(res.status).toBe(503);
  });
});

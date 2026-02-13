import request from 'supertest';
import { app } from '../server';

process.env.DEMO_EMAIL = 'demo@example.com';
process.env.DEMO_PASSWORD = 'password';

describe('Auth guards', () => {
  it('returns 401 when missing token', async () => {
    const res = await request(app).get('/api/routes/today');
    expect(res.status).toBe(401);
  });

  it('returns 403 on admin route for non-admin', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com'; // someone else
    const login = await request(app).post('/api/auth/login').send({ email: 'demo@example.com', password: 'password' });
    const token = login.body.token as string;
    const res = await request(app)
      .get('/api/admin/clients')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});


import request from 'supertest';
import { app } from '../server';

describe('Metrics endpoint', () => {
  it('GET /metrics returns Prometheus metrics text', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    // Should include at least one of our custom metrics
    expect(res.text).toMatch(/http_requests_total/);
  });
});


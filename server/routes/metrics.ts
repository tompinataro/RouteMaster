// server/routes/metrics.ts
import { Router, Request, Response, NextFunction } from 'express';
import client from 'prom-client';

const router = Router();

// Guard against multiple registrations in dev/hot-reload
const g: any = global as any;
if (!g.__PROM_DEFAULT_METRICS__) {
  client.collectDefaultMetrics();
  g.__PROM_DEFAULT_METRICS__ = true;
}

// HTTP metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'] as const,
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'] as const,
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export function requestMetrics(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    try {
      const durationNs = Number(process.hrtime.bigint() - start);
      const durationSec = durationNs / 1e9;
      const status = String(res.statusCode);
      const path = req.route?.path || req.path || 'unknown';
      const labels = { method: req.method, path, status } as const;
      httpRequestsTotal.inc(labels);
      httpRequestDurationSeconds.observe(labels, durationSec);
    } catch {}
  });
  next();
}

router.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    const metrics = await client.register.metrics();
    res.end(metrics);
  } catch (err) {
    const message = (err as Error)?.message ?? 'metrics error';
    res.status(500).end(message);
  }
});

export default router;

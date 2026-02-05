import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import metricsRouter, { requestMetrics } from './routes/metrics';
import { createAuthRouter } from './routes/auth';
import { createAdminRouter } from './routes/admin';
import { createReportsRouter } from './routes/reports';
import { createVisitsRouter } from './routes/visits';
import { requireAuth, requireAdmin } from './auth';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(requestMetrics);

  app.use(healthRouter);
  app.use(metricsRouter);

  app.use('/api', createVisitsRouter(requireAuth, requireAdmin));
  app.use('/api/auth', createAuthRouter(requireAuth));
  app.use('/api/admin', createAdminRouter(requireAuth, requireAdmin));
  app.use('/api/admin/reports', createReportsRouter(requireAuth, requireAdmin));

  return app;
}

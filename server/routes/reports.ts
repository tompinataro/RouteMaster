import express from 'express';
import { buildSummary, buildCsv, buildHtml, sendReportEmail } from '../reports/summary';
import { resolveRange } from '../reports/range';
import { hasDb } from '../db';

type AuthMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => void;

export function createReportsRouter(requireAuth: AuthMiddleware, requireAdmin: AuthMiddleware) {
  const router = express.Router();

  router.post('/summary', requireAuth, requireAdmin, async (req, res) => {
    if (!hasDb()) {
      return res.status(503).json({ ok: false, error: 'database not configured' });
    }
    const { frequency, startDate, endDate } = req.body ?? {};
    try {
      const range = resolveRange(frequency, startDate, endDate);
      const rows = await buildSummary(range.startDate, range.endDate);
      res.json({
        ok: true,
        rows,
        range: { start: range.startDate.toISOString(), end: range.endDate.toISOString(), frequency },
      });
    } catch (err: any) {
      console.error('[reports/summary] error', err);
      res.status(500).json({ ok: false, error: err?.message ?? 'failed to build summary' });
    }
  });

  router.post('/email', requireAuth, requireAdmin, async (req, res) => {
    if (!hasDb()) {
      return res.status(503).json({ ok: false, error: 'database not configured' });
    }
    const { emails, frequency, startDate, endDate } = req.body ?? {};
    let targets: string[] = [];
    if (Array.isArray(emails)) {
      targets = emails.filter(Boolean);
    } else if (typeof emails === 'string') {
      targets = emails.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (!targets.length) {
      return res.status(400).json({ ok: false, error: 'recipient emails required' });
    }
    const range = resolveRange(frequency, startDate, endDate);
    try {
      const rows = await buildSummary(range.startDate, range.endDate);
      const csv = buildCsv(rows);
      const html = buildHtml(rows, range.startDate, range.endDate);
      await sendReportEmail(targets, `Field Tech Summary (${frequency})`, html, csv);
      res.json({
        ok: true,
        sentTo: targets,
        range: { start: range.startDate.toISOString(), end: range.endDate.toISOString(), frequency },
      });
    } catch (err: any) {
      console.error('[reports/email] error', err);
      res.status(500).json({ ok: false, error: err?.message ?? 'failed to send report' });
    }
  });

  return router;
}

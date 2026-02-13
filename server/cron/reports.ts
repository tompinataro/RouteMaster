import cron from 'node-cron';
import { resolveRange } from '../reports/range';
import { buildSummary, buildCsv, buildHtml, sendReportEmail } from '../reports/summary';
import { REPORT_TIMEZONE } from '../config';

export function startReportCron() {
  cron.schedule('0 5 * * 1', async () => {
    console.log('[CRON] Sending weekly report to Tom');
    try {
      const { startDate, endDate } = resolveRange('weekly');
      const rows = await buildSummary(startDate, endDate);
      const csv = buildCsv(rows);
      const html = buildHtml(rows, startDate, endDate);
      await sendReportEmail(['tom@pinataro.com'], 'Field Work Summary Report (Weekly)', html, csv);
      console.log('[CRON] Weekly report sent to Tom');
    } catch (err: any) {
      console.error('[CRON] Failed to send weekly report:', err?.message);
    }
  }, { timezone: REPORT_TIMEZONE });

  cron.schedule('0 5 * * *', async () => {
    console.log('[CRON] Sending daily report to Tom');
    try {
      const { startDate, endDate } = resolveRange('daily');
      const rows = await buildSummary(startDate, endDate);
      const csv = buildCsv(rows);
      const html = buildHtml(rows, startDate, endDate);
      await sendReportEmail(['tom@pinataro.com'], 'Field Work Summary Report (Daily)', html, csv);
      console.log('[CRON] Daily report sent to Tom');
    } catch (err: any) {
      console.error('[CRON] Failed to send daily report:', err?.message);
    }
  }, { timezone: REPORT_TIMEZONE });
}

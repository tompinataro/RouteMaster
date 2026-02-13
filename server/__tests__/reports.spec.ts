import { resolveRange } from '../reports/range';

const msPerDay = 24 * 60 * 60 * 1000;
const timeZone = process.env.REPORT_TIMEZONE || 'America/Chicago';
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const formatDate = (date: Date) => dateFormatter.format(date);

describe('Report ranges', () => {
  it('daily range stays within the same day (UTC)', async () => {
    const { startDate, endDate } = resolveRange('daily');
    expect(formatDate(startDate)).toBe(formatDate(endDate));
    expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
  });

  it('weekly range spans ~8 days (UTC, end-of-day inclusive)', async () => {
    const { startDate, endDate } = resolveRange('weekly');
    const diffDays = (endDate.getTime() - startDate.getTime()) / msPerDay;
    expect(diffDays).toBeGreaterThan(7.9);
    expect(diffDays).toBeLessThan(8.1);
  });

  it('custom range honors provided start/end dates', async () => {
    const { startDate, endDate } = resolveRange('custom', '2026-01-10', '2026-01-12');
    expect(formatDate(startDate)).toBe('2026-01-10');
    expect(formatDate(endDate)).toBe('2026-01-12');
  });
});

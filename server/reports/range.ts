import { REPORT_TIMEZONE } from '../config';

function getTimeZoneOffsetMinutes(timeZone: string, date: Date) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = dtf.formatToParts(date);
    const values: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== 'literal') values[part.type] = part.value;
    }
    const asUTC = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );
    return (asUTC - date.getTime()) / 60000;
  } catch {
    return 0;
  }
}

function getZonedDateParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function makeZonedDate(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
) {
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, utc);
  return new Date(utc.getTime() - offsetMinutes * 60000);
}

function startOfDayInZone(date: Date, timeZone: string) {
  const { year, month, day } = getZonedDateParts(date, timeZone);
  return makeZonedDate(timeZone, year, month, day, 0, 0, 0, 0);
}

function endOfDayInZone(date: Date, timeZone: string) {
  const nextDay = addDaysInZone(date, 1, timeZone);
  const nextStart = startOfDayInZone(nextDay, timeZone);
  return new Date(nextStart.getTime() - 1);
}

function addDaysInZone(date: Date, days: number, timeZone: string) {
  const { year, month, day } = getZonedDateParts(date, timeZone);
  return new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0, 0));
}

function parseDateInZone(input: string, timeZone: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(' ', 'T');
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalized)) {
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [datePart, timePart] = normalized.split('T');
  const [yearStr, monthStr, dayStr] = datePart.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;
  let hour = 0;
  let minute = 0;
  let second = 0;
  if (timePart) {
    const timePieces = timePart.split(':');
    hour = Number(timePieces[0] || 0);
    minute = Number(timePieces[1] || 0);
    const secRaw = (timePieces[2] || '0').split('.')[0];
    second = Number(secRaw || 0);
  }
  return makeZonedDate(timeZone, year, month, day, hour, minute, second, 0);
}

export function resolveRange(frequency: string, explicitStart?: string, explicitEnd?: string) {
  const parsedStart = explicitStart ? parseDateInZone(explicitStart, REPORT_TIMEZONE) : null;
  const parsedEnd = explicitEnd ? parseDateInZone(explicitEnd, REPORT_TIMEZONE) : null;
  let end = parsedEnd || new Date();
  let start = parsedStart || new Date();
  const now = new Date();
  if (!parsedStart || !parsedEnd) {
    switch (frequency) {
      case 'daily':
        start = startOfDayInZone(now, REPORT_TIMEZONE);
        end = endOfDayInZone(now, REPORT_TIMEZONE);
        break;
      case 'weekly': {
        const startAnchor = addDaysInZone(now, -7, REPORT_TIMEZONE);
        start = startOfDayInZone(startAnchor, REPORT_TIMEZONE);
        end = endOfDayInZone(now, REPORT_TIMEZONE);
        break;
      }
      case 'payperiod': {
        const startAnchor = addDaysInZone(now, -14, REPORT_TIMEZONE);
        start = startOfDayInZone(startAnchor, REPORT_TIMEZONE);
        end = endOfDayInZone(now, REPORT_TIMEZONE);
        break;
      }
      case 'monthly': {
        const startAnchor = addDaysInZone(now, -30, REPORT_TIMEZONE);
        start = startOfDayInZone(startAnchor, REPORT_TIMEZONE);
        end = endOfDayInZone(now, REPORT_TIMEZONE);
        break;
      }
      default: {
        const startAnchor = addDaysInZone(now, -7, REPORT_TIMEZONE);
        start = startOfDayInZone(startAnchor, REPORT_TIMEZONE);
        end = endOfDayInZone(now, REPORT_TIMEZONE);
        break;
      }
    }
  }
  return { startDate: start, endDate: end };
}

export function formatRangeLabel(start: Date, end: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORT_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

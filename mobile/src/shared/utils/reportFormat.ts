import type { ReportSummaryRow } from '../api/client';
import { formatTime } from './time';

export const REPORT_FREQUENCIES = [
  { label: 'Day', value: 'daily' },
  { label: 'Week', value: 'weekly' },
  { label: 'Pay Period', value: 'payperiod' },
  { label: 'Month', value: 'monthly' },
  { label: 'Custom', value: 'custom' },
] as const;

export type FrequencyValue = typeof REPORT_FREQUENCIES[number]['value'];

export function formatShortDateInput(value: string) {
  const digits = value.replace(/[^\d]/g, '').slice(0, 8);
  if (!digits) return '';
  const mm = digits.slice(0, 2);
  const dd = digits.slice(2, 4);
  const rest = digits.slice(4);
  let out = mm;
  if (digits.length >= 3) out = `${mm}/${dd}`;
  if (rest) out = `${mm}/${dd}/${rest}`;
  return out;
}

export function parseShortDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const yearRaw = match[3];
  const year = yearRaw.length === 2 ? Number(`20${yearRaw}`) : Number(yearRaw);
  if (!month || !day || !year) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function todayShortDate() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  let raw = value;
  if (raw.includes('T')) raw = raw.split('T')[0];
  if (raw.includes(' ')) raw = raw.split(' ')[0];
  const parts = raw.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${Number(month)}/${Number(day)}/${year}`;
  }
  try {
    const date = new Date(value);
    return date.toLocaleDateString();
  } catch {
    return value;
  }
}

export function buildRangeLabel(
  range: { start?: string | null; end?: string | null } | undefined,
  frequency: FrequencyValue,
  customStartIso?: string | null,
  customEndIso?: string | null
) {
  if (frequency === 'custom' && customStartIso && customEndIso) {
    return `${formatDate(customStartIso)} – ${formatDate(customEndIso)}`;
  }
  if (frequency === 'daily' && range?.start) {
    return `${formatDate(range.start)} – ${formatDate(range.start)}`;
  }
  return `${formatDate(range?.start)} – ${formatDate(range?.end)}`;
}

export function formatCompactDate(value?: string | null) {
  if (!value) return '—';
  let raw = value;
  if (raw.includes('T')) raw = raw.split('T')[0];
  if (raw.includes(' ')) raw = raw.split(' ')[0];
  const parts = raw.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${month}${day}${year.slice(2)}`;
  }
  return value;
}

export function buildSummaryLines(rows: ReportSummaryRow[]) {
  if (!rows.length) return ['(No visits recorded for this range)'];
  return rows.map(item => {
    if (item.rowType === 'spacer') return '';
    if (item.rowType === 'total') {
      const miles = Number.isFinite(item.mileageDelta) ? item.mileageDelta.toFixed(1) : '—';
      return `${item.techName} | Mileage Total: ${miles}`;
    }
    return `${item.techName} | ${item.routeName || '—'} | Date: ${formatCompactDate(item.visitDate)} | ${item.clientName} | Notes: ${item.techNotes || '—'} | ${item.address} | In: ${formatTime(item.checkInTs)} Out: ${formatTime(item.checkOutTs)} | Duration: ${item.durationFormatted || '—'} | Miles: ${Number.isFinite(item.mileageDelta) ? item.mileageDelta.toFixed(1) : '—'} | Contact: ${item.onSiteContact || '—'} | Geo: ${item.geoValidated === true ? 'Yes' : item.geoValidated === false ? 'No' : '—'}`;
  });
}

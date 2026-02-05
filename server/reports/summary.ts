import nodemailer from 'nodemailer';
import { buildReportRows } from '../data';
import { dbQuery, hasDb } from '../db';
import {
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_URL,
  SMTP_USER,
} from '../config';
import { formatRangeLabel } from './range';

type ReportRow = {
  techId: number | null;
  techName: string;
  routeName: string | null;
  clientName: string;
  address: string;
  techNotes?: string | null;
  checkInTs: string | null;
  checkOutTs: string | null;
  visitDate?: string | null;
  rowType?: 'data' | 'total' | 'spacer';
  durationMinutes: number;
  durationFormatted: string;
  onSiteContact?: string | null;
  odometerReading?: number | null;
  mileageDelta: number;
  distanceFromClientFeet?: number | null;
  geoValidated?: boolean;
  durationFlag?: boolean;
  geoFlag?: boolean;
  managedPassword?: string | null;
};

function haversineMiles(lat1?: number | null, lon1?: number | null, lat2?: number | null, lon2?: number | null) {
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined ||
    lat1 === null ||
    lon1 === null ||
    lat2 === null ||
    lon2 === null
  ) {
    return null;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDuration(minutes: number) {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function formatCompactDate(value?: string | null) {
  if (!value) return '';
  let raw = value;
  if (raw.includes('T')) raw = raw.split('T')[0];
  if (raw.includes(' ')) raw = raw.split(' ')[0];
  const parts = raw.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${month.padStart(2, '0')}${day.padStart(2, '0')}${year.slice(-2)}`;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    const yy = String(parsed.getFullYear()).slice(-2);
    return `${mm}${dd}${yy}`;
  }
  return value;
}

type MailTransport = ReturnType<typeof nodemailer.createTransport>;
let mailTransport: MailTransport | null = null;
if (SMTP_URL) {
  mailTransport = nodemailer.createTransport(SMTP_URL);
} else if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  mailTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT || 587,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function buildSummary(startDate: Date, endDate: Date): Promise<ReportRow[]> {
  const rawRows = await buildReportRows(startDate, endDate);
  // Keep only completed visits (check-out present)
  const completedRows = rawRows.filter(row => row.visit_time);

  // Get all unique tech IDs from completed rows
  const uniqueTechIds = Array.from(new Set(completedRows.map(r => r.tech_id).filter(Boolean))) as number[];

  // Fetch managed passwords for each tech
  const techPasswords = new Map<number, string | null>(); // key: tech_id
  if (uniqueTechIds.length > 0 && hasDb()) {
    const pwResult = await dbQuery<{ id: number; managed_password: string | null }>(
      `select id, managed_password from users where id = any($1)`,
      [uniqueTechIds]
    );
    (pwResult?.rows || []).forEach(row => {
      techPasswords.set(row.id, row.managed_password);
    });
  }

  // Fetch daily_start_odometer for each tech and each day in the range
  const dailyStartOdometers = new Map<string, number>(); // key: "tech_id|date"
  const fallbackStartOdometers = new Map<number, number>(); // key: tech_id -> latest nonzero
  if (uniqueTechIds.length > 0 && hasDb()) {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    const result = await dbQuery<{ user_id: number; date: string; odometer_reading: number }>(
      `select user_id, date, odometer_reading from daily_start_odometer
       where user_id = any($1) and date >= $2 and date <= $3
       order by user_id, date`,
      [uniqueTechIds, startDateStr, endDateStr]
    );
    (result?.rows || []).forEach(row => {
      const val = typeof row.odometer_reading === 'number' ? row.odometer_reading : Number(row.odometer_reading);
      if (!Number.isNaN(val)) {
        const rowDateStr = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().split('T')[0];
        dailyStartOdometers.set(`${row.user_id}|${rowDateStr}`, val);
      }
    });
    const fallbackResult = await dbQuery<{ user_id: number; odometer_reading: number }>(
      `select distinct on (user_id) user_id, odometer_reading
       from daily_start_odometer
       where user_id = any($1) and odometer_reading > 0 and date <= $2
       order by user_id, date desc`,
      [uniqueTechIds, endDateStr]
    );
    (fallbackResult?.rows || []).forEach(row => {
      const val = typeof row.odometer_reading === 'number' ? row.odometer_reading : Number(row.odometer_reading);
      if (!Number.isNaN(val)) {
        fallbackStartOdometers.set(row.user_id, val);
      }
    });
  }

  const rows: ReportRow[] = [];

  for (const row of completedRows) {
    const techName = row.tech_name ? row.tech_name.trim() : 'Unassigned';
    if (row.tech_name && /^demo\b/i.test(techName)) continue;

    const payload = row.payload || {};
    let checkInTs: string | null = null;
    let checkOutTs: string | null = null;
    try {
      if (typeof payload.checkInTs === 'string') {
        const d = new Date(payload.checkInTs);
        if (!Number.isNaN(d.getTime())) checkInTs = d.toISOString();
      } else if (payload.checkInTs) {
        const d = new Date(payload.checkInTs as any);
        if (!Number.isNaN(d.getTime())) checkInTs = d.toISOString();
      }
    } catch {}
    try {
      if (row.visit_time) {
        const d = new Date(row.visit_time as any);
        if (!Number.isNaN(d.getTime())) checkOutTs = d.toISOString();
      }
    } catch {}
    if (!checkOutTs) {
      try {
        if (typeof payload.checkOutTs === 'string') {
          const d = new Date(payload.checkOutTs);
          if (!Number.isNaN(d.getTime())) checkOutTs = d.toISOString();
        } else if (payload.checkOutTs) {
          const d = new Date(payload.checkOutTs as any);
          if (!Number.isNaN(d.getTime())) checkOutTs = d.toISOString();
        }
      } catch {}
    }
    if (!checkInTs && row.created_at) {
      const d = new Date(row.created_at as any);
      if (!Number.isNaN(d.getTime())) checkInTs = d.toISOString();
    }
    if (!checkOutTs) {
      continue;
    }
    const inDate = checkInTs ? new Date(checkInTs) : null;
    const outDate = checkOutTs ? new Date(checkOutTs) : null;
    const visitDate = checkOutTs ? checkOutTs.split('T')[0] : null;
    const durationMinutes = inDate && outDate ? Math.max(0, (outDate.getTime() - inDate.getTime()) / 60000) : 0;
    const durationFormatted = formatDuration(durationMinutes);
    const onSiteContact = payload.onSiteContact || null;
    const techNotes = payload.techNotes || payload.noteToOffice || payload.notes || null;
    const odometerReading = payload.odometerReading != null ? Number(payload.odometerReading) : null;

    let mileageDelta = 0;
    const rawLoc = payload.checkOutLoc;
    let geoValidated: boolean | undefined = undefined;
    let distanceFromClientFeet: number | null = null;
    let geoFlag = false;
    if (rawLoc && typeof rawLoc.lat === 'number' && typeof rawLoc.lng === 'number') {
      const distMiles = haversineMiles(row.latitude, row.longitude, rawLoc.lat, rawLoc.lng);
      if (distMiles !== null) {
        distanceFromClientFeet = distMiles * 5280;
        geoValidated = distanceFromClientFeet <= 300;
        geoFlag = distanceFromClientFeet > 300;
      }
    }
    const durationFlag = geoFlag;
    rows.push({
      techId: row.tech_id,
      techName: techName,
      routeName: row.route_name,
      clientName: row.client_name,
      address: row.address,
      checkInTs,
      checkOutTs,
      visitDate,
      durationMinutes,
      durationFormatted,
      onSiteContact,
      techNotes,
      odometerReading,
      mileageDelta,
      distanceFromClientFeet,
      geoValidated,
      durationFlag,
      geoFlag,
      managedPassword: row.tech_id ? techPasswords.get(row.tech_id) || null : null,
    });
  }

  if (rows.length) {
    const parseTs = (value?: string | null) => {
      if (!value) return 0;
      const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
      const d = new Date(normalized);
      const t = d.getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    const rowsByTechDate = new Map<string, ReportRow[]>();
    const techTotals = new Map<string, number>();

    for (const row of rows) {
      const techId = row.techId ?? 0;
      const dateKey = row.visitDate || (row.checkOutTs ? row.checkOutTs.split('T')[0] : '');
      if (!dateKey) continue;
      const key = `${techId}|${dateKey}`;
      const list = rowsByTechDate.get(key) || [];
      list.push(row);
      rowsByTechDate.set(key, list);
    }

    for (const [key, group] of rowsByTechDate) {
      const [techIdStr, dateStr] = key.split('|');
      const techId = Number(techIdStr);
      group.sort((a, b) => {
        const ta = parseTs(a.checkOutTs || a.checkInTs);
        const tb = parseTs(b.checkOutTs || b.checkInTs);
        if (ta !== tb) return ta - tb;
        return (a.clientName || '').localeCompare(b.clientName || '');
      });

      let prevOdo = dailyStartOdometers.get(`${techId}|${dateStr}`);
      if (!(typeof prevOdo === 'number' && prevOdo > 0)) {
        const fallback = fallbackStartOdometers.get(techId);
        if (typeof fallback === 'number' && fallback > 0) {
          prevOdo = fallback;
        }
      }
      let total = 0;

      for (const row of group) {
        const odo = typeof row.odometerReading === 'number' ? row.odometerReading : Number(row.odometerReading);
        let delta = 0;
        if (Number.isFinite(odo)) {
          if (typeof prevOdo === 'number' && odo >= prevOdo) {
            delta = odo - prevOdo;
          }
          prevOdo = odo;
        }
        row.mileageDelta = delta;
        total += delta;
      }

      const techKey = String(techId);
      techTotals.set(techKey, (techTotals.get(techKey) || 0) + total);
    }

    const techGroups = new Map<string, { techId: number | null; techName: string; rows: ReportRow[] }>();
    for (const row of rows) {
      const key = `${row.techId ?? 'unassigned'}|${(row.techName || 'Unassigned').trim().toLowerCase()}`;
      const entry = techGroups.get(key) || { techId: row.techId ?? null, techName: row.techName || 'Unassigned', rows: [] };
      entry.rows.push(row);
      techGroups.set(key, entry);
    }

    const sortedTechKeys = Array.from(techGroups.keys()).sort((a, b) => {
      const aName = techGroups.get(a)?.techName || '';
      const bName = techGroups.get(b)?.techName || '';
      return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
    });

    const finalRows: ReportRow[] = [];
    for (let i = 0; i < sortedTechKeys.length; i++) {
      const key = sortedTechKeys[i];
      const group = techGroups.get(key);
      if (!group) continue;
      group.rows.sort((a, b) => {
        const dateA = a.visitDate || '';
        const dateB = b.visitDate || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const ta = parseTs(a.checkOutTs || a.checkInTs);
        const tb = parseTs(b.checkOutTs || b.checkInTs);
        if (ta !== tb) return ta - tb;
        return (a.clientName || '').localeCompare(b.clientName || '');
      });
      finalRows.push(...group.rows);

      const total = techTotals.get(String(group.techId ?? 0)) || 0;
      finalRows.push({
        rowType: 'total',
        techId: group.techId,
        techName: group.techName,
        routeName: null,
        clientName: 'Mileage Total',
        address: '',
        checkInTs: null,
        checkOutTs: null,
        visitDate: null,
        durationMinutes: 0,
        durationFormatted: '',
        onSiteContact: null,
        techNotes: null,
        odometerReading: null,
        mileageDelta: total,
        distanceFromClientFeet: null,
        geoValidated: undefined,
        durationFlag: false,
        geoFlag: false,
        managedPassword: group.techId ? techPasswords.get(group.techId) || null : null,
      });
      if (i < sortedTechKeys.length - 1) {
        finalRows.push({
          rowType: 'spacer',
          techId: group.techId,
          techName: group.techName,
          routeName: null,
          clientName: '',
          address: '',
          checkInTs: null,
          checkOutTs: null,
          visitDate: null,
          durationMinutes: 0,
          durationFormatted: '',
          onSiteContact: null,
          techNotes: null,
          odometerReading: null,
          mileageDelta: 0,
          distanceFromClientFeet: null,
          geoValidated: undefined,
          durationFlag: false,
          geoFlag: false,
          managedPassword: group.techId ? techPasswords.get(group.techId) || null : null,
        });
      }
    }

    return finalRows;
  }
  return rows;
}

export function buildCsv(rows: ReportRow[]) {
  const header = [
    'Technician',
    'Password',
    'Route',
    'Visit Date',
    'Client Location',
    'Notes',
    'Address',
    'Check-In',
    'Check-Out',
    'Duration',
    'Mileage Delta',
    'On-site Contact',
    'Geo Distance (ft)',
    'Geo Validated',
  ];
  const lines = [header.join(',')];
  rows.forEach(row => {
    if (row.rowType === 'spacer') {
      lines.push('');
      return;
    }
    const isTotal = row.rowType === 'total';
    lines.push([
      row.techName,
      isTotal ? '' : (row.managedPassword || ''),
      row.routeName || '',
      formatCompactDate(row.visitDate),
      row.clientName,
      isTotal ? '' : (row.techNotes || '').replace(/,/g, ' '),
      isTotal ? '' : row.address.replace(/,/g, ' '),
      isTotal ? '' : (row.checkInTs || ''),
      isTotal ? '' : (row.checkOutTs || ''),
      isTotal ? '' : row.durationFormatted,
      row.mileageDelta.toFixed(2),
      isTotal ? '' : (row.onSiteContact || ''),
      isTotal ? '' : (row.distanceFromClientFeet != null ? row.distanceFromClientFeet.toFixed(0) : ''),
      isTotal ? '' : (row.geoValidated ? 'Yes' : row.geoValidated === false ? 'No' : ''),
    ].join(','));
  });
  return lines.join('\n');
}

export function buildHtml(rows: ReportRow[], start: Date, end: Date) {
  const rowsHtml = rows.map(row => {
    if (row.rowType === 'spacer') {
      return `<tr><td colspan="13">&nbsp;</td></tr>`;
    }
    const isTotal = row.rowType === 'total';
    const geoFail = row.geoValidated === false || (row.distanceFromClientFeet != null && row.distanceFromClientFeet > 300);
    const durationFlag = geoFail || !!row.durationFlag;
    const geoFlag = geoFail || !!row.geoFlag;
    const clientStyle = (durationFlag || geoFlag) ? 'color:#b91c1c;font-weight:700;' : '';
    const durationStyle = durationFlag ? 'color:#b91c1c;font-weight:700;' : '';
    const geoStyle = geoFlag ? 'color:#b91c1c;font-weight:700;' : '';
    const totalStyle = isTotal ? 'font-weight:700;' : '';
    return `
    <tr>
      <td style="${totalStyle}">${row.techName}</td>
      <td style="${totalStyle}">${row.routeName || ''}</td>
      <td style="${totalStyle}">${formatCompactDate(row.visitDate)}</td>
      <td style="${isTotal ? totalStyle : clientStyle}">${row.clientName}</td>
      <td style="${totalStyle}">${isTotal ? '' : (row.techNotes || '')}</td>
      <td style="${totalStyle}">${isTotal ? '' : row.address}</td>
      <td style="${totalStyle}">${isTotal ? '' : (row.checkInTs || '')}</td>
      <td style="${totalStyle}">${isTotal ? '' : (row.checkOutTs || '')}</td>
      <td style="${isTotal ? totalStyle : durationStyle}">${isTotal ? '' : row.durationFormatted}</td>
      <td style="${totalStyle}">${row.mileageDelta.toFixed(2)}</td>
      <td style="${totalStyle}">${isTotal ? '' : (row.onSiteContact || '')}</td>
      <td style="${totalStyle}">${isTotal ? '' : (row.distanceFromClientFeet != null ? row.distanceFromClientFeet.toFixed(0) : '')}</td>
      <td style="${isTotal ? totalStyle : geoStyle}">${isTotal ? '' : (row.geoValidated === false ? 'No' : row.geoValidated === true ? 'Yes' : '')}</td>
    </tr>
  `;
  }).join('');
  return `
    <h2>Field Tech Summary</h2>
    <p>Range: ${formatRangeLabel(start, end)}</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead>
        <tr>
          <th>Technician</th>
          <th>Route</th>
          <th>Visit Date</th>
          <th>Client</th>
          <th>Notes</th>
          <th>Address</th>
          <th>Check-In</th>
          <th>Check-Out</th>
          <th>Duration</th>
          <th>Mileage Delta</th>
          <th>On-site Contact</th>
          <th>Geo Distance (ft)</th>
          <th>Geo Valid</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

export async function sendReportEmail(to: string[], subject: string, html: string, csv: string) {
  if (!mailTransport) {
    throw new Error('SMTP_URL not configured for report emails.');
  }
  await mailTransport.sendMail({
    from: SMTP_USER || undefined,
    to,
    subject,
    html,
    text: 'Attached is your Field Technician summary report.',
    attachments: [
      {
        filename: 'field-tech-summary.csv',
        content: csv,
      },
    ],
  });
}

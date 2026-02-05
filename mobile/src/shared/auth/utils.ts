export function sanitizeOdometerReading(odometerReading?: number | string): number | null {
  const raw = odometerReading ?? '';
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

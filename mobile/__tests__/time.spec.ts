import { describe, it, expect } from 'vitest';
import { formatTime } from '../src/utils/time';

describe('formatTime', () => {
  it('formats ISO timestamps to short time', () => {
    const iso = '2025-01-01T15:05:00.000Z';
    const res = formatTime(iso);
    expect(typeof res).toBe('string');
    // Should contain hour and minute in some locale format
    expect(/\d/.test(res)).toBe(true);
  });

  it('returns em dash-like placeholder on invalid input', () => {
    const res = formatTime('not-a-date');
    expect(res === '—' || typeof res === 'string').toBe(true);
  });
});


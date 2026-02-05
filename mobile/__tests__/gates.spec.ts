import { describe, it, expect } from 'vitest';
import { isSubmitDisabled } from '../src/logic/gates';

describe('isSubmitDisabled', () => {
  const checklistDone = [
    { key: 'watered', done: true },
    { key: 'pruned', done: true },
    { key: 'replaced', done: false },
  ];
  const checklistNotDone = [
    { key: 'watered', done: false },
    { key: 'pruned', done: true },
    { key: 'replaced', done: false },
  ];
  const base = {
    submitting: false,
    checkInTs: null as string | null,
    requiresAck: false,
    ack: false,
    checklist: checklistDone,
  };

  it('disables when not checked in', () => {
    const res = isSubmitDisabled({ ...base, checkInTs: null });
    expect(res).toBe(true);
  });

  it('enabled after check-in when checklist is complete', () => {
    const res = isSubmitDisabled({ ...base, checkInTs: '2025-01-01T00:00:00Z', checklist: checklistDone });
    expect(res).toBe(false);
  });

  it('disables when checklist is not complete', () => {
    const res = isSubmitDisabled({ ...base, checkInTs: '2025-01-01T00:00:00Z', checklist: checklistNotDone });
    expect(res).toBe(true);
  });

  it('disables when notes require ack but not acknowledged', () => {
    const res = isSubmitDisabled({ ...base, checkInTs: '2025-01-01T00:00:00Z', requiresAck: true, ack: false });
    expect(res).toBe(true);
  });

  it('enabled when notes require ack and are acknowledged', () => {
    const res = isSubmitDisabled({ ...base, checkInTs: '2025-01-01T00:00:00Z', requiresAck: true, ack: true });
    expect(res).toBe(false);
  });

  it('disables while submitting', () => {
    const res = isSubmitDisabled({ ...base, submitting: true, checkInTs: '2025-01-01T00:00:00Z' });
    expect(res).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AsyncStorage with an in-memory map
const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: async (k: string, v: string) => { store.set(k, v); },
    removeItem: async (k: string) => { store.delete(k); },
    multiRemove: async (keys: string[]) => { keys.forEach(k => store.delete(k)); },
  },
}));

// Mock submitVisit to control success/failure
vi.mock('../src/shared/api/client', () => ({
  submitVisit: vi.fn(async () => { throw new Error('network'); }),
}));

let enqueueSubmission: typeof import('../src/offlineQueue').enqueueSubmission;
let flushQueue: typeof import('../src/offlineQueue').flushQueue;
let getQueueStats: typeof import('../src/offlineQueue').getQueueStats;
let resetOfflineQueueStoreForTests: typeof import('../src/offlineQueue').resetOfflineQueueStoreForTests;

describe('offlineQueue', () => {
  beforeEach(async () => {
    store.clear();
    if (!enqueueSubmission) {
      const mod = await import('../src/offlineQueue');
      enqueueSubmission = mod.enqueueSubmission;
      flushQueue = mod.flushQueue;
      getQueueStats = mod.getQueueStats;
      resetOfflineQueueStoreForTests = mod.resetOfflineQueueStoreForTests;
    }
    resetOfflineQueueStoreForTests?.();
  });

  it('dedupes submissions by id:YYYY-MM-DD', async () => {
    await enqueueSubmission(123, { a: 1 });
    await enqueueSubmission(123, { a: 2 });
    const stats = await getQueueStats();
    expect(stats.pending).toBe(1);
  });

  it('backs off on failure and increments attempts', async () => {
    await enqueueSubmission(999, { foo: 'bar' });
    const res = await flushQueue('fake-token');
    expect(res.sent).toBe(0);
    const stats = await getQueueStats();
    expect(stats.pending).toBe(1);
    expect(stats.maxAttempts).toBeGreaterThanOrEqual(1);
    expect(typeof stats.oldestNextTryAt === 'string' || stats.oldestNextTryAt === undefined).toBe(true);
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { submitVisit } from '../api/client';

const KEY = 'offline_submissions_v2';

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  multiRemove: (keys: string[]) => Promise<void>;
};

const memoryStore = new Map<string, string>();
const memoryStorage: Storage = {
  getItem: async (key) => (memoryStore.has(key) ? memoryStore.get(key)! : null),
  setItem: async (key, value) => { memoryStore.set(key, value); },
  removeItem: async (key) => { memoryStore.delete(key); },
  multiRemove: async (keys) => { keys.forEach(k => memoryStore.delete(k)); },
};
const storage: Storage = typeof window === 'undefined' ? memoryStorage : AsyncStorage;

type QueueItem = {
  id: number;
  payload: any;
  enqueuedAt: string;
  // Sprint 9 additions
  idempotencyKey: string; // visitId:YYYY-MM-DD
  attempts: number;
  nextTryAt?: string; // ISO timestamp for backoff
  lastError?: string;
};

async function readQueue(): Promise<QueueItem[]> {
  const raw = await storage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as QueueItem[]; } catch { return []; }
}

async function writeQueue(items: QueueItem[]) {
  await storage.setItem(KEY, JSON.stringify(items));
}

function today(): string { return new Date().toISOString().slice(0,10); }

export async function enqueueSubmission(id: number, payload: any) {
  const items = await readQueue();
  const key = `${id}:${today()}`;
  // Dedupe: if an item with same idempotencyKey exists, replace payload but keep attempts/backoff
  const idx = items.findIndex(i => i.idempotencyKey === key);
  if (idx >= 0) {
    const prev = items[idx];
    items[idx] = {
      ...prev,
      id,
      payload,
      lastError: undefined,
    };
  } else {
    items.push({ id, payload, enqueuedAt: new Date().toISOString(), idempotencyKey: key, attempts: 0 });
  }
  await writeQueue(items);
}

export async function flushQueue(token: string): Promise<{ sent: number; remaining: number }> {
  let items = await readQueue();
  if (!items.length) return { sent: 0, remaining: 0 };
  const keep: QueueItem[] = [];
  let sent = 0;

  const now = Date.now();
  const backoff = (attempts: number) => {
    // 1s, 5s, 15s, 60s, 2m, max 5m
    const steps = [1000, 5000, 15000, 60000, 120000, 300000];
    return steps[Math.min(attempts, steps.length - 1)];
  };

  for (const item of items) {
    const waitUntil = item.nextTryAt ? new Date(item.nextTryAt).getTime() : 0;
    if (waitUntil && now < waitUntil) {
      keep.push(item);
      continue;
    }
    try {
      const res = await submitVisit(item.id, item.payload, token);
      // Treat either ok or idempotent ok as success
      if (res?.ok !== false) {
        sent += 1;
        continue;
      }
      // If response indicates failure, fall through to catch block
      throw new Error('submit failed');
    } catch (e: any) {
      const attempts = (item.attempts ?? 0) + 1;
      const delay = backoff(attempts);
      const msg = String(e?.message || '');
      // Permanent failures: 4xx (client errors) should not retry indefinitely
      const isPermanent = /^4\\d{2}\\b/.test(msg);
      if (isPermanent) {
        // Drop from queue; retain lastError only for optional future telemetry (not stored)
        // (Could surface a banner elsewhere if desired.)
        continue;
      }
      keep.push({ ...item, attempts, nextTryAt: new Date(now + delay).toISOString(), lastError: msg });
    }
  }
  await writeQueue(keep);
  return { sent, remaining: keep.length };
}

export async function getQueueStats(): Promise<{ pending: number; maxAttempts: number; oldestNextTryAt?: string; lastError?: string }> {
  const items = await readQueue();
  let maxAttempts = 0;
  let oldestNext: string | undefined;
  let lastError: string | undefined;
  for (const i of items) {
    if ((i.attempts ?? 0) > maxAttempts) maxAttempts = i.attempts ?? 0;
    if (i.nextTryAt && (!oldestNext || i.nextTryAt < oldestNext)) oldestNext = i.nextTryAt;
    if (i.lastError) lastError = i.lastError;
  }
  return { pending: items.length, maxAttempts, oldestNextTryAt: oldestNext, lastError };
}

export function resetOfflineQueueStoreForTests() {
  memoryStore.clear();
}

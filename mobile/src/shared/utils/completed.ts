import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'completed_visits_v1';
const KEY_PROGRESS = 'inprogress_visits_v1';
const KEY_DAY = 'visit_state_day_v1';

function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function ensureToday(): Promise<void> {
  try {
    const cur = await AsyncStorage.getItem(KEY_DAY);
    const t = today();
    if (cur !== t) {
      await AsyncStorage.multiRemove([KEY, KEY_PROGRESS]);
      await AsyncStorage.setItem(KEY_DAY, t);
    }
  } catch {}
}

export async function getCompleted(): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export async function addCompleted(id: number): Promise<void> {
  await ensureToday();
  const set = await getCompleted();
  set.add(id);
  await AsyncStorage.setItem(KEY, JSON.stringify(Array.from(set)));
}

export async function clearCompleted(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export async function getInProgress(): Promise<Set<number>> {
  await ensureToday();
  try {
    const raw = await AsyncStorage.getItem(KEY_PROGRESS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export async function addInProgress(id: number): Promise<void> {
  await ensureToday();
  const set = await getInProgress();
  set.add(id);
  await AsyncStorage.setItem(KEY_PROGRESS, JSON.stringify(Array.from(set)));
}

export async function removeInProgress(id: number): Promise<void> {
  await ensureToday();
  const set = await getInProgress();
  if (set.has(id)) set.delete(id);
  await AsyncStorage.setItem(KEY_PROGRESS, JSON.stringify(Array.from(set)));
}

export async function pruneToIds(ids: number[]): Promise<void> {
  await ensureToday();
  const allow = new Set(ids);
  const c = await getCompleted();
  const p = await getInProgress();
  const cNew = Array.from(c).filter((id) => allow.has(id));
  const pNew = Array.from(p).filter((id) => allow.has(id));
  await AsyncStorage.setItem(KEY, JSON.stringify(cNew));
  await AsyncStorage.setItem(KEY_PROGRESS, JSON.stringify(pNew));
}

// Dev-only helper: clear all local progress state (completed + in-progress)
export async function clearAllProgress(): Promise<void> {
  await AsyncStorage.multiRemove([KEY, KEY_PROGRESS]);
}

// Server-truth sync: replace local persistent sets with server-provided flags
export async function syncServerTruth(completedIds: number[], inProgressIds: number[]): Promise<void> {
  await ensureToday();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(Array.from(new Set(completedIds))));
    await AsyncStorage.setItem(KEY_PROGRESS, JSON.stringify(Array.from(new Set(inProgressIds))));
  } catch {}
}

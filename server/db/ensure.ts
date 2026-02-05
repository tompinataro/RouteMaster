import { dbQuery, hasDb } from '../db';

export async function ensureManagedPasswordColumn() {
  if (!hasDb()) return;
  await dbQuery('alter table users add column if not exists managed_password text');
}

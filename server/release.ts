import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

async function run() {
  if (process.env.SKIP_RELEASE_DB === '1' || /^(true|yes)$/i.test(process.env.SKIP_RELEASE_DB || '')) {
    console.log('SKIP_RELEASE_DB set; skipping DB setup.');
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('No DATABASE_URL set; skipping DB setup.');
    return;
  }
  // Heroku Postgres typically requires SSL; default to SSL in production
  const useSSL = (() => {
    try {
      const u = new URL(url);
      return process.env.PGSSLMODE === 'require' || process.env.NODE_ENV === 'production' || /amazonaws\.com$/.test(u.hostname);
    } catch {
      return true;
    }
  })();
  const pool = new Pool({
    connectionString: url,
    ssl: useSSL ? { rejectUnauthorized: false } : undefined,
  });
  try {
    const sqlDir = join(__dirname, 'sql');
    const schemaPath = join(sqlDir, 'schema.sql');
    const seedPath = join(sqlDir, 'seed.sql');
    if (!existsSync(schemaPath) || !existsSync(seedPath)) {
      console.log('SQL files not found in dist; skipping DB setup.');
      return;
    }
    const schema = readFileSync(schemaPath, 'utf8');
    const seed = readFileSync(seedPath, 'utf8');
    await pool.query(schema);
    await pool.query(seed);
    console.log('DB schema + seed applied');
  } finally {
    await pool.end();
  }
}

run().catch((e) => {
  if (process.env.ALLOW_RELEASE_DB_FAILURE === '1') {
    console.error('Release script error (ignored due to ALLOW_RELEASE_DB_FAILURE=1):', e);
    process.exit(0);
  }
  console.error('Release script failed:', e);
  process.exit(1);
});

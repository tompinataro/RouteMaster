import dotenv from 'dotenv';

dotenv.config();

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PROD = NODE_ENV === 'production';
export const IS_TEST = NODE_ENV === 'test';

export const JWT_SECRET = (() => {
  const raw = process.env.JWT_SECRET || '';
  if (!raw && IS_PROD) {
    throw new Error('JWT_SECRET is required in production.');
  }
  return raw || 'dev-secret-change-me';
})();

export const SMTP_URL = process.env.SMTP_URL || '';
export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;
export const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || (SMTP_PORT === 465);

export const REPORT_TIMEZONE = process.env.REPORT_TIMEZONE || 'America/Chicago';

export function getDemoEmail() {
  return (process.env.DEMO_EMAIL || 'demo@example.com').toLowerCase();
}

export function getDemoPassword() {
  return process.env.DEMO_PASSWORD || 'password';
}

export function getAdminEmail() {
  return (process.env.ADMIN_EMAIL || getDemoEmail()).toLowerCase();
}

export const PORT = Number(process.env.PORT) || 5100;
export const HOST = process.env.HOST || '0.0.0.0';

export const DATABASE_URL = process.env.DATABASE_URL || '';
export const PGSSLMODE = process.env.PGSSLMODE || '';

if (IS_PROD && !DATABASE_URL) {
  throw new Error('DATABASE_URL is required in production.');
}

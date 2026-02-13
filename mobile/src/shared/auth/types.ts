import type { LoginResponse } from '../api/client';

export type AuthState = {
  token: string | null;
  user: LoginResponse['user'] | null;
  loading: boolean;
  signIn: (email: string, password: string, odometerReading?: number | string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (options?: { reason?: string }) => Promise<{ ok: boolean; deleted?: boolean; requiresManualCleanup?: boolean }>;
};

export const AUTH_TOKEN_KEY = 'auth_token';
export const AUTH_USER_KEY = 'auth_user';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteAccount as apiDeleteAccount,
  login as apiLogin,
  LoginResponse,
  refresh as apiRefresh,
  postStartOdometer,
  setUnauthorizedHandler,
  setTokenRefreshedHandler,
} from '../api/client';
import { showBanner } from '../components/globalBannerBus';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY, AuthState } from './types';
import { sanitizeOdometerReading } from './utils';

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<LoginResponse['user'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, u] = await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(AUTH_USER_KEY),
        ]);
        if (t) setToken(t);
        if (u) setUser(JSON.parse(u));
        if (t) {
          try {
            const res = await apiRefresh(t);
            setToken(res.token);
            setUser(res.user);
            await AsyncStorage.setItem(AUTH_TOKEN_KEY, res.token);
            await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
          } catch {
            // ignore; user may be offline or token still fresh
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      try {
        showBanner({ type: 'error', message: 'Session expired - please sign in.' });
      } catch {}
      setToken(null);
      setUser(null);
      try {
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
        await AsyncStorage.removeItem(AUTH_USER_KEY);
      } catch {}
    });
    setTokenRefreshedHandler(async (newToken, newUser) => {
      try {
        setToken(newToken);
        if (newUser) setUser(newUser);
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken);
        if (newUser) await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
      } catch {}
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = async (email: string, password: string, odometerReading?: number | string) => {
    const res = await apiLogin(email, password);
    setToken(res.token);
    setUser(res.user);
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, res.token);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));

    const odoVal = sanitizeOdometerReading(odometerReading);
    if (odoVal !== null) {
      try {
        await postStartOdometer(res.token, odoVal);
      } catch (e: any) {
        console.error('[signIn] failed to post odometer', e);
      }
    }
  };

  const performSignOut = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(AUTH_USER_KEY);
  };

  const signOut = async () => {
    await performSignOut();
  };

  const deleteAccount: AuthState['deleteAccount'] = async (options) => {
    if (!token) throw new Error('Not authenticated');
    const result = await apiDeleteAccount(token, options);
    await performSignOut();
    return result;
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, signIn, signOut, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

if (typeof AppState !== 'undefined') {
  let lastState: AppStateStatus = AppState.currentState as AppStateStatus;
  AppState.addEventListener('change', async (state) => {
    try {
      if (state === 'active' && lastState !== 'active') {
        const t = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (t) {
          try {
            const res = await apiRefresh(t);
            await AsyncStorage.setItem(AUTH_TOKEN_KEY, res.token);
            await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
          } catch {
            // ignore; offline or token still valid
          }
        }
      }
    } finally {
      lastState = state;
    }
  });
}

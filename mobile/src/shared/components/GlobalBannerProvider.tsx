import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { BannerMsg, setBannerHandler } from './globalBannerBus';

type Ctx = { show: (msg: BannerMsg) => void; hide: () => void };
const C = createContext<Ctx | undefined>(undefined);

export function GlobalBannerProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<BannerMsg | null>(null);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const hide = useCallback(() => {
    if (timer) { clearTimeout(timer); setTimer(null); }
    setMsg(null);
  }, [timer]);

  const show = useCallback((m: BannerMsg) => {
    if (timer) { clearTimeout(timer); setTimer(null); }
    setMsg(m);
    const t = setTimeout(() => setMsg(null), m.durationMs ?? (m.type === 'error' ? 5000 : 2500));
    setTimer(t);
  }, [timer]);

  useEffect(() => {
    setBannerHandler(show);
    return () => setBannerHandler(null);
  }, [show]);

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  // Animate in/out when msg changes
  useEffect(() => {
    if (msg) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -60, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [msg]);

  return (
    <C.Provider value={value}>
      {children}
      <SafeAreaView edges={['top']} style={styles.safeTop}>
      <Animated.View
        pointerEvents={msg ? 'auto' : 'none'}
        style={[styles.banner,
          { transform: [{ translateY }], opacity },
          msg?.type === 'error' ? styles.error : msg?.type === 'success' ? styles.success : styles.info
        ]}
        accessibilityRole="text"
        accessibilityLabel={msg?.type === 'error' ? 'Error' : msg?.type === 'success' ? 'Saved' : 'Notice'}
      >
        {msg ? <Text style={styles.text}>{msg.message}</Text> : null}
      </Animated.View>
      </SafeAreaView>
    </C.Provider>
  );
}

export function useGlobalBanner() {
  const ctx = useContext(C);
  if (!ctx) throw new Error('useGlobalBanner must be used within GlobalBannerProvider');
  return ctx;
}

const styles = StyleSheet.create({
  safeTop: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 },
  banner: { left: 0, right: 0, paddingVertical: spacing(2), paddingHorizontal: spacing(4), borderBottomWidth: 1 },
  text: { textAlign: 'center', fontWeight: '600' },
  info: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  success: { backgroundColor: colors.successBg, borderColor: '#86efac' },
  error: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
});

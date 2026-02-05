import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/provider';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';
import { showBanner } from '../components/globalBannerBus';

export default function LoginLandingScreen() {
  const { signIn } = useAuth();
  const { width, height } = useWindowDimensions();
  const maxContentWidth = Math.min(width - spacing(6), 420);
  const contentWidth = Math.max(280, maxContentWidth);
  const isShort = height < 700;
  const logoSize = Math.min(contentWidth, Math.round(height * (isShort ? 0.34 : 0.4)));
  const verticalPad = isShort ? spacing(4) : spacing(6);
  const gap = isShort ? spacing(2) : spacing(3);
  const [email, setEmail] = useState('tom@pinataro.com');
  const [password, setPassword] = useState('');
  const [initialOdometer, setInitialOdometer] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    try {
      await signIn(email, password, initialOdometer.trim() || undefined);
      if (initialOdometer.trim()) {
        await AsyncStorage.setItem('dailyInitialOdometer', initialOdometer.trim());
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      showBanner({ type: 'error', message: `Login failed - ${msg}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { paddingVertical: verticalPad, gap }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustKeyboardInsets
        >
          <View style={[styles.content, { maxWidth: contentWidth }]}>
            <View style={[styles.logoFrame, { width: logoSize, height: logoSize }]}>
              <Text style={styles.logoText}>RouteMaster</Text>
              <Text style={styles.rightsText}>All Rights Reserved. ©️ 2026</Text>
            </View>
            <Text style={styles.heading}>The Field Tech&apos;s Favorite Dashboard</Text>
            <Text style={styles.subtitle}>A Tixpy App</Text>
            <View style={styles.inputsSection}>
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.muted}
                returnKeyType="next"
                autoComplete="email"
                textContentType="username"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={colors.muted}
                returnKeyType="next"
                onSubmitEditing={onSubmit}
                textContentType="oneTimeCode"
                autoComplete="off"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                keyboardType="numbers-and-punctuation"
                value={initialOdometer}
                onChangeText={setInitialOdometer}
                placeholder="Starting Odometer (optional)"
                placeholderTextColor={colors.muted}
                returnKeyType="next"
                autoComplete="off"
                autoCorrect={false}
                blurOnSubmit
              />
            </View>
          </View>
          <View style={[styles.footer, { maxWidth: contentWidth }]}>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <ThemedButton
                title="Log In"
                onPress={onSubmit}
                style={styles.halfWidthBtn}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  keyboardWrap: { flex: 1 },
  container: {
    flexGrow: 1,
    width: '100%',
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(4),
  },
  content: {
    width: '100%',
    alignItems: 'center',
    gap: spacing(2),
    justifyContent: 'center',
  },
  inputsSection: { width: '100%', gap: spacing(2) },
  logoFrame: {
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  logoText: { fontSize: 32, fontWeight: '900', color: colors.primary, letterSpacing: 0.5 },
  heading: { fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  rightsText: { position: 'absolute', bottom: 8, left: 12, right: 12, textAlign: 'center', fontSize: 11, color: colors.muted },
  footer: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  input: { width: '100%', borderColor: colors.border, color: colors.text, borderWidth: 1, padding: spacing(3), borderRadius: 8, backgroundColor: colors.card },
  halfWidthBtn: { alignSelf: 'center', width: '50%' },
});

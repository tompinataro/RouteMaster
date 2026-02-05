import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth/provider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoadingOverlay from '../components/LoadingOverlay';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';
import { showBanner } from '../components/globalBannerBus';

type Props = NativeStackScreenProps<RootStackParamList, 'LoginForm'>;

export default function LoginFormScreen(_props: Props) {
  const { signIn } = useAuth();
  const { width, height } = useWindowDimensions();
  const maxContentWidth = Math.min(width - spacing(6), 420);
  const contentWidth = Math.max(280, maxContentWidth);
  const isShort = height < 700;
  const logoSize = Math.min(contentWidth, Math.round(height * (isShort ? 0.26 : 0.3)));
  const paddingTop = isShort ? spacing(8) : spacing(12);
  const paddingBottom = isShort ? spacing(8) : spacing(10);
  const paddingHorizontal = isShort ? spacing(4) : spacing(6);
  const [email, setEmail] = useState('tom@pinataro.com');
  const [password, setPassword] = useState('');
  const [initialOdometer, setInitialOdometer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password, initialOdometer.trim() || undefined);
      if (initialOdometer.trim()) {
        await AsyncStorage.setItem('dailyInitialOdometer', initialOdometer.trim());
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      showBanner({ type: 'error', message: `Login failed - ${msg}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 160 : 0}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              maxWidth: contentWidth,
              paddingTop,
              paddingBottom,
              paddingHorizontal,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
          bounces={false}
        >
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
              keyboardType="decimal-pad"
              value={initialOdometer}
              onChangeText={setInitialOdometer}
              placeholder="Starting Odometer (optional)"
              placeholderTextColor={colors.muted}
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              autoComplete="off"
              autoCorrect={false}
              blurOnSubmit={false}
            />
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            {loading ? (
              <ActivityIndicator />
            ) : (
              <ThemedButton title="Log In" onPress={onSubmit} style={styles.fullWidthBtn} />
            )}
          </View>
          <View style={[styles.logoFrame, { width: logoSize, height: logoSize }]}>
            <Text style={styles.logoText}>RouteMaster</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
      <LoadingOverlay visible={loading} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeTop: { flex: 1 },
  content: { flexGrow: 1, width: '100%', alignItems: 'center', gap: spacing(2), justifyContent: 'space-between', alignSelf: 'center' },
  inputsSection: { width: '100%', gap: spacing(3) },
  logoFrame: {
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    overflow: 'hidden',
    marginTop: spacing(4),
  },
  logoText: { fontSize: 28, fontWeight: '900', color: colors.primary, letterSpacing: 0.5 },
  input: { width: '100%', borderColor: colors.border, color: colors.text, borderWidth: 1, padding: spacing(3), borderRadius: 8, backgroundColor: colors.card },
  fullWidthBtn: { alignSelf: 'stretch', marginTop: spacing(2) },
  error: { color: colors.danger, marginTop: spacing(2) },
});

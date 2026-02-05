import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, Linking, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { health, API_BASE } from '../api/client';
import Constants from 'expo-constants';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export default function AboutScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const version = (Constants?.expoConfig as any)?.version || 'dev';

  useEffect(() => {
    setLoading(true);
    health()
      .then((h) => setResult(`OK: ${h.message} (${API_BASE})`))
      .catch((e) => setResult(`ERROR: ${e.message}`))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>About RouteMaster</Text>
      <Text style={styles.sub}>App v{version}</Text>
      {loading ? <ActivityIndicator /> : <Text style={styles.body}>{result ?? 'No result yet'}</Text>}
      <View style={{ height: 8 }} />
      <Pressable onPress={() => Linking.openURL('https://example.com/support').catch(() => {})} accessibilityRole="link" accessibilityLabel="Open Support">
        <Text style={styles.link}>Support</Text>
      </Pressable>
      <Pressable onPress={() => Linking.openURL('https://example.com/privacy').catch(() => {})} accessibilityRole="link" accessibilityLabel="Open Privacy Policy">
        <Text style={styles.link}>Privacy Policy</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('DeleteAccount')} accessibilityRole="button" accessibilityLabel="Delete my account">
        <Text style={[styles.link, styles.dangerLink]}>Delete My Account</Text>
      </Pressable>
      <Button title="Back to Home" onPress={() => navigation.navigate('Home')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  sub: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  body: { fontSize: 14, marginBottom: 12 },
  link: { fontSize: 16, color: '#2563eb', fontWeight: '600', marginBottom: 8 },
  dangerLink: { color: '#dc2626' }
});

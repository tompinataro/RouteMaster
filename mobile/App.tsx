import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5001').replace(/\/$/, '');

export default function App() {
  const [lastPing, setLastPing] = useState<string | null>(null);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setLastPing(new Date().toLocaleTimeString());
      Alert.alert('Health', JSON.stringify(json));
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      Alert.alert('Health', msg);
    }
  };

  useEffect(() => {
    checkHealth().catch(() => {});
  }, []);

  return (
    <SafeAreaView>
      <View style={{ alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 48 }}>
        <Text style={{ fontSize: 20, marginBottom: 8 }}>RouteMaster</Text>
        <Text style={{ marginBottom: 8 }}>API: {API_BASE_URL}</Text>
        <Text style={{ marginBottom: 16 }}>
          {lastPing ? `Last ping: ${lastPing}` : 'Not pinged yet'}
        </Text>
        <Button title="Ping" onPress={checkHealth} />
        <StatusBar style="auto" />
      </View>
    </SafeAreaView>
  );
}

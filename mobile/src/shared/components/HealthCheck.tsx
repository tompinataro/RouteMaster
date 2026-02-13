import React, { useCallback, useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5001').replace(/\/$/, '');

export default function HealthCheck() {
  const [last, setLast] = useState<string | null>(null);

  const ping = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      const json = await res.json();
      setLast(new Date().toLocaleTimeString());
      Alert.alert('Health', JSON.stringify(json));
    } catch (err: any) {
      Alert.alert('Health', String(err?.message ?? err));
    }
  }, []);

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ marginBottom: 8 }}>API: {API_BASE_URL}</Text>
      <Text style={{ marginBottom: 16 }}>{last ? `Last ping: ${last}` : 'Not pinged yet'}</Text>
      <Button title="Ping" onPress={ping} />
    </View>
  );
}

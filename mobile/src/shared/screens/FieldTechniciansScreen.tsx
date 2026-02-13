import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Modal, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth/provider';
import { showBanner } from '../components/globalBannerBus';
import { adminCreateUser, adminSetUserPassword } from '../api/client';
import ThemedButton from '../components/Button';
import Card from '../components/Card';
import ListRow from '../components/ListRow';
import { colors, spacing } from '../theme';
import { truncateText } from '../utils/text';
import { generateTempPassword } from '../utils/passwords';
import { useFieldTechniciansData } from '../hooks/useFieldTechniciansData';

type Props = NativeStackScreenProps<RootStackParamList, 'FieldTechnicians'>;

export default function FieldTechniciansScreen({ route, navigation }: Props) {
  const { token } = useAuth();
  const showAll = route.params?.mode === 'all';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [lastTemp, setLastTemp] = useState<{ name: string; password: string } | null>(null);
  const { techUsers, serviceRoutes, load } = useFieldTechniciansData({ token });

  useEffect(() => {
    navigation.setOptions({
      title: showAll ? 'All Field Technicians' : 'Field Technicians',
      headerBackTitle: 'Back',
    });
  }, [navigation, showAll]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLastTemp(null);
      load();
    });
    return unsubscribe;
  }, [navigation, load]);

  const createTech = async () => {
    if (!token) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      showBanner({ type: 'error', message: 'Name and email are required.' });
      return;
    }
    setCreating(true);
    try {
      const trimmedPhone = phone.trim();
      const res = await adminCreateUser(token, {
        name: trimmedName,
        email: trimmedEmail,
        role: 'tech',
        phone: trimmedPhone || undefined,
      });
      if (res?.ok) {
        let temp = res.tempPassword;
        if (!temp || temp.length < 8) {
          temp = generateTempPassword(8);
          try {
            await adminSetUserPassword(token, { userId: res.user.id, newPassword: temp });
          } catch {}
        }
        setLastTemp({ name: res.user.name, password: temp });
        setName('');
        setEmail('');
        setPhone('');
        showBanner({ type: 'success', message: `Added ${res.user.name}. Share their temp password.` });
        await load();
      }
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to add field tech.' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {!showAll && (
        <Card style={styles.card}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={colors.muted}
          />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
          />
          <ThemedButton
            title={creating ? 'Adding...' : 'Add Field Tech'}
            onPress={createTech}
            disabled={creating}
          />
          {lastTemp ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                {formatPossessive(lastTemp.name)} temp pw = {lastTemp.password}
              </Text>
            </View>
          ) : null}
        </Card>
      )}
      <Card style={styles.card}>
        <Text style={styles.subTitle}>Current Field Techs</Text>
        {techUsers.length === 0 ? (
          <Text style={styles.emptyCopy}>No field techs yet.</Text>
        ) : (
          <ScrollView
            style={showAll ? styles.listScrollFull : styles.listScroll}
            contentContainerStyle={styles.listScrollContent}
          >
            {techUsers.map(user => (
              <ListRow key={user.id} style={styles.listRow}>
                <View>
                  <Text style={styles.listName}>
                    {truncateText(user.name, 22)} ({user.managed_password || user.email?.split('@')[0] || 'temp'})
                  </Text>
                  <Text style={styles.listEmail}>{user.email}</Text>
                  {user.phone ? <Text style={styles.listEmail}>{user.phone}</Text> : null}
                  {(() => {
                    const assigned = serviceRoutes.filter(r => r.user_id === user.id).map(r => r.name);
                    if (assigned.length) {
                      return <Text style={styles.routeAssigned}>{`Assigned Route: ${assigned.join(', ')}`}</Text>;
                    }
                    return <Text style={styles.routeNone}>No route assigned yet.</Text>;
                  })()}
                </View>
              </ListRow>
            ))}
          </ScrollView>
        )}
      </Card>
    </ScrollView>
  );
}

function formatPossessive(name?: string | null) {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  return /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
}

const styles = StyleSheet.create({
  container: { padding: spacing(4), gap: spacing(3) },
  card: { gap: spacing(1) },
  subTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    color: colors.text,
    backgroundColor: colors.card,
  },
  notice: { marginTop: spacing(2), padding: spacing(2), backgroundColor: '#ecfdf5', borderRadius: 10, borderWidth: 1, borderColor: '#6ee7b7' },
  noticeText: { color: '#047857', fontWeight: '600' },
  listRow: { paddingTop: spacing(1.5), paddingVertical: 0 },
  listName: { fontWeight: '600', color: colors.text },
  listEmail: { color: colors.muted },
  routeNone: { color: colors.muted, fontSize: 12 },
  routeAssigned: { color: colors.primary, fontWeight: '600', marginTop: spacing(0.5) },
  emptyCopy: { color: colors.muted },
  listScroll: { maxHeight: 320 },
  listScrollFull: { maxHeight: undefined },
  listScrollContent: { paddingVertical: spacing(1), gap: spacing(1) },
});

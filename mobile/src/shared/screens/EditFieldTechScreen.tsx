import React, { useState } from 'react';
import { Alert, View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../auth/provider';
import { adminUpdateUser, adminDeleteUser } from '../api/client';
import { showBanner } from '../components/globalBannerBus';
import ThemedButton from '../components/Button';

export default function EditFieldTechScreen({ route, navigation }: any) {
  const { user } = route.params || {};
  const { token } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [password, setPassword] = useState(user?.managed_password ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onSave() {
    if (!token || !user?.id) {
      navigation.goBack();
      return;
    }
    if (password && password.trim().length > 0 && password.trim().length < 8) {
      return;
    }
    try {
      setSaving(true);
      await adminUpdateUser(token, user.id, {
        name,
        email,
        phone,
        managed_password: password ? password.trim() : undefined,
      });
      navigation.goBack();
    } catch (e) {
    } finally {
      setSaving(false);
    }
  }

  const confirmDelete = () => {
    if (!token || !user?.id) return;
    const handleDelete = async () => {
      setDeleting(true);
      try {
        await adminDeleteUser(token, user.id);
        showBanner({ type: 'success', message: 'Field tech deleted.' });
        navigation.goBack();
      } catch (e: any) {
        showBanner({ type: 'error', message: e?.message || 'Unable to delete field tech.' });
      } finally {
        setDeleting(false);
      }
    };
    if (Platform.OS === 'web') {
      const ok = window.confirm('Are you sure you want to delete this Field Technician?');
      if (ok) {
        handleDelete();
      }
      return;
    }
    Alert.alert(
      'Delete Field Technician',
      'Are you sure you want to delete this Field Technician?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', style: 'destructive', onPress: handleDelete },
      ]
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing(3), gap: spacing(2) }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing(1) }}>Edit Field Tech</Text>

        <View style={{ gap: spacing(1) }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Name</Text>
          <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.muted} />
        </View>

        <View style={{ gap: spacing(1) }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Email</Text>
          <TextInput style={inputStyle} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" />
        </View>

        <View style={{ gap: spacing(1) }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Phone</Text>
          <TextInput style={inputStyle} value={phone} onChangeText={setPhone} placeholder="612-555-1234" placeholderTextColor={colors.muted} keyboardType="phone-pad" />
        </View>

        <View style={{ gap: spacing(1) }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Password</Text>
          <TextInput style={inputStyle} value={password} onChangeText={setPassword} />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing(2), marginTop: spacing(2) }}>
          <ThemedButton title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => navigation.goBack()} />
          <ThemedButton title={saving ? 'Saving…' : 'Save'} style={{ flex: 1 }} onPress={onSave} disabled={saving} />
        </View>
        <ThemedButton
          title={deleting ? 'Deleting…' : 'Delete'}
          variant="outline"
          onPress={confirmDelete}
          disabled={deleting}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
  paddingVertical: spacing(1.25),
  paddingHorizontal: spacing(2),
  fontSize: 16,
  color: colors.text,
  backgroundColor: colors.background,
} as const;

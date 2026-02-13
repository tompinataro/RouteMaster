import React, { useCallback, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth/provider';
import Card from '../components/Card';
import { colors } from '../theme';
import { showBanner } from '../components/globalBannerBus';

type Props = NativeStackScreenProps<RootStackParamList, 'DeleteAccount'>;

export default function DeleteAccountScreen({ navigation }: Props) {
  const { deleteAccount, user } = useAuth();
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      'Delete account?',
      'This will permanently remove your account and related data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              const reason = feedback.trim() || undefined;
              const result = await deleteAccount({ reason });
              showBanner({ type: 'success', message: 'Account deleted successfully.' });
              if (result?.requiresManualCleanup) {
                showBanner({
                  type: 'info',
                  message: 'Local data cleared. Contact support if you need further confirmation.'
                });
              }
            } catch (err: any) {
              const message = err?.message ? String(err.message) : 'Unable to delete account right now.';
              showBanner({ type: 'error', message });
              setSubmitting(false);
            }
          }
        }
      ],
      { cancelable: true }
    );
  }, [deleteAccount, feedback]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.card}>
          <Text style={styles.title}>Delete Account</Text>
          <Text style={styles.body}>
            Deleting your account will permanently remove your profile, assigned routes, and related activity from
            RouteMaster. This action cannot be undone.
          </Text>
          <Text style={styles.body}>
            To continue, you can optionally tell us why you{'\''}re leaving. Your current account
            {user?.email ? ` (${user.email})` : ''} will be removed immediately after you confirm.
          </Text>
          <TextInput
            multiline
            accessibilityLabel="Share feedback (optional)"
            placeholder="Share feedback (optional)"
            style={styles.input}
            value={feedback}
            onChangeText={setFeedback}
            editable={!submitting}
            maxLength={500}
          />
          <View style={styles.actions}>
            <Text style={styles.warning}>This is permanent. Please confirm below to delete your account.</Text>
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={confirmDelete}
              style={({ pressed }) => [
                styles.deleteButton,
                submitting && styles.deleteButtonDisabled,
                pressed && !submitting && styles.deleteButtonPressed
              ]}
            >
              <Text style={styles.deleteButtonLabel}>{submitting ? 'Deleting…' : 'Delete my account'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.secondaryButton}>
              <Text style={styles.secondary}>Cancel</Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: colors.background
  },
  card: {
    padding: 20,
    borderColor: '#d1d5db',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 0
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    color: colors.text
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
    color: '#374151'
  },
  input: {
    minHeight: 96,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#9ca3af',
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 16,
    backgroundColor: '#fff'
  },
  actions: {
    marginTop: 24,
    alignItems: 'stretch'
  },
  warning: {
    fontSize: 14,
    color: '#b91c1c',
    fontWeight: '600',
    marginBottom: 12
  },
  deleteButton: {
    borderRadius: 8,
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  deleteButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff'
  },
  deleteButtonPressed: {
    opacity: 0.85
  },
  deleteButtonDisabled: {
    backgroundColor: '#ef4444'
  },
  secondaryButton: {
    borderRadius: 8,
    paddingVertical: 12
  },
  secondary: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center'
  }
});

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Switch, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth/provider';
import LoadingOverlay from '../components/LoadingOverlay';
import ThemedButton from '../components/Button';
import Banner from '../components/Banner';
import { colors, spacing } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isSubmitDisabled } from '../../logic/gates';
import { formatTime } from '../utils/time';
import { useVisitDetailData } from '../hooks/useVisitDetailData';

type Props = NativeStackScreenProps<RootStackParamList, 'VisitDetail'>;

export default function VisitDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { token } = useAuth();
  const isWeb = Platform.OS === 'web';
  const headerHeight = useHeaderHeight();
  const setTitle = useCallback((title: string) => navigation.setOptions({ title }), [navigation]);
  const {
    visit,
    loading,
    submitting,
    submitError,
    timelyInstruction,
    setTimelyInstruction,
    ack,
    setAck,
    checkInTs,
    checkOutTs,
    noteToOffice,
    setNoteToOffice,
    onSiteContact,
    setOnSiteContact,
    odometerReading,
    setOdometerReading,
    requiresAck,
    toggleChecklistItem,
    handleCheckIn,
    handleSubmit,
  } = useVisitDetailData({
    id,
    token,
    setTitle,
    locationProvider: isWeb ? undefined : Location,
    persistCheckInLocation: !isWeb,
  });

  const onSubmitPress = useCallback(async () => {
    const result = await handleSubmit();
    if (result === 'online') {
      navigation.navigate('RouteList', { saved: true });
    } else if (result === 'offline') {
      navigation.navigate('RouteList', { savedOffline: true });
    }
  }, [handleSubmit, navigation]);

  if (loading && !visit) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!visit) return <View style={styles.center}><Text>Visit not found</Text></View>;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight + 12 : 0}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingBottom: spacing(6) }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.content}>
          {submitError ? <Banner type="error" message={submitError} /> : null}
          <Text style={styles.sectionTitle}>Timely Notes</Text>
          <View style={styles.timelyCard}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }} />
              {requiresAck ? (
                <View style={styles.ackInline}>
                  <Text style={styles.ackLabel}>Acknowledge</Text>
                  <Switch style={styles.ackSwitch} value={ack} onValueChange={setAck} />
                </View>
              ) : null}
            </View>
            <Text style={[requiresAck ? styles.timelyCopy : styles.timelyPlaceholder, styles.timelyText]}>
              {requiresAck ? timelyInstruction : 'Any notes from the office will appear here.'}
            </Text>
          </View>
          <View style={styles.checkInWrap}>
            <ThemedButton
              title={checkInTs ? 'Checked In' : 'Check In'}
              onPress={handleCheckIn}
              style={styles.checkInBtn}
            />
            <Text style={styles.timeText}>{checkInTs ? formatTime(checkInTs) : '--'}</Text>
          </View>
          <View style={styles.checklistCard}>
            {visit.checklist.map((item, idx) => {
              const taskLabel = `Task ${idx + 1}`;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.row, idx === visit.checklist.length - 1 ? styles.rowLast : null]}
                  activeOpacity={0.7}
                  onPress={() => toggleChecklistItem(item.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle ${taskLabel}`}
                  accessibilityState={{ checked: item.done }}
                  hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                >
                  <Text style={styles.label}>{taskLabel}</Text>
                  <TouchableOpacity
                    accessibilityRole="switch"
                    accessibilityState={{ checked: item.done }}
                    onPress={() => toggleChecklistItem(item.key)}
                    style={styles.switchShell}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <View style={[styles.switchTrack, item.done && styles.switchTrackOn]}>
                      <View style={[
                        styles.switchThumb,
                        item.done ? styles.switchThumbOn : styles.switchThumbOff
                      ]} />
                    </View>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionTitle}>On-site Contact Name</Text>
            <TextInput
              style={styles.textInput}
              value={onSiteContact}
              onChangeText={setOnSiteContact}
              placeholder="Check-in during each visit, enter name here."
              placeholderTextColor={colors.muted}
              accessibilityLabel="On-site contact"
              returnKeyType={isWeb ? 'done' : 'next'}
              blurOnSubmit
            />
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Tech Visit Notes</Text>
          </View>
          <TextInput
            style={styles.notes}
            multiline
            numberOfLines={1}
            value={noteToOffice}
            onChangeText={setNoteToOffice}
            placeholder="Optional notes from the field to the office."
            placeholderTextColor={colors.muted}
          />
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionTitle}>Odometer Reading</Text>
            <TextInput
              style={styles.textInput}
              value={odometerReading}
              onChangeText={setOdometerReading}
              placeholder="Enter current mileage"
              placeholderTextColor={colors.muted}
              keyboardType={isWeb ? 'number-pad' : 'numbers-and-punctuation'}
              accessibilityLabel="Odometer reading"
              returnKeyType={isWeb ? 'done' : 'next'}
              blurOnSubmit
            />
          </View>
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.stickyBar}>
        <ThemedButton
          title={submitting ? 'Submitting...' : 'Check Out & Complete Visit'}
          onPress={onSubmitPress}
          disabled={isSubmitDisabled({ submitting, checkInTs, requiresAck, ack, checklist: visit?.checklist || [] })}
          style={styles.submitBtn}
        />
      </SafeAreaView>
      <LoadingOverlay visible={loading || submitting} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: spacing(4) },
  content: { width: '100%', maxWidth: 360, alignSelf: 'center', gap: spacing(3) },
  checklistCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card, paddingVertical: spacing(1.2) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing(1.8), borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing(4) },
  rowLast: { borderBottomWidth: 0 },
  label: { fontSize: 16, color: colors.text },
  notes: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card, borderWidth: 1, borderRadius: 8, paddingVertical: spacing(1.5), paddingHorizontal: spacing(3), minHeight: 52, textAlignVertical: 'top', fontSize: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing(2) },
  nameRow: { alignItems: 'center', marginBottom: spacing(1) },
  clientName: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ackInline: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), flexShrink: 0, marginTop: spacing(2) },
  ackLabel: { color: colors.text, fontSize: 17 },
  ackSwitch: { transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] },
  ackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing(3), borderBottomColor: colors.border, borderBottomWidth: 1 },
  timelyCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: spacing(3), paddingTop: spacing(1), paddingBottom: spacing(2), gap: spacing(1.25) },
  timelyCopy: { color: colors.text, fontSize: 16, lineHeight: 22 },
  timelyPlaceholder: { color: colors.muted, fontSize: 16 },
  timelyText: { paddingHorizontal: spacing(0.5), lineHeight: 20, marginTop: spacing(0.25) },
  submitBtn: { alignSelf: 'center', minWidth: 240, maxWidth: 360 },
  stickyBar: { padding: spacing(3), paddingBottom: spacing(3.5), backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing(3) },
  checkInWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(3), paddingVertical: spacing(2) },
  checkInBtn: { minWidth: 220 },
  timeText: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  fieldGroup: { width: '100%', maxWidth: 360, gap: spacing(1) },
  textInput: {
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    fontSize: 16,
  },
  switchShell: { paddingVertical: spacing(0.25), paddingHorizontal: spacing(0.25) },
  switchTrack: {
    width: 36,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchTrackOn: { backgroundColor: colors.primary },
  switchThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  switchThumbOn: { alignSelf: 'flex-end' },
  switchThumbOff: { alignSelf: 'flex-start' },
});

import React from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Linking, Share, Platform } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth/provider';
import ThemedButton from '../components/Button';
import Card from '../components/Card';
import { colors, spacing } from '../theme';
import { showBanner } from '../components/globalBannerBus';
import { adminFetchReportSummary, adminSendReport } from '../api/client';
import { truncateText } from '../utils/text';
import { formatTime } from '../utils/time';
import { useReportsData } from '../hooks/useReportsData';
import {
  buildRangeLabel,
  buildSummaryLines,
  formatCompactDate,
  formatShortDateInput,
  parseShortDate,
  REPORT_FREQUENCIES,
  FrequencyValue,
} from '../utils/reportFormat';

type Props = NativeStackScreenProps<RootStackParamList, 'Reports'>;

export default function ReportsScreen(_props: Props) {
  const { token, user } = useAuth();
  const isWeb = Platform.OS === 'web';
  const {
    recipients,
    updateRecipient,
    addRecipient,
    removeRecipient,
    previewFrequency,
    setPreviewFrequency,
    summary,
    rangeText,
    loadingSummary,
    sending,
    setSending,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    isCustom,
    fetchSummary,
  } = useReportsData({ token, userEmail: user?.email ?? null });

  const sendReport = async () => {
    if (!token) return;
    const cleaned = recipients
      .map(rec => ({ ...rec, email: rec.email.trim() }))
      .filter(rec => !!rec.email);
    if (!cleaned.length) {
      showBanner({ type: 'error', message: 'Add at least one recipient email.' });
      return;
    }
    if (isCustom) {
      const startIso = parseShortDate(customStartDate);
      const endIso = parseShortDate(customEndDate);
      if (!startIso || !endIso) {
        showBanner({ type: 'error', message: 'Enter start/end as MM/DD/YY for custom range.' });
        return;
      }
      setSending(true);
      try {
        if (isWeb) {
          await adminSendReport(token, {
            frequency: 'custom',
            emails: cleaned.map(r => r.email),
            startDate: `${startIso}T00:00:00`,
            endDate: `${endIso}T23:59:59`,
          });
          showBanner({ type: 'success', message: 'Report email(s) sent.' });
        } else {
          const res = await adminFetchReportSummary(token, {
            frequency: 'custom',
            startDate: `${startIso}T00:00:00`,
            endDate: `${endIso}T23:59:59`,
          });
          const rows = res.rows || [];
          const rangeLabel = buildRangeLabel(res.range, 'custom', startIso, endIso);
          const summaryLines = buildSummaryLines(rows);
          const subject = 'Field Tech Summary (Custom)';
          const body = `Range: ${rangeLabel}\nFrequency: custom\n\n${summaryLines.join('\n')}\n\nGenerated from RouteMaster.`;
          if (await MailComposer.isAvailableAsync()) {
            await MailComposer.composeAsync({ subject, body, recipients: cleaned.map(r => r.email) });
          } else {
            const mailto = `mailto:${encodeURIComponent(cleaned.map(r => r.email).join(','))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            const canMail = await Linking.canOpenURL(mailto);
            if (canMail) {
              await Linking.openURL(mailto);
            } else {
              await Share.share({ title: subject, message: body });
            }
          }
          showBanner({ type: 'success', message: 'Report email started (sent via Mail/share).' });
        }
      } catch (err: any) {
        showBanner({ type: 'error', message: err?.message || 'Unable to send report.' });
      } finally {
        setSending(false);
      }
      return;
    }
    const grouped = cleaned.reduce<Record<string, string[]>>((acc, rec) => {
      if (!acc[rec.frequency]) acc[rec.frequency] = [];
      acc[rec.frequency].push(rec.email);
      return acc;
    }, {});
    const entries = Object.entries(grouped);
    if (!entries.length) {
      showBanner({ type: 'error', message: 'Add at least one recipient email.' });
      return;
    }
    setSending(true);
    try {
      for (const [freq, emails] of entries) {
        if (!emails.length) continue;
        if (isWeb) {
          await adminSendReport(token, { frequency: freq, emails });
          continue;
        }
        const subject = `Field Tech Summary (${freq})`;
        const res = await adminFetchReportSummary(token, { frequency: freq });
        const rows = res.rows || [];
        const rangeLabel = buildRangeLabel(res.range, freq as FrequencyValue);
        const summaryLines = buildSummaryLines(rows);
        const body = `Range: ${rangeLabel}\nFrequency: ${freq}\n\n${summaryLines.join('\n')}\n\nGenerated from RouteMaster.`;
        const mailto = `mailto:${encodeURIComponent(emails.join(','))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        if (await MailComposer.isAvailableAsync()) {
          await MailComposer.composeAsync({ subject, body, recipients: emails });
          continue;
        }
        const canMail = await Linking.canOpenURL(mailto);
        if (canMail) {
          await Linking.openURL(mailto);
          continue;
        }
        await Share.share({ title: subject, message: body });
      }
      showBanner({ type: 'success', message: isWeb ? 'Report email(s) sent.' : 'Report email started (sent via Mail/share).' });
    } catch (err: any) {
      try {
        const summaryLines = buildSummaryLines(summary);
        const subject = 'Field Summary Report';
        const body = `Range: ${rangeText}\nFrequency: ${previewFrequency}\n\n${summaryLines.join('\n')}`;
        const mailto = `mailto:${encodeURIComponent(cleaned.map(r => r.email).join(','))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        if (!isWeb && await MailComposer.isAvailableAsync()) {
          await MailComposer.composeAsync({ subject, body, recipients: cleaned.map(r => r.email) });
          showBanner({ type: 'info', message: 'Opened mail composer since server email failed.' });
        } else if (await Linking.canOpenURL(mailto)) {
          await Linking.openURL(mailto);
          showBanner({ type: 'info', message: 'Opened mail client since server email failed.' });
        } else {
          showBanner({ type: 'error', message: err?.message || 'Unable to send report.' });
        }
      } catch {
        showBanner({ type: 'error', message: err?.message || 'Unable to send report.' });
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card>
        <Text style={styles.heading}>Summary Report Generator</Text>
        <Text style={styles.label}>Recipients</Text>
        <View style={styles.recipientStack}>
          {recipients.map(rec => (
            <View key={rec.id} style={styles.recipientRow}>
              <TextInput
                style={styles.recipientInput}
                value={rec.email}
                onChangeText={text => updateRecipient(rec.id, { email: text })}
                placeholder="admin@example.com"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Pressable style={styles.removeRecipient} onPress={() => removeRecipient(rec.id)}>
                <Text style={styles.removeRecipientText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <ThemedButton title="Add Recipient" variant="outline" onPress={addRecipient} />

        <Text style={styles.label}>Report Date Range</Text>
        <View style={styles.frequencyRow}>
          {REPORT_FREQUENCIES.map(freq => (
            <Pressable
              key={freq.value}
              style={[styles.frequencyBtn, previewFrequency === freq.value && styles.frequencyBtnActive]}
              onPress={() => setPreviewFrequency(freq.value as FrequencyValue)}
            >
              <Text style={[styles.frequencyText, previewFrequency === freq.value && styles.frequencyTextActive]}>
                {freq.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {isCustom ? (
          <View style={styles.customRangeRow}>
            <TextInput
              style={styles.customInput}
              value={customStartDate}
              onChangeText={(text) => setCustomStartDate(formatShortDateInput(text))}
              placeholder="MM/DD/YY"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.customInput}
              value={customEndDate}
              onChangeText={(text) => setCustomEndDate(formatShortDateInput(text))}
              placeholder="MM/DD/YY"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
          </View>
        ) : null}
        <Text style={styles.rangeText}>Range: {rangeText}</Text>
        <View style={styles.actionRow}>
          <ThemedButton
            title={loadingSummary ? 'Loading…' : 'Refresh Preview'}
            onPress={fetchSummary}
            disabled={loadingSummary}
            style={styles.actionButton}
          />
          <ThemedButton
            title={sending ? 'Sending…' : 'Email Report'}
            onPress={sendReport}
            disabled={sending}
            style={[styles.actionButton, styles.sendBtn]}
          />
        </View>
      </Card>
      <Card>
        <Text style={styles.heading}>Summary Report Preview</Text>
        {summary.length === 0 ? (
          <Text style={styles.muted}>{loadingSummary ? 'Loading…' : 'No visits recorded for this range.'}</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                <Text numberOfLines={1} style={[styles.cell, styles.technician, styles.headerCell]}>Technician</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.route, styles.headerCell]}>Route</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.date, styles.headerCell]}>Date</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.client, styles.headerCell]}>Client</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.notes, styles.headerCell]}>Notes</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.address, styles.headerCell]}>Address</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.checkIn, styles.headerCell]}>Check-In</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.checkOut, styles.headerCell]}>Check-Out</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.duration, styles.headerCell]}>Duration</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.mileage, styles.headerCell]}>Mileage</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.contact, styles.headerCell]}>Contact</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.geoValid, styles.headerCell]}>Geo Valid</Text>
              </View>
              {summary.map((item, index) => {
                if (item.rowType === 'spacer') {
                  return <View key={`spacer-${index}`} style={styles.spacerRow} />;
                }
                const isTotal = item.rowType === 'total';
                return (
                  <View key={`${item.techId}-${item.clientName}-${index}`} style={styles.tableRow}>
                    <Text numberOfLines={1} style={[styles.cell, styles.technician, isTotal ? styles.totalText : null]}>{truncateText(item.techName, 14)}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.route, isTotal ? styles.totalText : null]}>{item.routeName || ''}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.date, isTotal ? styles.totalText : null]}>{isTotal ? '' : formatCompactDate(item.visitDate)}</Text>
                    <View style={[styles.clientCell]}>
                      <Text numberOfLines={1} style={[styles.clientText, isTotal ? styles.totalText : null, { fontSize: 12 }]}>{truncateText(item.clientName, 18)}</Text>
                    </View>
                    <Text numberOfLines={1} style={[styles.cell, styles.notes, isTotal ? styles.totalText : null]}>{isTotal ? '' : truncateText(item.techNotes || '—', 16)}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.address, isTotal ? styles.totalText : null]}>{isTotal ? '' : truncateText(item.address, 20)}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.checkIn, { fontSize: 11 }]}>{isTotal ? '' : formatTime(item.checkInTs)}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.checkOut, { fontSize: 11 }]}>{isTotal ? '' : formatTime(item.checkOutTs)}</Text>
                    <Text numberOfLines={1} style={[
                      styles.cell,
                      styles.duration,
                      item.durationFlagged ? styles.warnText : null,
                    ]}>{isTotal ? '' : item.durationLabel}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.mileage, isTotal ? styles.totalText : null]}>{item.mileage?.toFixed?.(1) ?? item.mileage}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.contact, isTotal ? styles.totalText : null]}>{isTotal ? '' : truncateText(item.contactName || '—', 16)}</Text>
                    <Text numberOfLines={1} style={[
                      styles.cell,
                      styles.geoValid,
                      item.geoValidated === false ? styles.warnText : null,
                    ]}>{isTotal ? '' : (item.geoValidated === true ? 'Yes' : item.geoValidated === false ? 'No' : '—')}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(4), gap: spacing(4) },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing(2) },
  label: { fontSize: 14, color: colors.text, fontWeight: '600', marginBottom: spacing(1) },
  recipientStack: { gap: spacing(1), marginBottom: spacing(2) },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  recipientInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing(2), paddingVertical: spacing(1.5), backgroundColor: colors.card, color: colors.text },
  removeRecipient: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  removeRecipientText: { fontSize: 20, color: colors.primary },
  frequencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), marginBottom: spacing(1) },
  frequencyBtn: { paddingVertical: spacing(0.75), paddingHorizontal: spacing(2), borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  frequencyBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  frequencyText: { fontSize: 13, color: colors.text },
  frequencyTextActive: { color: colors.buttonText, fontWeight: '700' },
  customRangeRow: { flexDirection: 'row', gap: spacing(1.5), marginBottom: spacing(1) },
  customInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing(2), paddingVertical: spacing(1.5), backgroundColor: colors.card, color: colors.text },
  rangeText: { color: colors.muted, marginBottom: spacing(2) },
  actionRow: { flexDirection: 'row', gap: spacing(2) },
  actionButton: { flex: 1 },
  sendBtn: {},
  muted: { color: colors.muted, fontSize: 14 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(1), borderBottomWidth: 1, borderBottomColor: colors.border },
  tableHeaderRow: { backgroundColor: colors.card, borderRadius: 6, borderBottomWidth: 0, marginBottom: spacing(1) },
  cell: { paddingHorizontal: spacing(1), fontSize: 12, color: colors.text },
  headerCell: { fontWeight: '700' },
  technician: { width: 120 },
  route: { width: 80 },
  date: { width: 60 },
  client: { width: 120 },
  notes: { width: 140 },
  address: { width: 160 },
  checkIn: { width: 64 },
  checkOut: { width: 64 },
  duration: { width: 70 },
  mileage: { width: 70 },
  contact: { width: 110 },
  geoValid: { width: 70 },
  clientCell: { width: 120 },
  clientText: { color: colors.text },
  spacerRow: { height: spacing(2) },
  totalText: { fontWeight: '700' },
  warnText: { color: colors.error, fontWeight: '700' },
});

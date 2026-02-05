import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetchReportSummary, ReportSummaryRow } from '../api/client';
import { showBanner } from '../components/globalBannerBus';
import { flushQueue, getQueueStats } from '../utils/offlineQueue';
import { buildRangeLabel, parseShortDate, todayShortDate, FrequencyValue } from '../utils/reportFormat';

type RecipientTarget = {
  id: string;
  email: string;
  frequency: FrequencyValue;
};

const newRecipient = (): RecipientTarget => ({
  id: `rec-${Math.random().toString(36).slice(2)}-${Date.now()}`,
  email: '',
  frequency: 'weekly',
});

type Options = {
  token?: string | null;
  userEmail?: string | null;
};

export function useReportsData(options: Options) {
  const { token, userEmail } = options;
  const [recipients, setRecipients] = useState<RecipientTarget[]>([newRecipient()]);
  const [previewFrequency, setPreviewFrequency] = useState<FrequencyValue>('weekly');
  const [summary, setSummary] = useState<ReportSummaryRow[]>([]);
  const [rangeText, setRangeText] = useState('—');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [sending, setSending] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const isCustom = previewFrequency === 'custom';

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    setLoadingSummary(true);
    try {
      try {
        const { sent, remaining } = await flushQueue(token);
        if (sent > 0) {
          showBanner({ type: 'info', message: `Synced ${sent} offline visit${sent > 1 ? 's' : ''} before refresh.` });
        } else if (remaining > 0) {
          const stats = await getQueueStats();
          if (stats.maxAttempts >= 3) {
            showBanner({ type: 'info', message: `Retrying ${remaining} queued visit${remaining > 1 ? 's' : ''} in background.` });
          }
        }
      } catch {}
      const customStartIso = parseShortDate(customStartDate);
      const customEndIso = parseShortDate(customEndDate);
      if (isCustom && (!customStartIso || !customEndIso)) {
        showBanner({ type: 'error', message: 'Enter start/end as MM/DD/YY for custom range.' });
        return;
      }
      const customStart = customStartIso ? `${customStartIso}T00:00:00` : undefined;
      const customEnd = customEndIso ? `${customEndIso}T23:59:59` : undefined;
      const res = await adminFetchReportSummary(token, {
        frequency: previewFrequency,
        startDate: customStart,
        endDate: customEnd,
      });
      setSummary(res.rows || []);
      setRangeText(buildRangeLabel(res.range, previewFrequency, customStartIso, customEndIso));
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to fetch report.' });
    } finally {
      setLoadingSummary(false);
    }
  }, [token, previewFrequency, customStartDate, customEndDate, isCustom]);

  useEffect(() => {
    if (!token) return;
    if (!isCustom) {
      fetchSummary();
      return;
    }
    const startOk = !!parseShortDate(customStartDate);
    const endOk = !!parseShortDate(customEndDate);
    if (startOk && endOk) {
      fetchSummary();
    }
  }, [token, previewFrequency, customStartDate, customEndDate, isCustom, fetchSummary]);

  useEffect(() => {
    if (!isCustom) return;
    if (!customStartDate && !customEndDate) {
      const today = todayShortDate();
      setCustomStartDate(today);
      setCustomEndDate(today);
    }
  }, [isCustom, customStartDate, customEndDate]);

  useEffect(() => {
    if (!userEmail) return;
    setRecipients((prev) => {
      const existing = prev.map((r) => r.email.toLowerCase());
      if (existing.includes(userEmail.toLowerCase())) return prev;
      const next = [...prev];
      if (next.length && next[0].email.trim() === '') {
        next[0] = { ...next[0], email: userEmail };
        return next;
      }
      return [{ ...newRecipient(), email: userEmail }, ...next];
    });
  }, [userEmail]);

  const updateRecipient = useCallback((id: string, patch: Partial<RecipientTarget>) => {
    setRecipients(prev => prev.map(rec => (rec.id === id ? { ...rec, ...patch } : rec)));
  }, []);

  const addRecipient = useCallback(() => setRecipients(prev => [...prev, newRecipient()]), []);

  const removeRecipient = useCallback((id: string) => {
    setRecipients(prev => {
      if (prev.length <= 1) {
        return prev.map((rec, idx) => (idx === 0 ? { ...rec, email: '' } : rec));
      }
      return prev.filter(rec => rec.id !== id);
    });
  }, []);

  return {
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
  };
}

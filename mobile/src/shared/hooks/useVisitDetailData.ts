import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addCompleted, addInProgress, removeInProgress } from '../utils/completed';
import { enqueueSubmission } from '../utils/offlineQueue';
import { fetchVisit, markVisitInProgress, submitVisit, Visit } from '../api/client';
import { showBanner } from '../components/globalBannerBus';

type LocationProvider = {
  getForegroundPermissionsAsync: () => Promise<{ granted: boolean }>;
  requestForegroundPermissionsAsync: () => Promise<{ granted: boolean }>;
  getCurrentPositionAsync: (opts?: any) => Promise<{ coords?: { latitude?: number; longitude?: number } }>;
  Accuracy?: { Balanced?: any };
};

type Options = {
  id: number;
  token?: string | null;
  setTitle?: (title: string) => void;
  locationProvider?: LocationProvider;
  persistCheckInLocation?: boolean;
};

export function useVisitDetailData(options: Options) {
  const { id, token, setTitle, locationProvider, persistCheckInLocation = false } = options;
  const [visit, setVisit] = useState<Visit | null>(null);
  const [timelyInstruction, setTimelyInstruction] = useState('');
  const [ack, setAck] = useState(false);
  const [checkInTs, setCheckInTs] = useState<string | null>(null);
  const [checkOutTs, setCheckOutTs] = useState<string | null>(null);
  const [noteToOffice, setNoteToOffice] = useState('');
  const [onSiteContact, setOnSiteContact] = useState('');
  const [odometerReading, setOdometerReading] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locPermissionAsked, setLocPermissionAsked] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoSavePayload = useRef<string>('');
  const checkInLocRef = useRef<{ lat: number; lng: number } | null>(null);
  const checkInKey = useMemo(() => `visit-checkin-ts:${id}`, [id]);
  const checkInLocKey = useMemo(() => `visit-checkin-loc:${id}`, [id]);

  const getLocation = useCallback(async (): Promise<{ lat: number; lng: number } | undefined> => {
    if (!locationProvider) return undefined;
    try {
      const status = await locationProvider.getForegroundPermissionsAsync();
      if (!status.granted) {
        const req = await locationProvider.requestForegroundPermissionsAsync();
        setLocPermissionAsked(true);
        if (!req.granted) {
          if (!locPermissionAsked) {
            showBanner({ type: 'info', message: 'Location permission denied; geo validation will be skipped.' });
          }
          return undefined;
        }
      }
      const pos = await locationProvider.getCurrentPositionAsync({
        accuracy: locationProvider.Accuracy?.Balanced,
      });
      if (pos?.coords?.latitude && pos?.coords?.longitude) {
        return { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch {
      showBanner({ type: 'info', message: 'Unable to fetch location; geo validation skipped.' });
    }
    return undefined;
  }, [locationProvider, locPermissionAsked]);

  useEffect(() => {
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetchVisit(id, token);
        setVisit(res.visit);
        setTitle?.(`Today at ${res.visit.clientName}`);
        setTimelyInstruction(res.visit.timelyNote || '');
        setAck(false);
        setNoteToOffice('');
        setOnSiteContact('');
        setOdometerReading('');
        const persistedTs = await AsyncStorage.getItem(checkInKey);
        setCheckInTs(persistedTs ?? res.visit?.checkInTs ?? null);
        if (persistCheckInLocation) {
          try {
            const persistedLoc = await AsyncStorage.getItem(checkInLocKey);
            if (persistedLoc) {
              const parsed = JSON.parse(persistedLoc);
              if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
                checkInLocRef.current = parsed;
              }
            }
          } catch {}
        }
        setCheckOutTs(null);
        setSubmitError(null);
        try { await addInProgress(id); } catch {}
        try { await markVisitInProgress(id, token); } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token, setTitle, persistCheckInLocation, checkInKey, checkInLocKey]);

  const handleCheckIn = useCallback(async () => {
    if (checkInTs) return;
    const ts = new Date().toISOString();
    setCheckInTs(ts);
    if (!token || !visit) return;
    const loc = await getLocation();
    if (loc && persistCheckInLocation) {
      checkInLocRef.current = loc;
      try { await AsyncStorage.setItem(checkInLocKey, JSON.stringify(loc)); } catch {}
    }
    const payload = {
      notes: noteToOffice || undefined,
      checklist: visit.checklist.map(c => ({ key: c.key, done: c.done })),
      timelyAck: (timelyInstruction.trim() ? ack : undefined),
      timelyInstruction: timelyInstruction || undefined,
      checkInTs: ts,
      checkInLoc: loc,
      onSiteContact: onSiteContact || undefined,
      odometerReading: odometerReading || undefined,
    } as any;
    try {
      await submitVisit(visit.id, payload, token);
      lastAutoSavePayload.current = JSON.stringify(payload);
      await AsyncStorage.setItem(checkInKey, ts);
    } catch {
      await enqueueSubmission(visit.id, payload);
      lastAutoSavePayload.current = JSON.stringify(payload);
      showBanner({ type: 'info', message: 'Checked in offline - will sync when online' });
      await AsyncStorage.setItem(checkInKey, ts);
    }
  }, [
    checkInTs,
    token,
    visit,
    getLocation,
    persistCheckInLocation,
    checkInLocKey,
    checkInKey,
    noteToOffice,
    timelyInstruction,
    ack,
    onSiteContact,
    odometerReading,
  ]);

  const handleSubmit = useCallback(async (): Promise<'online' | 'offline' | null> => {
    if (!token || !visit) return null;
    setSubmitting(true);
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    try {
      const outTs = checkOutTs || new Date().toISOString();
      const requiresAck = !!timelyInstruction && timelyInstruction.trim().length > 0;
      const payload = {
        notes: noteToOffice || undefined,
        checklist: visit.checklist.map(c => ({ key: c.key, done: c.done })),
        timelyAck: requiresAck ? ack : undefined,
        timelyInstruction: timelyInstruction || undefined,
        checkInTs: checkInTs || undefined,
        checkOutTs: outTs,
        checkOutLoc: await getLocation(),
        noteToOffice: noteToOffice || undefined,
        onSiteContact: onSiteContact || undefined,
        odometerReading: odometerReading || undefined,
      };
      if (!checkOutTs) setCheckOutTs(outTs);
      setSubmitError(null);
      await AsyncStorage.removeItem(checkInKey);
      if (persistCheckInLocation) {
        await AsyncStorage.removeItem(checkInLocKey);
      }
      checkInLocRef.current = null;
      setCheckInTs(null);
      try {
        await submitVisit(visit.id, payload, token);
        await addCompleted(visit.id);
        await removeInProgress(visit.id);
        return 'online';
      } catch {
        await enqueueSubmission(visit.id, payload);
        await addCompleted(visit.id);
        await removeInProgress(visit.id);
        await AsyncStorage.removeItem(checkInKey);
        if (persistCheckInLocation) {
          await AsyncStorage.removeItem(checkInLocKey);
        }
        checkInLocRef.current = null;
        setCheckInTs(null);
        return 'offline';
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Submit failed';
      setSubmitError(msg);
      showBanner({ type: 'error', message: msg });
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [
    token,
    visit,
    checkOutTs,
    timelyInstruction,
    noteToOffice,
    ack,
    checkInTs,
    onSiteContact,
    odometerReading,
    getLocation,
    checkInKey,
    checkInLocKey,
    persistCheckInLocation,
  ]);

  useEffect(() => {
    if (!token || !visit || !checkInTs || checkOutTs || submitting) return;
    const requiresAck = !!timelyInstruction && timelyInstruction.trim().length > 0;
    const payloadBase = {
      notes: noteToOffice || undefined,
      checklist: visit.checklist.map(c => ({ key: c.key, done: c.done })),
      timelyAck: requiresAck ? ack : undefined,
      timelyInstruction: timelyInstruction || undefined,
      checkInTs: checkInTs || undefined,
      noteToOffice: noteToOffice || undefined,
      onSiteContact: onSiteContact || undefined,
      odometerReading: odometerReading || undefined,
    };
    const payloadKey = JSON.stringify({ ...payloadBase, checkInLoc: checkInLocRef.current || null });
    if (payloadKey === lastAutoSavePayload.current) return;
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    autoSaveTimer.current = setTimeout(async () => {
      if (!token || !visit || !checkInTs || checkOutTs) return;
      let loc = checkInLocRef.current;
      if (!loc && persistCheckInLocation) {
        loc = await getLocation();
        if (loc) {
          checkInLocRef.current = loc;
          try { await AsyncStorage.setItem(checkInLocKey, JSON.stringify(loc)); } catch {}
        }
      }
      const payload = { ...payloadBase, checkInLoc: loc };
      const key = JSON.stringify(payload);
      if (key === lastAutoSavePayload.current) return;
      lastAutoSavePayload.current = key;
      try {
        await submitVisit(visit.id, payload, token);
      } catch {
        await enqueueSubmission(visit.id, payload);
      }
    }, 900);
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
    };
  }, [
    token,
    visit,
    checkInTs,
    checkOutTs,
    noteToOffice,
    onSiteContact,
    odometerReading,
    ack,
    timelyInstruction,
    submitting,
    getLocation,
    persistCheckInLocation,
    checkInLocKey,
  ]);

  const requiresAck = !!timelyInstruction && timelyInstruction.trim().length > 0;

  return {
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
    toggleChecklistItem: (key: string) => {
      setVisit((prev) =>
        prev
          ? {
              ...prev,
              checklist: prev.checklist.map((c) => (c.key === key ? { ...c, done: !c.done } : c)),
            }
          : prev
      );
    },
    handleCheckIn,
    handleSubmit,
  };
}

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth/provider';
import {
  adminAssignServiceRoute,
  adminFetchClients,
  adminFetchServiceRoutes,
  adminFetchUsers,
} from '../api/client';
import { showBanner } from '../components/globalBannerBus';
import Card from '../components/Card';
import HeaderEmailChip from '../components/HeaderEmailChip';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';
import { formatRouteAddress } from '../utils/address';
import { shareEmail } from '../utils/email';
import { sortByLastName } from '../utils/sort';
import { truncateText } from '../utils/text';

type AdminUser = { id: number; name: string; role?: string; };
type ServiceRoute = { id: number; name: string; user_name?: string | null; user_id?: number | null; };
type AdminClient = { id: number; name: string; address?: string | null; service_route_id?: number | null; scheduled_time?: string | null; };

type Colors = {
  primary: string;
  text: string;
  muted: string;
  card: string;
  border: string;
};

type Deps = {
  useAuth: () => { token?: string | null };
  adminAssignServiceRoute: (token: string, payload: { routeId: number; userId: number | null }) => Promise<any>;
  adminFetchClients: (token: string) => Promise<{ clients?: AdminClient[] } | null>;
  adminFetchServiceRoutes: (token: string) => Promise<{ routes?: ServiceRoute[] } | null>;
  adminFetchUsers: (token: string) => Promise<{ users?: AdminUser[] } | null>;
  showBanner: (msg: { type?: 'info' | 'success' | 'error'; message: string }) => void;
  truncateText: (value?: string | null, max?: number) => string;
  formatRouteAddress: (address?: string | null) => string;
  shareEmail: (subject: string, body: string) => Promise<boolean>;
  sortByLastName: <T extends { name?: string | null }>(items: T[]) => T[];
  useFocusEffect: (effect: () => void | (() => void)) => void;
  ThemedButton: React.ComponentType<{ title: string; variant?: 'primary' | 'outline' | 'ghost'; onPress: () => void; style?: any }>;
  HeaderEmailChip: React.ComponentType<{ onPress: () => void; label?: string; style?: any }>;
  colors: Colors;
  spacing: (n: number) => number;
};

type Props = { navigation: { setOptions: (options: any) => void } };

export function createAllServiceRoutesScreen(deps: Deps) {
  const styles = createStyles(deps.colors, deps.spacing);

  return function AllServiceRoutesScreen({ navigation }: Props) {
    const { token } = deps.useAuth();
    const [routes, setRoutes] = useState<ServiceRoute[]>([]);
    const [clients, setClients] = useState<AdminClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [techs, setTechs] = useState<AdminUser[]>([]);
    const [assignRoute, setAssignRoute] = useState<ServiceRoute | null>(null);
    const [sortByAlpha, setSortByAlpha] = useState(true);

    const load = useCallback(async () => {
      if (!token) return;
      try {
        setLoading(true);
        const [routeRes, clientRes, usersRes] = await Promise.all([
          deps.adminFetchServiceRoutes(token),
          deps.adminFetchClients(token),
          deps.adminFetchUsers(token),
        ]);
        setRoutes(routeRes?.routes || []);
        setClients(clientRes?.clients || []);
        const filteredTechs = deps.sortByLastName((usersRes?.users || []).filter(u => u.role === 'tech'));
        setTechs(filteredTechs);
      } catch (err: any) {
        deps.showBanner({ type: 'error', message: err?.message || 'Unable to load service routes.' });
      } finally {
        setLoading(false);
      }
    }, [token]);

    deps.useFocusEffect(
      useCallback(() => {
        load();
      }, [load])
    );

    useEffect(() => {
      load();
    }, [load]);

    useLayoutEffect(() => {
      navigation.setOptions({
        headerBackTitle: 'Back',
        headerRight: routes.length
          ? () => (
              <deps.HeaderEmailChip onPress={shareRoutes} />
            )
          : undefined,
      });
    }, [navigation, routes.length]);

    const clientsByRoute = routes.reduce<Record<number, AdminClient[]>>((acc, route) => {
      const list = clients.filter(c => c.service_route_id === route.id);
      const dedup = Array.from(
        new Map(list.map(c => [`${c.name}|${c.address}`, c])).values()
      );
      // Sort client locations: alpha when toggle is on, otherwise by scheduled_time then name
      dedup.sort((a, b) => {
        if (sortByAlpha) {
          return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
        }
        const at = a.scheduled_time ?? '';
        const bt = b.scheduled_time ?? '';
        if (at && bt && at !== bt) return at.localeCompare(bt);
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      });
      acc[route.id] = dedup;
      return acc;
    }, {});

    const shareRoutes = async () => {
      if (!routes.length) {
        deps.showBanner({ type: 'info', message: 'No service routes to share yet.' });
        return;
      }
      const lines = routes.map(route => {
        const assignedClients = (clientsByRoute[route.id] || []).map(client => client.name).join(', ');
        const tech = route.user_name || 'Unassigned';
        return `${route.name}\nTech: ${tech}${assignedClients ? `\nClients: ${assignedClients}` : ''}`;
      });
      const subject = 'Service Routes';
      const body = `Service Routes:\n\n${lines.join('\n\n')}`;
      await deps.shareEmail(subject, body);
    };

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          {loading ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : routes.length === 0 ? (
            <Text style={styles.empty}>No service routes yet.</Text>
          ) : (
            routes
              .sort((a, b) => sortByAlpha ? a.name.localeCompare(b.name) : 0)
              .map(route => (
              <View key={route.id} style={styles.routeBlock}>
                <View style={styles.routeHeader}>
                  <Pressable
                    style={styles.sortButton}
                    onPress={() => setSortByAlpha(!sortByAlpha)}
                  >
                    <View style={[styles.sortDot, sortByAlpha ? styles.sortDotFilled : styles.sortDotEmpty]} />
                  </Pressable>
                  <Text style={styles.routeName}>{route.name}</Text>
                  <Text style={styles.routeTech}>
                    {route.user_name ? `Tech: ${route.user_name}` : 'Unassigned'}
                  </Text>
                </View>
                <Pressable onPress={() => setAssignRoute(route)} style={styles.secondaryChip}>
                  <Text style={styles.secondaryChipText}>Change Route Assignment</Text>
                </Pressable>
                {(clientsByRoute[route.id] || []).length === 0 ? (
                  <Text style={styles.empty}>No client locations placed.</Text>
                ) : (
                  clientsByRoute[route.id].map(client => (
                    <Text
                      key={`${route.id}-${client.id}`}
                      style={styles.clientLine}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      • {deps.truncateText(client.name, 20)} — {deps.formatRouteAddress(client.address)}
                    </Text>
                  ))
                )}
              </View>
            ))
          )}
        </Card>
        <RouteAssignModal
          visible={!!assignRoute}
          route={assignRoute}
          techs={techs}
          onSelect={(techId) => {
            if (!token || !assignRoute) return;
            deps.adminAssignServiceRoute(token, { routeId: assignRoute.id, userId: techId })
              .then(() => {
                deps.showBanner({ type: 'success', message: 'Route assignment updated.' });
                setAssignRoute(null);
                load();
              })
              .catch((err: any) => deps.showBanner({ type: 'error', message: err?.message || 'Unable to assign route.' }));
          }}
          onClose={() => setAssignRoute(null)}
          deps={deps}
          styles={styles}
        />
      </ScrollView>
    );
  };
}

const SharedAllServiceRoutesScreen = createAllServiceRoutesScreen({
  useAuth,
  adminAssignServiceRoute,
  adminFetchClients,
  adminFetchServiceRoutes,
  adminFetchUsers,
  showBanner,
  truncateText,
  formatRouteAddress,
  shareEmail,
  sortByLastName,
  useFocusEffect,
  ThemedButton,
  HeaderEmailChip,
  colors,
  spacing,
});

export default function AllServiceRoutesScreen({ navigation }: Props) {
  return <SharedAllServiceRoutesScreen navigation={navigation} />;
}

function RouteAssignModal({
  visible,
  route,
  techs,
  onSelect,
  onClose,
  deps,
  styles,
}: {
  visible: boolean;
  route: ServiceRoute | null;
  techs: AdminUser[];
  onSelect: (techId: number | null) => void;
  onClose: () => void;
  deps: Deps;
  styles: ReturnType<typeof createStyles>;
}) {
  if (!visible || !route) return null;
  return (
    <View style={styles.modalBackdrop} pointerEvents="box-none">
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Assign {route.name}</Text>
        <ScrollView style={{ maxHeight: 360 }}>
          {techs.map(t => (
            <deps.ThemedButton
              key={t.id}
              title={t.name}
              variant="outline"
              onPress={() => onSelect(t.id)}
              style={{ marginBottom: deps.spacing(1) }}
            />
          ))}
          <deps.ThemedButton title="Clear assignment" variant="outline" onPress={() => onSelect(null)} />
        </ScrollView>
        <deps.ThemedButton title="Cancel" variant="ghost" onPress={onClose} />
      </View>
    </View>
  );
}

function createStyles(colors: Colors, spacing: (n: number) => number) {
  return StyleSheet.create({
    container: { padding: spacing(4), gap: spacing(3) },
    empty: { color: colors.muted },
    routeBlock: { paddingTop: spacing(1.5), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing(0.75) },
    routeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
    routeName: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
    routeTech: { color: colors.muted },
    sortButton: { width: 8, height: 8, justifyContent: 'center', alignItems: 'center' },
    sortDot: { width: 4, height: 4, borderRadius: 2, borderWidth: 1 },
    sortDotFilled: { backgroundColor: colors.text, borderColor: colors.text },
    sortDotEmpty: { backgroundColor: 'transparent', borderColor: colors.text },
    clientLine: { color: colors.text, paddingLeft: spacing(1) },
    modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: spacing(4) },
    modalCard: { width: '100%', maxWidth: 380, backgroundColor: colors.card, borderRadius: 12, padding: spacing(4), gap: spacing(2), borderWidth: 1, borderColor: colors.border },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing(1) },
    secondaryChip: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: spacing(0.5) },
    secondaryChipText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  });
}

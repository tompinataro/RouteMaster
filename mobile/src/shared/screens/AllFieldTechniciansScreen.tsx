import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth/provider';
import { adminClearRoutesForTech, adminFetchServiceRoutes, adminFetchUsers } from '../api/client';
import { showBanner } from '../components/globalBannerBus';
import Card from '../components/Card';
import HeaderEmailChip from '../components/HeaderEmailChip';
import ListRow from '../components/ListRow';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';
import { shareEmail } from '../utils/email';
import { sortByLastName } from '../utils/sort';
import { truncateText } from '../utils/text';

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role?: string;
  managed_password?: string | null;
  phone?: string | null;
};
type ServiceRoute = { id: number; name: string; user_id?: number | null; assigned_user_id?: number | null };

type Colors = {
  primary: string;
  text: string;
  muted: string;
  card: string;
  border: string;
};

type Deps = {
  useAuth: () => { token?: string | null; user?: { role?: string } | null };
  adminFetchUsers: (token: string) => Promise<{ users?: AdminUser[] } | null>;
  adminFetchServiceRoutes: (token: string) => Promise<{ routes?: ServiceRoute[] } | null>;
  adminClearRoutesForTech: (token: string, userId: number) => Promise<any>;
  showBanner: (msg: { type?: 'info' | 'success' | 'error'; message: string }) => void;
  truncateText: (value?: string | null, max?: number) => string;
  shareEmail: (subject: string, body: string) => Promise<boolean>;
  sortByLastName: <T extends { name?: string | null }>(items: T[]) => T[];
  useFocusEffect: (effect: () => void | (() => void)) => void;
  ThemedButton: React.ComponentType<{ title: string; variant?: 'primary' | 'outline' | 'ghost'; onPress: () => void; style?: any }>;
  HeaderEmailChip: React.ComponentType<{ onPress: () => void; label?: string; style?: any }>;
  colors: Colors;
  spacing: (n: number) => number;
};

type Props = { navigation: { setOptions: (options: any) => void; navigate?: (name: string, params?: any) => void } };

export function createAllFieldTechniciansScreen(deps: Deps) {
  const styles = createStyles(deps.colors, deps.spacing);

  return function AllFieldTechniciansScreen({ navigation }: Props) {
    const { token, user } = deps.useAuth();
    const [techs, setTechs] = useState<AdminUser[]>([]);
    const [routes, setRoutes] = useState<ServiceRoute[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const [userRes, routeRes] = await Promise.all([
          deps.adminFetchUsers(token),
          deps.adminFetchServiceRoutes(token),
        ]);
        const techList = deps.sortByLastName((userRes?.users || []).filter(u => u.role === 'tech'));
        setTechs(techList);
        setRoutes(routeRes?.routes || []);
      } catch (err: any) {
        deps.showBanner({ type: 'error', message: err?.message || 'Unable to load field technicians.' });
      } finally {
        setLoading(false);
      }
    };
    useEffect(() => {
      load();
    }, [token]);

    useLayoutEffect(() => {
      navigation.setOptions({
        headerBackTitle: 'Back',
        headerRight: techs.length
          ? () => (
              <deps.HeaderEmailChip onPress={shareTechs} />
            )
          : undefined,
      });
    }, [navigation, techs.length]);

    deps.useFocusEffect(
      React.useCallback(() => {
        // Refresh list whenever returning to this screen
        load();
        return () => {};
      }, [token])
    );

    const getRouteForTech = (userId: number) =>
      routes.find(r => r.user_id === userId || (r as any)?.assigned_user_id === userId);

    const shareTechs = async () => {
      if (!techs.length) {
        deps.showBanner({ type: 'info', message: 'No field technicians to share yet.' });
        return;
      }
      const lines = techs.map(t => {
        const assignedRoute = getRouteForTech(t.id);
        const routeName = assignedRoute ? assignedRoute.name : 'Unassigned';
        return `${t.name}\nEmail: ${t.email}${t.phone ? `\nPhone: ${t.phone}` : ''}\nRoute: ${routeName}`;
      });
      const subject = 'Field Technicians';
      const body = `Field Technicians:\n\n${lines.join('\n\n')}`;
      await deps.shareEmail(subject, body);
    };

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          {loading ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : techs.length === 0 ? (
            <Text style={styles.empty}>No field technicians yet.</Text>
          ) : (
            techs.map(tech => {
              const assignedRoute = getRouteForTech(tech.id);
              return (
                <ListRow key={tech.id}>
                  <View style={styles.infoColumn}>
                    <Text style={styles.name}>{deps.truncateText(tech.name, 40)}</Text>
                    <Text style={styles.email}>{deps.truncateText(`${tech.email}${tech.managed_password ? ` (${tech.managed_password})` : ''}`, 56)}</Text>
                    {tech.phone ? <Text style={styles.email}>{tech.phone}</Text> : null}
                    <Text style={styles.routeLabel}>
                      {assignedRoute ? `Assigned Route(s) = "${assignedRoute.name}"` : 'Assigned Route(s) = "Unassigned"'}
                    </Text>
                  </View>
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={styles.editBtn}
                      onPress={() => (navigation as any)?.navigate?.('EditFieldTech', { user: tech })}
                    >
                      <Text style={styles.editBtnText}>Edit</Text>
                    </Pressable>
                    {tech?.role === 'admin' ? (
                      <Pressable
                        style={styles.clearBtn}
                        onPress={async () => {
                          if (!token) return;
                          try {
                            await deps.adminClearRoutesForTech(token, tech.id);
                            deps.showBanner({ type: 'success', message: 'Routes reset.' });
                          } catch (err: any) {
                            deps.showBanner({ type: 'error', message: err?.message || 'Unable to reset routes.' });
                          } finally {
                            load();
                          }
                        }}
                      >
                        <Text style={styles.clearBtnText}>Reset assignments</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </ListRow>
              );
            })
          )}
        </Card>
      </ScrollView>
    );
  };
}

const SharedAllFieldTechniciansScreen = createAllFieldTechniciansScreen({
  useAuth,
  adminFetchUsers,
  adminFetchServiceRoutes,
  adminClearRoutesForTech,
  showBanner,
  truncateText,
  shareEmail,
  sortByLastName,
  useFocusEffect,
  ThemedButton,
  HeaderEmailChip,
  colors,
  spacing,
});

export default function AllFieldTechniciansScreen({ navigation }: Props) {
  return <SharedAllFieldTechniciansScreen navigation={navigation} />;
}

function createStyles(colors: Colors, spacing: (n: number) => number) {
  return StyleSheet.create({
    container: { padding: spacing(4) },
    empty: { color: colors.muted },
    infoColumn: { flex: 1, gap: spacing(0.25) },
    name: { fontWeight: '700', color: colors.text },
    email: { color: colors.muted, fontSize: 13 },
    routeLabel: { color: colors.primary, fontWeight: '600' },
    editBtn: { paddingVertical: spacing(1), paddingHorizontal: spacing(2), borderRadius: 8, borderWidth: 1, borderColor: colors.primary, backgroundColor: 'transparent' },
    editBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
    actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
    clearBtn: { paddingVertical: spacing(1), paddingHorizontal: spacing(2), borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' },
    clearBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  });
}

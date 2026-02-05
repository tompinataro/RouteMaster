import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth/provider';
import { adminCreateServiceRoute } from '../api/client';
import ThemedButton from '../components/Button';
import Card from '../components/Card';
import { colors, spacing } from '../theme';
import { showBanner } from '../components/globalBannerBus';
import { truncateText } from '../utils/text';
import { useServiceRoutesData } from '../hooks/useServiceRoutesData';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceRoutes'>;

export default function ServiceRoutesScreen({ route, navigation }: Props) {
  const { token } = useAuth();
  const showAll = route.params?.mode === 'all';
  const focusRouteId = route.params?.focusRouteId;
  const [routeName, setRouteName] = useState('');
  const [creatingRoute, setCreatingRoute] = useState(false);
  const {
    serviceRoutes,
    clientsByRoute,
    unassignedClients,
    unassignedRoutes,
    load,
    appendRoute,
  } = useServiceRoutesData({ token, focusRouteId });

  useEffect(() => {
    navigation.setOptions({ title: showAll ? 'All Service Routes' : 'Service Routes' });
  }, [navigation, showAll]);

  const createRoute = async () => {
    if (!token) return;
    const trimmed = routeName.trim();
    if (!trimmed) {
      showBanner({ type: 'error', message: 'Route name is required.' });
      return;
    }
    setCreatingRoute(true);
    try {
      const res = await adminCreateServiceRoute(token, { name: trimmed });
      if (res?.route) {
        appendRoute(res.route);
      }
      setRouteName('');
      showBanner({ type: 'success', message: `${trimmed} created.` });
      await load();
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to create service route.' });
    } finally {
      setCreatingRoute(false);
    }
  };

  if (showAll) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <Text style={styles.title}>All Service Routes</Text>
          {serviceRoutes.length === 0 ? (
            <Text style={styles.emptyCopy}>No service routes yet.</Text>
          ) : (
            serviceRoutes.map(routeItem => {
              const assignedClients = clientsByRoute.get(routeItem.id) || [];
              return (
                <View key={routeItem.id} style={styles.routeCard}>
                  <Text style={styles.routeName}>{routeItem.name}</Text>
                  <Text style={styles.routeTechLine}>
                    {routeItem.user_name ? `Technician: ${routeItem.user_name}` : 'No technician assigned'}
                  </Text>
                  {assignedClients.length === 0 ? (
                    <Text style={styles.emptyCopy}>No client locations placed.</Text>
                  ) : (
                    assignedClients.map(client => (
                      <Text key={`${client.id}-${client.name}`} style={styles.clientItem}>
                        • {truncateText(client.name)} — {truncateText(client.address, 36)}
                      </Text>
                    ))
                  )}
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card>
        <Text style={styles.title}>Create New Route</Text>
        <TextInput
          value={routeName}
          onChangeText={setRouteName}
          placeholder="Route name"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <ThemedButton title={creatingRoute ? 'Creating…' : 'Add Route'} onPress={createRoute} disabled={creatingRoute} />
      </Card>
      <Card>
        <Text style={styles.title}>Unassigned Clients</Text>
        {unassignedClients.length === 0 ? (
          <Text style={styles.emptyCopy}>All clients have routes assigned.</Text>
        ) : (
          unassignedClients.map(client => (
            <Text key={`${client.id}-${client.name}`} style={styles.clientItem}>
              • {truncateText(client.name)} — {truncateText(client.address, 36)}
            </Text>
          ))
        )}
      </Card>
      <Card>
        <Text style={styles.title}>Unassigned Routes</Text>
        {unassignedRoutes.length === 0 ? (
          <Text style={styles.emptyCopy}>No unassigned routes.</Text>
        ) : (
          unassignedRoutes.map(routeItem => (
            <Pressable
              key={routeItem.id}
              onPress={() => navigation.navigate('AllServiceRoutes', { focusRouteId: routeItem.id })}
            >
              <Text style={styles.routeName}>{routeItem.name}</Text>
            </Pressable>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(4), gap: spacing(3) },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  routeCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing(2), gap: spacing(1.5), marginBottom: spacing(2) },
  routeName: { fontWeight: '700', color: colors.text, fontSize: 16, marginBottom: spacing(0.5) },
  routeTechLine: { color: colors.muted, fontWeight: '600' },
  clientItem: { color: colors.text },
  emptyCopy: { color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
    color: colors.text,
    backgroundColor: colors.card,
  },
});

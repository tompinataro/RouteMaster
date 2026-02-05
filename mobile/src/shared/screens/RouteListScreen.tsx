import React, { useEffect, useCallback, memo, useRef, useLayoutEffect } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Pressable, Animated, Easing, GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth/provider';
import { TodayRoute } from '../api/client';
import LoadingOverlay from '../components/LoadingOverlay';
import Card from '../components/Card';
import ThemedButton from '../components/Button';
import { showBanner } from '../components/globalBannerBus';
import { colors, spacing } from '../theme';
import { truncateText } from '../utils/text';
import { useFocusEffect } from '@react-navigation/native';
import { useRouteListData } from '../hooks/useRouteListData';
import { formatRouteAddress } from '../utils/address';

type Props = NativeStackScreenProps<RootStackParamList, 'RouteList'>;

export default function RouteListScreen({ navigation, route }: Props) {
  const { token, signOut, user } = useAuth();
  const {
    routes,
    loading,
    refreshing,
    error,
    completed,
    inProgress,
    load,
    refresh,
    triggerReset,
    refreshLocalState,
    openMaps,
  } = useRouteListData(token);
  const title = user?.name ? `Today's Route for ${user.name.split(/\s+/)[0]}` : "Today's Route";
  const isAdmin = user?.role === 'admin';

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: title,
      headerRight: () => (
        <Pressable style={styles.resetChip} onPress={triggerReset} accessibilityRole="button" accessibilityLabel="Reset route state">
          <Text style={styles.resetChipText}>Reset</Text>
        </Pressable>
      ),
    });
  }, [navigation, title, triggerReset]);

  useFocusEffect(
    React.useCallback(() => {
      load();
      if ((route.params as any)?.devResetTS) {
        refreshLocalState();
        navigation.setParams({ devResetTS: undefined } as any);
      }
    }, [load, refreshLocalState, route.params?.devResetTS])
  );

  useEffect(() => {
    const ts = (route.params as any)?.devResetTS;
    if (ts) {
      refreshLocalState();
      navigation.setParams({ devResetTS: undefined } as any);
    }
  }, [route.params?.devResetTS, refreshLocalState]);

  useEffect(() => {
    const saved = (route.params as any)?.saved;
    const savedOffline = (route.params as any)?.savedOffline;
    if (saved) {
      showBanner({ type: 'success', message: '✓ Saved' });
      navigation.setParams({ saved: undefined } as any);
    } else if (savedOffline) {
      showBanner({ type: 'info', message: '✓ Saved offline - will sync when online' });
      navigation.setParams({ savedOffline: undefined } as any);
    }
  }, [route.params?.saved, route.params?.savedOffline]);

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const onOpenVisit = useCallback((id: number) => {
    navigation.navigate('VisitDetail', { id });
  }, [navigation]);

  const keyExtractor = useCallback((item: TodayRoute) => String(item.id), []);

  type ItemProps = {
    route: TodayRoute;
    isDone: boolean;
    inProg: boolean;
    onOpen: (id: number) => void;
    onOpenMaps: (address?: string | null) => void;
  };

  const RouteListItem = memo(function RouteListItem({ route, isDone, inProg, onOpen, onOpenMaps }: ItemProps) {
    const cardScale = useRef(new Animated.Value(1)).current;
    const onCardPressIn = () => Animated.timing(cardScale, { toValue: 0.98, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const onCardPressOut = () => Animated.timing(cardScale, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const streetOnly = formatRouteAddress(route.address, 22);
    return (
      <Pressable
        onPress={() => onOpen(route.id)}
        onPressIn={onCardPressIn}
        onPressOut={onCardPressOut}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Open visit for ${route.clientName}`}
        accessibilityHint="Opens the visit details"
      >
        <Animated.View style={{ transform: [{ scale: cardScale }] }}>
          <Card style={styles.card}>
            <View style={styles.rowTop}>
              <View style={styles.leftWrap}>
                <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{truncateText(route.clientName, 14)}</Text>
                <Text style={styles.sub} numberOfLines={1} ellipsizeMode="tail">{streetOnly}</Text>
              </View>
              <View style={styles.centerWrap}>
                <MapButton onPress={() => onOpenMaps(route.address)} label={`Open directions for ${route.clientName}`} />
              </View>
              <MemoCheck done={isDone} progress={inProg && !isDone} label={isDone ? 'Completed' : inProg ? 'In progress' : 'Not started'} />
            </View>
          </Card>
        </Animated.View>
      </Pressable>
    );
  }, (prev, next) =>
    prev.route.id === next.route.id &&
    prev.route.clientName === next.route.clientName &&
    prev.route.address === next.route.address &&
    prev.isDone === next.isDone &&
    prev.inProg === next.inProg
  );

  const MemoCheck = memo(function Check({ done, progress, label }: { done: boolean; progress: boolean; label: string }) {
    const scale = useRef(new Animated.Value(done ? 1 : 0.9)).current;
    const opacity = useRef(new Animated.Value(done ? 1 : 0)).current;
    useEffect(() => {
      if (done) {
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }),
          Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
      } else {
        opacity.setValue(0);
        scale.setValue(0.9);
      }
    }, [done]);
    return (
      <View
        style={[styles.checkBadge, done ? styles.checkBadgeDone : progress ? styles.checkBadgeInProgress : null]}
        accessibilityRole="image"
        accessibilityLabel={label}
      >
        <Animated.Text style={[styles.checkMark, styles.checkMarkDone, { opacity, transform: [{ scale }] }]}>✓</Animated.Text>
      </View>
    );
  }, (prev, next) => prev.done === next.done && prev.progress === next.progress && prev.label === next.label);

  const MapButton = ({ onPress, label }: { onPress: () => void; label: string }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const animatePressIn = () => Animated.timing(scale, { toValue: 0.96, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const animatePressOut = () => Animated.timing(scale, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    return (
      <Pressable
        style={styles.mapBtn}
        onPress={(event: GestureResponderEvent) => {
          event.stopPropagation();
          onPress();
        }}
        onPressIn={(event: GestureResponderEvent) => {
          event.stopPropagation();
          animatePressIn();
        }}
        onPressOut={(event: GestureResponderEvent) => {
          event.stopPropagation();
          animatePressOut();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens maps with driving directions"
      >
        <Animated.View style={[styles.mapBtnInner, { transform: [{ scale }] }]}>
          <Text style={styles.mapBtnText}>Map</Text>
          <Text style={styles.mapBtnArrow}>›</Text>
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <>
      {error ? (
        <View style={styles.errorWrap}>
          <ThemedButton title="Retry" variant="outline" onPress={load} style={styles.retryBtn} />
        </View>
      ) : null}
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: spacing(24) }]}
        data={routes}
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <RouteListItem
            route={item}
            isDone={completed.has(item.id)}
            inProg={inProgress.has(item.id)}
            onOpen={onOpenVisit}
            onOpenMaps={openMaps}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{isAdmin ? 'No assignments yet' : 'No CLs on your route for today'}</Text>
            <Text style={styles.emptySub}>
              {isAdmin ? 'Assign clients from the Account tab to build today\'s route.' : 'Please call the office if this is incorrect.'}
            </Text>
          </View>
        }
        ListFooterComponent={
          <SafeAreaView edges={['bottom']} style={styles.footerBar}>
            <View style={styles.accountRow}>
              {isAdmin ? (
                <ThemedButton title="Admin" onPress={() => navigation.navigate('Account')} style={styles.secondaryBtn} />
              ) : null}
              <ThemedButton title="Log Out" onPress={signOut} style={styles.secondaryBtn} />
            </View>
          </SafeAreaView>
        }
      />
      <LoadingOverlay visible={loading || refreshing} />
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing(4) },
  card: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    marginBottom: spacing(3),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'relative' },
  centerWrap: { position: 'absolute', left: '55%', width: 80, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: -20 }] },
  leftWrap: { flexGrow: 1, flexShrink: 1, minWidth: 0, paddingRight: spacing(2) + 88 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  dot: { color: colors.muted },
  sub: { color: colors.muted, marginTop: spacing(1) },
  mapBtn: { paddingVertical: spacing(0.5), paddingHorizontal: spacing(1.5), borderRadius: 8, borderWidth: 1, borderColor: colors.muted, flexShrink: 0, backgroundColor: 'transparent' },
  mapBtnInner: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.25) },
  mapBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  mapBtnArrow: { color: colors.primary, fontWeight: '900', fontSize: 28, marginTop: -2 },
  checkBadge: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginRight: 0 },
  checkBadgeDone: { borderColor: colors.muted, backgroundColor: '#fff' },
  checkBadgeInProgress: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  checkMark: { color: colors.muted, fontSize: 22, fontWeight: '900' },
  checkMarkDone: { color: colors.primary },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing(20) },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing(1) },
  emptySub: { color: colors.muted },
  banner: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.successBg, padding: spacing(2), alignItems: 'center', zIndex: 2, borderBottomWidth: 1, borderColor: colors.border },
  bannerText: { color: colors.successText, fontWeight: '600' },
  errorWrap: { paddingHorizontal: spacing(4), marginTop: spacing(2) },
  retryBtn: { alignSelf: 'flex-start', marginTop: spacing(2) },
  footerBar: { padding: spacing(3), backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  submitBtn: { alignSelf: 'center', minWidth: 240, maxWidth: 360 },
  accountRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing(3) },
  secondaryBtn: { minWidth: 160 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing(4), paddingTop: spacing(3), paddingBottom: spacing(1) },
  resetChip: { paddingHorizontal: spacing(1.5), paddingVertical: spacing(0.5), borderRadius: 999, borderWidth: 1, borderColor: colors.primary, backgroundColor: 'transparent', marginRight: spacing(5.5) },
  resetChipText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  screenTitle: { fontSize: 22, fontWeight: '800', color: colors.text, flexShrink: 1 },
});

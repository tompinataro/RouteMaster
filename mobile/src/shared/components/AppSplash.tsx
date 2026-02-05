import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 40, fontWeight: '900', color: colors.primary, letterSpacing: 0.5 },
});

const AppSplash = () => {
  return (
    <View style={styles.root} accessibilityLabel="Loading">
      <Text style={styles.title}>RouteMaster</Text>
    </View>
  );
};

export default AppSplash;

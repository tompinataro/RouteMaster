import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

type Props = { type?: 'info' | 'success' | 'error'; message: string };

export default function Banner({ type = 'info', message }: Props) {
  const style = [styles.base];
  if (type === 'success') style.push(styles.success);
  else if (type === 'error') style.push(styles.error);
  else style.push(styles.info);
  return (
    <View style={style} accessibilityRole="text">
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: spacing(3),
  },
  text: { color: colors.text },
  info: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  success: { backgroundColor: colors.successBg, borderColor: '#86efac' },
  error: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
});

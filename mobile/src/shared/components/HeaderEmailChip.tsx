import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, spacing } from '../theme';

type Props = {
  onPress: () => void;
  label?: string;
  style?: ViewStyle;
};

export default function HeaderEmailChip({ onPress, label = 'Email List', style }: Props) {
  return (
    <Pressable style={[styles.chip, style]} onPress={onPress}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.25),
    marginRight: spacing(5.5),
  },
  chipText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 11,
  },
});

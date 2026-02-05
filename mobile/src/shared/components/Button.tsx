import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing } from '../theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  style?: ViewStyle;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export default function Button({ title, onPress, variant = 'primary', style, disabled, accessibilityLabel }: Props) {
  const isOutline = variant === 'outline';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      hitSlop={12}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        isOutline ? styles.outline : styles.primary,
        pressed && { opacity: 0.9 },
        disabled && { opacity: 0.6 },
        style,
      ]}
    >
      <Text style={[styles.text, isOutline && styles.textOutline]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.primary,
  },
  text: {
    color: '#fff',
    fontWeight: '700',
  },
  textOutline: {
    color: colors.primary,
  },
});

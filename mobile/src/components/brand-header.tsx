import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radii, spacing } from '@/theme';

interface BrandHeaderProps {
  onBack?: () => void;
}

export const BrandHeader = memo(function BrandHeader({
  onBack,
}: BrandHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <LinearGradient colors={[colors.lavender, colors.coral]} style={styles.logo}>
          <Text style={styles.logoText}>✦</Text>
        </LinearGradient>
        <Text style={styles.brandText}>ImagineLab</Text>
      </View>

      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={onBack}
          style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.ink,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: radii.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  brandText: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  backButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  backText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

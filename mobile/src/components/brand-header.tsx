import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radii, spacing } from '@/theme';

interface BrandHeaderProps {
  onBack?: () => void;
  home?: boolean;
}

export const BrandHeader = memo(function BrandHeader({
  onBack,
  home = false,
}: BrandHeaderProps) {
  return (
    <View style={[styles.header, home ? styles.homeHeader : null]}>
      <View style={[styles.brand, home ? styles.homeBrand : null]}>
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
  homeHeader: {
    minHeight: 82,
    justifyContent: 'center',
    paddingTop: 16,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  homeBrand: {
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
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
    fontSize: 24,
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

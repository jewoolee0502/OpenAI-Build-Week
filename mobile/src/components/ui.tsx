import { memo, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { colors, radii, spacing } from '@/theme';

export const SectionHeading = memo(function SectionHeading({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDetail}>{detail}</Text>
    </View>
  );
});

export const MiniBadge = memo(function MiniBadge({
  label,
  color = colors.lavender,
}: {
  label: string;
  color?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}24` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
});

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'mint' | 'secondary' | 'danger';
  accessibilityHint?: string;
}

export const ActionButton = memo(function ActionButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  tone = 'primary',
  accessibilityHint,
}: ActionButtonProps) {
  const toneStyle = buttonTones[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        toneStyle.container,
        disabled || loading ? styles.buttonDisabled : null,
        pressed ? styles.buttonPressed : null,
      ]}>
      {loading ? <ActivityIndicator color={toneStyle.text.color} /> : null}
      <Text style={[styles.actionText, toneStyle.text]}>{label}</Text>
    </Pressable>
  );
});

export const SurfaceCard = memo(function SurfaceCard({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.surfaceCard, style]}>{children}</View>;
});

export const ErrorBanner = memo(function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onDismiss}>
        <Text style={styles.dismissText}>Dismiss</Text>
      </Pressable>
    </View>
  );
});

export const LoadingPill = memo(function LoadingPill({ label = 'Building…' }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" style={styles.loadingPill}>
      <ActivityIndicator color={colors.lavender} size="small" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
});

export const EmptyState = memo(function EmptyState({
  symbol,
  title,
  detail,
}: {
  symbol: string;
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptySymbol}>{symbol}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDetail}>{detail}</Text>
    </View>
  );
});

export function InlineRow({ children }: { children: ReactNode }) {
  return <View style={styles.inlineRow}>{children}</View>;
}

const buttonTones: Record<
  NonNullable<ActionButtonProps['tone']>,
  { container: ViewStyle; text: TextStyle }
> = {
  primary: { container: { backgroundColor: colors.lavender }, text: { color: colors.ink } },
  mint: { container: { backgroundColor: colors.mint }, text: { color: colors.ink } },
  secondary: {
    container: { backgroundColor: colors.surfaceSoft },
    text: { color: colors.white },
  },
  danger: {
    container: { backgroundColor: colors.errorSurface },
    text: { color: colors.error },
  },
};

const styles = StyleSheet.create({
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.white,
    flex: 1,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  sectionDetail: {
    color: colors.softText,
    fontSize: 14,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  actionButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
  surfaceCard: {
    borderRadius: radii.large,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.medium,
    backgroundColor: colors.errorSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  errorText: {
    flex: 1,
    color: colors.white,
    lineHeight: 20,
  },
  dismissText: {
    color: colors.coral,
    fontWeight: '800',
  },
  loadingPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceLifted,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  loadingText: {
    color: colors.white,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#FFFFFF20',
    borderRadius: radii.large,
    padding: spacing.xl,
  },
  emptySymbol: {
    color: colors.lavender,
    fontSize: 42,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyDetail: {
    color: colors.softText,
    textAlign: 'center',
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
});

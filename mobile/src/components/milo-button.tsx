import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/theme';

interface MiloButtonProps {
  onPress: () => void;
  label?: string;
  compact?: boolean;
  imageSource?: ImageSourcePropType;
  variant?: 'default' | 'home';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const MiloButton = memo(function MiloButton({
  onPress,
  label,
  compact = false,
  imageSource,
  variant = 'default',
  style,
  accessibilityLabel = 'Ask Milo',
}: MiloButtonProps) {
  const isHome = variant === 'home';
  const labelBubble = label ? (
    <View style={[styles.bubble, isHome ? styles.homeBubble : null]}>
      <Text numberOfLines={1} style={[styles.bubbleText, isHome ? styles.homeBubbleText : null]}>{label}</Text>
    </View>
  ) : null;

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, isHome ? styles.homeWrapper : null, style]}>
      {!isHome ? labelBubble : null}
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          compact ? styles.buttonCompact : null,
          isHome ? styles.homeButton : null,
          pressed ? styles.buttonPressed : null,
        ]}>
        {imageSource ? (
          <View style={styles.imageOrb}>
            <Image source={imageSource} style={styles.mascotImage} />
          </View>
        ) : (
          <LinearGradient colors={['#6FE1C4', '#A88BFF', '#FF9B72']} style={styles.orb}>
            <View style={styles.face}>
              <Text style={[styles.star, compact ? styles.starCompact : null]}>✦</Text>
              <View style={styles.eyes}>
                <View style={styles.eye} />
                <View style={styles.eye} />
              </View>
            </View>
          </LinearGradient>
        )}
      </Pressable>
      {isHome ? labelBubble : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'flex-end',
    gap: 5,
  },
  homeWrapper: {
    alignItems: 'center',
    gap: 0,
  },
  bubble: {
    maxWidth: 132,
    borderWidth: 1,
    borderColor: '#17142B18',
    borderRadius: 14,
    backgroundColor: '#FFF8EFF5',
    paddingHorizontal: 10,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  homeBubble: {
    zIndex: 2,
    marginTop: -8,
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: 16,
    backgroundColor: '#6E35DB',
    paddingHorizontal: 17,
    paddingVertical: 7,
  },
  homeBubbleText: {
    color: colors.white,
    fontSize: 15,
  },
  button: {
    width: 74,
    height: 74,
    borderWidth: 4,
    borderColor: colors.white,
    borderRadius: 37,
    backgroundColor: colors.lavender,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 13,
    elevation: 9,
  },
  buttonCompact: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
  },
  homeButton: {
    width: 112,
    height: 112,
    borderWidth: 3,
    borderRadius: 56,
    backgroundColor: '#6A4FE0',
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  orb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 999,
  },
  imageOrb: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 999,
  },
  mascotImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  face: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    color: '#FFF3A8',
    fontSize: 37,
    fontWeight: '900',
  },
  starCompact: {
    fontSize: 31,
  },
  eyes: {
    position: 'absolute',
    top: 18,
    flexDirection: 'row',
    gap: 7,
  },
  eye: {
    width: 4,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.ink,
  },
});

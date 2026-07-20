import { memo } from 'react';
import { Image, type ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { GameProject } from '@/api/types';
import { colors, radii, spacing } from '@/theme';

interface ProjectCardProps {
  project: GameProject;
  onPress: (project: GameProject) => void;
  imageSource?: ImageSourcePropType | null;
  variant?: 'featured' | 'compact';
  style?: object;
}

const palettes = [
  ['#35258A', '#E76891'],
  ['#167E64', '#7CCB63'],
  ['#8D4FB5', '#FF9B78'],
  ['#205E9D', '#55C1A0'],
] as const;

export const ProjectCard = memo(function ProjectCard({
  project,
  onPress,
  imageSource,
  variant = 'compact',
  style,
}: ProjectCardProps) {
  const palette = palettes[(project.id.charCodeAt(0) || 0) % palettes.length] ?? palettes[0];
  const featured = variant === 'featured';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${project.title}`}
      onPress={() => onPress(project)}
      style={({ pressed }) => [
        styles.card,
        featured ? styles.featuredCard : styles.compactCard,
        style,
        pressed ? styles.pressed : null,
      ]}>
      {featured ? (
        <View style={styles.featuredHeading}>
          <View style={styles.featuredHeadingCopy}>
            <Text numberOfLines={1} style={styles.featuredTitle}>{project.title}</Text>
            <Text style={styles.featuredSubtitle}>Your latest world</Text>
          </View>
          <Text style={styles.more}>•••</Text>
        </View>
      ) : null}

      <LinearGradient colors={palette} style={[styles.art, featured ? styles.featuredArt : styles.compactArt]}>
        {imageSource ? <Image source={imageSource} style={styles.cover} /> : null}
        <View style={styles.sparkleCloud} pointerEvents="none">
          <Text style={styles.spark}>✦</Text>
          <Text style={styles.orbit}>◌</Text>
        </View>
        {!featured ? <Text numberOfLines={2} style={styles.compactTitle}>{project.title}</Text> : null}
      </LinearGradient>

      <View style={[styles.meta, featured ? styles.featuredMeta : null]}>
        <View style={styles.statusLine}>
          <View style={[styles.dot, { backgroundColor: project.status === 'published' ? colors.mint : colors.lavender }]} />
          <Text style={styles.status}>{project.status === 'published' ? 'PUBLISHED' : 'DRAFT'}</Text>
          <Text style={styles.version}>v{project.currentVersion.versionNumber}</Text>
        </View>
        {featured ? (
          <View style={styles.continueButton}>
            <Text style={styles.continueText}>Continue building</Text>
            <Text style={styles.arrow}>→</Text>
          </View>
        ) : (
          <Text style={styles.openArrow}>↗</Text>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFFFFF20',
    backgroundColor: colors.surface,
  },
  featuredCard: {
    borderRadius: radii.large,
  },
  compactCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  featuredHeading: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  featuredHeadingCopy: {
    flex: 1,
    gap: 2,
  },
  featuredTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  featuredSubtitle: {
    color: colors.softText,
    fontSize: 12,
  },
  more: {
    color: colors.softText,
    fontSize: 16,
    letterSpacing: 2,
  },
  art: {
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  featuredArt: {
    aspectRatio: 1.52,
  },
  compactArt: {
    aspectRatio: 1.12,
    padding: 12,
  },
  cover: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  sparkleCloud: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: {
    color: '#FFFFFFD9',
    fontSize: 48,
    fontWeight: '900',
  },
  orbit: {
    position: 'absolute',
    color: '#FFFFFF38',
    fontSize: 126,
  },
  compactTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 19,
  },
  meta: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  featuredMeta: {
    alignItems: 'stretch',
    flexDirection: 'column',
    padding: 14,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  status: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  version: {
    marginLeft: 'auto',
    color: colors.softText,
    fontSize: 11,
  },
  continueButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    backgroundColor: colors.lavender,
    paddingHorizontal: 16,
  },
  continueText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  arrow: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  openArrow: {
    color: colors.softText,
    fontSize: 16,
  },
});

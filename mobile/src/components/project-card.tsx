import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { GameProject } from '@/api/types';
import { MiniBadge } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';

interface ProjectCardProps {
  project: GameProject;
  onPress: (project: GameProject) => void;
}

const accents = [colors.lavender, colors.coral, colors.mint] as const;

export const ProjectCard = memo(function ProjectCard({ project, onPress }: ProjectCardProps) {
  const accentIndex = (project.id.charCodeAt(0) || 0) % accents.length;
  const accent = accents[accentIndex] ?? colors.lavender;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${project.title}`}
      onPress={() => onPress(project)}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
      <LinearGradient colors={['#3B326C', '#5B477A']} style={styles.thumbnail}>
        <Text style={[styles.spark, { color: accent }]}>✦</Text>
      </LinearGradient>

      <View style={styles.content}>
        <Text numberOfLines={2} style={styles.title}>
          {project.title}
        </Text>
        <View style={styles.meta}>
          <MiniBadge
            color={project.status === 'published' ? colors.mint : colors.lavender}
            label={project.status === 'published' ? 'LIVE' : 'DRAFT'}
          />
          <Text style={styles.detail}>
            v{project.currentVersion.versionNumber} · {project.updatedAt.slice(0, 10)}
          </Text>
        </View>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radii.large,
    backgroundColor: colors.surface,
    padding: 15,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  thumbnail: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  spark: {
    fontSize: 30,
    fontWeight: '900',
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.white,
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 23,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detail: {
    color: colors.softText,
    fontSize: 13,
  },
  chevron: {
    color: colors.softText,
    fontSize: 28,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { GameProject } from '@/api/types';
import { ChildPageHeader } from '@/components/child-page-header';
import { EmptyState, ErrorBanner, LoadingPill } from '@/components/ui';
import { useAppState } from '@/state/app-provider';

function progressLabel(project: GameProject) {
  const assets = project.builder?.assets ?? [];
  if (!project.builder?.creativePlan) return '1 of 3 · Imagine your idea';
  if (!assets.some((asset) => asset.kind === 'background')) return '2 of 3 · Draw the game world';
  if (!assets.some((asset) => asset.kind === 'object')) return '3 of 3 · Draw game pieces';
  return project.status === 'published' ? 'Published' : 'Ready to play';
}

export default function ProjectsTabScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    child,
    projects,
    isLoading,
    errorMessage,
    clearError,
    projectImageSource,
    refreshChildProjects,
  } = useAppState();
  const childUserId = child?.id;
  const featuredProject = useMemo(
    () => projects.find((project) => project.status === 'draft' || project.builder?.stage !== 'ready_to_publish') ?? projects[0] ?? null,
    [projects],
  );
  const gridColumns = width >= 680 ? 3 : 2;
  const gridWidth = Math.min(width, 760) - 28;
  const projectCardWidth = (gridWidth - (gridColumns - 1) * 10) / gridColumns;

  useEffect(() => {
    if (childUserId) void refreshChildProjects().catch(() => undefined);
  }, [childUserId, refreshChildProjects]);

  const openProject = useCallback((project: GameProject) => {
    if (project.builder?.stage !== 'ready_to_publish') {
      router.push({ pathname: '/builder/[projectId]', params: { projectId: project.id } });
      return;
    }
    router.push({ pathname: '/studio/[projectId]', params: { projectId: project.id } });
  }, [router]);

  if (!child) return <Redirect href="/" />;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <LinearGradient colors={['#12102F', '#090923']} style={StyleSheet.absoluteFill} />
      <ChildPageHeader childId={child.childId} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.pageIntro}>
          <View>
            <Text style={styles.eyebrow}>YOUR CREATIONS</Text>
            <Text style={styles.pageTitle}>Projects</Text>
            <View style={styles.underline} />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/new-project')}
            style={({ pressed }) => [styles.newButton, pressed ? styles.pressed : null]}>
            <Ionicons color="#FFFFFF" name="add" size={22} />
            <Text style={styles.newButtonText}>New project</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>Keep building a world, or open one you already finished.</Text>

        {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={clearError} /> : null}
        {isLoading ? <LoadingPill label="Opening your projects…" /> : null}

        {!isLoading && projects.length === 0 ? (
          <EmptyState detail="Your games and drawings will live here." symbol="✦" title="Your first world is waiting." />
        ) : null}

        {featuredProject ? (
          <Pressable
            accessibilityLabel={`Continue ${featuredProject.title}`}
            accessibilityRole="button"
            onPress={() => openProject(featuredProject)}
            style={({ pressed }) => [styles.featuredCard, pressed ? styles.pressed : null]}>
            <View style={styles.featuredArtwork}>
              <LinearGradient colors={['#4A58C7', '#59BFA9', '#FFCB63']} style={StyleSheet.absoluteFill} />
              {projectImageSource(featuredProject) ? (
                <Image source={projectImageSource(featuredProject)!} style={styles.coverImage} />
              ) : <Text style={styles.fallbackSpark}>✦</Text>}
            </View>
            <LinearGradient colors={['#2D2458', '#3A226D']} style={styles.featuredDetails}>
              <Text style={styles.featuredKicker}>CONTINUE CREATING</Text>
              <Text numberOfLines={2} style={styles.featuredTitle}>{featuredProject.title}</Text>
              <Text style={styles.progress}>{progressLabel(featuredProject)}</Text>
              <View style={styles.keepButton}>
                <Text style={styles.keepButtonText}>Keep creating</Text>
                <Ionicons color="#FFFFFF" name="chevron-forward" size={20} />
              </View>
            </LinearGradient>
          </Pressable>
        ) : null}

        {projects.length > 0 ? (
          <View style={styles.projectGrid}>
            {projects.map((project) => (
              <Pressable
                accessibilityLabel={`Open ${project.title}`}
                accessibilityRole="button"
                key={project.id}
                onPress={() => openProject(project)}
                style={({ pressed }) => [styles.projectCard, { width: projectCardWidth }, pressed ? styles.pressed : null]}>
                <LinearGradient colors={['#3659B6', '#A74FC5', '#FF8F75']} style={StyleSheet.absoluteFill} />
                {projectImageSource(project) ? <Image source={projectImageSource(project)!} style={styles.coverImage} /> : null}
                {!projectImageSource(project) ? <Text style={styles.cardFallback}>✦</Text> : null}
                <LinearGradient colors={['transparent', '#10102CEB']} style={styles.cardShade} />
                <View style={styles.cardCopy}>
                  <Text numberOfLines={1} style={styles.cardTitle}>{project.title}</Text>
                  <Text style={styles.cardStatus}>{project.status === 'published' ? '● Published' : '● Draft'}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0D0C26' },
  scrollContent: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 15, paddingHorizontal: 14, paddingBottom: 120 },
  pageIntro: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, paddingTop: 8 },
  eyebrow: { color: '#9B6CFF', fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  pageTitle: { color: '#FFFFFF', fontSize: 38, fontWeight: '900', letterSpacing: -1.5, lineHeight: 42 },
  underline: { width: 52, height: 5, borderRadius: 4, backgroundColor: '#FF7362', transform: [{ rotate: '-4deg' }] },
  subtitle: { color: '#B8B2C8', fontSize: 14, lineHeight: 20 },
  newButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 23, backgroundColor: '#7135DE', paddingHorizontal: 15 },
  newButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  featuredCard: { minHeight: 190, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: '#7D5FE0A0', borderRadius: 24, backgroundColor: '#241B4C' },
  featuredArtwork: { width: '48%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  featuredDetails: { flex: 1, gap: 7, padding: 16 },
  featuredKicker: { color: '#65E0C1', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  featuredTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', letterSpacing: -0.6, lineHeight: 23 },
  progress: { color: '#D8D3E5', fontSize: 12, fontWeight: '700' },
  keepButton: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 'auto', borderRadius: 15, backgroundColor: '#823DF0', paddingHorizontal: 10 },
  keepButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  projectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  projectCard: { position: 'relative', flexShrink: 0, aspectRatio: 1.18, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF30', borderRadius: 20 },
  cardShade: { ...StyleSheet.absoluteFillObject, top: '45%' },
  cardCopy: { position: 'absolute', right: 11, bottom: 10, left: 11, gap: 2 },
  cardTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  cardStatus: { color: '#76E2C4', fontSize: 10, fontWeight: '800' },
  coverImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  fallbackSpark: { color: '#FFFFFFDD', fontSize: 58, fontWeight: '900' },
  cardFallback: { color: '#FFFFFFDD', fontSize: 44, fontWeight: '900', textAlign: 'center', marginTop: 40 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
});

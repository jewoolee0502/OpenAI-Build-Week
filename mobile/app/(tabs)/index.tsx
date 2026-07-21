import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import heroCollage from '../../assets/images/home/hero-collage.png';
import galleryCastle from '../../assets/images/home/gallery-castle.png';
import galleryJungle from '../../assets/images/home/gallery-jungle.png';
import galleryPenguin from '../../assets/images/home/gallery-penguin.png';

import type { GameProject } from '@/api/types';
import { BrandHeader } from '@/components/brand-header';
import { ChildPageHeader } from '@/components/child-page-header';
import { ActionButton, EmptyState, ErrorBanner, LoadingPill } from '@/components/ui';
import { useAppState } from '@/state/app-provider';
import { colors, radii, spacing } from '@/theme';

const galleryImages: ImageSourcePropType[] = [galleryCastle, galleryJungle, galleryPenguin];

function projectStep(project: GameProject) {
  const plan = project.builder?.creativePlan;
  const assets = project.builder?.assets ?? [];
  if (!plan) return { count: '1 of 3', label: 'Imagine your idea' };
  if (!assets.some((asset) => asset.kind === 'background')) {
    return { count: '2 of 3', label: 'Draw the game world' };
  }
  if (!assets.some((asset) => asset.kind === 'object')) {
    return { count: '3 of 3', label: 'Draw game pieces' };
  }
  return { count: '3 of 3', label: 'Finish your world' };
}

function SectionTitle({ children, accent = colors.lavender }: { children: string; accent?: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionTitle}>{children}</Text>
      <View style={[styles.sectionUnderline, { backgroundColor: accent }]} />
    </View>
  );
}

function ProjectArtwork({
  project,
  imageSource,
  onPress,
}: {
  project: GameProject;
  imageSource: ImageSourcePropType | null;
  onPress: (project: GameProject) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open ${project.title}`}
      accessibilityRole="button"
      onPress={() => onPress(project)}
      style={({ pressed }) => [styles.projectArtwork, pressed ? styles.pressed : null]}>
      <LinearGradient colors={['#3152AE', '#A44FC5', '#FF8B75']} style={StyleSheet.absoluteFill} />
      {imageSource ? <Image source={imageSource} style={styles.coverImage} /> : null}
      {!imageSource ? <Text style={styles.fallbackSpark}>✦</Text> : null}
      <LinearGradient colors={['transparent', '#11102CB5']} style={styles.projectArtShade} />
      <Text numberOfLines={1} style={styles.projectArtTitle}>{project.title}</Text>
    </Pressable>
  );
}

function ContinueProjectCard({
  project,
  imageSource,
  onPress,
}: {
  project: GameProject;
  imageSource: ImageSourcePropType | null;
  onPress: (project: GameProject) => void;
}) {
  const step = projectStep(project);
  return (
    <Pressable
      accessibilityLabel={`Keep creating ${project.title}`}
      accessibilityRole="button"
      onPress={() => onPress(project)}
      style={({ pressed }) => [styles.continueCard, pressed ? styles.pressed : null]}>
      <View style={styles.continueArt}>
        <LinearGradient colors={['#4C5BC8', '#53C1B0', '#FFCC5C']} style={StyleSheet.absoluteFill} />
        {imageSource ? <Image source={imageSource} style={styles.coverImage} /> : <Text style={styles.continueFallback}>✦</Text>}
      </View>
      <LinearGradient colors={['#28204F', '#332166']} style={styles.continueDetails}>
        <Text numberOfLines={2} style={styles.continueTitle}>{project.title}</Text>
        <Text style={styles.continueStep}>
          <Text style={styles.continueStepCount}>{step.count}</Text>
          {'  ·  '}{step.label}
        </Text>
        <View style={styles.doodleCard}>
          <Text style={styles.doodleTape}>▰</Text>
          <Text style={styles.doodlePerson}>♙</Text>
        </View>
        <LinearGradient colors={['#7B35EE', '#9C4DFA']} style={styles.keepCreatingButton}>
          <Text style={styles.keepCreatingText}>Keep creating</Text>
          <Ionicons color={colors.white} name="chevron-forward" size={21} />
        </LinearGradient>
      </LinearGradient>
    </Pressable>
  );
}

export default function ChildHomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    child,
    projects,
    isLoading,
    isRestoringSession,
    errorMessage,
    joinAsGuest,
    refreshChildProjects,
    projectImageSource,
    clearError,
  } = useAppState();
  const childUserId = child?.id;
  const featuredProject = useMemo(
    () => projects.find((project) => project.status === 'draft' || project.builder?.stage !== 'ready_to_publish') ?? null,
    [projects],
  );
  const otherProjects = useMemo(
    () => projects.filter((project) => project.id !== featuredProject?.id),
    [featuredProject?.id, projects],
  );
  const heroHeight = Math.min(330, Math.max(278, Math.min(width - 28, 724) * 0.72));

  useEffect(() => {
    if (childUserId) void refreshChildProjects().catch(() => undefined);
  }, [childUserId, refreshChildProjects]);

  const openProject = useCallback(
    (project: GameProject) => {
      if (project.builder?.stage !== 'ready_to_publish') {
        router.push({ pathname: '/builder/[projectId]', params: { projectId: project.id } });
        return;
      }
      router.push({ pathname: '/studio/[projectId]', params: { projectId: project.id } });
    },
    [router],
  );

  if (isRestoringSession) {
    return (
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <BrandHeader home />
        <View style={styles.guestCentered}><LoadingPill label="Opening your lab…" /></View>
      </SafeAreaView>
    );
  }

  if (!child) {
    return (
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <BrandHeader home />
        <View style={styles.guestPage}>
          <LinearGradient colors={['#744AE0', '#D86F91', '#FF9C73']} style={styles.guestHero}>
            <Text style={styles.eyebrow}>YOUR CREATOR ACCOUNT</Text>
            <Text style={styles.guestTitle}>Make a world that starts with you.</Text>
            <Text style={styles.guestBody}>
              Join as a guest, then talk, draw, arrange, test, and keep improving your game. We&apos;ll give you a Child ID a parent can connect.
            </Text>
            <ActionButton
              label="✦  Join as Guest"
              loading={isLoading}
              onPress={() => void joinAsGuest().catch(() => undefined)}
            />
          </LinearGradient>
          {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={clearError} /> : null}
          <Text style={styles.guestPrivacy}>Your private login token stays on this device. Only share the Child ID.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <LinearGradient colors={['#12102F', '#090923']} style={StyleSheet.absoluteFill} />
      <ChildPageHeader childId={child.childId} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={[styles.playgroundHero, { height: heroHeight, paddingHorizontal: width < 390 ? 20 : 35 }]}>
            <Image resizeMode="stretch" source={heroCollage} style={styles.heroImage} />
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>
                What will{`\n`}you <Text style={styles.heroTitleAccent}>invent</Text>{`\n`}today?
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/new-project')}
              style={({ pressed }) => [styles.startProjectButtonOuter, pressed ? styles.startPressed : null]}>
              <LinearGradient colors={['#FF704F', '#F24E3C']} style={styles.startProjectButton}>
                <Text style={styles.startStar}>✱</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.startProjectText}>Start a new project</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={clearError} /> : null}
          {isLoading && projects.length > 0 ? <LoadingPill /> : null}

          {featuredProject ? (
            <View style={styles.sectionBlock}>
              <SectionTitle accent={colors.coral}>Continue creating</SectionTitle>
              <ContinueProjectCard
                imageSource={projectImageSource(featuredProject)}
                onPress={openProject}
                project={featuredProject}
              />
            </View>
          ) : null}

          <View style={styles.sectionBlock}>
            <SectionTitle>Your projects</SectionTitle>
            {projects.length === 0 && !isLoading ? (
              <EmptyState detail="Start a new project whenever you are ready." symbol="☄" title="A blank lab is full of possibilities." />
            ) : null}
            {otherProjects.length > 0 ? (
              <View style={styles.projectGrid}>
                {otherProjects.map((project) => (
                  <ProjectArtwork
                    imageSource={projectImageSource(project)}
                    key={project.id}
                    onPress={openProject}
                    project={project}
                  />
                ))}
              </View>
            ) : featuredProject ? (
              <Text style={styles.onlyProjectCopy}>Your next finished world will appear here.</Text>
            ) : null}
          </View>

          <View style={styles.sectionBlock}>
            <SectionTitle accent="#FFE36C">Project gallery</SectionTitle>
            <View style={styles.galleryRow}>
              {galleryImages.map((source, index) => (
                <View key={index} style={styles.galleryTile}>
                  <Image source={source} style={styles.coverImage} />
                  {index < 2 ? (
                    <View style={styles.galleryStar}><Text style={styles.galleryStarText}>★</Text></View>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0D0C26' },
  guestCentered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  guestPage: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: 18 },
  guestHero: { gap: spacing.md, borderRadius: radii.hero, padding: 26 },
  guestTitle: { maxWidth: 560, color: colors.white, fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 43 },
  guestBody: { maxWidth: 620, color: '#FFFFFFDB', fontSize: 15, lineHeight: 22 },
  guestPrivacy: { color: colors.softText, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  eyebrow: { color: '#FFFFFFC9', fontSize: 12, fontWeight: '900', letterSpacing: 1.3 },
  scrollContent: { alignItems: 'center', paddingBottom: 166 },
  content: { width: '100%', maxWidth: 760, gap: 22, paddingHorizontal: 14, paddingTop: 2 },
  playgroundHero: { position: 'relative', overflow: 'hidden', justifyContent: 'space-between', borderRadius: 28, paddingHorizontal: 35, paddingTop: 27, paddingBottom: 18 },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', borderRadius: 28 },
  heroCopy: { alignItems: 'center', paddingLeft: 50 },
  heroTitle: { color: '#111638', fontSize: 45, fontWeight: '900', letterSpacing: -2.3, lineHeight: 44, textAlign: 'center', textShadowColor: '#FFFFFF50', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  heroTitleAccent: { color: '#7135DB' },
  startProjectButtonOuter: { borderWidth: 4, borderColor: '#FFF2D7', borderRadius: 28, backgroundColor: '#B7382D', shadowColor: '#281023', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8 },
  startPressed: { transform: [{ translateY: 2 }], opacity: 0.94 },
  startProjectButton: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 23, paddingHorizontal: 17 },
  startStar: { color: '#FFF8DF', fontSize: 34, fontWeight: '900' },
  startProjectText: { flexShrink: 1, color: colors.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  sectionBlock: { gap: 10 },
  sectionTitleWrap: { alignSelf: 'flex-start', gap: 3 },
  sectionTitle: { color: colors.white, fontSize: 25, fontWeight: '900', letterSpacing: -0.8 },
  sectionUnderline: { width: 44, height: 4, borderRadius: 3, transform: [{ rotate: '-4deg' }] },
  continueCard: { minHeight: 185, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: '#7A5CDC88', borderRadius: 24, backgroundColor: '#241B4C', shadowColor: '#000', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 7 },
  continueArt: { width: '49%', overflow: 'hidden' },
  continueFallback: { color: '#FFFFFFD9', fontSize: 62, fontWeight: '900', textAlign: 'center', marginTop: 52 },
  continueDetails: { flex: 1, gap: 6, padding: 15, paddingBottom: 13 },
  continueTitle: { minHeight: 44, color: colors.white, fontSize: 20, fontWeight: '900', letterSpacing: -0.6, lineHeight: 22 },
  continueStep: { color: '#E6E1F4', fontSize: 12, fontWeight: '700' },
  continueStepCount: { color: '#63E0C1', fontWeight: '900' },
  doodleCard: { width: 58, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 3, backgroundColor: '#FFF7DE', transform: [{ rotate: '-6deg' }] },
  doodleTape: { position: 'absolute', top: -9, color: '#C6B7A6', fontSize: 21, transform: [{ rotate: '7deg' }] },
  doodlePerson: { color: '#19867C', fontSize: 27 },
  keepCreatingButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 'auto', borderRadius: 15, paddingHorizontal: 10 },
  keepCreatingText: { color: colors.white, fontSize: 16, fontWeight: '900', letterSpacing: -0.4 },
  projectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  projectArtwork: { position: 'relative', flexBasis: '48%', flexGrow: 1, minWidth: 130, aspectRatio: 1.35, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF30', borderRadius: 19, backgroundColor: colors.surface },
  projectArtShade: { ...StyleSheet.absoluteFillObject, top: '48%' },
  projectArtTitle: { position: 'absolute', right: 10, bottom: 8, left: 10, color: colors.white, fontSize: 13, fontWeight: '900' },
  fallbackSpark: { color: '#FFFFFFD9', fontSize: 42, fontWeight: '900', textAlign: 'center', marginTop: 32 },
  coverImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  onlyProjectCopy: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  galleryRow: { flexDirection: 'row', gap: 8 },
  galleryTile: { position: 'relative', flex: 1, aspectRatio: 0.98, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF34', borderRadius: 18, backgroundColor: colors.surface },
  galleryStar: { position: 'absolute', top: 7, right: 7, width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#FFF7D8', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
  galleryStarText: { color: '#FFBF1F', fontSize: 18 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
});

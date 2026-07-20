import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { GameProject } from '@/api/types';
import { BrandHeader } from '@/components/brand-header';
import { HoldToTalkButton } from '@/components/hold-to-talk-button';
import { ProjectCard } from '@/components/project-card';
import { ActionButton, EmptyState, ErrorBanner, LoadingPill, SectionHeading } from '@/components/ui';
import { useAppState } from '@/state/app-provider';
import { colors, radii, spacing } from '@/theme';

export default function ChildHomeScreen() {
  const router = useRouter();
  const {
    child,
    projects,
    isLoading,
    isRestoringSession,
    errorMessage,
    joinAsGuest,
    refreshChildProjects,
    createProject,
    transcribeAudio,
    projectImageSource,
    clearError,
  } = useAppState();
  const [prompt, setPrompt] = useState('');
  const childUserId = child?.id;
  const featuredProject = projects[0] ?? null;
  const otherProjects = useMemo(() => projects.slice(1), [projects]);

  useEffect(() => {
    if (childUserId) void refreshChildProjects().catch(() => undefined);
  }, [childUserId, refreshChildProjects]);

  const openProject = useCallback(
    (project: GameProject) => {
      router.push({ pathname: '/studio/[projectId]', params: { projectId: project.id } });
    },
    [router],
  );

  const handleCreate = useCallback(async () => {
    const idea = prompt.trim();
    if (idea.length < 3) return;
    await Haptics.selectionAsync();
    try {
      const project = await createProject(idea);
      setPrompt('');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: '/builder/[projectId]', params: { projectId: project.id } });
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [createProject, prompt, router]);

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setPrompt((current) => joinPrompt(current, transcript));
  }, []);

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
            <Text style={styles.heroBody}>
              Join as a guest, then talk, draw, arrange, test, and keep improving your game. We&apos;ll give you a Child ID a parent can connect.
            </Text>
            <ActionButton label="✦  Join as Guest" loading={isLoading} onPress={() => void joinAsGuest()} />
          </LinearGradient>
          {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={clearError} /> : null}
          <Text style={styles.guestPrivacy}>Your private login token stays on this device. Only share the Child ID.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <BrandHeader home />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.accountCard}>
              <View style={styles.creatorAvatar}><Text style={styles.creatorAvatarText}>🤖</Text></View>
              <View style={styles.accountCopy}>
                <Text style={styles.accountLabel}>GUEST CREATOR</Text>
                <Text style={styles.childId}>{child.childId}</Text>
                <Pressable
                  accessibilityLabel="Copy Child ID"
                  accessibilityRole="button"
                  onPress={() => void Clipboard.setStringAsync(child.childId)}
                  style={({ pressed }) => [styles.copyIdButton, pressed ? styles.copyIdPressed : null]}>
                  <Text style={styles.copyIdText}>▣&nbsp; Copy ID</Text>
                </Pressable>
              </View>
              <View style={[styles.connectionPill, child.linked ? styles.connectionPillLinked : null]}>
                <Text style={styles.connectionText}>{child.linked ? '✓ CONNECTED' : '○ NOT CONNECTED'}</Text>
              </View>
            </View>

            <LinearGradient colors={['#744AE0', '#D86F91', '#FF9C73']} style={styles.hero}>
              <Text style={styles.eyebrow}>YOUR NEXT WORLD</Text>
              <Text style={styles.heroTitle}>What do you want to play?</Text>
              <Text style={styles.heroBody}>
                Start with a character, challenge, or silly rule. Next you&apos;ll draw and arrange the world yourself.
              </Text>
              <TextInput
                accessibilityLabel="Describe your game idea"
                multiline
                maxLength={1500}
                onChangeText={setPrompt}
                placeholder="A penguin slides through space and catches strawberries…"
                placeholderTextColor="#E6DCF0A8"
                style={styles.promptInput}
                textAlignVertical="top"
                value={prompt}
              />
              <HoldToTalkButton onTranscript={handleVoiceTranscript} transcribeAudio={transcribeAudio} />
              <ActionButton
                disabled={prompt.trim().length < 3}
                label="✦  Make it playable"
                loading={isLoading}
                onPress={() => void handleCreate()}
              />
            </LinearGradient>

            {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={clearError} /> : null}
            {isLoading && projects.length > 0 ? <LoadingPill /> : null}

            <SectionHeading
              detail={projects.length === 0 ? 'Your games will live here.' : `${projects.length} total`}
              title="Your creations"
            />
            {projects.length === 0 && !isLoading ? (
              <EmptyState detail="Start with the idea above." symbol="☄" title="A blank lab is full of possibilities." />
            ) : null}
            {featuredProject ? (
              <ProjectCard
                imageSource={projectImageSource(featuredProject)}
                onPress={openProject}
                project={featuredProject}
                variant="featured"
              />
            ) : null}
            {otherProjects.length > 0 ? (
              <View style={styles.projectGrid}>
                {otherProjects.map((project) => (
                  <ProjectCard
                    imageSource={projectImageSource(project)}
                    key={project.id}
                    onPress={openProject}
                    project={project}
                    style={styles.gridCard}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  guestCentered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  guestPage: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: 18 },
  guestHero: { gap: spacing.md, borderRadius: radii.hero, padding: 26 },
  guestTitle: { maxWidth: 560, color: colors.white, fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 43 },
  guestPrivacy: { color: colors.softText, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  scrollContent: { alignItems: 'center', paddingBottom: 54 },
  content: { width: '100%', maxWidth: 760, gap: spacing.md, paddingHorizontal: 18, paddingTop: 4 },
  accountCard: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#A88BFF38',
    borderRadius: 22,
    backgroundColor: '#292443',
    padding: 14,
  },
  creatorAvatar: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 31, backgroundColor: '#3B345E' },
  creatorAvatarText: { fontSize: 34 },
  accountCopy: { flex: 1, gap: 3 },
  accountLabel: { color: colors.lavender, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  childId: { color: colors.white, fontSize: 17, fontWeight: '900', letterSpacing: 1 },
  copyIdButton: { alignSelf: 'flex-start', paddingVertical: 3 },
  copyIdPressed: { opacity: 0.65 },
  copyIdText: { color: colors.softText, fontSize: 11, fontWeight: '800' },
  connectionPill: { borderRadius: radii.pill, backgroundColor: '#FFFFFF12', paddingHorizontal: 10, paddingVertical: 7 },
  connectionPillLinked: { backgroundColor: '#68DCB526' },
  connectionText: { color: colors.mint, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  hero: { gap: 12, borderRadius: radii.hero, padding: 22 },
  eyebrow: { color: '#FFFFFFC9', fontSize: 12, fontWeight: '900', letterSpacing: 1.3 },
  heroTitle: { maxWidth: 520, color: colors.white, fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 43 },
  heroBody: { maxWidth: 620, color: '#FFFFFFDB', fontSize: 15, lineHeight: 22 },
  promptInput: {
    minHeight: 108,
    borderWidth: 1,
    borderColor: '#FFFFFF42',
    borderRadius: 20,
    backgroundColor: '#17142B82',
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    padding: spacing.md,
  },
  projectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: { flexBasis: '47%' },
});

function joinPrompt(current: string, transcript: string): string {
  return [current.trim(), transcript.trim()].filter(Boolean).join(' ');
}

import { useCallback, useEffect, useState } from 'react';
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
import {
  ActionButton,
  EmptyState,
  ErrorBanner,
  LoadingPill,
  SectionHeading,
} from '@/components/ui';
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
    clearError,
  } = useAppState();
  const [prompt, setPrompt] = useState('');
  const childUserId = child?.id;

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
        <BrandHeader />
        <View style={styles.guestCentered}><LoadingPill label="Opening your lab…" /></View>
      </SafeAreaView>
    );
  }

  if (!child) {
    return (
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <BrandHeader />
        <View style={styles.guestPage}>
          <LinearGradient colors={['#6D4FCA', '#B95E84', '#E58A6E']} style={styles.guestHero}>
            <Text style={styles.eyebrow}>YOUR CREATOR ACCOUNT</Text>
            <Text style={styles.guestTitle}>Join the lab as a guest.</Text>
            <Text style={styles.heroBody}>
              We&apos;ll make a private creator session and a Child ID you can share with a parent.
              You don&apos;t need an email or password yet.
            </Text>
            <ActionButton
              label="✦  Join as Guest"
              loading={isLoading}
              onPress={() => void joinAsGuest()}
            />
          </LinearGradient>
          {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={clearError} /> : null}
          <Text style={styles.guestPrivacy}>
            Your Child ID can connect a parent. Your private login token stays on this device.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <BrandHeader />
      <View style={styles.accountCard}>
        <View style={styles.accountCopy}>
          <Text style={styles.accountLabel}>GUEST CREATOR</Text>
          <Text style={styles.childId}>{child.childId}</Text>
          <Text style={styles.accountStatus}>
            {child.linked ? '✓ Connected to a parent' : 'Share this ID with a parent to connect'}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Copy Child ID"
          accessibilityRole="button"
          onPress={() => void Clipboard.setStringAsync(child.childId)}
          style={({ pressed }) => [styles.copyIdButton, pressed ? styles.copyIdPressed : null]}>
          <Text style={styles.copyIdText}>Copy ID</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <LinearGradient colors={['#6D4FCA', '#B95E84', '#E58A6E']} style={styles.hero}>
            <Text style={styles.eyebrow}>YOUR NEXT WORLD</Text>
            <Text style={styles.heroTitle}>What do you want to play?</Text>
            <Text style={styles.heroBody}>
              Describe a character, a challenge, or a silly rule. ImagineLab will turn it into a
              game.
            </Text>
            <TextInput
              accessibilityLabel="Describe your game idea"
              multiline
              maxLength={1500}
              onChangeText={setPrompt}
              placeholder="A penguin slides through space and catches strawberries…"
              placeholderTextColor="#D9D0E9A8"
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
            <EmptyState
              detail="Start with the idea above."
              symbol="☄"
              title="A blank lab is full of possibilities."
            />
          ) : (
            <View style={styles.projectList}>
              {projects.map((project) => (
                <ProjectCard key={project.id} onPress={openProject} project={project} />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  flex: {
    flex: 1,
  },
  guestCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestPage: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    padding: 18,
  },
  guestHero: {
    gap: spacing.md,
    borderRadius: radii.hero,
    padding: 26,
  },
  guestTitle: {
    maxWidth: 470,
    color: colors.white,
    fontSize: 43,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 44,
  },
  guestPrivacy: {
    color: colors.softText,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginHorizontal: 18,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#A88BFF38',
    borderRadius: 18,
    backgroundColor: '#2A2543',
    padding: 14,
  },
  accountCopy: {
    flex: 1,
    gap: 3,
  },
  accountLabel: {
    color: colors.lavender,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  childId: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  accountStatus: {
    color: colors.softText,
    fontSize: 11,
  },
  copyIdButton: {
    borderRadius: 12,
    backgroundColor: '#A88BFF24',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  copyIdPressed: {
    opacity: 0.72,
  },
  copyIdText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: 18,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  hero: {
    gap: 12,
    borderRadius: radii.hero,
    padding: 22,
  },
  eyebrow: {
    color: '#FFFFFFBF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heroTitle: {
    maxWidth: 420,
    color: colors.white,
    fontSize: 39,
    fontWeight: '900',
    letterSpacing: -1.8,
    lineHeight: 40,
  },
  heroBody: {
    maxWidth: 560,
    color: '#FFFFFFD6',
    fontSize: 16,
    lineHeight: 23,
  },
  promptInput: {
    minHeight: 112,
    borderWidth: 1,
    borderColor: '#FFFFFF42',
    borderRadius: 20,
    backgroundColor: '#17142B82',
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    padding: spacing.md,
  },
  projectList: {
    gap: 12,
  },
});

function joinPrompt(current: string, transcript: string): string {
  return [current.trim(), transcript.trim()].filter(Boolean).join(' ');
}

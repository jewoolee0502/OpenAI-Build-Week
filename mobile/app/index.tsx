import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    projects,
    isLoading,
    errorMessage,
    refreshChildProjects,
    createProject,
    clearError,
  } = useAppState();
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    void refreshChildProjects().catch(() => undefined);
  }, [refreshChildProjects]);

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
      openProject(project);
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [createProject, openProject, prompt]);

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setPrompt((current) => joinPrompt(current, transcript));
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <BrandHeader />
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
            <HoldToTalkButton onTranscript={handleVoiceTranscript} />
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

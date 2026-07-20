import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiBaseUrl } from '@/api/client';
import { BrandHeader } from '@/components/brand-header';
import { GamePreview } from '@/components/game-preview';
import { HoldToTalkButton } from '@/components/hold-to-talk-button';
import {
  ActionButton,
  EmptyState,
  ErrorBanner,
  InlineRow,
  LoadingPill,
  MiniBadge,
  SurfaceCard,
} from '@/components/ui';
import { useAppState } from '@/state/app-provider';
import { colors, spacing } from '@/theme';

export default function StudioScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const {
    projects,
    isLoading,
    errorMessage,
    refreshChildProjects,
    editProject,
    publishProject,
    unpublishProject,
    transcribeAudio,
    projectImageSource,
    clearError,
  } = useAppState();
  const project = projects.find((candidate) => candidate.id === projectId);
  const [instruction, setInstruction] = useState('');
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!project) void refreshChildProjects().catch(() => undefined);
  }, [project, refreshChildProjects]);

  useEffect(() => {
    if (project?.status === 'published' && project.publicSlug && apiBaseUrl) {
      setPublishedUrl(`${apiBaseUrl}/g/${project.publicSlug}`);
    } else {
      setPublishedUrl(null);
    }
  }, [project?.publicSlug, project?.status]);

  const hasUnpublishedChanges = useMemo(
    () =>
      Boolean(
        project?.status === 'published' &&
          project.publishedVersionId &&
          project.publishedVersionId !== project.currentVersionId,
      ),
    [project?.currentVersionId, project?.publishedVersionId, project?.status],
  );

  const handleEdit = useCallback(async () => {
    const change = instruction.trim();
    if (!projectId || change.length < 2) return;
    await Haptics.selectionAsync();
    try {
      await editProject(projectId, change);
      setInstruction('');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [editProject, instruction, projectId]);

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setInstruction((current) => joinPrompt(current, transcript));
  }, []);

  const handlePublish = useCallback(async () => {
    if (!projectId) return;
    await Haptics.selectionAsync();
    try {
      const response = await publishProject(projectId);
      setPublishedUrl(response.publicUrl);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [projectId, publishProject]);

  const handleShare = useCallback(async () => {
    if (!publishedUrl || !project) return;
    await Share.share({
      message: `Play ${project.title}, made with ImagineLab: ${publishedUrl}`,
      url: publishedUrl,
    });
  }, [project, publishedUrl]);

  const handleCopy = useCallback(async () => {
    if (!publishedUrl) return;
    await Clipboard.setStringAsync(publishedUrl);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [publishedUrl]);

  const handleUnpublish = useCallback(() => {
    if (!projectId) return;
    Alert.alert(
      'Unpublish this game?',
      'The public link will stop serving the game until you publish it again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpublish',
          style: 'destructive',
          onPress: () => {
            void unpublishProject(projectId)
              .then(() => {
                setPublishedUrl(null);
                return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              })
              .catch(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
          },
        },
      ],
    );
  }, [projectId, unpublishProject]);

  if (!project) {
    return (
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <BrandHeader onBack={() => router.back()} />
        <View style={styles.centered}>
          {isLoading ? (
            <LoadingPill label="Loading project…" />
          ) : (
            <EmptyState detail="Return to your projects and try again." symbol="?" title="Project not found." />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <BrandHeader onBack={() => router.back()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <LinearGradient colors={['#4D36A2', '#C56890']} style={styles.projectHero}>
            <Image source={projectImageSource(project) ?? undefined} style={styles.projectCover} />
            <LinearGradient colors={['#17142B12', '#17142BF2']} style={styles.projectCoverShade} />
            <View style={styles.projectHeroContent}>
              <View style={styles.titleRow}>
                <View style={styles.titleContent}>
                  <Text style={styles.eyebrow}>PLAYTEST & IMPROVE</Text>
                  <Text style={styles.title}>{project.title}</Text>
                  <Text style={styles.subtitle}>Version {project.currentVersion.versionNumber} · {project.status}</Text>
                </View>
                <MiniBadge color={project.status === 'published' ? colors.mint : colors.lavender} label={project.status === 'published' ? 'LIVE' : 'DRAFT'} />
              </View>
              <View style={styles.builderButton}>
                <ActionButton label="✎  Edit my canvas" onPress={() => router.push({ pathname: '/builder/[projectId]', params: { projectId: project.id } })} tone="secondary" />
              </View>
            </View>
          </LinearGradient>

          {hasUnpublishedChanges ? (
            <View style={styles.draftNotice}>
              <Text style={styles.draftNoticeText}>
                Your newest version is still a draft. The public link continues serving the last
                published version.
              </Text>
            </View>
          ) : null}

          <View style={styles.previewHeading}><View><Text style={styles.eyebrow}>YOUR PLAYABLE GAME</Text><Text style={styles.previewTitle}>Try it like a player</Text></View><Text style={styles.previewHint}>Tap, test, notice</Text></View>
          <GamePreview height={460} html={project.currentVersion.html} />
          {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={clearError} /> : null}
          {isLoading ? <LoadingPill /> : null}

          <SurfaceCard style={styles.card}>
            <Text style={styles.cardTitle}>Change the game</Text>
            <Text style={styles.cardBody}>Tell ImagineLab what should feel different.</Text>
            <TextInput
              accessibilityLabel="Describe a change to the game"
              maxLength={1000}
              multiline
              onChangeText={setInstruction}
              placeholder="Make it faster, add three lives, and turn the sky purple…"
              placeholderTextColor={colors.mutedText}
              style={styles.input}
              textAlignVertical="top"
              value={instruction}
            />
            <HoldToTalkButton onTranscript={handleVoiceTranscript} transcribeAudio={transcribeAudio} />
            <ActionButton
              disabled={instruction.trim().length < 2}
              label="Build a new version"
              loading={isLoading}
              onPress={() => void handleEdit()}
            />
          </SurfaceCard>

          <SurfaceCard style={styles.card}>
            <Text style={styles.cardTitle}>Ready to share?</Text>
            <Text style={styles.cardBody}>
              Publishing creates a public play link. No account is needed to open it.
            </Text>
            <ActionButton
              label={project.status === 'published' ? 'Update published game' : 'Publish game'}
              loading={isLoading}
              onPress={() => void handlePublish()}
              tone="mint"
            />

            {publishedUrl ? (
              <View style={styles.linkBlock}>
                <Text numberOfLines={2} selectable style={styles.link}>
                  {publishedUrl}
                </Text>
                <InlineRow>
                  <View style={styles.halfButton}>
                    <ActionButton label="Copy link" onPress={() => void handleCopy()} tone="secondary" />
                  </View>
                  <View style={styles.halfButton}>
                    <ActionButton label="Share" onPress={() => void handleShare()} tone="secondary" />
                  </View>
                </InlineRow>
                <ActionButton label="Unpublish" onPress={handleUnpublish} tone="danger" />
              </View>
            ) : null}
          </SurfaceCard>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  content: {
    gap: spacing.md,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  projectHero: {
    position: 'relative',
    minHeight: 250,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderRadius: 28,
  },
  projectCover: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  projectCoverShade: {
    ...StyleSheet.absoluteFillObject,
  },
  projectHeroContent: {
    gap: 13,
    padding: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.mint,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  titleContent: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.white,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 33,
  },
  subtitle: {
    color: colors.softText,
    fontSize: 15,
  },
  builderButton: {
    maxWidth: 240,
  },
  previewHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewTitle: {
    marginTop: 3,
    color: colors.white,
    fontSize: 22,
    fontWeight: '900',
  },
  previewHint: {
    color: colors.softText,
    fontSize: 12,
  },
  draftNotice: {
    borderWidth: 1,
    borderColor: '#A88BFF38',
    borderRadius: 16,
    backgroundColor: '#A88BFF16',
    padding: 13,
  },
  draftNoticeText: {
    color: colors.softText,
    lineHeight: 20,
  },
  card: {
    gap: 12,
  },
  cardTitle: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '900',
  },
  cardBody: {
    color: colors.softText,
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    minHeight: 94,
    borderWidth: 1,
    borderColor: '#FFFFFF24',
    borderRadius: 18,
    backgroundColor: colors.surfaceLifted,
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    padding: spacing.md,
  },
  linkBlock: {
    gap: spacing.sm,
  },
  link: {
    color: colors.mint,
    fontSize: 14,
    lineHeight: 20,
  },
  halfButton: {
    minWidth: 130,
    flex: 1,
  },
});

function joinPrompt(current: string, transcript: string): string {
  return [current.trim(), transcript.trim()].filter(Boolean).join(' ');
}

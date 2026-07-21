import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import miloAgent from '../assets/images/home/milo-agent.png';

import { HoldToTalkButton } from '@/components/hold-to-talk-button';
import { ErrorBanner } from '@/components/ui';
import { createProjectFromVoice } from '@/features/voice-project';
import { useAppState } from '@/state/app-provider';
import { colors, radii, spacing } from '@/theme';

export default function NewProjectScreen() {
  const router = useRouter();
  const {
    child,
    isRestoringSession,
    createProject,
    transcribeAudio,
    errorMessage,
    clearError,
  } = useAppState();

  useEffect(() => {
    if (!isRestoringSession && !child) router.replace('/');
  }, [child, isRestoringSession, router]);

  const handleVoiceTranscript = useCallback(async (transcript: string) => {
    const project = await createProjectFromVoice(transcript, createProject);
    router.replace({ pathname: '/builder/[projectId]', params: { projectId: project.id } });
  }, [createProject, router]);

  if (!child) return <SafeAreaView style={styles.safe} />;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" hitSlop={8} onPress={() => router.back()} style={styles.backButton}>
            <Ionicons color={colors.white} name="arrow-back" size={26} />
          </Pressable>
          <View style={styles.headerBrand}>
            <Text style={styles.headerSpark}>✦</Text>
            <Text style={styles.headerTitle}>New project</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View accessibilityLabel="Step 1 of 3: Idea" style={styles.stepRail}>
          <View style={styles.stepActive}><Text style={styles.stepActiveText}>1&nbsp; IDEA</Text></View>
          <View style={styles.stepLine} />
          <Text style={styles.stepText}>2&nbsp; WORLD</Text>
          <View style={styles.stepLine} />
          <Text style={styles.stepText}>3&nbsp; PIECES</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.ideaPaper}>
            <Text style={styles.eyebrow}>YOUR IDEA</Text>
            <Text style={styles.title}>Tell Milo your game idea</Text>
            <Text style={styles.helper}>Hold Milo, tell your story, then release. We&apos;ll start building right away.</Text>

            <HoldToTalkButton
              imageSource={miloAgent}
              onTranscript={handleVoiceTranscript}
              style={styles.milo}
              transcribeAudio={transcribeAudio}
              variant="milo"
            />
            <Text style={styles.example}>Try: “A bunny plays rainbow golf in the clouds.”</Text>
          </View>
          {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={clearError} /> : null}
        </ScrollView>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  backButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: '#FFFFFF10',
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSpark: { color: colors.mint, fontSize: 22, fontWeight: '900' },
  headerTitle: { color: colors.white, fontSize: 19, fontWeight: '900' },
  headerSpacer: { width: 46 },
  stepRail: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 18,
  },
  stepActive: { borderRadius: radii.pill, backgroundColor: '#FF8E8324', paddingHorizontal: 10, paddingVertical: 6 },
  stepActiveText: { color: colors.coral, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  stepText: { color: colors.mutedText, fontSize: 10, fontWeight: '900', letterSpacing: 0.35 },
  stepLine: { width: 18, height: 1, backgroundColor: '#FFFFFF24' },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: 18 },
  ideaPaper: {
    width: '100%',
    maxWidth: 620,
    alignItems: 'center',
    gap: 17,
    borderRadius: 34,
    backgroundColor: '#FFF8EF',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  eyebrow: { alignSelf: 'flex-start', color: '#6D3CE7', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 37, fontWeight: '900', letterSpacing: -1.5, lineHeight: 39, textAlign: 'center' },
  helper: { maxWidth: 420, color: '#514A65', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  milo: { marginVertical: 12 },
  example: { color: '#726A83', fontSize: 12, fontWeight: '700', lineHeight: 17, textAlign: 'center' },
});

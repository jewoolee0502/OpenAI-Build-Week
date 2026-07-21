import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import miloAgent from '../assets/images/home/milo-agent.png';
import newProjectFrame from '../assets/images/home/new-project-frame-v2.png';

import { HoldToTalkButton } from '@/components/hold-to-talk-button';
import { IllustratedSceneFrame } from '@/components/illustrated-scene-frame';
import { createProjectFromVoice } from '@/features/voice-project';
import { useAppState } from '@/state/app-provider';
import { colors, radii, spacing } from '@/theme';

export default function NewProjectScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const isCompact = height < 760 || width <= 420;
  const frameWidth = Math.min(width - 16, 510);
  const frameHeight = frameWidth / (isCompact ? 0.6 : 0.72);
  const {
    child,
    isRestoringSession,
    createProject,
    transcribeAudio,
    clearError,
  } = useAppState();

  useEffect(() => {
    if (!isRestoringSession && !child) router.replace('/');
  }, [child, isRestoringSession, router]);

  useEffect(() => () => clearError(), [clearError]);

  const handleVoiceTranscript = useCallback(async (transcript: string) => {
    const project = await createProjectFromVoice(transcript, createProject);
    router.replace({ pathname: '/builder/[projectId]', params: { projectId: project.id } });
  }, [createProject, router]);

  if (!child) return <SafeAreaView style={styles.safe} />;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <LinearGradient colors={['#17142F', '#0C0B24']} style={StyleSheet.absoluteFill} />
      <View style={styles.flex}>
        <View style={styles.topArea}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}>
              <Ionicons color={colors.white} name="arrow-back" size={22} />
            </Pressable>
            <View style={styles.headerBrand}>
              <Text style={styles.headerSpark}>✦</Text>
              <Text style={styles.headerTitle}>New project</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <View accessibilityLabel="Step 1 of 3: Idea" style={styles.stepRail}>
            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, styles.stepNumberActive]}><Text style={styles.stepNumberActiveText}>1</Text></View>
              <Text style={styles.stepActiveText}>Idea</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <Text style={styles.stepText}>World</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
              <Text style={styles.stepText}>Pieces</Text>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, isCompact ? styles.scrollContentCompact : null]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <IllustratedSceneFrame
            contentStyle={[styles.ideaPaper, isCompact ? styles.ideaPaperCompact : null]}
            height={frameHeight}
            imageStyle={styles.frameImage}
            source={newProjectFrame}
            style={styles.paperShadow}
            width={frameWidth}>
              <Text style={styles.eyebrow}>YOUR IDEA</Text>
              <Text style={[styles.title, isCompact ? styles.titleCompact : null]}>Tell Milo your game idea</Text>
              <Text style={styles.helper}>Hold Milo and tell who is in your game, what happens, and what makes it fun.</Text>

              <HoldToTalkButton
                imageSource={miloAgent}
                onTranscript={handleVoiceTranscript}
                style={styles.milo}
                transcribeAudio={transcribeAudio}
                variant="milo"
              />

              <View style={styles.voiceGuide}>
                <Text style={styles.voiceGuideStep}>HOLD</Text>
                <View style={styles.voiceGuideDot} />
                <Text style={styles.voiceGuideStep}>TELL YOUR IDEA</Text>
                <View style={styles.voiceGuideDot} />
                <Text style={styles.voiceGuideStep}>RELEASE</Text>
              </View>

              <View style={styles.exampleCard}>
                <View style={styles.exampleIcon}>
                  <Ionicons color="#7A43E8" name="bulb-outline" size={18} />
                </View>
                <Text style={styles.example}><Text style={styles.exampleLead}>Need a spark?</Text>{'  '}“A bunny plays rainbow golf in the clouds.”</Text>
              </View>
          </IllustratedSceneFrame>
        </ScrollView>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  topArea: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF1F',
    borderRadius: 21,
    backgroundColor: '#FFFFFF0D',
  },
  backButtonPressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSpark: { color: colors.mint, fontSize: 22, fontWeight: '900' },
  headerTitle: { color: colors.white, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  headerSpacer: { width: 42 },
  stepRail: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 16,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepNumber: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF25', borderRadius: 12, backgroundColor: '#FFFFFF0A' },
  stepNumberActive: { borderColor: '#FFAA9F66', backgroundColor: '#FF8E832B' },
  stepNumberText: { color: '#9E96B6', fontSize: 10, fontWeight: '900' },
  stepNumberActiveText: { color: colors.coral, fontSize: 10, fontWeight: '900' },
  stepActiveText: { color: '#FFABA2', fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  stepText: { color: colors.mutedText, fontSize: 10, fontWeight: '800', letterSpacing: 0.15 },
  stepLine: { width: 22, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF1C' },
  scrollContent: { flexGrow: 1, alignItems: 'center', gap: spacing.md, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 30 },
  scrollContentCompact: { paddingTop: 2, paddingBottom: 18 },
  paperShadow: { maxWidth: 510, shadowColor: '#000', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.26, shadowRadius: 26, elevation: 10 },
  frameImage: { borderRadius: 18 },
  ideaPaper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 60,
    paddingTop: 62,
    paddingBottom: 70,
  },
  ideaPaperCompact: { gap: 9, paddingHorizontal: 40, paddingTop: 102, paddingBottom: 34 },
  eyebrow: { alignSelf: 'flex-start', color: '#6D3CE7', fontSize: 11, fontWeight: '900', letterSpacing: 1.45 },
  title: { maxWidth: 510, color: colors.ink, fontSize: 38, fontWeight: '900', letterSpacing: -1.7, lineHeight: 41, textAlign: 'center' },
  titleCompact: { fontSize: 29, letterSpacing: -1.1, lineHeight: 31 },
  helper: { maxWidth: 450, color: '#514A65', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  milo: { marginTop: 5, marginBottom: 1 },
  voiceGuide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 },
  voiceGuideStep: { color: '#7B718D', fontSize: 9, fontWeight: '900', letterSpacing: 0.65 },
  voiceGuideDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FF8E83' },
  exampleCard: { width: '100%', maxWidth: 470, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3, borderWidth: 1, borderColor: '#6D3CE71C', borderRadius: radii.medium, backgroundColor: '#FFFFFFA6', paddingHorizontal: 13, paddingVertical: 10 },
  exampleIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#EEE5FF' },
  example: { flex: 1, color: '#6D657C', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  exampleLead: { color: '#382A55', fontWeight: '900' },
});

import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { deleteAsync } from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radii, spacing } from '@/theme';

type VoicePhase = 'idle' | 'preparing' | 'recording' | 'transcribing' | 'submitting';

interface HoldToTalkButtonProps {
  onTranscript: (text: string) => void | Promise<void>;
  transcribeAudio: (uri: string) => Promise<string>;
  variant?: 'default' | 'hero' | 'milo';
  imageSource?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
}

const maximumRecordingMilliseconds = 30_000;
const minimumRecordingMilliseconds = 500;

export const HoldToTalkButton = memo(function HoldToTalkButton({
  onTranscript,
  transcribeAudio,
  variant = 'default',
  imageSource,
  style,
}: HoldToTalkButtonProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const phaseRef = useRef<VoicePhase>('idle');
  const isPressingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const recordingStartedAtRef = useRef(0);
  const maximumTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePhase = useCallback((nextPhase: VoicePhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const clearMaximumTimer = useCallback(() => {
    if (maximumTimerRef.current) clearTimeout(maximumTimerRef.current);
    maximumTimerRef.current = null;
  }, []);

  const finishRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    clearMaximumTimer();
    const duration = Date.now() - recordingStartedAtRef.current;
    let recordingUri: string | null = null;

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      recordingUri = recorder.uri;
      if (duration < minimumRecordingMilliseconds) {
        setVoiceError('Hold the button a little longer, then release when you finish speaking.');
        updatePhase('idle');
        return;
      }
      if (!recordingUri) throw new Error('The recording could not be saved. Please try again.');

      updatePhase('transcribing');
      const transcript = await transcribeAudio(recordingUri);
      updatePhase('submitting');
      await onTranscript(transcript);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updatePhase('idle');
    } catch (error) {
      setVoiceError(messageFrom(error));
      updatePhase('idle');
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      if (recordingUri) {
        await deleteAsync(recordingUri, { idempotent: true }).catch(() => undefined);
      }
    }
  }, [clearMaximumTimer, onTranscript, recorder, transcribeAudio, updatePhase]);

  const beginRecording = useCallback(async () => {
    if (phaseRef.current !== 'idle') return;
    setVoiceError(null);
    updatePhase('preparing');

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Microphone permission is needed to use voice ideas.');
      }
      if (!isPressingRef.current) {
        updatePhase('idle');
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!isPressingRef.current) {
        await recorder.stop().catch(() => undefined);
        await setAudioModeAsync({ allowsRecording: false });
        updatePhase('idle');
        return;
      }

      recorder.record();
      isRecordingRef.current = true;
      recordingStartedAtRef.current = Date.now();
      updatePhase('recording');
      await Haptics.selectionAsync();
      maximumTimerRef.current = setTimeout(() => {
        isPressingRef.current = false;
        void finishRecording();
      }, maximumRecordingMilliseconds);
    } catch (error) {
      setVoiceError(messageFrom(error));
      updatePhase('idle');
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }
  }, [finishRecording, recorder, updatePhase]);

  const handlePressIn = useCallback(() => {
    if (phaseRef.current !== 'idle') return;
    isPressingRef.current = true;
    void beginRecording();
  }, [beginRecording]);

  const handlePressOut = useCallback(() => {
    isPressingRef.current = false;
    if (isRecordingRef.current) void finishRecording();
  }, [finishRecording]);

  useEffect(
    () => () => {
      isPressingRef.current = false;
      clearMaximumTimer();
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        void recorder.stop();
      }
    },
    [clearMaximumTimer, recorder],
  );

  const isRecording = phase === 'recording';
  const isPreparing = phase === 'preparing';
  const isTranscribing = phase === 'transcribing';
  const isSubmitting = phase === 'submitting';
  const isBusy = phase === 'preparing' || phase === 'transcribing' || phase === 'submitting';
  const seconds = Math.min(30, Math.ceil(recorderState.durationMillis / 1000));

  if (variant === 'milo') {
    return (
      <View style={[styles.miloWrapper, style]}>
        <Pressable
          accessibilityHint="Keep holding Milo while you speak. Release to add the words to your idea."
          accessibilityLabel={isRecording ? 'Release Milo to finish voice idea' : 'Hold Milo to speak your idea'}
          accessibilityRole="button"
          accessibilityState={{ busy: isBusy }}
          disabled={isTranscribing || isSubmitting}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [
            styles.miloButton,
            isRecording || isPreparing ? styles.miloButtonRecording : null,
            isTranscribing || isSubmitting ? styles.miloButtonBusy : null,
            pressed && phase === 'idle' ? styles.miloButtonPressed : null,
          ]}>
          {isTranscribing || isSubmitting ? <ActivityIndicator color={colors.white} size="large" /> : null}
          {!isTranscribing && !isSubmitting && (isPreparing || isRecording) ? <MaterialCommunityIcons color={colors.white} name="microphone" size={54} /> : null}
          {!isBusy && !isRecording && imageSource ? <Image source={imageSource} style={styles.miloImage} /> : null}
          {!isBusy && !isRecording && !imageSource ? <Text style={styles.miloFallback}>✦</Text> : null}
        </Pressable>
        <View style={[styles.miloBubble, isRecording ? styles.miloBubbleRecording : null]}>
          <Text numberOfLines={1} style={styles.miloBubbleText}>{miloVoiceLabel(phase, seconds)}</Text>
        </View>
        {voiceError ? <Text style={styles.miloError}>{voiceError}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      <Pressable
        accessibilityHint="Keep holding while you speak. Release to turn your voice into text."
        accessibilityLabel={isRecording ? 'Release to finish voice idea' : 'Hold to speak your idea'}
        accessibilityRole="button"
        accessibilityState={{ busy: isBusy }}
        disabled={isTranscribing || isSubmitting}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.button,
          variant === 'hero' ? styles.buttonHero : null,
          isRecording ? styles.buttonRecording : null,
          phase === 'preparing' ? styles.buttonPreparing : null,
          phase === 'transcribing' || phase === 'submitting' ? styles.buttonTranscribing : null,
          pressed && !isBusy ? styles.buttonPressed : null,
        ]}>
        {isBusy ? (
          <ActivityIndicator color={phase === 'transcribing' || phase === 'submitting' ? colors.ink : colors.white} />
        ) : (
          <MaterialCommunityIcons
            color={isRecording ? colors.white : colors.coral}
            name={isRecording ? 'waveform' : 'microphone'}
            size={variant === 'hero' ? 30 : 22}
          />
        )}
        <Text style={[styles.label, variant === 'hero' ? styles.labelHero : null, phase === 'transcribing' || phase === 'submitting' ? styles.labelDark : null]}>
          {voiceLabel(phase, seconds)}
        </Text>
      </Pressable>
      <Text style={[styles.helper, voiceError ? styles.error : null]}>
        {voiceError ?? 'Hold while you talk · release to add the words'}
      </Text>
    </View>
  );
});

function voiceLabel(phase: VoicePhase, seconds: number): string {
  if (phase === 'preparing') return 'Getting the microphone ready…';
  if (phase === 'recording') return `Listening… ${seconds}s`;
  if (phase === 'transcribing') return 'Turning your voice into words…';
  if (phase === 'submitting') return 'Adding your words…';
  return 'Hold to talk';
}

function miloVoiceLabel(phase: VoicePhase, seconds: number): string {
  if (phase === 'preparing') return 'Getting ready…';
  if (phase === 'recording') return `Listening… ${seconds}s`;
  if (phase === 'transcribing') return 'Adding your words…';
  if (phase === 'submitting') return 'Starting your project…';
  return 'Hold Milo to talk';
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Voice input did not work. Please try again.';
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  button: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#FFFFFF38',
    borderRadius: radii.medium,
    backgroundColor: '#17142B78',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  buttonRecording: {
    borderColor: colors.coral,
    backgroundColor: '#C94B5E',
  },
  buttonHero: {
    minHeight: 76,
    borderRadius: 24,
    backgroundColor: '#6D3CE7',
    paddingVertical: 18,
  },
  buttonPreparing: {
    backgroundColor: colors.surfaceLifted,
  },
  buttonTranscribing: {
    backgroundColor: colors.mint,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
  },
  label: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  labelHero: {
    fontSize: 18,
  },
  labelDark: {
    color: colors.ink,
  },
  helper: {
    color: '#FFFFFFA8',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  error: {
    color: '#FFD1CB',
  },
  miloWrapper: {
    alignItems: 'center',
  },
  miloButton: {
    zIndex: 2,
    width: 136,
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: colors.white,
    borderRadius: 68,
    backgroundColor: '#6A4FE0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 13,
    elevation: 9,
  },
  miloButtonRecording: {
    borderColor: '#FFF1C7',
    backgroundColor: colors.coral,
    transform: [{ scale: 1.06 }],
  },
  miloButtonBusy: {
    backgroundColor: '#6D3CE7',
  },
  miloButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  miloImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  miloFallback: {
    color: '#FFF3A8',
    fontSize: 45,
    fontWeight: '900',
  },
  miloBubble: {
    zIndex: 3,
    minWidth: 154,
    marginTop: -10,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: 19,
    backgroundColor: '#6E35DB',
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  miloBubbleRecording: {
    backgroundColor: '#D95258',
  },
  miloBubbleText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  miloError: {
    maxWidth: 240,
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: '#431D37F2',
    color: '#FFD1CB',
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 9,
    paddingVertical: 7,
    textAlign: 'center',
  },
});

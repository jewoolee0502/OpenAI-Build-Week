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
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { imagineLabApi } from '@/api/client';
import { colors, radii, spacing } from '@/theme';

type VoicePhase = 'idle' | 'preparing' | 'recording' | 'transcribing';

interface HoldToTalkButtonProps {
  onTranscript: (text: string) => void;
}

const maximumRecordingMilliseconds = 30_000;
const minimumRecordingMilliseconds = 500;

export const HoldToTalkButton = memo(function HoldToTalkButton({
  onTranscript,
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
      const transcript = await imagineLabApi.transcribeAudio(recordingUri);
      onTranscript(transcript);
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
  }, [clearMaximumTimer, onTranscript, recorder, updatePhase]);

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
  const isBusy = phase === 'preparing' || phase === 'transcribing';
  const seconds = Math.min(30, Math.ceil(recorderState.durationMillis / 1000));

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityHint="Keep holding while you speak. Release to turn your voice into text."
        accessibilityLabel={isRecording ? 'Release to finish voice idea' : 'Hold to speak your idea'}
        accessibilityRole="button"
        accessibilityState={{ busy: isBusy }}
        disabled={phase === 'transcribing'}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.button,
          isRecording ? styles.buttonRecording : null,
          phase === 'preparing' ? styles.buttonPreparing : null,
          phase === 'transcribing' ? styles.buttonTranscribing : null,
          pressed && !isBusy ? styles.buttonPressed : null,
        ]}>
        {isBusy ? (
          <ActivityIndicator color={phase === 'transcribing' ? colors.ink : colors.white} />
        ) : (
          <MaterialCommunityIcons
            color={isRecording ? colors.white : colors.coral}
            name={isRecording ? 'waveform' : 'microphone'}
            size={22}
          />
        )}
        <Text style={[styles.label, phase === 'transcribing' ? styles.labelDark : null]}>
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
  return 'Hold to talk';
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
});

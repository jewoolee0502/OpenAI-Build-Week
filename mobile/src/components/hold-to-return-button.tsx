import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  returnHoldDurationMs,
  returnHoldProgress,
  returnHoldSecondsRemaining,
} from '@/features/return-hold';

interface HoldToReturnButtonProps {
  onComplete: () => void;
}

const progressUpdateMilliseconds = 50;

export const HoldToReturnButton = memo(function HoldToReturnButton({
  onComplete,
}: HoldToReturnButtonProps) {
  const [elapsedMilliseconds, setElapsedMilliseconds] = useState(0);
  const holdingRef = useRef(false);
  const startedAtRef = useRef(0);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    completionTimerRef.current = null;
    progressTimerRef.current = null;
  }, []);

  const cancelHold = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    clearTimers();
    setElapsedMilliseconds(0);
  }, [clearTimers]);

  const beginHold = useCallback(() => {
    if (holdingRef.current) return;
    holdingRef.current = true;
    startedAtRef.current = Date.now();
    setElapsedMilliseconds(0);
    void Haptics.selectionAsync();

    progressTimerRef.current = setInterval(() => {
      if (!holdingRef.current) return;
      setElapsedMilliseconds(Date.now() - startedAtRef.current);
    }, progressUpdateMilliseconds);

    completionTimerRef.current = setTimeout(() => {
      if (!holdingRef.current) return;
      holdingRef.current = false;
      clearTimers();
      setElapsedMilliseconds(returnHoldDurationMs);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    }, returnHoldDurationMs);
  }, [clearTimers, onComplete]);

  useEffect(() => clearTimers, [clearTimers]);

  const progress = returnHoldProgress(elapsedMilliseconds);
  const secondsRemaining = returnHoldSecondsRemaining(elapsedMilliseconds);
  const isHolding = elapsedMilliseconds > 0 && progress < 1;

  return (
    <Pressable
      accessibilityHint="Hold continuously for five seconds to return to the developer console. Releasing early cancels the return."
      accessibilityLabel={isHolding ? `${secondsRemaining} seconds remaining` : 'Hold five seconds to return to developer console'}
      accessibilityRole="button"
      onPressIn={beginHold}
      onPressOut={cancelHold}
      style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}>
      <View pointerEvents="none" style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      <Ionicons color="#FFFFFF" name="arrow-back" size={20} />
      <View pointerEvents="none" style={styles.copy}>
        <Text numberOfLines={1} style={styles.label}>
          {isHolding ? `Keep holding · ${secondsRemaining}s` : 'Hold to return · 5s'}
        </Text>
        <Text numberOfLines={1} style={styles.detail}>Developer console</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    position: 'relative',
    minWidth: 184,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFFD6',
    borderRadius: 27,
    backgroundColor: '#17142BEF',
    paddingHorizontal: 15,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
    right: undefined,
    backgroundColor: '#6D3CE7',
  },
  copy: {
    gap: 1,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  detail: {
    color: '#D8D3E5',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

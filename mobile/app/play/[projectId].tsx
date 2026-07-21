import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GamePreview } from '@/components/game-preview';
import { HoldToReturnButton } from '@/components/hold-to-return-button';
import { LoadingPill } from '@/components/ui';
import { useAppState } from '@/state/app-provider';
import { colors, spacing } from '@/theme';

export default function FullScreenGameScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { projects, isLoading, refreshChildProjects } = useAppState();
  const project = projects.find((candidate) => candidate.id === projectId);

  useEffect(() => {
    if (!project) void refreshChildProjects().catch(() => undefined);
  }, [project, refreshChildProjects]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => subscription.remove();
    }, []),
  );

  const returnToConsole = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (projectId) {
      router.replace({ pathname: '/studio/[projectId]', params: { projectId } });
    } else {
      router.replace('/');
    }
  }, [projectId, router]);

  if (!project) {
    return (
      <SafeAreaView style={styles.missingScreen}>
        <StatusBar style="light" />
        {isLoading ? <LoadingPill label="Opening your game…" /> : (
          <View style={styles.missingCard}>
            <Text style={styles.missingTitle}>This game could not be opened.</Text>
            <HoldToReturnButton onComplete={returnToConsole} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <View accessibilityLabel={`Playing ${project.title} full screen`} style={styles.screen}>
      <StatusBar hidden />
      <GamePreview fullScreen html={project.currentVersion.html} />
      <View pointerEvents="box-none" style={[styles.returnOverlay, { top: Math.max(insets.top, 10) }]}>
        <HoldToReturnButton onComplete={returnToConsole} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  returnOverlay: {
    position: 'absolute',
    left: 10,
    zIndex: 20,
  },
  missingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    padding: spacing.lg,
  },
  missingCard: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  missingTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
});

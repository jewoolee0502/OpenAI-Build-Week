import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { BuilderDraft, CanvasAsset, CreativePlan } from '@/api/types';
import { BrandHeader } from '@/components/brand-header';
import { DrawingSheet } from '@/components/drawing-sheet';
import { HoldToTalkButton } from '@/components/hold-to-talk-button';
import { ActionButton, ErrorBanner, LoadingPill, MiniBadge, SurfaceCard } from '@/components/ui';
import { useAppState } from '@/state/app-provider';
import { colors, radii, spacing } from '@/theme';

const emptyDraft = (): BuilderDraft => ({
  stage: 'build',
  creativePlan: null,
  interpretationStatus: 'pending',
  interpretation: null,
  assets: [],
  variants: [],
  selectedVariantId: null,
  updatedAt: new Date().toISOString(),
});

export default function BuilderScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const {
    child,
    projects,
    isRestoringSession,
    refreshChildProjects,
    deleteProject,
    loadBuilderDraft,
    saveBuilderDraft,
    generateCreativePlan,
    generateSceneVariants,
    testBuilderGame,
    transcribeAudio,
    errorMessage,
    clearError,
  } = useAppState();
  const project = projects.find((candidate) => candidate.id === projectId);
  const [draft, setDraft] = useState<BuilderDraft>(emptyDraft);
  const [mode, setMode] = useState<'canvas' | 'background' | 'object'>('canvas');
  const [objectName, setObjectName] = useState('');
  const [activeMission, setActiveMission] = useState<CreativePlan['elementMissions'][number] | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const [worldSize, setWorldSize] = useState({ width: 1, height: 1 });
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [isObjectMenuOpen, setIsObjectMenuOpen] = useState(false);

  useEffect(() => {
    if (!isRestoringSession && !child) router.replace('/');
  }, [child, isRestoringSession, router]);

  useEffect(() => {
    if (!project) void refreshChildProjects().catch(() => undefined);
  }, [project, refreshChildProjects]);

  useEffect(() => {
    if (!projectId || isRestoringSession || !child) return;
    setIsPlanning(true);
    void loadBuilderDraft(projectId)
      .then(async (value) => {
        const nextDraft = { ...emptyDraft(), ...(value ?? {}) };
        if (nextDraft.creativePlan) return nextDraft;
        return generateCreativePlan(projectId);
      })
      .then((value) => setDraft(value))
      .catch(() => undefined)
      .finally(() => setIsPlanning(false));
  }, [child, generateCreativePlan, isRestoringSession, loadBuilderDraft, projectId]);

  const selected = draft.assets.find((asset) => asset.id === selectedAssetId) ?? null;
  const background = draft.assets.find((asset) => asset.kind === 'background') ?? null;
  const objects = useMemo(
    () => draft.assets.filter((asset) => asset.kind === 'object').sort((a, b) => a.zIndex - b.zIndex),
    [draft.assets],
  );
  const drawingPrompt = mode === 'background' ? draft.creativePlan?.backgroundMission : activeMission;
  const drawingTitle = mode === 'background'
    ? draft.creativePlan?.backgroundMission.title ?? 'Draw your game world'
    : activeMission?.suggestedName ?? 'Draw something the game needs';
  const shortDrawingPrompt = compactDrawingPrompt(
    drawingPrompt?.prompt ?? (mode === 'background'
      ? 'Show where your game happens in your own style.'
      : 'Invent a character, object, goal, obstacle, or surprise.'),
  );

  useEffect(() => () => {
    void Speech.stop();
  }, []);

  const save = useCallback(async (nextDraft = draft) => {
    if (!projectId) return;
    setIsWorking(true);
    try {
      const saved = await saveBuilderDraft(projectId, {
        ...nextDraft,
        updatedAt: new Date().toISOString(),
      });
      setDraft(saved);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsWorking(false);
    }
  }, [draft, projectId, saveBuilderDraft]);

  const addDrawing = useCallback((imageDataUrl: string) => {
    const isBackground = mode === 'background';
    const name = isBackground
      ? 'My background'
      : objectName.trim() || activeMission?.suggestedName || 'My game object';
    const asset: CanvasAsset = {
      id: createId(),
      kind: isBackground ? 'background' : 'object',
      ...(!isBackground && activeMission ? { missionId: activeMission.id } : {}),
      name,
      imageDataUrl,
      x: isBackground ? 0 : 0.35,
      y: isBackground ? 0 : 0.35,
      width: isBackground ? 1 : 0.28,
      height: isBackground ? 1 : 0.28,
      zIndex: isBackground ? 0 : objects.length + 1,
    };
    setDraft((current) => ({
      ...current,
      stage: 'build',
      interpretationStatus: 'pending',
      variants: [],
      selectedVariantId: null,
      assets: isBackground
        ? [...current.assets.filter((item) => item.kind !== 'background'), asset]
        : [...current.assets, asset],
    }));
    setMode('canvas');
    setIsDrawingOpen(false);
    void Speech.stop();
    setObjectName('');
    setActiveMission(null);
    setSelectedAssetId(isBackground ? null : asset.id);
  }, [activeMission, mode, objectName, objects.length]);

  const requestVariants = useCallback(async () => {
    if (!projectId || !background || objects.length === 0) return;
    const preparedDraft = { ...draft, interpretationStatus: 'pending' as const };
    await save(preparedDraft);
    setIsWorking(true);
    try {
      setDraft(await generateSceneVariants(projectId));
    } finally {
      setIsWorking(false);
    }
  }, [background, draft, generateSceneVariants, objects.length, projectId, save]);

  const openBackgroundDrawing = useCallback(() => {
    setActiveMission(null);
    setMode('background');
  }, []);

  const openMissionDrawing = useCallback((mission: CreativePlan['elementMissions'][number]) => {
    setActiveMission(mission);
    setObjectName(mission.suggestedName);
    setMode('object');
  }, []);

  const openFreeDrawing = useCallback(() => {
    setActiveMission(null);
    setObjectName('');
    setMode('object');
  }, []);

  const closeDrawing = useCallback(() => {
    void Speech.stop();
    setIsDrawingOpen(false);
    setActiveMission(null);
    setObjectName('');
    setMode('canvas');
  }, []);

  const speakDrawingPrompt = useCallback(() => {
    const message = `${drawingTitle}. ${shortDrawingPrompt}`;
    void Speech.stop().then(() => Speech.speak(message, { rate: 0.88, pitch: 1.02 }));
  }, [drawingTitle, shortDrawingPrompt]);

  const startDrawing = useCallback(() => {
    setIsDrawingOpen(true);
    speakDrawingPrompt();
  }, [speakDrawingPrompt]);

  const leaveFullScreenDrawing = useCallback(() => {
    void Speech.stop();
    setIsDrawingOpen(false);
  }, []);

  const testGame = useCallback(async () => {
    if (!projectId || !draft.selectedVariantId) return;
    await save(draft);
    setIsWorking(true);
    try {
      await testBuilderGame(projectId);
      await refreshChildProjects();
      router.push({ pathname: '/studio/[projectId]', params: { projectId } });
    } finally {
      setIsWorking(false);
    }
  }, [draft, projectId, refreshChildProjects, router, save, testBuilderGame]);

  const moveAsset = useCallback((assetId: string, x: number, y: number) => {
    setDraft((current) => ({
      ...current,
      assets: current.assets.map((asset) => asset.id === assetId ? {
        ...asset,
        x: Math.max(0, Math.min(1 - asset.width, x)),
        y: Math.max(0, Math.min(1 - asset.height, y)),
      } : asset),
    }));
  }, []);

  const moveLayer = useCallback((direction: 'backward' | 'forward') => {
    if (!selectedAssetId) return;
    setDraft((current) => {
      const layeredObjects = current.assets
        .filter((asset) => asset.kind === 'object')
        .sort((a, b) => a.zIndex - b.zIndex);
      const currentIndex = layeredObjects.findIndex((asset) => asset.id === selectedAssetId);
      const nextIndex = currentIndex + (direction === 'forward' ? 1 : -1);
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= layeredObjects.length) return current;
      const currentAsset = layeredObjects[currentIndex];
      const otherAsset = layeredObjects[nextIndex];
      if (!currentAsset || !otherAsset) return current;
      return {
        ...current,
        assets: current.assets.map((asset) => {
          if (asset.id === currentAsset.id) return { ...asset, zIndex: otherAsset.zIndex };
          if (asset.id === otherAsset.id) return { ...asset, zIndex: currentAsset.zIndex };
          return asset;
        }),
      };
    });
  }, [selectedAssetId]);

  const openCanvas = useCallback(() => {
    if (!selectedAssetId && objects[0]) setSelectedAssetId(objects[0].id);
    setIsCanvasOpen(true);
  }, [objects, selectedAssetId]);

  const confirmDelete = useCallback(() => {
    if (!projectId) return;
    Alert.alert('Delete this game?', 'This permanently removes your drawings, game versions, and public link.', [
      { text: 'Keep game', style: 'cancel' },
      {
        text: 'Delete game',
        style: 'destructive',
        onPress: () => void deleteProject(projectId)
          .then(() => router.replace('/'))
          .catch((error: unknown) => Alert.alert('Could not delete game', error instanceof Error ? error.message : 'Please try again.')),
      },
    ]);
  }, [deleteProject, projectId, router]);

  if (!project) {
    return (
      <SafeAreaView style={styles.safe}>
        <BrandHeader onBack={() => router.back()} />
        <View style={styles.loading}><LoadingPill label="Opening your game…" /></View>
      </SafeAreaView>
    );
  }

  if (mode !== 'canvas') {
    const possibilities = drawingPrompt?.possibilities ?? [];
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <BrandHeader onBack={closeDrawing} />
        <ScrollView contentContainerStyle={styles.promptScrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.drawingPromptContent}>
            <SurfaceCard style={styles.drawingPromptCard}>
              <Text style={styles.cardEyebrow}>{mode === 'background' ? 'STEP 2 · DRAW THE WORLD' : 'STEP 3 · INVENT A GAME PIECE'}</Text>
              <Text style={styles.drawingPromptTitle}>{drawingTitle}</Text>
              <Text style={styles.drawingPromptCopy}>{shortDrawingPrompt}</Text>
              {possibilities.length > 0 ? (
                <View style={styles.sparkRow}>
                  {possibilities.slice(0, 3).map((possibility) => <Text key={possibility} style={styles.sparkChip}>Maybe {possibility}</Text>)}
                </View>
              ) : null}
              {mode === 'object' ? (
                <>
                  {activeMission ? <Text style={styles.missionPurpose}>{activeMission.purpose}</Text> : null}
                  <Text style={styles.inputLabel}>Name your drawing</Text>
                  <TextInput
                    value={objectName}
                    onChangeText={setObjectName}
                    placeholder={activeMission?.suggestedName ?? 'A bird, coin, castle…'}
                    placeholderTextColor={colors.mutedText}
                    style={styles.input}
                  />
                </>
              ) : null}
              <Text style={styles.openChoice}>Use the spark, change it, or draw something completely different.</Text>
            </SurfaceCard>
            <View style={styles.promptActions}>
              <View style={styles.promptAction}><ActionButton label="🔊  Hear the prompt" onPress={speakDrawingPrompt} tone="secondary" /></View>
              <View style={styles.promptAction}><ActionButton label="✎  Start drawing" onPress={startDrawing} tone="mint" /></View>
            </View>
          </View>
        </ScrollView>
        <Modal
          animationType="slide"
          navigationBarTranslucent
          onRequestClose={leaveFullScreenDrawing}
          statusBarTranslucent
          visible={isDrawingOpen}>
          {isDrawingOpen ? (
            <DrawingSheet
              drawingKind={mode === 'background' ? 'background' : 'object'}
              fullScreen
              onCancel={leaveFullScreenDrawing}
              onSave={addDrawing}
              onSpeak={speakDrawingPrompt}
              projectTitle={project.title}
              prompt={shortDrawingPrompt}
              promptTitle={drawingTitle}
            />
          ) : null}
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BrandHeader onBack={() => { void save().finally(() => router.back()); }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>BUILD YOUR WORLD</Text>
              <Text style={styles.title}>{project.title}</Text>
              <Text style={styles.subtitle}>Your idea becomes a game one choice at a time.</Text>
            </View>
            <MiniBadge label={draft.interpretationStatus === 'pending' ? 'DRAFT' : 'READY'} />
          </View>

          <StepRail hasBackground={Boolean(background)} hasElements={objects.length > 0} />
          {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={clearError} /> : null}

          {isPlanning ? (
            <LinearGradient colors={['#342A64', '#24203E']} style={styles.planLoading}>
              <Text style={styles.planSpark}>✦</Text>
              <Text style={styles.cardTitle}>Exploring your idea…</Text>
              <Text style={styles.cardCopy}>ImagineLab is finding different ways your idea could play, then it will invite you to draw the parts.</Text>
              <LoadingPill label="Making creative sparks…" />
            </LinearGradient>
          ) : null}

          {draft.creativePlan ? (
            <SurfaceCard style={styles.ideaCard}>
              <Text style={styles.cardEyebrow}>STEP 1 · YOUR IDEA</Text>
              <Text style={styles.cardTitle}>Here&apos;s what I heard</Text>
              <Text style={styles.ideaSummary}>{draft.creativePlan.ideaSummary}</Text>
              <Text style={styles.directionLabel}>This idea could become…</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.directionRow}>
                {draft.creativePlan.gameDirections.map((direction) => (
                  <View key={direction.title} style={styles.directionCard}>
                    <Text style={styles.directionTitle}>{direction.title}</Text>
                    <Text style={styles.directionText}>{direction.mechanic}</Text>
                    <Text style={styles.directionTwist}>✦ {direction.creativeTwist}</Text>
                  </View>
                ))}
              </ScrollView>
              <Text style={styles.openChoice}>{draft.creativePlan.encouragement}</Text>
            </SurfaceCard>
          ) : !isPlanning ? (
            <SurfaceCard style={styles.card}>
              <Text style={styles.cardEyebrow}>STEP 1 · YOUR IDEA</Text>
              <Text style={styles.cardTitle}>Let&apos;s explore it together</Text>
              <Text style={styles.cardCopy}>Ask ImagineLab to turn your idea into open drawing invitations.</Text>
              <ActionButton label="✦  Explore my idea" onPress={() => projectId && void generateCreativePlan(projectId).then(setDraft).catch(() => undefined)} />
            </SurfaceCard>
          ) : null}

          {draft.creativePlan && !background ? (
            <LinearGradient colors={['#7048D8', '#B65F92']} style={styles.missionHero}>
              <Text style={styles.cardEyebrow}>STEP 2 · DRAW THE BACKGROUND</Text>
              <Text style={styles.nextStepTitle}>{draft.creativePlan.backgroundMission.title}</Text>
              <Text style={styles.nextStepCopy}>{draft.creativePlan.backgroundMission.prompt}</Text>
              <View style={styles.sparkRow}>
                {draft.creativePlan.backgroundMission.possibilities.map((possibility) => (
                  <Text key={possibility} style={styles.heroSparkChip}>Maybe {possibility}</Text>
                ))}
              </View>
              <Text style={styles.heroFreedom}>Or surprise me with a place that is completely yours.</Text>
              <ActionButton label="✎  Draw my world" onPress={openBackgroundDrawing} tone="mint" />
            </LinearGradient>
          ) : null}

          {draft.creativePlan && background ? (
            <SurfaceCard style={styles.elementMissionCard}>
              <Text style={styles.cardEyebrow}>STEP 3 · INVENT THE GAME PIECES</Text>
              <Text style={styles.cardTitle}>What should live in your world?</Text>
              <Text style={styles.cardCopy}>Choose any spark below, combine a few, or invent your own. You only need one drawing to continue.</Text>
              <View style={styles.missionList}>
                {draft.creativePlan.elementMissions.map((mission) => {
                  const completed = objects.some((asset) => asset.missionId === mission.id);
                  return (
                    <Pressable
                      accessibilityLabel={`${completed ? 'Redraw' : 'Draw'} ${mission.suggestedName}`}
                      key={mission.id}
                      onPress={() => openMissionDrawing(mission)}
                      style={({ pressed }) => [styles.missionCard, completed ? styles.missionCardDone : null, pressed ? styles.missionCardPressed : null]}>
                      <View style={styles.missionTopLine}>
                        <Text style={styles.missionName}>{mission.suggestedName}</Text>
                        <Text style={completed ? styles.missionDone : styles.missionDraw}>{completed ? '✓ DRAWN' : 'DRAW →'}</Text>
                      </View>
                      <Text style={styles.missionPrompt}>{mission.prompt}</Text>
                      <Text style={styles.missionPurpose}>{mission.purpose}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <ActionButton label="+ Draw my own idea" onPress={openFreeDrawing} tone="secondary" />
            </SurfaceCard>
          ) : null}

          {background ? (
            <LinearGradient colors={['#342A64', '#24203E']} style={styles.worldShell}>
              <View style={styles.worldTopLine}>
                <View><Text style={styles.cardEyebrow}>YOUR CANVAS</Text><Text style={styles.worldTitle}>Arrange your world</Text></View>
                <Text style={styles.assetCount}>{draft.assets.length} piece{draft.assets.length === 1 ? '' : 's'}</Text>
              </View>
              <Pressable
                accessibilityHint="Opens a full-screen space where you can move one object at a time."
                accessibilityLabel="Open full-screen canvas"
                onPress={openCanvas}
                style={styles.world}>
                <Image source={{ uri: background.imageDataUrl }} style={styles.background} />
                {objects.map((asset) => <StaticCanvasAsset asset={asset} key={asset.id} selected={selectedAssetId === asset.id} />)}
                <View pointerEvents="none" style={styles.worldHint}><Text style={styles.worldHintText}>↗ Tap to arrange</Text></View>
              </Pressable>
              <View style={styles.actions}>
                <View style={styles.actionHalf}><ActionButton label="Redraw background" onPress={openBackgroundDrawing} tone="secondary" /></View>
                <View style={styles.actionHalf}><ActionButton label="+ Add my own piece" onPress={openFreeDrawing} /></View>
              </View>
            </LinearGradient>
          ) : null}

          {background ? (
            <View style={styles.learningCallout}>
              <Text style={styles.learningIcon}>💡</Text>
              <View style={styles.learningCopy}><Text style={styles.learningTitle}>You&apos;re the game designer</Text><Text style={styles.learningText}>The AI offers possibilities. Your drawings, names, arrangement, and rules decide what the game becomes.</Text></View>
            </View>
          ) : null}

          {selected?.kind === 'object' ? (
            <SurfaceCard style={styles.card}>
              <Text style={styles.cardEyebrow}>BEHAVIOR IDEA</Text>
              <Text style={styles.cardTitle}>What should {selected.name} do?</Text>
              <Text style={styles.cardCopy}>This idea is saved with your canvas and sent into the test build.</Text>
              <TextInput
                value={draft.interpretation ?? ''}
                onChangeText={(text) => setDraft((current) => ({
                  ...current,
                  interpretation: text || null,
                  interpretationStatus: 'pending',
                  variants: [],
                  selectedVariantId: null,
                }))}
                multiline
                maxLength={500}
                placeholder={`Maybe ${selected.name} follows my finger or gives the player points…`}
                placeholderTextColor={colors.mutedText}
                style={styles.input}
              />
              <HoldToTalkButton
                onTranscript={(text) => setDraft((current) => ({
                  ...current,
                  interpretation: [current.interpretation, text].filter(Boolean).join(' '),
                  interpretationStatus: 'pending',
                  variants: [],
                  selectedVariantId: null,
                }))}
                transcribeAudio={transcribeAudio}
              />
            </SurfaceCard>
          ) : null}

          {background && draft.variants.length === 0 ? (
            <LinearGradient colors={['#6F46D8', '#B65F92']} style={styles.nextStepCard}>
              <Text style={styles.cardEyebrow}>PUT YOUR IDEAS TOGETHER</Text>
              <Text style={styles.nextStepTitle}>{objects.length > 0 ? 'Ready to see your world come alive?' : 'Add one game piece to continue'}</Text>
              <Text style={styles.nextStepCopy}>{objects.length > 0 ? 'ImagineLab will read your original idea, your drawings, their names, arrangement, and behavior idea. You still choose the final direction.' : 'Draw at least one character, object, goal, obstacle, or surprise so the test game is built from your creativity.'}</Text>
              <ActionButton
                disabled={objects.length === 0}
                label="✦  Show 4 design ideas"
                loading={isWorking}
                onPress={() => void requestVariants()}
                tone="mint"
              />
            </LinearGradient>
          ) : background && draft.variants.length > 0 ? (
            <SurfaceCard style={styles.card}>
              <Text style={styles.cardEyebrow}>YOU DECIDE</Text>
              <Text style={styles.cardTitle}>Choose a game look</Text>
              <Text style={styles.cardCopy}>The AI offers directions; the final choice stays yours.</Text>
              <View style={styles.variantGrid}>
                {draft.variants.map((variant) => {
                  const isSelected = draft.selectedVariantId === variant.id;
                  return (
                    <Pressable
                      accessibilityLabel={`Choose ${variant.title}`}
                      key={variant.id}
                      onPress={() => setDraft((current) => ({ ...current, stage: 'test', selectedVariantId: variant.id }))}
                      style={[styles.variant, isSelected ? styles.variantSelected : null]}>
                      <Image source={{ uri: variant.previewDataUrl }} style={styles.variantImage} />
                      {isSelected ? <Text style={styles.variantCheck}>✓</Text> : null}
                      <View style={styles.variantCopy}><Text numberOfLines={1} style={styles.variantTitle}>{variant.title}</Text><Text numberOfLines={2} style={styles.variantDescription}>{variant.description}</Text></View>
                    </Pressable>
                  );
                })}
              </View>
              <ActionButton disabled={!draft.selectedVariantId} label="▷  Build my test game" loading={isWorking} onPress={() => void testGame()} tone="mint" />
            </SurfaceCard>
          ) : null}

          {isWorking ? <LoadingPill label={draft.variants.length === 0 ? 'Saving your choices…' : 'Building your world…'} /> : null}
          <View style={styles.saveRow}>
            <View style={styles.saveButton}><ActionButton label="Save draft" loading={isWorking} onPress={() => void save()} tone="secondary" /></View>
            <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.deleteButton}><Text style={styles.deleteText}>Delete game</Text></Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal animationType="slide" onRequestClose={() => setIsCanvasOpen(false)} visible={isCanvasOpen}>
        <SafeAreaView style={styles.canvasSafe} edges={['top', 'bottom']}>
          <View style={styles.canvasHeader}>
            <View style={styles.canvasHeading}><Text style={styles.eyebrow}>ARRANGE YOUR WORLD</Text><Text style={styles.canvasTitle}>{selected?.name ?? 'Choose an object'}</Text></View>
            <Pressable accessibilityLabel="Choose an object" onPress={() => setIsObjectMenuOpen((open) => !open)} style={styles.menuButton}><Text style={styles.menuIcon}>☰</Text></Pressable>
            <Pressable accessibilityLabel="Finish moving objects" onPress={() => setIsCanvasOpen(false)} style={styles.doneButton}><Text style={styles.doneButtonText}>Done</Text></Pressable>
          </View>
          {isObjectMenuOpen ? (
            <View style={styles.objectMenu}>
              <Text style={styles.objectMenuTitle}>Choose an object to move</Text>
              {objects.length ? objects.map((asset) => (
                <Pressable key={asset.id} onPress={() => { setSelectedAssetId(asset.id); setIsObjectMenuOpen(false); }} style={[styles.objectOption, asset.id === selectedAssetId ? styles.objectOptionSelected : null]}><Text style={styles.objectOptionText}>{asset.name}</Text></Pressable>
              )) : <Text style={styles.cardCopy}>Add an object first.</Text>}
            </View>
          ) : null}
          <View onLayout={(event) => setWorldSize(event.nativeEvent.layout)} style={styles.fullscreenWorld}>
            {background ? <Image source={{ uri: background.imageDataUrl }} style={styles.background} /> : <View style={styles.blank}><Text style={styles.blankText}>Draw a background to start your world</Text></View>}
            {objects.map((asset) => <DraggableCanvasAsset asset={asset} enabled={asset.id === selectedAssetId} key={asset.id} onMove={moveAsset} onSelect={setSelectedAssetId} selected={asset.id === selectedAssetId} worldSize={worldSize} />)}
          </View>
          <Text style={styles.canvasInstruction}>{selected ? `Drag ${selected.name}. Use ☰ if it is hard to select.` : 'Choose an object from ☰ to start moving it.'}</Text>
          <View style={styles.layerActions}><View style={styles.actionHalf}><ActionButton disabled={!selected} label="Move back" onPress={() => moveLayer('backward')} tone="secondary" /></View><View style={styles.actionHalf}><ActionButton disabled={!selected} label="Move forward" onPress={() => moveLayer('forward')} /></View></View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function StepRail({ hasBackground, hasElements }: { hasBackground: boolean; hasElements: boolean }) {
  const activeStep = hasBackground ? 2 : 1;
  const completed = [true, hasBackground, hasElements];
  return (
    <View accessibilityLabel={`Creative start step ${activeStep + 1} of 3`} style={styles.stepRail}>
      {['SHARE IDEA', 'DRAW WORLD', 'INVENT PIECES'].map((label, index) => (
        <View key={label} style={styles.stepItem}>
          <View style={[styles.stepDot, completed[index] ? styles.stepDotComplete : null, index === activeStep ? styles.stepDotActive : null]}><Text style={[styles.stepNumber, completed[index] || index === activeStep ? styles.stepNumberActive : null]}>{completed[index] ? '✓' : index + 1}</Text></View>
          <Text style={[styles.stepLabel, index === activeStep ? styles.stepLabelActive : null]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { alignItems: 'center', paddingBottom: 50 },
  content: { width: '100%', maxWidth: 760, gap: spacing.md, paddingHorizontal: 18, paddingTop: 6 },
  promptScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  drawingPromptContent: { width: '100%', maxWidth: 620, gap: spacing.md },
  drawingPromptCard: { gap: 12, borderWidth: 1, borderColor: '#A98BFF45', padding: spacing.md },
  drawingPromptTitle: { color: colors.white, fontSize: 28, fontWeight: '900', letterSpacing: -0.8, lineHeight: 31 },
  drawingPromptCopy: { color: colors.white, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  promptActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  promptAction: { flex: 1, minWidth: 150 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headingCopy: { flex: 1, gap: 3 },
  eyebrow: { color: colors.mint, fontWeight: '900', fontSize: 11, letterSpacing: 1.1 },
  title: { color: colors.white, fontSize: 31, fontWeight: '900', letterSpacing: -1.2, lineHeight: 34 },
  subtitle: { color: colors.softText, fontSize: 13, lineHeight: 19 },
  stepRail: { flexDirection: 'row', justifyContent: 'space-between', gap: 5, borderRadius: 18, backgroundColor: colors.surface, padding: 12 },
  stepItem: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF2E', borderRadius: 15, backgroundColor: colors.surfaceLifted },
  stepDotComplete: { borderColor: '#8AF4D670', backgroundColor: '#8AF4D625' },
  stepDotActive: { borderColor: colors.mint, backgroundColor: colors.mint },
  stepNumber: { color: colors.softText, fontSize: 12, fontWeight: '900' },
  stepNumberActive: { color: colors.ink },
  stepLabel: { color: colors.mutedText, fontSize: 8, fontWeight: '900', letterSpacing: 0.4, textAlign: 'center' },
  stepLabelActive: { color: colors.white },
  worldShell: { gap: 12, borderRadius: radii.hero, padding: 14 },
  worldTopLine: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  worldTitle: { color: colors.white, fontSize: 20, fontWeight: '900' },
  assetCount: { color: colors.softText, fontSize: 11 },
  world: { aspectRatio: 1.35, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF26', borderRadius: 22, backgroundColor: colors.surfaceLifted },
  worldHint: { position: 'absolute', right: 10, bottom: 10, borderRadius: radii.pill, backgroundColor: '#17142BE6', paddingHorizontal: 11, paddingVertical: 7 },
  worldHintText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  blank: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  blankSymbol: { color: colors.lavender, fontSize: 30 },
  blankText: { color: colors.softText, textAlign: 'center', fontWeight: '700' },
  background: { width: '100%', height: '100%', position: 'absolute' },
  asset: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  assetContents: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  assetSelected: { borderColor: colors.mint, borderRadius: 8 },
  assetImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  assetName: { color: colors.white, fontWeight: '900', fontSize: 10, backgroundColor: '#17142BCC', paddingHorizontal: 5, paddingVertical: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  actionHalf: { flex: 1, minWidth: 0 },
  learningCallout: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#FFD16635', borderRadius: 18, backgroundColor: '#FFD16612', padding: 13 },
  learningIcon: { fontSize: 26 },
  learningCopy: { flex: 1, gap: 2 },
  learningTitle: { color: '#FFE19A', fontSize: 14, fontWeight: '900' },
  learningText: { color: colors.softText, fontSize: 12, lineHeight: 17 },
  card: { gap: 10, borderWidth: 1, borderColor: '#FFFFFF12' },
  cardEyebrow: { color: colors.mint, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  cardTitle: { color: colors.white, fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  cardCopy: { color: colors.softText, lineHeight: 20 },
  planLoading: { alignItems: 'center', gap: 10, borderRadius: radii.large, padding: spacing.lg },
  planSpark: { color: colors.mint, fontSize: 30 },
  ideaCard: { gap: 12, borderWidth: 1, borderColor: '#A98BFF45', backgroundColor: '#292349' },
  ideaSummary: { color: colors.white, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  directionLabel: { color: colors.lavender, fontSize: 12, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  directionRow: { gap: 10, paddingRight: 4 },
  directionCard: { width: 235, gap: 7, borderWidth: 1, borderColor: '#FFFFFF18', borderRadius: 16, backgroundColor: colors.surfaceLifted, padding: 13 },
  directionTitle: { color: colors.white, fontSize: 16, fontWeight: '900' },
  directionText: { color: colors.softText, fontSize: 12, lineHeight: 17 },
  directionTwist: { color: colors.mint, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  openChoice: { color: '#D9D1F4', fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
  missionHero: { gap: 12, borderRadius: radii.hero, padding: spacing.md },
  sparkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  sparkChip: { overflow: 'hidden', borderRadius: radii.pill, backgroundColor: '#FFFFFF12', color: colors.softText, fontSize: 11, lineHeight: 15, paddingHorizontal: 10, paddingVertical: 7 },
  heroSparkChip: { overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF28', borderRadius: radii.pill, backgroundColor: '#FFFFFF16', color: colors.white, fontSize: 11, lineHeight: 15, paddingHorizontal: 10, paddingVertical: 7 },
  heroFreedom: { color: '#FFFFFFD6', fontSize: 12, fontWeight: '800' },
  elementMissionCard: { gap: 12, borderWidth: 1, borderColor: '#8AF4D633' },
  missionList: { gap: 9 },
  missionCard: { gap: 6, borderWidth: 1, borderColor: '#FFFFFF1C', borderRadius: 16, backgroundColor: colors.surfaceLifted, padding: 13 },
  missionCardDone: { borderColor: '#8AF4D670', backgroundColor: '#8AF4D610' },
  missionCardPressed: { opacity: 0.78 },
  missionTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  missionName: { flex: 1, color: colors.white, fontSize: 15, fontWeight: '900' },
  missionDraw: { color: colors.mint, fontSize: 10, fontWeight: '900' },
  missionDone: { color: colors.mint, fontSize: 10, fontWeight: '900' },
  missionPrompt: { color: colors.softText, fontSize: 12, lineHeight: 17 },
  missionPurpose: { color: colors.lavender, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  inputLabel: { color: colors.softText, fontSize: 11, fontWeight: '900' },
  input: { minHeight: 62, borderWidth: 1, borderColor: '#FFFFFF20', borderRadius: radii.medium, backgroundColor: colors.surfaceLifted, color: colors.white, padding: 12, textAlignVertical: 'top' },
  nextStepCard: { gap: 11, borderRadius: radii.large, padding: spacing.md },
  nextStepTitle: { color: colors.white, fontSize: 24, fontWeight: '900', letterSpacing: -0.8, lineHeight: 27 },
  nextStepCopy: { color: '#FFFFFFD6', fontSize: 13, lineHeight: 19 },
  variantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  variant: { position: 'relative', flexBasis: '47%', flexGrow: 1, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF20', borderRadius: 16, backgroundColor: colors.surfaceLifted },
  variantSelected: { borderColor: colors.mint, borderWidth: 2 },
  variantImage: { width: '100%', aspectRatio: 1.2, resizeMode: 'cover' },
  variantCheck: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, color: colors.ink, backgroundColor: colors.mint, fontSize: 16, fontWeight: '900', textAlign: 'center', lineHeight: 26 },
  variantCopy: { gap: 3, padding: 10 },
  variantTitle: { color: colors.white, fontWeight: '900' },
  variantDescription: { color: colors.softText, fontSize: 11, lineHeight: 15 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  saveButton: { flex: 1 },
  deleteButton: { paddingHorizontal: 14, paddingVertical: 12 },
  deleteText: { color: colors.error, fontSize: 13, fontWeight: '800' },
  canvasSafe: { flex: 1, gap: 12, padding: 18, backgroundColor: colors.ink },
  canvasHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  canvasHeading: { flex: 1 },
  canvasTitle: { color: colors.white, fontSize: 24, fontWeight: '900' },
  menuButton: { alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: radii.medium, backgroundColor: colors.surfaceLifted },
  menuIcon: { color: colors.white, fontSize: 26, fontWeight: '900' },
  doneButton: { borderRadius: radii.pill, backgroundColor: colors.mint, paddingHorizontal: 14, paddingVertical: 12 },
  doneButtonText: { color: colors.ink, fontWeight: '900' },
  objectMenu: { gap: 6, maxHeight: 220, overflow: 'hidden', borderRadius: radii.medium, backgroundColor: colors.surfaceLifted, padding: 10 },
  objectMenuTitle: { color: colors.softText, fontSize: 12, fontWeight: '900', paddingBottom: 2 },
  objectOption: { borderRadius: radii.small, backgroundColor: '#FFFFFF12', paddingHorizontal: 12, paddingVertical: 10 },
  objectOptionSelected: { backgroundColor: '#8AF4D640' },
  objectOptionText: { color: colors.white, fontWeight: '800' },
  fullscreenWorld: { flex: 1, minHeight: 200, overflow: 'hidden', borderRadius: radii.hero, backgroundColor: colors.surfaceLifted },
  canvasInstruction: { color: colors.softText, textAlign: 'center', fontWeight: '700' },
  layerActions: { flexDirection: 'row', gap: 8 },
});

function DraggableCanvasAsset({
  asset,
  onMove,
  onSelect,
  selected,
  enabled,
  worldSize,
}: {
  asset: CanvasAsset;
  onMove: (assetId: string, x: number, y: number) => void;
  onSelect: (assetId: string) => void;
  selected: boolean;
  enabled: boolean;
  worldSize: { width: number; height: number };
}) {
  const startPosition = useRef({ x: asset.x, y: asset.y });
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => enabled,
    onMoveShouldSetPanResponder: () => enabled,
    onPanResponderGrant: () => {
      startPosition.current = { x: asset.x, y: asset.y };
      onSelect(asset.id);
    },
    onPanResponderMove: (_event, gesture) => onMove(
      asset.id,
      startPosition.current.x + gesture.dx / worldSize.width,
      startPosition.current.y + gesture.dy / worldSize.height,
    ),
  }), [asset.id, asset.x, asset.y, enabled, onMove, onSelect, worldSize.height, worldSize.width]);

  return (
    <View {...responder.panHandlers} style={[styles.asset, { left: `${asset.x * 100}%`, top: `${asset.y * 100}%`, width: `${asset.width * 100}%`, height: `${asset.height * 100}%`, zIndex: asset.zIndex }, selected ? styles.assetSelected : null]}>
      <View pointerEvents="none" style={styles.assetContents}><Image source={{ uri: asset.imageDataUrl }} style={styles.assetImage} /><Text numberOfLines={1} style={styles.assetName}>{asset.name}</Text></View>
    </View>
  );
}

function StaticCanvasAsset({ asset, selected }: { asset: CanvasAsset; selected: boolean }) {
  return (
    <View pointerEvents="none" style={[styles.asset, { left: `${asset.x * 100}%`, top: `${asset.y * 100}%`, width: `${asset.width * 100}%`, height: `${asset.height * 100}%`, zIndex: asset.zIndex }, selected ? styles.assetSelected : null]}>
      <View style={styles.assetContents}><Image source={{ uri: asset.imageDataUrl }} style={styles.assetImage} /><Text numberOfLines={1} style={styles.assetName}>{asset.name}</Text></View>
    </View>
  );
}

function compactDrawingPrompt(prompt: string, maxLength = 150): string {
  const clean = prompt.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const firstSentence = clean.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  if (firstSentence && firstSentence.length <= maxLength) return firstSentence;
  const shortened = clean.slice(0, maxLength - 1).replace(/\s+\S*$/, '').trim();
  return `${shortened}…`;
}

function createId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

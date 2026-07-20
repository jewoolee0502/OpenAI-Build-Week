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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { BuilderDraft, CanvasAsset } from '@/api/types';
import { BrandHeader } from '@/components/brand-header';
import { DrawingSheet } from '@/components/drawing-sheet';
import { HoldToTalkButton } from '@/components/hold-to-talk-button';
import { ActionButton, ErrorBanner, LoadingPill, MiniBadge, SurfaceCard } from '@/components/ui';
import { useAppState } from '@/state/app-provider';
import { colors, radii, spacing } from '@/theme';

const emptyDraft = (): BuilderDraft => ({
  stage: 'build',
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
    projects,
    refreshChildProjects,
    deleteProject,
    loadBuilderDraft,
    saveBuilderDraft,
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
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [worldSize, setWorldSize] = useState({ width: 1, height: 1 });
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [isObjectMenuOpen, setIsObjectMenuOpen] = useState(false);

  useEffect(() => {
    if (!project) void refreshChildProjects().catch(() => undefined);
  }, [project, refreshChildProjects]);

  useEffect(() => {
    if (!projectId) return;
    void loadBuilderDraft(projectId)
      .then((value) => setDraft(value ?? emptyDraft()))
      .catch(() => undefined);
  }, [loadBuilderDraft, projectId]);

  const selected = draft.assets.find((asset) => asset.id === selectedAssetId) ?? null;
  const background = draft.assets.find((asset) => asset.kind === 'background') ?? null;
  const objects = useMemo(
    () => draft.assets.filter((asset) => asset.kind === 'object').sort((a, b) => a.zIndex - b.zIndex),
    [draft.assets],
  );

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
    const name = isBackground ? 'My background' : objectName.trim() || 'My game object';
    const asset: CanvasAsset = {
      id: createId(),
      kind: isBackground ? 'background' : 'object',
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
    setObjectName('');
    setSelectedAssetId(asset.id);
  }, [mode, objectName, objects.length]);

  const requestVariants = useCallback(async () => {
    if (!projectId || !background) return;
    const preparedDraft = { ...draft, interpretationStatus: 'pending' as const };
    await save(preparedDraft);
    setIsWorking(true);
    try {
      setDraft(await generateSceneVariants(projectId));
    } finally {
      setIsWorking(false);
    }
  }, [background, draft, generateSceneVariants, projectId, save]);

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
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <BrandHeader onBack={() => setMode('canvas')} />
        <View style={styles.drawingContent}>
          {mode === 'object' ? (
            <SurfaceCard style={styles.card}>
              <Text style={styles.cardEyebrow}>NAME YOUR IDEA</Text>
              <Text style={styles.cardTitle}>What did you draw?</Text>
              <TextInput
                value={objectName}
                onChangeText={setObjectName}
                placeholder="A bird, coin, castle…"
                placeholderTextColor={colors.mutedText}
                style={styles.input}
              />
            </SurfaceCard>
          ) : null}
          <DrawingSheet fullScreen onCancel={() => setMode('canvas')} onSave={addDrawing} />
        </View>
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

          <StepRail stage={draft.stage} />
          {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={clearError} /> : null}

          <LinearGradient colors={['#342A64', '#24203E']} style={styles.worldShell}>
            <View style={styles.worldTopLine}>
              <View><Text style={styles.cardEyebrow}>YOUR CANVAS</Text><Text style={styles.worldTitle}>Arrange the scene</Text></View>
              <Text style={styles.assetCount}>{draft.assets.length} piece{draft.assets.length === 1 ? '' : 's'}</Text>
            </View>
            <Pressable
              accessibilityHint="Opens a full-screen space where you can move one object at a time."
              accessibilityLabel="Open full-screen canvas"
              onPress={openCanvas}
              style={styles.world}>
              {background ? (
                <Image source={{ uri: background.imageDataUrl }} style={styles.background} />
              ) : (
                <View style={styles.blank}><Text style={styles.blankSymbol}>✦</Text><Text style={styles.blankText}>Draw a background to start your world</Text></View>
              )}
              {objects.map((asset) => <StaticCanvasAsset asset={asset} key={asset.id} selected={selectedAssetId === asset.id} />)}
              <View pointerEvents="none" style={styles.worldHint}><Text style={styles.worldHintText}>↗ Tap to arrange</Text></View>
            </Pressable>
            <View style={styles.actions}>
              <View style={styles.actionHalf}><ActionButton label={background ? 'Redraw background' : 'Draw background'} onPress={() => setMode('background')} tone="secondary" /></View>
              <View style={styles.actionHalf}><ActionButton label="+ Add an object" onPress={() => setMode('object')} /></View>
            </View>
          </LinearGradient>

          <View style={styles.learningCallout}>
            <Text style={styles.learningIcon}>💡</Text>
            <View style={styles.learningCopy}><Text style={styles.learningTitle}>You&apos;re the art director</Text><Text style={styles.learningText}>Give objects names, place them with intention, and explain what should happen in your game.</Text></View>
          </View>

          {selected ? (
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

          {draft.variants.length === 0 ? (
            <LinearGradient colors={['#6F46D8', '#B65F92']} style={styles.nextStepCard}>
              <Text style={styles.cardEyebrow}>NEXT: CHOOSE A LOOK</Text>
              <Text style={styles.nextStepTitle}>Ready to see your world in four styles?</Text>
              <Text style={styles.nextStepCopy}>ImagineLab reads your prompt, named drawings, arrangement, and behavior idea. You choose what fits.</Text>
              <ActionButton
                disabled={!background}
                label="✦  Show 4 design ideas"
                loading={isWorking}
                onPress={() => void requestVariants()}
                tone="mint"
              />
            </LinearGradient>
          ) : (
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
          )}

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

function StepRail({ stage }: { stage: BuilderDraft['stage'] }) {
  const activeStep = stage === 'build' ? 0 : stage === 'choose_design' ? 1 : 2;
  return (
    <View accessibilityLabel={`Builder step ${activeStep + 1} of 3`} style={styles.stepRail}>
      {['DRAW & ARRANGE', 'CHOOSE A LOOK', 'TEST & IMPROVE'].map((label, index) => (
        <View key={label} style={styles.stepItem}>
          <View style={[styles.stepDot, index <= activeStep ? styles.stepDotActive : null]}><Text style={[styles.stepNumber, index <= activeStep ? styles.stepNumberActive : null]}>{index + 1}</Text></View>
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
  drawingContent: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.sm, padding: 18, paddingTop: spacing.sm },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headingCopy: { flex: 1, gap: 3 },
  eyebrow: { color: colors.mint, fontWeight: '900', fontSize: 11, letterSpacing: 1.1 },
  title: { color: colors.white, fontSize: 31, fontWeight: '900', letterSpacing: -1.2, lineHeight: 34 },
  subtitle: { color: colors.softText, fontSize: 13, lineHeight: 19 },
  stepRail: { flexDirection: 'row', justifyContent: 'space-between', gap: 5, borderRadius: 18, backgroundColor: colors.surface, padding: 12 },
  stepItem: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF2E', borderRadius: 15, backgroundColor: colors.surfaceLifted },
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

function createId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

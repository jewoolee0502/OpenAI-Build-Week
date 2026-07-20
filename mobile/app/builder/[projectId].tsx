import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  stage: 'build', interpretationStatus: 'pending', interpretation: null, assets: [], variants: [], selectedVariantId: null, updatedAt: new Date().toISOString(),
});

export default function BuilderScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { projects, refreshChildProjects, deleteProject, loadBuilderDraft, saveBuilderDraft, generateSceneVariants, testBuilderGame, transcribeAudio, errorMessage, clearError } = useAppState();
  const project = projects.find((candidate) => candidate.id === projectId);
  const [draft, setDraft] = useState<BuilderDraft>(emptyDraft);
  const [mode, setMode] = useState<'canvas' | 'background' | 'object'>('canvas');
  const [objectName, setObjectName] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [change, setChange] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [worldSize, setWorldSize] = useState({ width: 1, height: 1 });
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [isObjectMenuOpen, setIsObjectMenuOpen] = useState(false);

  useEffect(() => { if (!project) void refreshChildProjects().catch(() => undefined); }, [project, refreshChildProjects]);
  useEffect(() => {
    if (!projectId) return;
    void loadBuilderDraft(projectId).then((value) => setDraft(value ?? emptyDraft())).catch(() => undefined);
  }, [loadBuilderDraft, projectId]);

  const selected = draft.assets.find((asset) => asset.id === selectedAssetId) ?? null;
  const background = draft.assets.find((asset) => asset.kind === 'background') ?? null;
  const objects = useMemo(() => draft.assets.filter((asset) => asset.kind === 'object').sort((a, b) => a.zIndex - b.zIndex), [draft.assets]);

  const save = useCallback(async (nextDraft = draft) => {
    if (!projectId) return;
    setIsWorking(true);
    try {
      const saved = await saveBuilderDraft(projectId, { ...nextDraft, updatedAt: new Date().toISOString() });
      setDraft(saved);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally { setIsWorking(false); }
  }, [draft, projectId, saveBuilderDraft]);

  const addDrawing = useCallback((imageDataUrl: string) => {
    const isBackground = mode === 'background';
    const name = isBackground ? 'My background' : objectName.trim() || 'My game object';
    const asset: CanvasAsset = {
      id: createId(), kind: isBackground ? 'background' : 'object', name, imageDataUrl,
      x: isBackground ? 0 : 0.35, y: isBackground ? 0 : 0.35, width: isBackground ? 1 : 0.28, height: isBackground ? 1 : 0.28, zIndex: isBackground ? 0 : objects.length + 1,
    };
    setDraft((current) => ({ ...current, stage: 'build', variants: [], selectedVariantId: null, assets: isBackground ? [...current.assets.filter((item) => item.kind !== 'background'), asset] : [...current.assets, asset] }));
    setMode('canvas'); setObjectName(''); setSelectedAssetId(asset.id);
  }, [mode, objectName, objects.length]);

  const requestVariants = useCallback(async () => {
    if (!projectId || !background) return;
    await save(); setIsWorking(true);
    try { setDraft(await generateSceneVariants(projectId)); } finally { setIsWorking(false); }
  }, [background, generateSceneVariants, projectId, save]);

  const testGame = useCallback(async () => {
    if (!projectId || !draft.selectedVariantId) return;
    await save(); setIsWorking(true);
    try { await testBuilderGame(projectId); await refreshChildProjects(); router.push({ pathname: '/studio/[projectId]', params: { projectId } }); } finally { setIsWorking(false); }
  }, [draft.selectedVariantId, projectId, refreshChildProjects, router, save, testBuilderGame]);

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
      const layeredObjects = current.assets.filter((asset) => asset.kind === 'object').sort((a, b) => a.zIndex - b.zIndex);
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
      { text: 'Delete game', style: 'destructive', onPress: () => void deleteProject(projectId).then(() => router.replace('/')).catch((error: unknown) => Alert.alert('Could not delete game', error instanceof Error ? error.message : 'Please try again.')) },
    ]);
  }, [deleteProject, projectId, router]);

  if (!project) return <SafeAreaView style={styles.safe}><BrandHeader onBack={() => router.back()} /><LoadingPill label="Opening your game…" /></SafeAreaView>;
  if (mode !== 'canvas') return <SafeAreaView style={styles.safe} edges={['top']}><BrandHeader onBack={() => setMode('canvas')} /><View style={styles.drawingContent}>{mode === 'object' ? <SurfaceCard style={styles.card}><Text style={styles.cardTitle}>What did you draw?</Text><TextInput value={objectName} onChangeText={setObjectName} placeholder="A bird, coin, castle…" placeholderTextColor={colors.mutedText} style={styles.input} /></SurfaceCard> : null}<DrawingSheet fullScreen onCancel={() => setMode('canvas')} onSave={addDrawing} /></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top']}><BrandHeader onBack={() => { void save().finally(() => router.back()); }} /><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.heading}><View><Text style={styles.eyebrow}>BUILD YOUR WORLD</Text><Text style={styles.title}>{project.title}</Text></View><MiniBadge label={draft.interpretationStatus === 'pending' ? 'AI IS THINKING' : 'READY'} /></View>
    {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={clearError} /> : null}
    <Pressable accessibilityHint="Opens a full-screen space where you can move one object at a time." accessibilityLabel="Open full-screen canvas" onPress={openCanvas} style={styles.world}>
      {background ? <Image source={{ uri: background.imageDataUrl }} style={styles.background} /> : <View style={styles.blank}><Text style={styles.blankText}>Draw a background to start your world</Text></View>}
      {objects.map((asset) => <StaticCanvasAsset asset={asset} key={asset.id} selected={selectedAssetId === asset.id} />)}
      <View pointerEvents="none" style={styles.worldHint}><Text style={styles.worldHintText}>Tap canvas to move objects</Text></View>
    </Pressable>
    <View style={styles.actions}><ActionButton label="Draw background" onPress={() => setMode('background')} tone="secondary" /><ActionButton label="Add an object" onPress={() => setMode('object')} /></View>
    {selected ? <SurfaceCard style={styles.card}><Text style={styles.cardTitle}>{selected.name}</Text><Text style={styles.cardCopy}>Tap the canvas above to move it in a full-screen workspace.</Text><TextInput value={change} onChangeText={setChange} multiline placeholder={`Tell ImagineLab what ${selected.name} should do…`} placeholderTextColor={colors.mutedText} style={styles.input} /><HoldToTalkButton onTranscript={(text) => setChange((current) => [current, text].filter(Boolean).join(' '))} transcribeAudio={transcribeAudio} /></SurfaceCard> : null}
    <SurfaceCard style={styles.card}><Text style={styles.cardTitle}>Save your progress</Text><Text style={styles.cardCopy}>You can return to your drawings, canvas, or chosen design later.</Text><ActionButton label="Save" loading={isWorking} onPress={() => void save()} tone="mint" /><ActionButton label="Delete game" onPress={confirmDelete} tone="danger" /></SurfaceCard>
    {draft.variants.length === 0 ? <ActionButton disabled={!background} label="Test: show design ideas" loading={isWorking} onPress={() => void requestVariants()} /> : <SurfaceCard style={styles.card}><Text style={styles.cardTitle}>Choose a game look</Text>{draft.variants.map((variant) => <Pressable key={variant.id} onPress={() => setDraft((current) => ({ ...current, stage: 'test', selectedVariantId: variant.id }))} style={[styles.variant, draft.selectedVariantId === variant.id ? styles.variantSelected : null]}><Image source={{ uri: variant.previewDataUrl }} style={styles.variantImage} /><View style={styles.variantCopy}><Text style={styles.variantTitle}>{variant.title}</Text><Text style={styles.cardCopy}>{variant.description}</Text></View></Pressable>)}<ActionButton disabled={!draft.selectedVariantId} label="Play this game" loading={isWorking} onPress={() => void testGame()} tone="mint" /></SurfaceCard>}
  </ScrollView><Modal animationType="slide" onRequestClose={() => setIsCanvasOpen(false)} visible={isCanvasOpen}><SafeAreaView style={styles.canvasSafe} edges={['top', 'bottom']}><View style={styles.canvasHeader}><View style={styles.canvasHeading}><Text style={styles.eyebrow}>ARRANGE YOUR WORLD</Text><Text style={styles.canvasTitle}>{selected?.name ?? 'Choose an object'}</Text></View><Pressable accessibilityLabel="Choose an object" onPress={() => setIsObjectMenuOpen((open) => !open)} style={styles.menuButton}><Text style={styles.menuIcon}>☰</Text></Pressable><Pressable accessibilityLabel="Finish moving objects" onPress={() => setIsCanvasOpen(false)} style={styles.doneButton}><Text style={styles.doneButtonText}>Done</Text></Pressable></View>
    {isObjectMenuOpen ? <View style={styles.objectMenu}><Text style={styles.objectMenuTitle}>Choose an object to move</Text>{objects.length ? objects.map((asset) => <Pressable key={asset.id} onPress={() => { setSelectedAssetId(asset.id); setIsObjectMenuOpen(false); }} style={[styles.objectOption, asset.id === selectedAssetId ? styles.objectOptionSelected : null]}><Text style={styles.objectOptionText}>{asset.name}</Text></Pressable>) : <Text style={styles.cardCopy}>Add an object first.</Text>}</View> : null}
    <View onLayout={(event) => setWorldSize(event.nativeEvent.layout)} style={styles.fullscreenWorld}>{background ? <Image source={{ uri: background.imageDataUrl }} style={styles.background} /> : <View style={styles.blank}><Text style={styles.blankText}>Draw a background to start your world</Text></View>}{objects.map((asset) => <DraggableCanvasAsset asset={asset} enabled={asset.id === selectedAssetId} key={asset.id} onMove={moveAsset} onSelect={setSelectedAssetId} selected={asset.id === selectedAssetId} worldSize={worldSize} />)}</View>
    <Text style={styles.canvasInstruction}>{selected ? `Drag ${selected.name}. Use ☰ if it is hard to select.` : 'Choose an object from ☰ to start moving it.'}</Text><View style={styles.layerActions}><ActionButton disabled={!selected} label="Move back" onPress={() => moveLayer('backward')} tone="secondary" /><ActionButton disabled={!selected} label="Move forward" onPress={() => moveLayer('forward')} /></View>
  </SafeAreaView></Modal></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink }, content: { gap: spacing.md, padding: 18, paddingBottom: 48 }, drawingContent: { flex: 1, gap: spacing.sm, padding: 18, paddingTop: spacing.sm }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, eyebrow: { color: colors.mint, fontWeight: '900', fontSize: 12, letterSpacing: 1 }, title: { color: colors.white, fontSize: 29, fontWeight: '900' }, world: { aspectRatio: 1.35, overflow: 'hidden', borderRadius: radii.hero, backgroundColor: colors.surfaceLifted }, worldHint: { position: 'absolute', right: 10, bottom: 10, borderRadius: radii.pill, backgroundColor: '#17142BD9', paddingHorizontal: 10, paddingVertical: 6 }, worldHintText: { color: colors.white, fontSize: 12, fontWeight: '900' }, blank: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }, blankText: { color: colors.softText, textAlign: 'center', fontWeight: '700' }, background: { width: '100%', height: '100%', position: 'absolute' }, asset: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' }, assetContents: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }, assetSelected: { borderColor: colors.mint }, assetImage: { width: '100%', height: '100%', resizeMode: 'contain' }, assetName: { color: colors.white, fontWeight: '900', fontSize: 11, backgroundColor: '#17142BAA', paddingHorizontal: 4 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, card: { gap: 10 }, cardTitle: { color: colors.white, fontSize: 20, fontWeight: '900' }, cardCopy: { color: colors.softText, lineHeight: 20 }, input: { minHeight: 62, borderRadius: radii.medium, backgroundColor: colors.surfaceLifted, color: colors.white, padding: 12, textAlignVertical: 'top' }, variant: { overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: '#FFFFFF20', borderRadius: radii.medium, backgroundColor: colors.surfaceLifted }, variantSelected: { borderColor: colors.mint, borderWidth: 2 }, variantImage: { width: 112, height: 82 }, variantCopy: { flex: 1, gap: 4, padding: 10 }, variantTitle: { color: colors.white, fontWeight: '900' }, canvasSafe: { flex: 1, gap: 12, padding: 18, backgroundColor: colors.ink }, canvasHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 }, canvasHeading: { flex: 1 }, canvasTitle: { color: colors.white, fontSize: 24, fontWeight: '900' }, menuButton: { alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: radii.medium, backgroundColor: colors.surfaceLifted }, menuIcon: { color: colors.white, fontSize: 26, fontWeight: '900' }, doneButton: { borderRadius: radii.pill, backgroundColor: colors.mint, paddingHorizontal: 14, paddingVertical: 12 }, doneButtonText: { color: colors.ink, fontWeight: '900' }, objectMenu: { gap: 6, maxHeight: 220, overflow: 'hidden', borderRadius: radii.medium, backgroundColor: colors.surfaceLifted, padding: 10 }, objectMenuTitle: { color: colors.softText, fontSize: 12, fontWeight: '900', paddingBottom: 2 }, objectOption: { borderRadius: radii.small, backgroundColor: '#FFFFFF12', paddingHorizontal: 12, paddingVertical: 10 }, objectOptionSelected: { backgroundColor: '#8AF4D640' }, objectOptionText: { color: colors.white, fontWeight: '800' }, fullscreenWorld: { flex: 1, minHeight: 200, overflow: 'hidden', borderRadius: radii.hero, backgroundColor: colors.surfaceLifted }, canvasInstruction: { color: colors.softText, textAlign: 'center', fontWeight: '700' }, layerActions: { flexDirection: 'row', gap: 8 },
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
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => enabled,
    onMoveShouldSetPanResponder: () => enabled,
    onPanResponderGrant: () => onSelect(asset.id),
    onPanResponderMove: (_event, gesture) => onMove(
      asset.id,
      asset.x + gesture.dx / worldSize.width,
      asset.y + gesture.dy / worldSize.height,
    ),
  }), [asset, enabled, onMove, onSelect, worldSize.height, worldSize.width]);

  return <View {...responder.panHandlers} style={[styles.asset, { left: `${asset.x * 100}%`, top: `${asset.y * 100}%`, width: `${asset.width * 100}%`, height: `${asset.height * 100}%`, zIndex: asset.zIndex }, selected ? styles.assetSelected : null]}><View pointerEvents="none" style={styles.assetContents}><Image source={{ uri: asset.imageDataUrl }} style={styles.assetImage} /><Text numberOfLines={1} style={styles.assetName}>{asset.name}</Text></View></View>;
}

function StaticCanvasAsset({ asset, selected }: { asset: CanvasAsset; selected: boolean }) {
  return <View pointerEvents="none" style={[styles.asset, { left: `${asset.x * 100}%`, top: `${asset.y * 100}%`, width: `${asset.width * 100}%`, height: `${asset.height * 100}%`, zIndex: asset.zIndex }, selected ? styles.assetSelected : null]}><View style={styles.assetContents}><Image source={{ uri: asset.imageDataUrl }} style={styles.assetImage} /><Text numberOfLines={1} style={styles.assetName}>{asset.name}</Text></View></View>;
}

function createId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

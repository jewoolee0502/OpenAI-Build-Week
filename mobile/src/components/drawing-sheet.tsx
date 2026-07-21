import { Ionicons } from '@expo/vector-icons';
import { Canvas, Circle, Path, Rect, Skia, SweepGradient, useCanvasRef } from '@shopify/react-native-skia';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiloButton } from '@/components/milo-button';
import { colors, radii, spacing } from '@/theme';

type Stroke = { path: string; color: string; width: number };

interface DrawingSheetProps {
  onSave: (imageDataUrl: string) => void;
  onCancel: () => void;
  onSpeak?: () => void;
  fullScreen?: boolean;
  projectTitle?: string;
  promptTitle?: string;
  prompt?: string;
  drawingKind?: 'background' | 'object';
}

const paperColor = '#FFF8EF';
const palette = ['#2A1D55', '#EF5F64', '#FF9A4F', '#F0CA3E', '#39A96B', '#3C8FE8', '#8B5FE8', '#2D2D36'];
const wheelColors = ['#FF4D4D', '#FFE14D', '#4DFF88', '#4DDCFF', '#5E72FF', '#D44DFF', '#FF4D4D'];
const brushSizes = [6, 10, 16] as const;

export function DrawingSheet({
  onSave,
  onCancel,
  onSpeak,
  fullScreen = false,
  projectTitle = 'My new world',
  promptTitle = 'Draw it your way',
  prompt,
  drawingKind = 'object',
}: DrawingSheetProps) {
  const insets = useSafeAreaInsets();
  const canvasRef = useCanvasRef();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(palette[0] ?? '#2A1D55');
  const [width, setWidth] = useState<number>(10);
  const [isSaving, setIsSaving] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isPromptVisible, setIsPromptVisible] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const pathRef = useRef<ReturnType<typeof Skia.Path.Make> | null>(null);
  const activeRef = useRef<Stroke | null>(null);

  const colorWheelResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => setColorFromWheel(event.nativeEvent.locationX, event.nativeEvent.locationY, setColor),
        onPanResponderMove: (event) => setColorFromWheel(event.nativeEvent.locationX, event.nativeEvent.locationY, setColor),
      }),
    [],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          setIsPaletteOpen(false);
          const { locationX, locationY } = event.nativeEvent;
          const path = Skia.Path.Make();
          path.moveTo(locationX, locationY);
          pathRef.current = path;
          activeRef.current = { path: path.toSVGString(), color, width };
          setStrokes((current) => [...current, activeRef.current!]);
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          if (!pathRef.current || !activeRef.current) return;
          pathRef.current.lineTo(locationX, locationY);
          const next = { ...activeRef.current, path: pathRef.current.toSVGString() };
          activeRef.current = next;
          setStrokes((current) => [...current.slice(0, -1), next]);
        },
        onPanResponderRelease: () => {
          pathRef.current = null;
          activeRef.current = null;
        },
        onPanResponderTerminate: () => {
          pathRef.current = null;
          activeRef.current = null;
        },
      }),
    [color, width],
  );

  const save = async () => {
    if (strokes.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      const image = await canvasRef.current?.makeImageSnapshotAsync();
      if (image) onSave(`data:image/png;base64,${image.encodeToBase64()}`);
    } finally {
      setIsSaving(false);
    }
  };

  const cycleBrushSize = () => {
    const currentIndex = brushSizes.findIndex((value) => value === width);
    setWidth(brushSizes[(currentIndex + 1) % brushSizes.length] ?? 10);
  };

  const promptCopy = prompt?.trim() || promptTitle;
  const bottomInset = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.sheet, fullScreen ? styles.fullScreen : null]}>
      <StatusBar style={fullScreen ? 'dark' : 'light'} />
      <View
        onLayout={(event) => setCanvasSize(event.nativeEvent.layout)}
        style={[styles.canvas, fullScreen ? styles.canvasExpanded : null]}
        {...responder.panHandlers}>
        <Canvas pointerEvents="none" ref={canvasRef} style={StyleSheet.absoluteFill}>
          {drawingKind === 'background' ? <Rect color={paperColor} height={canvasSize.height} width={canvasSize.width} x={0} y={0} /> : null}
          {strokes.map((stroke, index) => (
            <Path
              color={stroke.color}
              key={`${index}-${stroke.path}`}
              path={stroke.path}
              strokeCap="round"
              strokeJoin="round"
              strokeWidth={stroke.width}
              style="stroke"
            />
          ))}
        </Canvas>
      </View>

      <View pointerEvents="box-none" style={[styles.topOverlay, { top: fullScreen ? insets.top + 8 : 10 }]}>
        <View style={styles.topPanel}>
          <View style={styles.topRow}>
            <Pressable accessibilityLabel="Leave drawing" hitSlop={8} onPress={onCancel} style={styles.backButton}>
              <Ionicons color={colors.white} name="arrow-back" size={25} />
            </Pressable>
            <Text numberOfLines={1} style={styles.projectTitle}>{projectTitle}</Text>
            <View style={styles.topSpacer} />
          </View>
          <View accessibilityLabel={drawingKind === 'background' ? 'Step 2 of 3, draw world' : 'Step 3 of 3, draw pieces'} style={styles.progressRow}>
            <Text style={styles.progressDone}>1&nbsp; ✓</Text>
            <View style={styles.progressLine} />
            <Text style={drawingKind === 'background' ? styles.progressActive : styles.progressDone}>
              {drawingKind === 'background' ? '2  WORLD' : '2  ✓'}
            </Text>
            <View style={styles.progressLine} />
            <Text style={drawingKind === 'object' ? styles.progressActive : styles.progressMuted}>
              {drawingKind === 'object' ? '3  PIECES' : '3'}
            </Text>
          </View>
        </View>
      </View>

      {isPromptVisible ? (
        <View style={[styles.promptChip, { top: fullScreen ? insets.top + 96 : 98 }]}>
          <View style={styles.promptSpark}><Text style={styles.promptSparkText}>✦</Text></View>
          <View style={styles.promptCopy}>
            <Text numberOfLines={1} style={styles.promptTitle}>{promptTitle}</Text>
            {promptCopy !== promptTitle ? <Text numberOfLines={1} style={styles.promptText}>{promptCopy}</Text> : null}
          </View>
          {onSpeak ? (
            <Pressable accessibilityLabel="Hear the drawing prompt" hitSlop={6} onPress={onSpeak} style={styles.promptAction}>
              <Ionicons color="#5C3BC7" name="volume-high" size={21} />
            </Pressable>
          ) : null}
          <Pressable accessibilityLabel="Hide drawing prompt" hitSlop={8} onPress={() => setIsPromptVisible(false)} style={styles.dismissPrompt}>
            <Ionicons color="#746D82" name="close" size={17} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityLabel="Show drawing prompt"
          onPress={() => setIsPromptVisible(true)}
          style={[styles.promptRestore, { top: fullScreen ? insets.top + 96 : 98 }]}>
          <Text style={styles.promptRestoreText}>✦</Text>
        </Pressable>
      )}

      {isPaletteOpen ? (
        <View style={[styles.palettePopover, { bottom: bottomInset + 74 }]}>
          {palette.map((value) => (
            <Pressable
              accessibilityLabel={`Use ${value} color`}
              key={value}
              onPress={() => { setColor(value); setIsPaletteOpen(false); }}
              style={[styles.swatch, { backgroundColor: value }, color === value ? styles.selectedSwatch : null]}
            />
          ))}
          <View accessibilityLabel="Choose any color" accessibilityRole="adjustable" style={styles.colorWheel} {...colorWheelResponder.panHandlers}>
            <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Circle cx={21} cy={21} r={19}><SweepGradient c={{ x: 21, y: 21 }} colors={wheelColors} /></Circle>
              <Circle color={color} cx={21} cy={21} r={7} />
            </Canvas>
          </View>
        </View>
      ) : null}

      <View style={[styles.toolDock, { bottom: bottomInset + 4 }]}>
        <Pressable accessibilityLabel="Choose a drawing color" onPress={() => setIsPaletteOpen((current) => !current)} style={styles.toolButton}>
          <View style={[styles.currentColor, { backgroundColor: color }]} />
        </Pressable>
        <Pressable accessibilityLabel={`Change brush size. Current size ${width}`} onPress={cycleBrushSize} style={styles.toolButton}>
          <Ionicons color={colors.white} name="brush" size={23} />
          <Text style={styles.toolBadge}>{width}</Text>
        </Pressable>
        <Pressable accessibilityLabel="Undo last stroke" disabled={strokes.length === 0} onPress={() => setStrokes((current) => current.slice(0, -1))} style={[styles.toolButton, strokes.length === 0 ? styles.toolDisabled : null]}>
          <Ionicons color={colors.white} name="arrow-undo" size={23} />
        </Pressable>
        <Pressable accessibilityLabel="Clear drawing" disabled={strokes.length === 0} onPress={() => setStrokes([])} style={[styles.toolButton, strokes.length === 0 ? styles.toolDisabled : null]}>
          <Ionicons color={colors.coral} name="trash-outline" size={22} />
        </Pressable>
      </View>

      <Pressable
        accessibilityLabel="Use this drawing"
        accessibilityRole="button"
        accessibilityState={{ disabled: strokes.length === 0 || isSaving }}
        disabled={strokes.length === 0 || isSaving}
        onPress={() => void save()}
        style={[
          styles.confirm,
          { bottom: bottomInset + 83 },
          strokes.length === 0 || isSaving ? styles.confirmDisabled : null,
        ]}>
        <Ionicons color={colors.ink} name={isSaving ? 'hourglass-outline' : 'checkmark'} size={35} />
      </Pressable>

      {onSpeak ? (
        <MiloButton
          accessibilityLabel="Ask Milo to repeat the drawing idea"
          compact
          label="Need an idea?"
          onPress={onSpeak}
          style={[styles.milo, { bottom: bottomInset + 2 }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'relative', gap: spacing.sm, overflow: 'hidden', borderRadius: radii.large, backgroundColor: colors.surface, padding: spacing.md },
  fullScreen: { flex: 1, gap: 0, borderRadius: 0, backgroundColor: paperColor, padding: 0 },
  canvas: { height: 300, overflow: 'hidden', borderRadius: radii.medium, backgroundColor: paperColor },
  canvasExpanded: { ...StyleSheet.absoluteFillObject, height: undefined, borderRadius: 0 },
  topOverlay: { position: 'absolute', zIndex: 30, left: 10, right: 10 },
  topPanel: { overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF18', borderRadius: 23, backgroundColor: '#17142BF2', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 8 },
  topRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  projectTitle: { flex: 1, color: colors.white, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  topSpacer: { width: 42 },
  progressRow: { minHeight: 31, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderTopWidth: 1, borderTopColor: '#FFFFFF0F', paddingHorizontal: 12, paddingBottom: 4 },
  progressDone: { color: colors.mint, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  progressActive: { overflow: 'hidden', borderRadius: radii.pill, backgroundColor: '#FFE36C', color: '#37266A', fontSize: 9, fontWeight: '900', letterSpacing: 0.5, paddingHorizontal: 9, paddingVertical: 4 },
  progressMuted: { color: colors.mutedText, fontSize: 9, fontWeight: '900' },
  progressLine: { width: 18, height: 1, backgroundColor: '#FFFFFF28' },
  promptChip: { position: 'absolute', zIndex: 28, left: 12, maxWidth: '84%', minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#2A1D551A', borderRadius: 18, backgroundColor: '#FFF8EFF5', paddingHorizontal: 9, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 10, elevation: 6 },
  promptSpark: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#FFE36C' },
  promptSparkText: { color: '#6D3CE7', fontSize: 18, fontWeight: '900' },
  promptCopy: { flexShrink: 1, gap: 1 },
  promptTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  promptText: { color: '#5C5575', fontSize: 10, fontWeight: '700' },
  promptAction: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#EFE6FF' },
  dismissPrompt: { width: 28, height: 39, alignItems: 'center', justifyContent: 'center' },
  promptRestore: { position: 'absolute', zIndex: 28, left: 13, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white, borderRadius: 24, backgroundColor: '#FFE36C', elevation: 6 },
  promptRestoreText: { color: '#6D3CE7', fontSize: 23, fontWeight: '900' },
  palettePopover: { position: 'absolute', zIndex: 31, left: 12, maxWidth: 288, flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderWidth: 1, borderColor: '#FFFFFF20', borderRadius: 19, backgroundColor: '#17142BF2', padding: 10, elevation: 9 },
  swatch: { width: 36, height: 36, borderWidth: 3, borderColor: 'transparent', borderRadius: 18 },
  selectedSwatch: { borderColor: colors.white, transform: [{ scale: 1.08 }] },
  colorWheel: { width: 42, height: 42, overflow: 'hidden', borderWidth: 2, borderColor: colors.white, borderRadius: 21 },
  toolDock: { position: 'absolute', zIndex: 30, left: 12, flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: '#FFFFFF20', borderRadius: 20, backgroundColor: '#17142BF2', padding: 7, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 10, elevation: 8 },
  toolButton: { position: 'relative', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#FFFFFF0E' },
  toolDisabled: { opacity: 0.34 },
  currentColor: { width: 27, height: 27, borderWidth: 3, borderColor: colors.white, borderRadius: 14 },
  toolBadge: { position: 'absolute', right: 3, bottom: 2, minWidth: 17, overflow: 'hidden', borderRadius: 8, backgroundColor: colors.mint, color: colors.ink, fontSize: 8, fontWeight: '900', textAlign: 'center', paddingHorizontal: 2, paddingVertical: 1 },
  confirm: { position: 'absolute', zIndex: 32, right: 15, width: 66, height: 66, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white, borderRadius: 33, backgroundColor: colors.mint, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10 },
  confirmDisabled: { opacity: 0.42 },
  milo: { position: 'absolute', zIndex: 31, right: 14 },
});

function setColorFromWheel(x: number, y: number, setColor: (value: string) => void): void {
  const angle = (Math.atan2(y - 21, x - 21) * 180) / Math.PI;
  const hue = (angle + 360) % 360;
  setColor(`hsl(${Math.round(hue)} 90% 45%)`);
}

import { Canvas, Circle, Path, Skia, SweepGradient, useCanvasRef } from '@shopify/react-native-skia';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/theme';

type Stroke = { path: string; color: string; width: number };

interface DrawingSheetProps {
  onSave: (imageDataUrl: string) => void;
  onCancel: () => void;
  fullScreen?: boolean;
}

const palette = ['#FFFFFF', '#FF9B82', '#FFE36C', '#8EE6CE', '#A88BFF', '#6BBEFF'];

const wheelColors = ['#FF4D4D', '#FFE14D', '#4DFF88', '#4DDCFF', '#5E72FF', '#D44DFF', '#FF4D4D'];

export function DrawingSheet({ onSave, onCancel, fullScreen = false }: DrawingSheetProps) {
  const canvasRef = useCanvasRef();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(palette[0] ?? '#FFFFFF');
  const [width, setWidth] = useState(10);
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
      }),
    [color, width],
  );

  const save = async () => {
    const image = await canvasRef.current?.makeImageSnapshotAsync();
    if (!image) return;
    onSave(`data:image/png;base64,${image.encodeToBase64()}`);
  };

  return (
    <View style={[styles.sheet, fullScreen ? styles.fullScreen : null]}>
      <Text style={styles.title}>Draw your idea</Text>
      <Text style={styles.copy}>Use your finger. It can be messy — ImagineLab will help later.</Text>
      <View style={[styles.canvas, fullScreen ? styles.canvasExpanded : null]} {...responder.panHandlers}>
        <Canvas pointerEvents="none" ref={canvasRef} style={StyleSheet.absoluteFill}>
          {strokes.map((stroke, index) => (
            <Path key={`${index}-${stroke.path}`} color={stroke.color} path={stroke.path} style="stroke" strokeWidth={stroke.width} strokeCap="round" strokeJoin="round" />
          ))}
        </Canvas>
      </View>
      <View style={styles.row}>
        {palette.map((value) => <Pressable key={value} onPress={() => setColor(value)} style={[styles.swatch, { backgroundColor: value }, color === value ? styles.selected : null]} />)}
        <View accessibilityLabel="Choose any color" accessibilityRole="adjustable" style={styles.colorWheel} {...colorWheelResponder.panHandlers}>
          <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Circle cx={25} cy={25} r={23}><SweepGradient c={{ x: 25, y: 25 }} colors={wheelColors} /></Circle>
            <Circle color={color} cx={25} cy={25} r={8} />
          </Canvas>
        </View>
        <View style={[styles.currentColor, { backgroundColor: color }]} />
      </View>
      <View style={styles.row}>
        {[6, 10, 16].map((value) => <Pressable key={value} onPress={() => setWidth(value)} style={[styles.size, width === value ? styles.selectedSize : null]}><Text style={styles.sizeText}>{value === 6 ? 'Fine' : value === 10 ? 'Brush' : 'Bold'}</Text></Pressable>)}
        <Pressable onPress={() => setStrokes((current) => current.slice(0, -1))} style={styles.utility}><Text style={styles.utilityText}>Undo</Text></Pressable>
        <Pressable onPress={() => setStrokes([])} style={styles.utility}><Text style={styles.utilityText}>Clear</Text></Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onCancel} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        <Pressable onPress={() => void save()} style={styles.save}><Text style={styles.saveText}>Save drawing</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.sm, borderRadius: radii.large, backgroundColor: colors.surface, padding: spacing.md },
  fullScreen: { flex: 1 },
  title: { color: colors.white, fontSize: 22, fontWeight: '900' },
  copy: { color: colors.softText, lineHeight: 20 },
  canvas: { height: 300, overflow: 'hidden', borderRadius: radii.medium, backgroundColor: '#252044', borderWidth: 1, borderColor: '#FFFFFF25' },
  canvasExpanded: { flex: 1, height: undefined, minHeight: 280 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  colorWheel: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', borderWidth: 2, borderColor: colors.white },
  currentColor: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.white },
  selected: { borderColor: colors.mint, transform: [{ scale: 1.12 }] },
  size: { borderRadius: 12, backgroundColor: colors.surfaceLifted, paddingHorizontal: 10, paddingVertical: 8 },
  selectedSize: { backgroundColor: colors.lavender },
  sizeText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  utility: { paddingHorizontal: 6, paddingVertical: 8 },
  utilityText: { color: colors.mint, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  cancel: { flex: 1, alignItems: 'center', padding: 14 },
  cancelText: { color: colors.softText, fontWeight: '900' },
  save: { flex: 2, alignItems: 'center', borderRadius: radii.medium, backgroundColor: colors.mint, padding: 14 },
  saveText: { color: colors.ink, fontWeight: '900' },
});

function setColorFromWheel(x: number, y: number, setColor: (value: string) => void): void {
  const angle = (Math.atan2(y - 25, x - 25) * 180) / Math.PI;
  const hue = (angle + 360) % 360;
  setColor(`hsl(${Math.round(hue)} 100% 60%)`);
}

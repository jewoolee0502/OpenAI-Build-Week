import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/theme';

// Metro transforms this packaged WebAssembly file into a public asset URL.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const canvasKitWasm = require('canvaskit-wasm/bin/full/canvaskit.wasm') as string;

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

export function DrawingSheet(props: DrawingSheetProps) {
  return (
    <WithSkiaWeb
      componentProps={props}
      fallback={
        <View style={styles.loading}>
          <ActivityIndicator color={colors.mint} />
          <Text style={styles.text}>Getting the drawing canvas ready…</Text>
        </View>
      }
      getComponent={() => {
        // Expo resolves platform extensions for dynamic imports, so load the implementation explicitly.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return Promise.resolve({ default: require('./drawing-sheet.tsx').DrawingSheet });
      }}
      opts={{ locateFile: () => canvasKitWasm }}
    />
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.large, backgroundColor: colors.surface },
  text: { color: colors.softText, fontWeight: '700' },
});

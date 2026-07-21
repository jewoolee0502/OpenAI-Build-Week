import {
  Image,
  type ImageContentFit,
  type ImageSource,
  type ImageStyle,
} from 'expo-image';
import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface IllustratedSceneFrameProps {
  children: ReactNode;
  height: number;
  source: ImageSource | number | string;
  width: number;
  contentFit?: ImageContentFit;
  contentStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  style?: StyleProp<ViewStyle>;
}

export function IllustratedSceneFrame({
  children,
  height,
  source,
  width,
  contentFit = 'fill',
  contentStyle,
  imageStyle,
  style,
}: IllustratedSceneFrameProps) {
  return (
    <View style={[styles.frame, { height, width }, style]}>
      <Image
        accessibilityIgnoresInvertColors
        contentFit={contentFit}
        source={source}
        style={[styles.image, imageStyle]}
        transition={120}
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
  },
});

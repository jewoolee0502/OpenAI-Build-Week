import { memo, useCallback } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { colors, radii } from '@/theme';

interface GamePreviewProps {
  html: string;
  height?: number;
  fullScreen?: boolean;
}

export const GamePreview = memo(function GamePreview({ html, height = 500, fullScreen = false }: GamePreviewProps) {
  const allowNavigation = useCallback((request: WebViewNavigation) => {
    return request.url === 'about:blank' || request.url.startsWith('about:blank#');
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.frame, styles.webPlaceholder, fullScreen ? styles.fullScreenFrame : { height }]}>
        <Text style={styles.webPlaceholderSymbol}>▷</Text>
        <Text style={styles.webPlaceholderTitle}>Open this project in Expo Go to playtest</Text>
        <Text style={styles.webPlaceholderBody}>
          The secure game preview runs inside the Android and iOS app.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.frame, fullScreen ? styles.fullScreenFrame : { height }]}>
      <WebView
        source={{ html }}
        originWhitelist={['about:blank']}
        onShouldStartLoadWithRequest={allowNavigation}
        javaScriptEnabled
        domStorageEnabled={false}
        cacheEnabled={false}
        incognito
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
        mixedContentMode="never"
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        mediaPlaybackRequiresUserAction
        allowsInlineMediaPlayback={false}
        allowsLinkPreview={false}
        style={styles.webView}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: radii.hero,
    borderWidth: 1,
    borderColor: '#FFFFFF20',
    backgroundColor: colors.surface,
  },
  fullScreenFrame: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 0,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.transparent,
  },
  webPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 28,
  },
  webPlaceholderSymbol: {
    color: colors.coral,
    fontSize: 48,
    fontWeight: '800',
  },
  webPlaceholderTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  webPlaceholderBody: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});

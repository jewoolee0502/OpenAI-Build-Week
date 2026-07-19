import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { colors, radii } from '@/theme';

interface GamePreviewProps {
  html: string;
  height?: number;
}

export const GamePreview = memo(function GamePreview({ html, height = 500 }: GamePreviewProps) {
  const allowNavigation = useCallback((request: WebViewNavigation) => {
    return request.url === 'about:blank' || request.url.startsWith('about:blank#');
  }, []);

  return (
    <View style={[styles.frame, { height }]}>
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
  webView: {
    flex: 1,
    backgroundColor: colors.transparent,
  },
});

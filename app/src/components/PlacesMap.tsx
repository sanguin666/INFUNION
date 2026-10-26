import { useMemo, useRef } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { placesMapHtml, type FromMap, type ToMap } from './placesMapHtml';
import { useMapBridge, type PlacesMapProps } from './placesMapBridge';

/**
 * The map of communities on the phone: the map page in a WebView. The
 * web build has its own file (PlacesMap.web.tsx) drawing the same page in
 * an iframe.
 */
export function PlacesMap(props: PlacesMapProps) {
  const webView = useRef<WebView>(null);
  const html = useMemo(placesMapHtml, []);
  const onMessage = useMapBridge(props, (message: ToMap) => {
    webView.current?.injectJavaScript(`window.receive(${JSON.stringify(JSON.stringify(message))});true;`);
  });

  return (
    <WebView
      ref={webView}
      source={{ html, baseUrl: 'https://infunion.app/' }}
      originWhitelist={['*']}
      onMessage={(event: WebViewMessageEvent) => onMessage(event.nativeEvent.data)}
      style={props.style}
      accessibilityLabel={props.label}
      setSupportMultipleWindows={false}
    />
  );
}

export type { FromMap };

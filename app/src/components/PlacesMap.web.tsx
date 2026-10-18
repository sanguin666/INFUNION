import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { placesMapHtml, type ToMap } from './placesMapHtml';
import { useMapBridge, type PlacesMapProps } from './placesMapBridge';

/** The map of communities in the web build: the same page as on the phone, in an iframe. */
export function PlacesMap(props: PlacesMapProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const html = useMemo(placesMapHtml, []);
  const onMessage = useMapBridge(props, (message: ToMap) => {
    frame.current?.contentWindow?.postMessage({ source: 'ansae-app', data: JSON.stringify(message) }, '*');
  });

  useEffect(() => {
    function listen(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.source === 'ansae-map') onMessage(event.data.data);
    }
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, [onMessage]);

  return (
    <View style={props.style} accessibilityLabel={props.label}>
      <iframe
        ref={frame}
        srcDoc={html}
        title={props.label}
        style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
      />
    </View>
  );
}

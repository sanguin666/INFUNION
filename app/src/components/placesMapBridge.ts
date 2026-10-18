import { useCallback, useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { FromMap, MapPin, ToMap } from './placesMapHtml';

export type PlacesMapProps = {
  pins: MapPin[];
  origin: { latitude: number; longitude: number } | null;
  selectedId: string | null;
  // A pin was tapped (its id), or the map itself (null).
  onSelect: (id: string | null) => void;
  // The map page could not load its library: no connection.
  onError?: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * What the phone and web maps share: hold messages until the page says
 * it is ready, then keep it in step with the pins and the selection.
 */
export function useMapBridge(props: PlacesMapProps, post: (message: ToMap) => void) {
  const [ready, setReady] = useState(false);
  const postRef = useRef(post);
  postRef.current = post;
  const handlers = useRef(props);
  handlers.current = props;

  useEffect(() => {
    if (ready) postRef.current({ type: 'places', pins: props.pins, origin: props.origin });
  }, [ready, props.pins, props.origin]);

  useEffect(() => {
    if (ready) postRef.current({ type: 'select', id: props.selectedId });
  }, [ready, props.selectedId]);

  return useCallback((raw: string) => {
    let message: FromMap;
    try {
      message = JSON.parse(raw) as FromMap;
    } catch {
      return;
    }
    if (message.type === 'ready') setReady(true);
    if (message.type === 'select') handlers.current.onSelect(message.id || null);
    if (message.type === 'error') handlers.current.onError?.();
  }, []);
}

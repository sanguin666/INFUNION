import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_STYLE_URL, pinSvg } from '../placeKinds';
import type { PoiType } from '../api/types';

type Props = {
  latitude: number | null;
  longitude: number | null;
  type: PoiType;
  // Called when the pin is dragged, or dropped by a click on the map.
  onMove: (latitude: number, longitude: number) => void;
  label: string;
};

// Western Europe, for a place that has no pin yet.
const NO_PIN_CENTER: [number, number] = [2.5, 44];

/**
 * The place's pin on an OpenStreetMap map, for the admin to check and
 * correct: drag it, or click where the entrance is.
 */
export default function PinMap({ latitude, longitude, type, onMove, label }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!container.current) return;
    const hasPin = latitude !== null && longitude !== null;
    const instance = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE_URL,
      center: hasPin ? [longitude, latitude] : NO_PIN_CENTER,
      zoom: hasPin ? 16 : 4,
      attributionControl: { compact: true },
    });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    instance.on('load', () => warmUp(instance));
    instance.on('click', (event) => {
      onMoveRef.current(event.lngLat.lat, event.lngLat.lng);
    });
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is built once; the effects below follow the pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The marker follows the pin and the kind of place.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    marker.current?.remove();
    marker.current = null;
    if (latitude === null || longitude === null) return;

    const element = document.createElement('div');
    element.innerHTML = pinSvg(type, 40);
    element.style.cursor = 'grab';
    const next = new maplibregl.Marker({ element, anchor: 'bottom', draggable: true })
      .setLngLat([longitude, latitude])
      .addTo(instance);
    next.on('dragend', () => {
      const position = next.getLngLat();
      onMoveRef.current(position.lat, position.lng);
    });
    marker.current = next;

    // Bring a pin that left the view (a new search result) back in.
    if (!instance.getBounds().contains([longitude, latitude])) {
      instance.jumpTo({ center: [longitude, latitude], zoom: Math.max(instance.getZoom(), 16) });
    }
  }, [latitude, longitude, type]);

  return <div ref={container} className="pin-map" role="application" aria-label={label} />;
}

/**
 * Positron is grey; this warms its land and water toward ANSAE's beige so
 * the map sits on the page instead of on top of it.
 */
function warmUp(instance: maplibregl.Map) {
  for (const layer of instance.getStyle().layers ?? []) {
    try {
      if (layer.type === 'background') instance.setPaintProperty(layer.id, 'background-color', '#F4EEE4');
      if (layer.type === 'fill' && /water/.test(layer.id)) instance.setPaintProperty(layer.id, 'fill-color', '#CFE0EA');
      if (layer.type === 'fill' && /park|wood|grass/.test(layer.id)) instance.setPaintProperty(layer.id, 'fill-color', '#DDE8D2');
    } catch {
      // A layer that won't take the colour keeps its own.
    }
  }
}

import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';

/**
 * The how-to clips (Seb picked direction B, 18 Nov 2026): one short clip
 * per page of the menu, recorded from the real admin on the demo
 * community (see admin/walkthrough). The first sign-in plays them all in
 * a row; afterwards each page's tip has a "Watch how" link to its own
 * clip, and Dashboard › Account plays them again.
 *
 * public/walkthrough/manifest.json lists the clips recorded in each
 * language. A language without clips keeps the welcome tour.
 */
export type Clip = { id: string; title: string; duration: number };

type Manifest = Record<string, Record<string, { title: string; duration: number }>>;

let manifest: Promise<Manifest | null> | null = null;
function loadManifest(): Promise<Manifest | null> {
  manifest ??= fetch(`${import.meta.env.BASE_URL}walkthrough/manifest.json`)
    .then((response) => (response.ok ? (response.json() as Promise<Manifest>) : null))
    .catch(() => null);
  return manifest;
}

/** The clips in the admin's language: undefined while loading, [] if none. */
export function useHowToClips(): Clip[] | undefined {
  const { language } = useI18n();
  const [loaded, setLoaded] = useState<{ language: string; clips: Clip[] } | null>(null);
  useEffect(() => {
    let live = true;
    loadManifest().then((all) => {
      if (!live) return;
      const mine = all?.[language] ?? {};
      setLoaded({ language, clips: Object.entries(mine).map(([id, clip]) => ({ id, ...clip })) });
    });
    return () => {
      live = false;
    };
  }, [language]);
  return loaded?.language === language ? loaded.clips : undefined;
}

// The menu pages whose tip links to a clip, by their path in the menu.
const CLIP_OF_PAGE: Record<string, string> = {
  'home-page': 'home-page',
  members: 'members',
  requests: 'requests',
  events: 'events',
  donations: 'donations',
  website: 'website',
  'my-qr': 'website',
};

export function clipForPage(clips: Clip[] | undefined, page: string): Clip | undefined {
  const id = CLIP_OF_PAGE[page];
  return id ? clips?.find((clip) => clip.id === id) : undefined;
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Anything in the admin (Dashboard › Account) can ask the layout to open
// the player.
const OPEN_EVENT = 'infunion-how-to';
export function openHowTo(clipId?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: clipId ?? null }));
}
export function useOpenHowTo(onOpen: (clipId: string | null) => void) {
  useEffect(() => {
    const listener = (event: Event) => onOpen((event as CustomEvent<string | null>).detail);
    window.addEventListener(OPEN_EVENT, listener);
    return () => window.removeEventListener(OPEN_EVENT, listener);
  }, [onOpen]);
}

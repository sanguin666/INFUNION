import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { PoiHubScreen } from '../screens/PoiHubScreen';
import { AccessibleText } from '../components/AccessibleText';
import { getPoi } from '../api/pois';
import { useI18n } from '../i18n/I18nContext';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n/translations';
import { colors, spacing } from '../theme/theme';
import type { Poi } from '../api/types';
import { PreviewContext, type PreviewState } from './PreviewContext';

// What the dashboard sends, and what this answers it with.
const FROM_ADMIN = 'infunion-admin';
const FROM_APP = 'infunion-app';

type AdminMessage = {
  source: typeof FROM_ADMIN;
  type: 'preview';
  language?: string;
  badges?: PreviewState['badges'];
  blocks?: PreviewState['blocks'];
  drafts?: string[];
};

/** The place to preview, from `?preview=<id>`, on the web only. */
export function previewPoiId(): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  return new URLSearchParams(window.location.search).get('preview');
}

function isLanguage(value: unknown): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

/**
 * The app as a member sees one place, inside the dashboard's phone frame.
 * It is the real hub, home page and tab bar, not a copy, so the preview
 * can't drift from the app. The dashboard pushes what is in its editor
 * through `postMessage`, and the home page draws that instead of what is
 * saved, the moment it changes.
 *
 * Only the window that framed this page is listened to: another tab
 * can't paint someone else's page into it. It only ever changes what this
 * frame draws, never anything on the server.
 */
export function PreviewApp({ poiId }: { poiId: string }) {
  const { setLanguage, t } = useI18n();
  const [poi, setPoi] = useState<Poi | null>(null);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<PreviewState>({ badges: null, blocks: null, drafts: [] });

  useEffect(() => {
    const lang = new URLSearchParams(window.location.search).get('lang');
    if (isLanguage(lang)) setLanguage(lang);
    getPoi(poiId)
      .then(setPoi)
      .catch(() => setFailed(true));
  }, [poiId]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;
      const data = event.data as AdminMessage | undefined;
      if (!data || data.source !== FROM_ADMIN || data.type !== 'preview') return;
      if (isLanguage(data.language)) setLanguage(data.language);
      setState((current) => ({
        badges: data.badges ?? current.badges,
        blocks: data.blocks ?? current.blocks,
        drafts: data.drafts ?? current.drafts,
      }));
    }
    window.addEventListener('message', onMessage);
    // Tells the dashboard it can send what it has; anything sent before
    // this page was listening was lost.
    window.parent?.postMessage({ source: FROM_APP, type: 'ready' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (failed) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center' }}>
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('common.placeUnavailable')}
        </AccessibleText>
      </View>
    );
  }
  if (!poi) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return (
    <PreviewContext.Provider value={state}>
      <PoiHubScreen
        poi={poi}
        onOpenPlaces={() => undefined}
        onAddPlace={() => undefined}
        onLeavePlace={async () => undefined}
        onSignIn={() => undefined}
      />
    </PreviewContext.Provider>
  );
}

import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { AccessibleText } from '../components/AccessibleText';
import { AccessibleButton } from '../components/AccessibleButton';
import { uploadUri } from '../api/client';
import { getPoiBadges, getPoiPageBlocks } from '../api/poiPage';
import { getCampaigns, type Campaign } from '../api/donations';
import { getEvents } from '../api/events';
import { BadgeTiles } from '../components/BadgeTiles';
import { badgeTiles } from '../utils/badges';
import { usePreview } from '../preview/PreviewContext';
import type {
  ActiveModule,
  Event,
  ModuleType,
  PageBlockType,
  Poi,
  PoiBadge,
  PoiPageBlock,
} from '../api/types';
import type { HubTab } from '../components/PoiShell';
import { cardSurface, colors, radii, spacing, themedStyles } from '../theme/theme';
import { useI18n } from '../i18n/I18nContext';
import { TranslateLine } from '../components/TranslateLine';
import { SparkleIcon } from '../components/icons';
import { useTranslations } from '../translation/useTranslations';

type Props = {
  poi: Poi;
  modules: ActiveModule[] | null;
  onSelectTab: (tab: HubTab) => void;
  // The member assistant, when the community has it (Complete plan).
  onAsk?: () => void;
};

// What a POI that hasn't built a page yet gets: its own description,
// so the home page talks about the place from the start.
function defaultBlocks(poi: Poi): PoiPageBlock[] {
  if (!poi.description) return [];
  return [
    { id: 'default:about', type: 'text', position: 0, title: null, body: poi.description, imageUrl: null, itemCount: 1 },
  ];
}

// A block is only worth rendering while the module behind it is on.
const BLOCK_MODULE: Partial<Record<PageBlockType, ModuleType>> = {
  donate: 'donations',
};

// Block types a page may still hold from before but no longer shows.
// The home page talks about the place itself, not lists from the other
// sections (Seb, 28 Sep 2026): Mass times, events, news and the
// livestream are behind their own buttons in the menu. Kept as types so
// they can come back later.
const RETIRED_BLOCKS = new Set<PageBlockType>([
  'celebration_times',
  'next_events',
  'past_events',
  'latest_announcements',
  'next_livestream',
]);

/**
 * A POI's home page: the blocks its admins arranged in the dashboard, in
 * their order, falling back to a sensible default page when they haven't
 * built one. This is what a congregant lands on when they open the place,
 * before they pick anything from the menu.
 */
export function PoiHomeScreen({ poi, modules, onSelectTab, onAsk }: Props) {
  const { t, language } = useI18n();

  const [savedBlocks, setBlocks] = useState<PoiPageBlock[] | null>(null);
  const [savedBadges, setBadges] = useState<PoiBadge[]>([]);
  // In the dashboard's live preview, the editor's badges and sections
  // stand in for the saved ones, unsaved changes included.
  const preview = usePreview();
  const blocks = preview?.blocks
    ? preview.blocks.length > 0
      ? preview.blocks
      : defaultBlocks(poi)
    : savedBlocks;
  const badges = preview?.badges ?? savedBadges;
  const drafts = new Set(preview?.drafts ?? []);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);

  const isLive = (type: ModuleType) =>
    modules?.some((m) => m.moduleType === type && m.status !== 'expired' && m.status !== 'cancelled') ??
    false;

  useEffect(() => {
    let cancelled = false;
    getPoiPageBlocks(poi.id)
      .then((result) => {
        if (!cancelled) setBlocks(result.length > 0 ? result : defaultBlocks(poi));
      })
      // A page nobody could load shouldn't leave the screen blank — the
      // default page is still better than nothing, and every module stays
      // reachable from the tab bar either way.
      .catch(() => {
        if (!cancelled) setBlocks(defaultBlocks(poi));
      });
    return () => {
      cancelled = true;
    };
  }, [poi.id, poi.description]);

  useEffect(() => {
    let cancelled = false;
    getPoiBadges(poi.id)
      .then((result) => {
        if (!cancelled) setBadges(result);
      })
      // No badges is a page that starts with its first block, which is fine.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [poi.id]);

  const visible = (blocks ?? []).filter((block) => {
    if (RETIRED_BLOCKS.has(block.type)) return false;
    const required = BLOCK_MODULE[block.type];
    return !required || isLive(required);
  });
  // The team's own words, translated for a member reading another
  // language (Complete plan). Not in the dashboard's preview, where the
  // team is still writing them.
  const ABOUT = 'default:about';
  const blockTr = useTranslations(
    poi,
    'block',
    preview ? [] : visible.filter((b) => b.id !== ABOUT && (b.title || b.body)).map((b) => b.id),
  );
  const aboutTr = useTranslations(poi, 'about', !preview && visible.some((b) => b.id === ABOUT) ? [poi.id] : []);
  const tx = (block: PoiPageBlock, field: 'title' | 'body', original: string | null | undefined) =>
    block.id === ABOUT
      ? field === 'body'
        ? aboutTr.text(poi.id, 'description', original)
        : (original ?? '')
      : blockTr.text(block.id, field, original);
  const translateLine = (block: PoiPageBlock) =>
    block.id === ABOUT ? <TranslateLine handle={aboutTr} id={poi.id} /> : <TranslateLine handle={blockTr} id={block.id} />;

  // The badges are the one place other sections still show: fetched
  // only when a badge needs them.
  const needsEvents = isLive('events') && badges.some((b) => b.kind !== 'message' && b.kind !== 'campaign');
  const needsCampaigns = isLive('donations') && badges.some((b) => b.kind === 'campaign');

  useEffect(() => {
    if (!needsEvents) return;
    let cancelled = false;
    getEvents(poi.id)
      .then((result) => {
        if (!cancelled) setEvents(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [poi.id, needsEvents]);

  useEffect(() => {
    if (!needsCampaigns) return;
    let cancelled = false;
    getCampaigns(poi.id)
      .then((result) => {
        if (!cancelled) setCampaigns(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [poi.id, needsCampaigns]);

  if (blocks === null) {
    return (
      <AccessibleText variant="body" color={colors.textMuted}>
        {t('common.loading')}
      </AccessibleText>
    );
  }

  // The badges come first, above everything the page holds.
  const tiles = badgeTiles(badges, { events, campaigns, isLive, now: new Date(), language, t });
  const top = <BadgeTiles tiles={tiles} drafts={drafts} onOpen={onSelectTab} />;
  // The place is closing its account: members are told when, and what to
  // keep before then (their tax receipts).
  const closing = poi.closesAt ? (
    <View style={styles.closing} accessibilityRole="alert">
      <AccessibleText variant="body" color={colors.primaryStrong} style={styles.blockTitle}>
        {t('home.closingTitle', {
          date: new Date(poi.closesAt).toLocaleDateString(CLOSING_LOCALES[language] ?? language, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
        })}
      </AccessibleText>
      <AccessibleText variant="body">{t('home.closingBody')}</AccessibleText>
    </View>
  ) : null;

  return (
    <>
      {closing}
      {onAsk && !preview && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('assistant.askPlaceholder', { name: poi.name })}
          onPress={onAsk}
          style={styles.ask}
        >
          <SparkleIcon size={22} color={colors.primary} />
          <AccessibleText variant="body" color={colors.textMuted} style={styles.askText} numberOfLines={3}>
            {t('assistant.askPlaceholder', { name: poi.name })}
          </AccessibleText>
        </Pressable>
      )}
      {top}
      {visible.map((block) => {
        const drawn = renderBlock(block);
        // An unsaved section in the dashboard's preview, outlined so the
        // editor can tell it from what members see today.
        return drawn && drafts.has(block.id) ? (
          <View key={block.id} style={styles.draft}>
            {drawn}
          </View>
        ) : (
          drawn
        );
      })}
    </>
  );

  function renderBlock(block: PoiPageBlock) {
    switch (block.type) {
      case 'text':
        return (
          <View key={block.id} style={styles.section}>
            {!!block.title && (
              <AccessibleText variant="bodyLarge" style={styles.blockTitle}>
                {tx(block, 'title', block.title)}
              </AccessibleText>
            )}
            {!!block.body && <AccessibleText variant="body">{tx(block, 'body', block.body)}</AccessibleText>}
            {translateLine(block)}
          </View>
        );

      case 'image':
        if (!block.imageUrl) return null;
        return (
          <View key={block.id} style={styles.section}>
            <Image
              source={{ uri: uploadUri(block.imageUrl) }}
              style={styles.image}
              resizeMode="cover"
              accessibilityLabel={block.title || poi.name}
            />
            {!!block.title && (
              <AccessibleText variant="caption" color={colors.textMuted}>
                {tx(block, 'title', block.title)}
              </AccessibleText>
            )}
            {!!block.title && translateLine(block)}
          </View>
        );

      case 'donate':
        return (
          <View key={block.id} style={styles.section}>
            {!!block.title && (
              <AccessibleText variant="bodyLarge" style={styles.blockTitle}>
                {tx(block, 'title', block.title)}
              </AccessibleText>
            )}
            {!!block.body && (
              <AccessibleText variant="body" color={colors.textMuted}>
                {tx(block, 'body', block.body)}
              </AccessibleText>
            )}
            {translateLine(block)}
            <AccessibleButton
              label={t('hub.donationsLabel')}
              onPress={() => onSelectTab('donations')}
            />
          </View>
        );

      default:
        return null;
    }
  }
}

const CLOSING_LOCALES: Record<string, string> = { en: 'en-GB', es: 'es-ES', va: 'ca-ES', ca: 'ca-ES', gl: 'gl-ES', pt: 'pt-PT', fr: 'fr-FR' };

const styles = themedStyles(() => ({
  // The assistant's entry, styled as the field it opens.
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  askText: {
    flex: 1,
  },
  closing: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
  },
  draft: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primaryStrong,
    borderRadius: radii.lg,
    padding: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  blockTitle: {
    fontWeight: '800',
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.lg,
    ...cardSurface,
  },
}));

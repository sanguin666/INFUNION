import { useEffect, useState, type ChangeEvent } from 'react';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../api/client';
import { getActiveModules } from '../api/activeModules';
import { getPoi } from '../api/pois';
import {
  createPageBlock,
  deletePageBlock,
  getPageBlocks,
  reorderPageBlocks,
  updatePageBlock,
  uploadPageImage,
} from '../api/poiPage';
import type { ActiveModule, ModuleType, PageBlockType, Poi, PoiPageBlock } from '../api/types';
import { Grip, MoreMenu, moved, useReorder } from '../components/Reorder';
import { BadgesSection } from './BadgesSection';
import { PhonePreview } from '../components/PhonePreview';
import type { PoiBadge } from '../api/types';
import { TabBar, TabPanel, useTab } from '../components/Tabs';
import { PersonalisePanel } from './PersonalisePanel';
import { CommunityInfoCard } from './CommunityInfoCards';
import { LocationCard } from './LocationCard';
import { BottomMenuPanel, initialMenuOrder } from './MenuOrder';
import { hideFromList, useUndo } from '../components/Undo';
import { HomeVersionsButton } from '../components/HomeVersions';

// Four tabs, on one line (Seb, 21 Nov 2026): the colour, name, logo and
// address share Identity instead of two tabs of their own.
const HOME_TABS = ['badges', 'sections', 'menu', 'identity'] as const;

// Blocks that fill themselves from a module's content. They have nothing
// to write, only a count, and they need that module switched on.
const BLOCK_MODULE: Partial<Record<PageBlockType, ModuleType>> = {
  next_events: 'events',
  past_events: 'events',
  latest_announcements: 'announcements',
  next_livestream: 'livestreams',
  donate: 'donations',
  celebration_times: 'events',
};

const COUNTED_BLOCKS = new Set<PageBlockType>(['latest_announcements']);

// No longer offered or shown (Seb, 28 Sep 2026): the home page talks
// about the place, not lists from other sections, which stay behind their
// own buttons in the app's menu. A page that still holds one keeps it in
// the database, hidden here and in the app, so they can come back later.
const RETIRED_BLOCKS = new Set<PageBlockType>([
  'celebration_times',
  'next_events',
  'past_events',
  'latest_announcements',
  'next_livestream',
]);

const ADDABLE_BLOCKS: PageBlockType[] = [
  'text',
  'image',
  'donate',
];

const LIVE_STATUSES = new Set(['trial', 'active']);

/**
 * Switching to another saved version (#194) replaces the whole page, so
 * the editor starts again from what the server now has.
 */
export function PoiHomePage() {
  const [round, setRound] = useState(0);
  const [switched, setSwitched] = useState<string | null>(null);
  return (
    <HomePageEditor
      key={round}
      switched={switched}
      onReload={(message) => {
        setSwitched(message);
        setRound((n) => n + 1);
      }}
    />
  );
}

function HomePageEditor({ onReload, switched }: { onReload: (message: string) => void; switched: string | null }) {
  const poiId = usePoiId();
  const { t } = useI18n();
  const [blocks, setBlocks] = useState<PoiPageBlock[] | null>(null);
  const [saved, setSaved] = useState<Record<string, PoiPageBlock>>({});
  // Retired blocks the page still holds: the server wants every block in
  // a reorder, so they ride along at the end.
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [modules, setModules] = useState<ActiveModule[]>([]);
  const [modulesLoaded, setModulesLoaded] = useState(false);
  // The bottom menu (its own tab): the community, and the order as the
  // tab holds it, saved or not, which the phone shows as it changes.
  const [poi, setPoi] = useState<Poi | null>(null);
  const [menuOrder, setMenuOrder] = useState<ModuleType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // What the phone beside the editor shows: the badges as the badge
  // editor holds them, and which of them are not saved yet.
  const [tab, setTab] = useTab(HOME_TABS);
  const [previewBadges, setPreviewBadges] = useState<{ badges: PoiBadge[]; drafts: string[] } | null>(null);

  const BLOCK_NAMES: Record<PageBlockType, string> = {
    text: t('homePage.blockText'),
    image: t('homePage.blockImage'),
    next_events: t('homePage.blockNextEvents'),
    past_events: t('homePage.blockPastEvents'),
    latest_announcements: t('homePage.blockLatestAnnouncements'),
    next_livestream: t('homePage.blockNextLivestream'),
    donate: t('homePage.blockDonate'),
    celebration_times: t('homePage.blockCelebrationTimes'),
  };

  function adopt(all: PoiPageBlock[]) {
    const list = all.filter((b) => !RETIRED_BLOCKS.has(b.type));
    setHiddenIds(all.filter((b) => RETIRED_BLOCKS.has(b.type)).map((b) => b.id));
    setBlocks(list);
    setSaved(Object.fromEntries(list.map((b) => [b.id, b])));
  }

  useEffect(() => {
    getPageBlocks(poiId)
      .then(adopt)
      .catch(() => setError(t('homePage.loadError')));
    getPoi(poiId)
      .then(setPoi)
      .catch(() => {});
    getActiveModules(poiId)
      .then((list) => {
        setModules(list);
        setModulesLoaded(true);
      })
      // The editor still works without this; it only drives the "module is
      // off" hint, so a failure here isn't worth an error banner.
      .catch(() => {});
  }, [poiId]);

  // A module switched on or off, or a save, starts the list again from
  // what the server has.
  useEffect(() => {
    if (poi && modulesLoaded) setMenuOrder(initialMenuOrder(poi, modules));
  }, [poi, modules, modulesLoaded]);

  function isModuleLive(type: ModuleType) {
    return modules.some((m) => m.moduleType === type && LIVE_STATUSES.has(m.status));
  }

  function editLocally(id: string, patch: Partial<PoiPageBlock>) {
    setJustSaved(false);
    setBlocks((current) => current?.map((b) => (b.id === id ? { ...b, ...patch } : b)) ?? null);
  }

  function isDirty(block: PoiPageBlock) {
    const original = saved[block.id];
    if (!original) return true;
    return (
      original.title !== block.title ||
      original.body !== block.body ||
      original.imageUrl !== block.imageUrl ||
      original.itemCount !== block.itemCount
    );
  }

  // One Save for every section changed (Seb, 21 Nov 2026), instead of a
  // Save under each one.
  const [savingAll, setSavingAll] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  async function saveAll() {
    const changed = (blocks ?? []).filter(isDirty);
    if (changed.length === 0) return;
    setSavingAll(true);
    setJustSaved(false);
    setError(null);
    try {
      for (const block of changed) {
        const updated = await updatePageBlock(poiId, block.id, {
          title: block.title ?? '',
          body: block.body ?? '',
          imageUrl: block.imageUrl ?? '',
          itemCount: block.itemCount,
        });
        setBlocks((current) => current?.map((b) => (b.id === updated.id ? updated : b)) ?? null);
        setSaved((current) => ({ ...current, [updated.id]: updated }));
      }
      setJustSaved(true);
    } catch {
      setError(t('homePage.saveError'));
    } finally {
      setSavingAll(false);
    }
  }

  async function add(type: PageBlockType) {
    setError(null);
    try {
      const created = await createPageBlock(poiId, {
        type,
        itemCount: COUNTED_BLOCKS.has(type) ? 3 : undefined,
      });
      setBlocks((current) => [...(current ?? []), created]);
      setSaved((current) => ({ ...current, [created.id]: created }));
    } catch {
      setError(t('homePage.saveError'));
    }
  }

  async function startFromDefault() {
    setError(null);
    try {
      // Matches the app's fallback page: the place's own description.
      const community = await getPoi(poiId);
      await createPageBlock(poiId, { type: 'text', body: community.description ?? '' });
      adopt(await getPageBlocks(poiId));
    } catch {
      setError(t('homePage.saveError'));
    }
  }

  const undo = useUndo();
  const drag = useReorder(blocks?.length ?? 0, move);

  function remove(id: string) {
    setError(null);
    undo.deleteLater({
      name: blocks?.find((b) => b.id === id)?.title ?? undefined,
      hide: () => hideFromList(setBlocks, id),
      commit: async () => {
        await deletePageBlock(poiId, id);
        adopt(await getPageBlocks(poiId));
      },
      onError: () => setError(t('homePage.saveError')),
    });
  }

  async function move(from: number, to: number) {
    if (!blocks) return;
    // The order must list every section: a delete still waiting goes first.
    await undo.flush();
    // Edits not saved yet ride along: the server's list replaces ours.
    const edits = Object.fromEntries(blocks.filter(isDirty).map((b) => [b.id, b]));
    const next = moved(blocks, from, to);
    setBlocks(next);
    setError(null);
    try {
      const fresh = await reorderPageBlocks(poiId, [...next.map((b) => b.id), ...hiddenIds]);
      adopt(fresh);
      setBlocks((current) => current?.map((b) => edits[b.id] ?? b) ?? null);
    } catch {
      setError(t('homePage.saveError'));
      // Put the list back the way the server still has it.
      adopt(await getPageBlocks(poiId).catch(() => blocks));
    }
  }

  async function pickImage(block: PoiPageBlock, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusyId(block.id);
    setError(null);
    try {
      const { url } = await uploadPageImage(poiId, file);
      // Saved straight away: an uploaded image that still needed a separate
      // Save click reads as though the upload failed.
      const updated = await updatePageBlock(poiId, block.id, { imageUrl: url });
      setBlocks((current) => current?.map((b) => (b.id === updated.id ? updated : b)) ?? null);
      setSaved((current) => ({ ...current, [updated.id]: updated }));
    } catch {
      setError(t('homePage.uploadError'));
    } finally {
      setBusyId(null);
    }
  }

  const previewDrafts = [
    ...(previewBadges?.drafts ?? []),
    ...(blocks ?? []).filter(isDirty).map((block) => block.id),
  ];

  return (
    <div className="page-with-preview">
      <div className="page-editor">
        <h2>{t('homePage.title')}</h2>
        <div className="page-subtitle-row">
          <p className="muted">{t('homePage.subtitle')}</p>
          <HomeVersionsButton poiId={poiId} onSwitched={onReload} beforeChange={undo.flush} />
        </div>
        {switched && (
          <p className="versions-notice" role="status" style={{ marginBottom: 16 }}>
            {switched}
          </p>
        )}

        <TabBar
          idPrefix="home"
          label={t('tabs.label')}
          current={tab}
          onChange={setTab}
          tabs={[
            { key: 'badges', label: t('tabs.homeBadges') },
            { key: 'sections', label: t('tabs.homeSections'), count: blocks?.length ?? null },
            { key: 'menu', label: t('tabs.homeMenu') },
            // What Settings held about the community's look, details and
            // address (Seb, 10 Nov 2026), in one tab since 21 Nov 2026.
            { key: 'identity', label: t('tabs.homeIdentity') },
          ]}
        />

        {/* Drawn from the start: the badges feed the phone preview on both tabs. */}
        <TabPanel idPrefix="home" tabKey="badges" current={tab} eager>
          <BadgesSection
            poiId={poiId}
            modules={modules}
            onPreview={(badges, drafts) => setPreviewBadges({ badges, drafts })}
          />
        </TabPanel>

        <TabPanel idPrefix="home" tabKey="sections" current={tab} eager>

          {error && <p className="error-text">{error}</p>}
          {blocks === null && !error && <p className="muted">{t('homePage.loading')}</p>}

          {blocks?.length === 0 && (
            <div className="card">
              <p className="muted">{t('homePage.empty')}</p>
              <div className="card-actions">
                <button type="button" className="btn btn-primary" onClick={startFromDefault}>
                  {t('homePage.useDefault')}
                </button>
              </div>
            </div>
          )}

          {blocks?.map((block, index) => {
            const requiredModule = BLOCK_MODULE[block.type];
            const moduleOff = requiredModule && !isModuleLive(requiredModule);
            const busy = busyId === block.id;
            const name = `${index + 1}. ${BLOCK_NAMES[block.type]}`;

            return (
              <div key={block.id} className="card form" {...drag.row(index)}>
                <div className="reorder-row" style={{ marginTop: 6, marginBottom: 4 }}>
                  <Grip {...drag.grip(index)} name={name} />
                  <p className="card-title grow" style={{ margin: 0 }}>
                    {name}
                  </p>
                  <MoreMenu
                    label={t('reorder.more', { name })}
                    items={[{ label: t('homePage.delete'), destructive: true, undoable: true, onSelect: () => remove(block.id) }]}
                  />
                </div>

                {moduleOff && <p className="error-text">{t('homePage.moduleOffNote')}</p>}

                {block.type === 'image' ? (
                  <>
                    {block.imageUrl && (
                      <img
                        src={`${API_BASE_URL}${block.imageUrl}`}
                        alt={block.title ?? ''}
                        style={{ width: '100%', maxWidth: 420, borderRadius: 12 }}
                      />
                    )}
                    <label>
                      {t('homePage.imageLabel')}
                      <input type="file" accept="image/*" onChange={(e) => pickImage(block, e)} disabled={busy} />
                    </label>
                    {busy && <p className="muted">{t('homePage.uploading')}</p>}
                    <label>
                      {t('homePage.captionLabel')}
                      <input
                        value={block.title ?? ''}
                        onChange={(e) => editLocally(block.id, { title: e.target.value })}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      {t('homePage.headingLabel')}
                      <input
                        value={block.title ?? ''}
                        onChange={(e) => editLocally(block.id, { title: e.target.value })}
                      />
                    </label>

                    {(block.type === 'text' || block.type === 'donate') && (
                      <label>
                        {t('homePage.textLabel')}
                        <textarea
                          rows={4}
                          value={block.body ?? ''}
                          onChange={(e) => editLocally(block.id, { body: e.target.value })}
                        />
                      </label>
                    )}

                    {COUNTED_BLOCKS.has(block.type) && (
                      <label>
                        {t('homePage.itemCountLabel')}
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={block.itemCount}
                          onChange={(e) =>
                            editLocally(block.id, { itemCount: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })
                          }
                        />
                      </label>
                    )}

                    {block.type === 'celebration_times' ? (
                      <p className="muted">{t('homePage.celebrationTimesNote')}</p>
                    ) : (
                      block.type !== 'text' &&
                      block.type !== 'donate' && <p className="muted">{t('homePage.autoNote')}</p>
                    )}
                  </>
                )}

              </div>
            );
          })}

          {blocks !== null && blocks.length > 0 && (
            <div className="card-actions" style={{ flexWrap: 'wrap' }}>
              <span className="muted">{t('homePage.addSection')}</span>
              {ADDABLE_BLOCKS.map((type) => (
                <button key={type} type="button" className="btn btn-small" onClick={() => add(type)}>
                  + {BLOCK_NAMES[type]}
                </button>
              ))}
            </div>
          )}

          {blocks !== null && blocks.length > 0 && (
            <div className="save-bar">
              <span className="muted">{justSaved && !blocks.some(isDirty) ? t('homePage.saved') : t('reorder.dragNote')}</span>
              <button type="button" className="btn btn-primary" onClick={saveAll} disabled={savingAll || !blocks.some(isDirty)}>
                {savingAll ? t('homePage.saving') : t('homePage.save')}
              </button>
            </div>
          )}
        </TabPanel>

        <TabPanel idPrefix="home" tabKey="menu" current={tab}>
          {poi && menuOrder && (
            <BottomMenuPanel poi={poi} modules={modules} order={menuOrder} onChange={setMenuOrder} onSaved={setPoi} />
          )}
          {(!poi || !menuOrder) && <p className="muted">{t('homePage.loading')}</p>}
        </TabPanel>

        {/* The colour, the name, description and logo, then the address. */}
        <TabPanel idPrefix="home" tabKey="identity" current={tab}>
          {poi && modulesLoaded && <PersonalisePanel poi={poi} modules={modules} onSaved={setPoi} preview={false} />}
          <div style={{ height: 24 }} />
          {poi && <CommunityInfoCard key={poi.id} poi={poi} onSaved={setPoi} />}
          <div style={{ height: 24 }} />
          {poi && <LocationCard key={poi.id} poi={poi} onSaved={setPoi} />}
        </TabPanel>
      </div>
      <PhonePreview
        // A new colour or logo is the app's own to draw: load it again.
        key={`${poi?.theme ?? ''}|${poi?.logoUrl ?? ''}`}
        poiId={poiId}
        badges={previewBadges?.badges ?? null}
        blocks={blocks}
        drafts={previewDrafts}
        menuOrder={menuOrder}
      />
    </div>
  );
}

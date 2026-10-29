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
import type { ActiveModule, ModuleType, PageBlockType, PoiPageBlock } from '../api/types';
import { DestructiveButton } from '../components/DestructiveButton';
import { BadgesSection } from './BadgesSection';
import { PhonePreview } from '../components/PhonePreview';
import type { PoiBadge } from '../api/types';
import { TabBar, TabPanel, useTab } from '../components/Tabs';

const HOME_TABS = ['badges', 'sections'] as const;

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

export function PoiHomePage() {
  const poiId = usePoiId();
  const { t } = useI18n();
  const [blocks, setBlocks] = useState<PoiPageBlock[] | null>(null);
  const [saved, setSaved] = useState<Record<string, PoiPageBlock>>({});
  // Retired blocks the page still holds: the server wants every block in
  // a reorder, so they ride along at the end.
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [modules, setModules] = useState<ActiveModule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);
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
    getActiveModules(poiId)
      .then(setModules)
      // The editor still works without this; it only drives the "module is
      // off" hint, so a failure here isn't worth an error banner.
      .catch(() => {});
  }, [poiId]);

  function isModuleLive(type: ModuleType) {
    return modules.some((m) => m.moduleType === type && LIVE_STATUSES.has(m.status));
  }

  function editLocally(id: string, patch: Partial<PoiPageBlock>) {
    setJustSavedId(null);
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

  async function save(block: PoiPageBlock) {
    setBusyId(block.id);
    setError(null);
    try {
      const updated = await updatePageBlock(poiId, block.id, {
        title: block.title ?? '',
        body: block.body ?? '',
        imageUrl: block.imageUrl ?? '',
        itemCount: block.itemCount,
      });
      setBlocks((current) => current?.map((b) => (b.id === updated.id ? updated : b)) ?? null);
      setSaved((current) => ({ ...current, [updated.id]: updated }));
      setJustSavedId(updated.id);
    } catch {
      setError(t('homePage.saveError'));
    } finally {
      setBusyId(null);
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
      const poi = await getPoi(poiId);
      await createPageBlock(poiId, { type: 'text', body: poi.description ?? '' });
      adopt(await getPageBlocks(poiId));
    } catch {
      setError(t('homePage.saveError'));
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await deletePageBlock(poiId, id);
      adopt(await getPageBlocks(poiId));
    } catch {
      setError(t('homePage.saveError'));
    }
  }

  async function move(index: number, delta: number) {
    if (!blocks) return;
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
    setError(null);
    try {
      adopt(await reorderPageBlocks(poiId, [...next.map((b) => b.id), ...hiddenIds]));
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
        <p className="muted">{t('homePage.subtitle')}</p>

        <TabBar
          idPrefix="home"
          label={t('tabs.label')}
          current={tab}
          onChange={setTab}
          tabs={[
            { key: 'badges', label: t('tabs.homeBadges') },
            { key: 'sections', label: t('tabs.homeSections'), count: blocks?.length ?? null },
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

            return (
              <div key={block.id} className="card form">
                <div className="card-actions" style={{ justifyContent: 'space-between', marginTop: 10, marginBottom: 4 }}>
                  <p className="card-title" style={{ margin: 0 }}>
                    {index + 1}. {BLOCK_NAMES[block.type]}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-icon"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={t('homePage.moveUp')}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon"
                      onClick={() => move(index, 1)}
                      disabled={index === blocks.length - 1}
                      aria-label={t('homePage.moveDown')}
                    >
                      ↓
                    </button>
                    <DestructiveButton label={t('homePage.delete')} onConfirm={() => remove(block.id)} />
                  </div>
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

                <div className="card-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => save(block)}
                    disabled={busy || !isDirty(block)}
                  >
                    {busy ? t('homePage.saving') : t('homePage.save')}
                  </button>
                  {justSavedId === block.id && !isDirty(block) && (
                    <span className="muted">{t('homePage.saved')}</span>
                  )}
                </div>
              </div>
            );
          })}

          {blocks !== null && (
            <div className="card">
              <p className="card-title">{t('homePage.addSection')}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                {ADDABLE_BLOCKS.map((type) => (
                  <button key={type} type="button" className="btn btn-primary" onClick={() => add(type)}>
                    + {BLOCK_NAMES[type]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </TabPanel>
      </div>
      <PhonePreview
        poiId={poiId}
        badges={previewBadges?.badges ?? null}
        blocks={blocks}
        drafts={previewDrafts}
      />
    </div>
  );
}

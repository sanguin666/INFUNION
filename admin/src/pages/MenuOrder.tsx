import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { updatePoiMenuOrder } from '../api/poiSettings';
import type { ActiveModule, ModuleType, Poi } from '../api/types';

// Kept in step with the app's PoiShell: Home takes the first of five
// buttons and More always takes the last, so three are left for modules.
const BAR_SLOTS = 3;

// The app's fallback order for modules a place never arranged, so the
// preview here matches what the app would draw for the untouched part
// of the list.
const DEFAULT_MENU_ORDER: ModuleType[] = [
  'events',
  'announcements',
  'donations',
  'requests',
  'messages',
  'mass_intentions',
  'daily_readings',
  'prayer_requests',
  'community',
  'livestreams',
];

const LIVE_STATUSES = new Set(['trial', 'active']);

/**
 * The modules a place runs, in the order its bottom menu shows them: its
 * saved order, then any live module it never placed, dropping anything no
 * longer live.
 */
export function initialMenuOrder(poi: Poi, modules: ActiveModule[]): ModuleType[] {
  const live = new Set(modules.filter((m) => LIVE_STATUSES.has(m.status)).map((m) => m.moduleType));
  const chosen = (poi.menuOrder ?? []).filter((type) => live.has(type));
  const rest = DEFAULT_MENU_ORDER.filter((type) => live.has(type) && !chosen.includes(type));
  return [...chosen, ...rest];
}

export type MenuPlacement = 'bar' | 'more' | 'events';

/**
 * Where each module lands in the app, by the app's own rules (hubMenu in
 * PoiShell): the first three get a button, the rest go under More. The
 * livestream never takes a button when it sits below the bar and Events
 * is on: the app shows it from the top of the Events screen instead, and
 * it gives up its place in the count.
 */
export function menuLayout(order: ModuleType[]): { bar: ModuleType[]; placement: (type: ModuleType) => MenuPlacement } {
  const livestreamInEvents =
    order.includes('livestreams') &&
    order.includes('events') &&
    order.indexOf('livestreams') >= Math.min(order.length, BAR_SLOTS);
  const placed = livestreamInEvents ? order.filter((type) => type !== 'livestreams') : order;
  const bar = placed.slice(0, BAR_SLOTS);
  return {
    bar,
    placement: (type) =>
      type === 'livestreams' && livestreamInEvents ? 'events' : bar.includes(type) ? 'bar' : 'more',
  };
}

/**
 * The bottom menu's modules as a numbered list with up and down arrows,
 * in two groups: the ones that get a button of their own in the app, then
 * the ones under More. The livestream says when the app shows it inside
 * Events instead.
 */
export function MenuOrderRows({
  order,
  onMove,
}: {
  order: ModuleType[];
  onMove: (index: number, delta: number) => void;
}) {
  const { t } = useI18n();
  const { bar, placement } = menuLayout(order);

  if (order.length === 0) {
    return (
      <p className="muted" style={{ marginTop: 12 }}>
        {t('menuOrder.empty')}
      </p>
    );
  }

  function row(type: ModuleType, index: number) {
    return (
      <li key={type} className="card-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'right' }}>{index + 1}</span>
          <div>
            <p className="card-title" style={{ margin: 0 }}>
              {moduleName(type, t)}
            </p>
            {placement(type) === 'events' && <span className="muted">{t('menuOrder.insideEvents')}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-icon"
            aria-label={t('menuOrder.moveUp')}
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="btn btn-icon"
            aria-label={t('menuOrder.moveDown')}
            disabled={index === order.length - 1}
            onClick={() => onMove(index, 1)}
          >
            ↓
          </button>
        </div>
      </li>
    );
  }

  // The bar always takes the head of the list (menuLayout), so the
  // groups are a plain split of it.
  const below = order.slice(bar.length);
  return (
    <>
      <p className="list-heading">{t('menuOrder.onBar')}</p>
      <ol className="card-rows list-group">{bar.map((type, index) => row(type, index))}</ol>
      {below.length > 0 && (
        <>
          <p className="list-heading">{t('menuOrder.underMore')}</p>
          <ol className="card-rows list-group">{below.map((type, index) => row(type, bar.length + index))}</ol>
        </>
      )}
    </>
  );
}

/**
 * Home page > Bottom menu (Seb, 3 Nov 2026): the order of the buttons at
 * the bottom of the community's app, beside the live phone, which shows
 * the order as it stands here before it is saved.
 */
export function BottomMenuPanel({
  poi,
  modules,
  order,
  onChange,
  onSaved,
}: {
  poi: Poi;
  modules: ActiveModule[];
  order: ModuleType[];
  onChange: (order: ModuleType[]) => void;
  onSaved: (poi: Poi) => void;
}) {
  const { t } = useI18n();
  const savedOrder = initialMenuOrder(poi, modules);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = order.join(',') !== savedOrder.join(',');

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setSaved(false);
    onChange(next);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      onSaved(await updatePoiMenuOrder(poi.id, order));
      setSaved(true);
    } catch {
      setError(t('menuOrder.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="card">
        <p className="card-title">{t('menuOrder.title')}</p>
        <p className="muted" style={{ marginTop: 4 }}>
          {t('menuOrder.subtitle')}
        </p>
        <MenuOrderRows order={order} onMove={move} />
      </div>
      <div className="card-actions">
        <button type="button" className="btn btn-primary" disabled={saving || !dirty} onClick={save}>
          {saving ? t('menuOrder.saving') : t('menuOrder.save')}
        </button>
        {saved && !dirty && <span className="muted">{t('menuOrder.saved')}</span>}
      </div>
      {error && <p className="error-text">{error}</p>}
    </>
  );
}

export function moduleName(type: ModuleType, t: ReturnType<typeof useI18n>['t']): string {
  switch (type) {
    case 'donations':
      return t('moduleNames.donations');
    case 'events':
      return t('moduleNames.events');
    case 'announcements':
      return t('moduleNames.announcements');
    case 'prayer_requests':
      return t('moduleNames.prayerRequests');
    case 'livestreams':
      return t('moduleNames.livestream');
    case 'community':
      return t('moduleNames.community');
    case 'requests':
      return t('moduleNames.requests');
    case 'mass_intentions':
      return t('moduleNames.massIntentions');
    case 'daily_readings':
      return t('moduleNames.readings');
    case 'messages':
      return t('moduleNames.messages');
  }
}

import { useEffect, useMemo, useState } from 'react';
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

type Props = {
  poi: Poi;
  modules: ActiveModule[];
  onSaved: (poi: Poi) => void;
};

/**
 * Lets a community arrange its own bottom menu: the modules it drags to the
 * top get a button of their own in the app, the rest fall under More.
 * The preview mirrors the app's own placement rules so an admin sees
 * exactly where each module will land before saving.
 */
export function MenuOrderCard({ poi, modules, onSaved }: Props) {
  const { t } = useI18n();

  const live = useMemo(
    () =>
      new Set(
        modules.filter((m) => LIVE_STATUSES.has(m.status)).map((m) => m.moduleType),
      ),
    [modules],
  );

  // The place's saved order, then any live module it never placed, then
  // drop anything no longer live. Recomputed when the place saves or a
  // module is switched on or off elsewhere on the page.
  const initial = useMemo(() => {
    const chosen = (poi.menuOrder ?? []).filter((type) => live.has(type));
    const rest = DEFAULT_MENU_ORDER.filter((type) => live.has(type) && !chosen.includes(type));
    return [...chosen, ...rest];
  }, [poi.menuOrder, live]);

  const [order, setOrder] = useState<ModuleType[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setOrder(initial);
    setSaved(false);
  }, [initial]);

  function move(index: number, delta: number) {
    setSaved(false);
    setOrder((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updatePoiMenuOrder(poi.id, order);
      onSaved(updated);
      setSaved(true);
    } catch {
      setError(t('menuOrder.saveError'));
    } finally {
      setSaving(false);
    }
  }

  // The livestream never takes a menu button when it sits below the bar
  // and Events is on: the app shows it from the top of the Events screen
  // instead, and it gives up its place in the count. Same rule as the
  // app's hubMenu.
  const livestreamInEvents =
    order.includes('livestreams') &&
    order.includes('events') &&
    order.indexOf('livestreams') >= Math.min(order.length, BAR_SLOTS);
  const placed = livestreamInEvents ? order.filter((type) => type !== 'livestreams') : order;
  const barCount = Math.min(placed.length, BAR_SLOTS);

  function placement(type: ModuleType): string {
    if (type === 'livestreams' && livestreamInEvents) return t('menuOrder.insideEvents');
    if (placed.indexOf(type) < barCount) return t('menuOrder.onBar');
    return t('menuOrder.underMore');
  }

  function isOnBar(type: ModuleType): boolean {
    return !(type === 'livestreams' && livestreamInEvents) && placed.indexOf(type) < barCount;
  }

  const dirty = order.join(',') !== initial.join(',');

  return (
    <div className="card">
      <p className="card-title">{t('menuOrder.title')}</p>
      <p className="muted" style={{ marginTop: 4 }}>
        {t('menuOrder.subtitle')}
      </p>

      {order.length === 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {t('menuOrder.empty')}
        </p>
      ) : (
        <ol className="card-rows">
          {order.map((type, index) => (
            <li key={type} className="card-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'right' }}>{index + 1}</span>
                <div>
                  <p className="card-title" style={{ margin: 0 }}>
                    {moduleName(type, t)}
                  </p>
                  <span className={`badge ${isOnBar(type) ? 'badge-active' : ''}`}>
                    {placement(type)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={t('menuOrder.moveUp')}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={t('menuOrder.moveDown')}
                  disabled={index === order.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {order.length > 0 && (
        <div className="card-actions">
          <button type="button" className="btn btn-primary" disabled={saving || !dirty} onClick={save}>
            {saving ? t('menuOrder.saving') : t('menuOrder.save')}
          </button>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      {saved && !error && <p className="muted">{t('menuOrder.saved')}</p>}
    </div>
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

import { useI18n } from '../i18n/I18nContext';
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
 * each saying where it will land in the app.
 */
export function MenuOrderRows({
  order,
  onMove,
}: {
  order: ModuleType[];
  onMove: (index: number, delta: number) => void;
}) {
  const { t } = useI18n();
  const { placement } = menuLayout(order);
  const label: Record<MenuPlacement, string> = {
    bar: t('menuOrder.onBar'),
    more: t('menuOrder.underMore'),
    events: t('menuOrder.insideEvents'),
  };

  if (order.length === 0) {
    return (
      <p className="muted" style={{ marginTop: 12 }}>
        {t('menuOrder.empty')}
      </p>
    );
  }

  return (
    <ol className="card-rows">
      {order.map((type, index) => (
        <li key={type} className="card-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'right' }}>{index + 1}</span>
            <div>
              <p className="card-title" style={{ margin: 0 }}>
                {moduleName(type, t)}
              </p>
              <span className={`badge ${placement(type) === 'bar' ? 'badge-active' : ''}`}>
                {label[placement(type)]}
              </span>
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
      ))}
    </ol>
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

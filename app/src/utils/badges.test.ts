import { describe, expect, it } from 'vitest';
import type { Event, PoiBadge } from '../api/types';
import type { Campaign } from '../api/donations';
import { badgeTiles, type BadgeContext } from './badges';

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

// 7 September 2026 is a Monday.
const MONDAY_9AM = at(2026, 9, 7, 9);

const words: Record<string, string> = {
  'badges.today': 'Today',
  'badges.tomorrow': 'Tomorrow',
  'badges.mass': 'Mass',
  'badges.confession': 'Confessions',
  'badges.officeOpen': 'Open now',
  'badges.officeClosed': 'Office closed',
  'badges.until': 'until {{time}}',
  'badges.opens': 'opens {{when}}',
  'badges.raised': '{{percent}}% raised',
  'badges.give': 'Give',
};
const t = ((key: string, params?: Record<string, string | number>) =>
  Object.entries(params ?? {}).reduce(
    (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
    words[key] ?? key,
  )) as BadgeContext['t'];

function badge(kind: PoiBadge['kind'], overrides: Partial<PoiBadge> = {}): PoiBadge {
  return {
    id: kind,
    kind,
    position: 0,
    enabled: true,
    text: null,
    important: false,
    linkModule: null,
    campaignId: null,
    showUntil: null,
    ...overrides,
  };
}

function weekly(category: Event['category'], start: Date, end: Date | null = null): Event {
  return {
    id: `${category}-${start.toISOString()}`,
    title: category,
    startsAt: start.toISOString(),
    endsAt: end ? end.toISOString() : null,
    location: null,
    description: null,
    category,
    recurrence: 'weekly',
    repeatUntil: null,
  };
}

function campaign(overrides: Partial<Campaign>): Campaign {
  return {
    id: 'roof',
    title: 'New roof',
    description: null,
    goalAmount: 20000,
    endsAt: null,
    active: true,
    raised: 5400,
    giftCount: 12,
    ...overrides,
  } as Campaign;
}

function context(overrides: Partial<BadgeContext> = {}): BadgeContext {
  return {
    events: [
      weekly('mass', at(2026, 1, 4, 10)), // Sundays 10:00
      weekly('mass', at(2026, 1, 5, 18, 30)), // Mondays 18:30
      weekly('confession', at(2026, 1, 3, 17)), // Saturdays 17:00
      weekly('office_hours', at(2026, 1, 5, 8, 30), at(2026, 1, 5, 12)), // Mondays 08:30–12:00
      weekly('office_hours', at(2026, 1, 7, 10), at(2026, 1, 7, 12)), // Wednesdays 10:00–12:00
    ],
    campaigns: [campaign({})],
    isLive: () => true,
    now: MONDAY_9AM,
    language: 'en',
    t,
    ...overrides,
  };
}

describe('badgeTiles', () => {
  it('says when the next Mass and confessions are', () => {
    const tiles = badgeTiles([badge('next_mass'), badge('next_confession')], context());
    expect(tiles.map((tile) => [tile.label, tile.value, tile.opens])).toEqual([
      ['Mass', 'Today 18:30', 'events'],
      ['Confessions', 'Sat 17:00', 'events'],
    ]);
  });

  it('says the office is open until it closes, or when it opens next', () => {
    const open = badgeTiles([badge('office_hours')], context())[0];
    expect([open.label, open.value, open.icon]).toEqual(['Open now', 'until 12:00', 'open']);

    const afterwards = badgeTiles([badge('office_hours')], context({ now: at(2026, 9, 7, 13) }))[0];
    expect([afterwards.label, afterwards.value, afterwards.icon]).toEqual([
      'Office closed',
      'opens Wed 10:00',
      'closed',
    ]);

    // Mid-sentence, the day keeps the language's own case.
    const inFrench = badgeTiles([badge('office_hours')], context({ now: at(2026, 9, 7, 13), language: 'fr' }))[0];
    expect(inFrench.value).toMatch(/^opens mer\.? 10:00$/);
    const [mass] = badgeTiles([badge('next_mass')], context({ now: at(2026, 9, 8, 9), language: 'fr' }));
    expect(mass.value).toMatch(/^Dim\.? 10:00$/);
  });

  it('shows how much of a campaign is raised, the chosen one or the newest', () => {
    const campaigns = [campaign({}), campaign({ id: 'organ', title: 'Organ', goalAmount: null })];
    const [newest] = badgeTiles([badge('campaign')], context({ campaigns }));
    expect([newest.label, newest.value, newest.opens]).toEqual(['New roof', '27% raised', 'donations']);
    const [chosen] = badgeTiles([badge('campaign', { campaignId: 'organ' })], context({ campaigns }));
    expect([chosen.label, chosen.value]).toEqual(['Organ', 'Give']);
  });

  it('draws a message across the row, and opens its module only while it is on', () => {
    const closed = badge('message', { text: 'Church closed Monday', important: true, linkModule: 'announcements' });
    const [tile] = badgeTiles([closed], context());
    expect(tile).toMatchObject({ wide: true, important: true, label: null, value: 'Church closed Monday', opens: 'announcements' });
    const [off] = badgeTiles([closed], context({ isLive: (m) => m !== 'announcements' }));
    expect(off.opens).toBeNull();
  });

  it('drops a message after its last day', () => {
    const lastDay = badge('message', { text: 'Closed today', showUntil: '2026-09-07' });
    expect(badgeTiles([lastDay], context())).toHaveLength(1);
    expect(badgeTiles([lastDay], context({ now: at(2026, 9, 8, 0, 5) }))).toHaveLength(0);
  });

  it('leaves out what has nothing to say, and keeps all the rest', () => {
    const none = badgeTiles(
      [badge('next_mass'), badge('office_hours'), badge('campaign')],
      context({ isLive: (m) => m !== 'events', campaigns: [] }),
    );
    expect(none).toEqual([]);

    const many = badgeTiles(
      [
        badge('message', { id: 'a', text: 'A' }),
        badge('next_mass'),
        badge('office_hours'),
        badge('next_confession'),
        badge('campaign'),
      ],
      context(),
    );
    expect(many.map((tile) => tile.id)).toEqual(['a', 'next_mass', 'office_hours', 'next_confession', 'campaign']);
  });
});

export type PoiType = 'church' | 'mosque' | 'synagogue' | 'other_worship' | 'association' | 'culture';

export type Poi = {
  id: string;
  name: string;
  type: PoiType;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  // The pin on the map of communities; null until the office places it.
  latitude?: number | null;
  longitude?: number | null;
  qrCodeToken: string;
  // A few lines about the place, written in the admin; the home page
  // shows it when the place hasn't built a page yet.
  description?: string | null;
  // The order this place wants its modules in the bottom menu, set in the
  // admin dashboard. Modules it leaves out fall in behind the ones it
  // listed, in the app's own default order.
  menuOrder: ModuleType[];
  createdAt: string;
  updatedAt: string;
};

export type ModuleType =
  | 'donations'
  | 'events'
  | 'announcements'
  | 'prayer_requests'
  | 'livestreams'
  | 'community'
  | 'requests'
  | 'mass_intentions'
  | 'daily_readings';

export type ActiveModule = {
  id: string;
  moduleType: ModuleType;
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  startDate: string;
  expirationDate: string | null;
};

// The small tiles at the very top of a place's home page, in the order
// its staff chose. A message carries its own words; the other kinds are
// worked out on the phone from the timetable and the giving.
export type BadgeKind = 'message' | 'next_mass' | 'office_hours' | 'next_confession' | 'campaign';

export type PoiBadge = {
  id: string;
  kind: BadgeKind;
  position: number;
  enabled: boolean;
  text: string | null;
  important: boolean;
  linkModule: ModuleType | null;
  campaignId: string | null;
  // The last day a message shows, as YYYY-MM-DD.
  showUntil: string | null;
};

// The sections a POI stacks on its home page, in the order it chose. The
// written ones (text, image) carry their own content; the rest pull live
// content from a module and render nothing when it isn't active.
export type PageBlockType =
  | 'text'
  | 'image'
  | 'celebration_times'
  | 'next_events'
  | 'past_events'
  | 'latest_announcements'
  | 'next_livestream'
  | 'donate';

export type PoiPageBlock = {
  id: string;
  type: PageBlockType;
  position: number;
  title: string | null;
  body: string | null;
  // Relative path (e.g. /uploads/poi-pages/<file>.jpg) — prefix with
  // API_BASE_URL (see api/client.ts) to get a loadable URL.
  imageUrl: string | null;
  // How many entries a live block shows.
  itemCount: number;
};

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  // Relative path (e.g. /uploads/announcements/<file>.m4a) — prefix with
  // API_BASE_URL (see api/client.ts) to get a playable URL.
  audioUrl: string | null;
  // The post's photo: a relative /uploads/... path or a full URL — go
  // through uploadUri (api/client.ts).
  imageUrl: string | null;
  important: boolean;
  createdAt: string;
};

// What kind of celebration or opening an event is. Masses, confessions
// and the like make up a place's weekly timetable; `other` is everything
// else (a concert, a fête).
export type EventCategory =
  | 'mass'
  | 'confession'
  | 'adoration'
  | 'prayer'
  | 'office_hours'
  | 'other';

export type Event = {
  id: string;
  title: string;
  // For a repeating event, the first day it can happen and the time it
  // starts at every time (see utils/schedule.ts).
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  description: string | null;
  category: EventCategory;
  recurrence: 'none' | 'weekly' | 'monthly';
  // The last day a repeating event still happens, or null for no end.
  repeatUntil: string | null;
  // Weekly: the weekdays it happens on (0 is Sunday); empty means the
  // weekday of `startsAt`.
  repeatDays?: number[];
  // Monthly: the nth (1–4, or -1 for the last) given weekday of the
  // month, or else a day of the month.
  monthlyWeek?: number | null;
  monthlyWeekday?: number | null;
  monthlyDay?: number | null;
  // Days a repeating event doesn't happen on, as YYYY-MM-DD.
  exceptions?: EventException[];
};

export type EventException = { date: string; reason?: string | null };

export type PrayerRequest = {
  id: string;
  authorName: string | null;
  message: string;
  prayerCount: number;
  createdAt: string;
};

export type LivestreamStatus = 'upcoming' | 'live' | 'ended';

export type Livestream = {
  id: string;
  title: string;
  url: string;
  scheduledAt: string;
  status: LivestreamStatus;
};

export type CommunityPost = {
  id: string;
  authorName: string | null;
  message: string;
  createdAt: string;
  commentCount: number;
};

export type CommunityComment = {
  id: string;
  authorName: string | null;
  message: string;
  createdAt: string;
};

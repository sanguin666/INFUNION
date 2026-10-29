export type PoiType = 'church' | 'mosque' | 'synagogue' | 'other_worship' | 'association' | 'culture';

export type SupportedLanguage = 'en' | 'es' | 'va' | 'gl' | 'pt' | 'fr';

export type Poi = {
  id: string;
  name: string;
  type: PoiType;
  language: SupportedLanguage;
  description: string | null;
  pictureUrl: string | null;
  qrFlyerHeadline: string | null;
  qrFlyerSubtext: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  // The pin on the map of communities; null until the office places it.
  latitude: number | null;
  longitude: number | null;
  // Whether the place shows on the map and in "near you".
  mapVisible: boolean;
  qrCodeToken: string;
  // The order this community wants its modules in the app's bottom menu.
  // The app gives the first few a button and puts the rest under More;
  // modules left out fall in behind in the app's default order.
  menuOrder: ModuleType[];
  // What a Mass intention costs here, or null to let people choose.
  massIntentionOffering: number | null;
  // Who issues the tax receipts: the legal body behind the community,
  // which is rarely the name people know the place by.
  legalName: string | null;
  legalTaxId: string | null;
  legalAddress: string | null;
  receiptSignatory: string | null;
  // What a gift here is worth on the giver's tax return; see the backend's
  // TaxScheme. Decides the receipts' wording and the modelo 182.
  taxScheme: TaxScheme;
  legalPhone: string | null;
  // Its look in the app: a logo that replaces infunion's in the header
  // inside the place (a path on the API), and an accent theme.
  logoUrl: string | null;
  theme: PoiThemeName;
};

export type PoiThemeName = 'purple' | 'ocean' | 'forest' | 'terracotta' | 'ruby' | 'teal' | 'graphite';

export type TaxScheme = 'none' | 'es_ley49' | 'es_art68';

// The sections a POI stacks on its home page in the app, in the order it
// chose. `text` and `image` carry their own content; the rest pull live
// content from a module and render nothing when it isn't active.
export type PageBlockType =
  | 'text'
  | 'image'
  | 'next_events'
  | 'past_events'
  | 'latest_announcements'
  | 'next_livestream'
  | 'donate'
  // The place's regular week, built from its weekly events.
  | 'celebration_times';

export type PoiPageBlock = {
  id: string;
  type: PageBlockType;
  position: number;
  title: string | null;
  body: string | null;
  // Relative path (e.g. /uploads/poi-pages/<file>.jpg) — prefix with the
  // API base URL to display it.
  imageUrl: string | null;
  itemCount: number;
};

// The small tiles at the very top of a place's home page in the app.
// `message` is written by the staff; the other four fill themselves and
// always exist, only switched on or off.
export type BadgeKind = 'message' | 'next_mass' | 'office_hours' | 'next_confession' | 'campaign';

export type PoiBadge = {
  id: string;
  kind: BadgeKind;
  position: number;
  enabled: boolean;
  text: string | null;
  // Drawn in orange rather than white.
  important: boolean;
  // The module a tap opens, or null for a badge that only informs.
  linkModule: ModuleType | null;
  // For `campaign`: the one to show, or null for the most recent.
  campaignId: string | null;
  // YYYY-MM-DD, the last day it shows; null for no end.
  showUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CurrentUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  language: SupportedLanguage;
  // infunion's own account: shows the Superadmin section.
  isSuperadmin?: boolean;
  adminPois: Poi[];
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
  | 'daily_readings'
  | 'messages';

export type ModuleStatus = 'trial' | 'active' | 'expired' | 'cancelled';

export type ActiveModule = {
  id: string;
  moduleType: ModuleType;
  status: ModuleStatus;
  startDate: string;
  expirationDate: string | null;
  // Module billing (30 Sep 2026): the free month, what is paid for, and a
  // stop that takes effect when the paid period ends.
  trialEndsAt: string | null;
  paidUntil: string | null;
  cancelAtPeriodEnd: boolean;
  // Given by infunion (superadmin): on and never billed.
  offered: boolean;
};

export type BillingInterval = 'monthly' | 'yearly';

export type BillingInvoice = {
  id: string;
  issuedAt: string;
  amount: number;
  lines: { moduleType: ModuleType; amount: number; periodStart: string; periodEnd: string }[];
};

export type BillingSummary = {
  interval: BillingInterval;
  // "Offert": every module on at no charge.
  comped: boolean;
  paymentMethod: string | null;
  renewsAt: string | null;
  prices: Record<BillingInterval, number>;
  freeModules: ModuleType[];
  // The modules this kind of place can have; older APIs leave it out.
  availableModules?: ModuleType[];
  modules: ActiveModule[];
  invoices: BillingInvoice[];
};

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  audioUrl: string | null;
  // A relative /uploads/... path or a full URL.
  imageUrl: string | null;
  important: boolean;
  createdAt: string;
};

export type EventCategory = 'mass' | 'confession' | 'adoration' | 'prayer' | 'office_hours' | 'other';

// A repeating event's `startsAt` is the first day it can happen and its
// time every time. Weekly: on `repeatDays` (or the weekday of `startsAt`).
// Monthly: the nth weekday of the month, or a day of the month.
export type EventRecurrence = 'none' | 'weekly' | 'monthly';

// A day a repeating event doesn't happen, as YYYY-MM-DD.
export type EventException = { date: string; reason?: string | null };

export type Event = {
  id: string;
  title: string;
  startsAt: string;
  // For a weekly event, the end of its first occurrence.
  endsAt: string | null;
  location: string | null;
  description: string | null;
  category: EventCategory;
  recurrence: EventRecurrence;
  // The last day a repeating event still happens, or null for "until changed".
  repeatUntil: string | null;
  repeatDays?: number[];
  // 1–4, or -1 for the last one.
  monthlyWeek?: number | null;
  monthlyWeekday?: number | null;
  monthlyDay?: number | null;
  exceptions?: EventException[];
};

export type LivestreamStatus = 'upcoming' | 'live' | 'ended';

export type Livestream = {
  id: string;
  title: string;
  url: string;
  scheduledAt: string;
  status: LivestreamStatus;
};

export type PrayerRequest = {
  id: string;
  authorName: string | null;
  message: string;
  prayerCount: number;
  createdAt: string;
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

export type DonationPurpose = 'general' | 'collection' | 'campaign' | 'mass_intention';

export type Donation = {
  id: string;
  amount: number;
  donorName: string | null;
  purpose: DonationPurpose;
  campaign: { id: string; title: string } | null;
  // A monthly gift: the first payment and every later month alike.
  recurring: boolean;
  createdAt: string;
};

// A project the community raises money for, with what it has raised.
export type Campaign = {
  id: string;
  title: string;
  description: string | null;
  goalAmount: number | null;
  endsAt: string | null;
  // Off: hidden from the app, still listed here with its gifts.
  active: boolean;
  raised: number;
  giftCount: number;
  // The picture on the project's page in the app, a path on the API.
  imageUrl: string | null;
  // Where the money goes, shares adding up to 100; null when not said.
  allocation: CampaignAllocationLine[] | null;
};

export type CampaignAllocationLine = { label: string; percent: number };

export type ReceiptDonor = {
  key: string;
  name: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  taxId: string | null;
  total: number;
  count: number;
  firstGiftAt: string;
  lastGiftAt: string;
  // Signed and relative (/receipts/...): prefix with the API base URL.
  // Opens the receipt for the next hour.
  url: string;
};

export type ReceiptList = {
  year: number;
  // The year's givers as a CSV, signed like the receipts.
  exportUrl: string;
  // Every gift of the year as a CSV, and the modelo 182 file.
  giftsUrl: string;
  modelo182Url: string;
  donors: ReceiptDonor[];
};

export type Modelo182Check = {
  included: number;
  total: number;
  skipped: { name: string; reason: 'no_tax_id' | 'bad_tax_id' | 'no_province' }[];
};

export type PeriodTotal = {
  total: number;
  count: number;
};

export type DailyTotal = {
  date: string;
  total: number;
  count: number;
};

export type DonationStats = {
  dailyTotals: DailyTotal[];
  thisWeek: PeriodTotal;
  lastWeek: PeriodTotal;
  thisMonth: PeriodTotal;
  lastMonth: PeriodTotal;
};

export type ServiceRequestType =
  | 'baptism'
  | 'wedding'
  | 'funeral'
  | 'first_communion'
  | 'confirmation'
  | 'certificate'
  | 'meeting'
  | 'blessing'
  | 'sick_visit'
  | 'registration'
  | 'other';

export type ServiceRequestStatus = 'received' | 'in_progress' | 'appointment_set' | 'completed' | 'cancelled';

// A private file: `url` is signed, relative (/private-files/...) and
// opens for the next hour, so prefix it with the API base URL.
export type RequestFile = {
  name: string;
  mime: string | null;
  url: string;
};

export type RequestMessage = {
  id: string;
  fromStaff: boolean;
  authorName: string | null;
  body: string | null;
  attachment: RequestFile | null;
  createdAt: string;
};

export type RequestDocument = {
  id: string;
  label: string;
  note: string | null;
  // Set when the member sent the file, or when staff ticked it off.
  receivedAt: string | null;
  file: RequestFile | null;
  createdAt: string;
};

export type ServiceRequestSummary = {
  id: string;
  type: ServiceRequestType;
  status: ServiceRequestStatus;
  contactName: string;
  contactPhone: string | null;
  details: string;
  // The family's wish, in their own words — not an appointment.
  preferredDate: string | null;
  appointmentAt: string | null;
  appointmentPlace: string | null;
  // Papers asked for and not yet in.
  documentsPending: number;
  // The member did something since the office last opened it.
  unread: boolean;
  createdAt: string;
  updatedAt: string;
  requester?: { id: string; firstName: string | null; lastName: string | null; phone: string | null };
};

export type ServiceRequestDetail = ServiceRequestSummary & {
  messages: RequestMessage[];
  documents: RequestDocument[];
};

export type MassIntentionStatus = 'pending_payment' | 'confirmed' | 'celebrated' | 'cancelled';

export type MassIntention = {
  id: string;
  intention: string;
  requesterName: string;
  requesterContact: string | null;
  // null: whenever the community can.
  celebrationAt: string | null;
  celebrationTitle: string | null;
  offeringAmount: number | null;
  status: MassIntentionStatus;
  // Written in at the office rather than asked for from the app.
  fromOffice: boolean;
  createdAt: string;
};

export type DashboardRequest = { id: string; type: ServiceRequestType; contactName: string; at: string };

export type DashboardSummary = {
  newRequests: DashboardRequest[];
  awaitingReply: DashboardRequest[];
  documentsToCheck: { requestId: string; type: ServiceRequestType; contactName: string; label: string; receivedAt: string }[];
  appointments: (DashboardRequest & { place: string | null })[];
  // Intentions counted by the Mass they are read at.
  intentionsToMark: { at: string | null; title: string | null; count: number }[];
  upcomingIntentions: { at: string | null; title: string | null; count: number }[];
  expiredMessages: { id: string; text: string; showUntil: string }[];
  members: { total: number; newThisWeek: number };
  prayerRequestsThisWeek: number;
};

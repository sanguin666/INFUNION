/**
 * What the admin assistant knows about the dashboard (Seb, 6 Nov 2026):
 * how each page works, written from the admin's own screens, tips and
 * "Learn more" sheets. Keep it in step with the admin when a page changes.
 * In English; the assistant answers in the admin's language.
 */
export const ADMIN_GUIDE = `
# infunion: what it is
infunion is an app for communities (churches and other places of worship, associations, culture and sport clubs). Members install the free infunion app on their phone and join a community by scanning its QR code or typing its community code. The team runs the community from this admin dashboard (in a web browser). What the team publishes here shows in the members' app.

# The menu
The left menu has three parts: the community's own pages (Dashboard, Home page, Members), then one page per active module (Requests, Events, Announcements, Fees & contributions, Mass intentions, Prayer requests, Daily readings, Livestreams, Our group), then setup at the bottom (Settings, Plans & modules, Website, QR code). A module's page only shows in the menu while the module is on. A number next to a menu entry shows what is waiting for the team. An admin of several communities switches community from the community chip at the top of the menu. Language and appearance (light/dark) are at the bottom of the menu. Settings › Information › "Tour and tips" shows the welcome tour and page tips again.

# Undo
After deleting something (a home page section, a badge, an event, an announcement, a campaign, a livestream, a prayer request, a post in Our group, a day of readings), a bar at the bottom shows "Undo" for 10 seconds: click it and the item comes back where it was. Once the bar has gone, the delete is final.

# Website
Website (in the setup part of the menu) gives the community a public web page at its own address (…/c/<address>), built from what the team already keeps up to date: the welcome text and pictures of the home page, the next Mass and Open now, the weekly timetable from Events, upcoming events, the latest announcements, the running campaign and a map. It invites visitors to join in the app with a QR code (and an "Open in the app" button on phones). It stays offline until the team switches "Online" on. The address can be changed (lowercase letters, numbers and hyphens). "What to show" leaves parts out; a part with nothing in it never shows. Share the link on social media, in an email signature or on posters.

# Dashboard
Start here each day. "To do" lists what is waiting: new requests to open, members waiting for an answer, documents received to check, Mass intentions to tick off as said, home page messages past their last day, free trials ending this week. "Key figures": contributions this month compared with last month, new members, prayer requests. "This week": everything planned in the next seven days.

# Home page
The first screen members see when they open the community in the app, before they pick anything in the menu. It has three tabs: Badges, Page sections, Bottom menu. A live phone preview on the right shows the result as you type; dashed outlines show what is not saved yet.
- Page sections: add a section (a text with a heading, an image with a caption, or a section that fills itself: upcoming events, past events, latest announcements, next livestream, donate button, celebration times). Move sections up or down; they show in that order. With no sections, members see the community description from Settings; "Start from the default page" adds a ready-made page. "Celebration times" is built from the weekly events on the Events page (set their kind and "Every week").
- Badges at the top of the page: small tiles such as Next Mass, Open / closed (from the opening hours in the calendar), Next confessions, Campaign (percentage raised). Switch each on or off and order them with the arrows. "+ Add a message" adds a short text badge (e.g. "Closed on Monday 29th"), optionally important (purple), opening a module on tap, and shown until a date.
- Versions: the "Versions" button under the Home page title (it shows "Live: <name>" once a version is saved). "Save the current page as a version" keeps the sections and badges under a name (e.g. Christmas, a campaign). "Use this version" puts a saved page live; the current page is kept first (in the live version, or an automatic copy), so you can always go back. Up to 5 versions per community; rename or delete them in the list. The bottom menu is the same for every version.
- Bottom menu: the order of the buttons at the bottom of the app. Home is always first and More always last; the first three modules on the list get a button, the others go under More.

# Members
Everyone who joined the community in the app. Search by name or phone. With the Messages module, "Send a private message" writes to one member: they get a notification and can answer in the app; the number in the menu shows messages waiting for an answer. Without the Messages module the page offers it (Essentials plan). A member's data can be exported, and a member can be removed from the community when they ask (their requests, prayer requests, posts and messages there are deleted; contributions stay, as the law requires). To invite people, share the QR code, or use the community's own list:
- Two tabs: "In the app" (members who joined) and "Not in the app yet" (people on the community's list who have not signed in yet, shown with a dashed circle and their status: not in the app yet, invited, or asked to stop messages). Filter by status or group, search, edit or remove someone, export their data, "Add someone" by hand.
- "Import a list": choose an Excel (.xlsx) or CSV file, or paste cells from a spreadsheet (from Google Sheets: File › Download › Microsoft Excel). Match each column to a field (first name, last name, full name, email, phone, WhatsApp, Telegram, language, groups, or "Don't import"), tick that these people are members who gave their details, then "Check" shows who is new, who is already in the app, who is already on the list (only missing details are added), rows that were the same person (merged), and rows with no valid email or phone (left out). Nothing is saved before "Import". Spanish phones without +34 get it added. At most 5,000 rows at a time.
- When someone on the list signs in to the app with the same email or phone, they join the community and move to "In the app" on their own (a church asks them for the religious-data consent first).
- "Write to members": an email outside the app to people on the list. Kinds: Invitation to the app (every plan, with a personal link to join; the same person can be invited again after 7 days), Ask for a contribution (a link to a web page where they give by card, optionally for a campaign; no app needed), Free message (both Essentials and up). Choose who: everyone not in the app yet, not invited yet, everyone on the list, or a group. {name} in the subject or message becomes each member's first name. "Send me a test" first. Every email says why they receive it and has a link to stop these emails; nobody who asked to stop is written to again. Answers go to the email of the team member who sent it. Monthly emails: Basic 1,000, Essentials 2,000, Complete 10,000. "Sent" lists each email with how many were sent, opened the link, joined the app, and contributed.
- WhatsApp: on the list, "WhatsApp" opens WhatsApp on your own phone or computer with a ready invitation and personal link for that person; you press send. Free.

# Requests (Requests & bookings module)
What members ask the team for from the app: a registration for an activity, a certificate or document, an appointment, and in churches a baptism, wedding, funeral, first communion, confirmation, a visit to a sick person, a blessing. The list is split into "Needs a reply" and everything else, with filters "Still open" and "Done or cancelled". Open a request to: read what they wrote and when they would like it; set the status (Received, In progress, Appointment set, Done, Cancelled) and an appointment date, time and place (setting a date marks it "Appointment set"); ask the member for a document (e.g. a birth certificate) and mark it received; write messages with a photo or PDF attached. The member sees the status, appointment and messages in the app and gets a notification on paid plans.

# Events
The community's calendar: activities, meetings, celebrations and opening hours. Tabs: Regular, Upcoming, Past. "+ New event": title, kind (in churches Mass, Confession, Adoration, Prayer; everywhere Opening hours and Other), date and time, optional end time, location and description. "Repeats": only once, every day, some days of the week (shortcuts Monday to Friday, the weekend), or once a month (e.g. the first Friday, or day 15). A repeating event can have a last date, and "Except these days" removes single dates with an optional reason shown in the app. Regular events are the community's weekly timetable in the app, and feed the home page "Celebration times" section and the Next Mass / Open-closed badges. Opening hours are events of the kind "Opening hours". A preview shows how members will see the event as you type.

# Announcements (News)
Post news: title, text, optional photo, optional voice message. Style Normal or Important (stands out). "Notify members on their phones" sends a push notification once, on publishing (paid plans). The newest post shows its photo big at the top of the News tab in the app. Posts can be edited or deleted.

# Fees & contributions (Donations module, free on every plan)
Members pay a fee or give once or every month from the app, by card. Tabs: Overview (this week, this month, average contribution, daily chart, recent contributions), Campaigns, Tax receipts. infunion keeps a small share of each contribution.
- Campaigns: a project to raise money for (roof, organ, trip): title, description, optional goal and end date, photo, and optional "Where the money goes" lines that add up to 100 %. Show or hide a campaign in the app; members see how close it is to the goal.
- Tax receipts: fill in the legal name, tax number and signatory of the legal body that issues the receipts, and the tax scheme (Spain: Ley 49/2002, or foundation/association outside it at 10 %, or no deduction). One receipt a year per person who asked for one when giving; open it to print or save as PDF. Download the list or every gift as CSV, and the Modelo 182 file for the Agencia Tributaria (due by 31 January; givers without a valid NIF or Spanish postcode are listed to fix first).

# Mass intentions (churches, Complete plan)
Masses asked for someone, from the app (with the offering paid online) or taken in person ("Add one taken in person": intention, asked by, contact, date or celebration, offering received). Listed by celebration for the celebrant; print the list; mark as celebrated or take off the list. Set the offering for one intention, or leave it empty to let people choose.

# Prayer requests (places of worship, Complete plan)
Members share a prayer intention in the app and others pray for it. The team can remove one that should not be public.

# Daily readings (places of worship, Complete plan)
The texts members read each day. Prepare days ahead; each published day appears in the app at midnight on its date. Days show as Published, Draft or Nothing yet.

# Livestreams (Complete plan)
Add a title, the link (URL) of a service or gathering streamed live or recorded, and the time. Members find it in the app at the right time and are told when it is live.

# Our group (Complete plan)
Where members post and reply to each other. The team moderates: remove a post or reply. The Reported tab lists what members reported (please decide within 24 hours): keep it, remove it, or remove and block the author from posting. Blocked people still use the app but cannot post, reply or share a prayer request.

# Settings
Tabs: Information (name, description, logo: square PNG/JPEG/WebP at least 256 × 256 pixels, shown in a circle in the app header; the content language; "Tour and tips" to see the welcome tour again), Personalise (the colour of buttons, banner and selected tab: purple, ocean, forest, terracotta, ruby, teal, graphite), Address & map (kind of community, which only infunion can change; address; pin on the map; "Visible on the infunion map" so people nearby find it in "Near you"), Account (download all the community's data as a ZIP; close the community's account: it disappears for members after 30 days and the closing can be cancelled until then; gifts and tax receipts are kept locked as the law requires).

# Plans & modules
Three plans. A paid plan can be tried free for one month, once per community. Yearly billing costs ten months (2 months free). Upgrading is immediate (pay the difference for the rest of the period); downgrading applies at renewal, and modules the smaller plan lacks are paused, never deleted. A payment method (card or SEPA direct debit) is added under "Your subscription", with invoices.
- Basic, free: Events, Fees & contributions. No push notifications.
- Essentials, 39 € a month or 390 € a year: everything in Basic plus push notifications (event reminders, new announcements, messages, replies to requests), Announcements, Requests & bookings, Messages.
- Complete, 59 € a month or 590 € a year: everything in Essentials plus Our group, Livestream, Prayer requests and Daily readings (places of worship), Mass intentions (churches), automatic translation of posts for members, and the AI assistant for members.
Each module in the plan can be shown or hidden in the app at no cost. "Learn more" on a module shows what the team does in the admin and what members get in the app. Sometimes infunion offers a plan: then no payment is needed.

# QR code
A printable flyer with the community's QR code, an editable headline and welcome message. Print it or save as PDF and put it up where people pass by. Scanning it gets people the app and into the community in seconds. Members can also type the community code.

# The members' app (to explain to members)
Members sign in with their email or phone number and a 6-digit code. They can follow several communities. In a community they see the home page, the bottom menu (Home, up to three modules, More), and can change the app language in More › Language. On the Complete plan they can translate posts and ask the AI assistant.

# Help
For anything the guide does not cover (billing problems, changing the kind of community, a bug), the team writes to support@infunion.app.
`;

/** The admin pages the answer may link to, and what each is for. */
export const ADMIN_PAGES: Record<string, string> = {
  dashboard: 'Dashboard: what is waiting, key figures, this week',
  'home-page': 'Home page: sections, badges and bottom menu of the app',
  members: 'Members: the member list and private messages',
  requests: 'Requests: what members ask the team for',
  events: 'Events: calendar, timetable and opening hours',
  announcements: 'Announcements: news for members',
  donations: 'Fees & contributions: overview, campaigns, tax receipts',
  'mass-intentions': 'Mass intentions: the register for the celebrant',
  'prayer-requests': 'Prayer requests: moderation',
  readings: 'Daily readings: texts of the day',
  livestreams: 'Livestreams: links to live or recorded services',
  community: 'Our group: posts, replies and reported content',
  settings: "Settings: the community's details, look, address and account",
  modules: 'Plans & modules: plan, modules, subscription',
  website: 'Website: the community public web page, its address and what it shows',
  'my-qr': 'QR code: the printable flyer to invite members',
};

/**
 * Product modules a church can subscribe to.
 * Add new modules here as the product grows (e.g. classes, sacrament booking, etc.).
 */
export enum ModuleType {
  DONATIONS = 'donations',
  EVENTS = 'events',
  ANNOUNCEMENTS = 'announcements',
  PRAYER_REQUESTS = 'prayer_requests',
  LIVESTREAMS = 'livestreams',
  COMMUNITY = 'community',
  // A member asks the community for something (a baptism, a wedding, a
  // certificate, a meeting with the priest) and follows it to the end:
  // status, documents to send, messages both ways.
  REQUESTS = 'requests',
  // A Mass said for someone, asked for with the offering the community
  // sets, and listed for the celebrant in the dashboard.
  MASS_INTENTIONS = 'mass_intentions',
  // Lectures du jour: the texts the office gives members to read each day.
  DAILY_READINGS = 'daily_readings',
  // Messages: the office writes to one member in particular, who gets a
  // notification and can answer in the place's Messages section.
  MESSAGES = 'messages',
}

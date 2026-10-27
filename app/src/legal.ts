// The public website, where the legal pages live. EXPO_PUBLIC_LANDING_URL
// lets a staging build point at the staging site.
const LANDING_URL = (process.env.EXPO_PUBLIC_LANDING_URL ?? 'https://infunion.app').replace(/\/$/, '');

export const TERMS_URL = `${LANDING_URL}/terms.html`;
export const PRIVACY_URL = `${LANDING_URL}/privacy.html`;

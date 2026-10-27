/**
 * The version of the terms of use and privacy policy the app asks people to
 * accept. Move it forward (a date is enough) whenever either document
 * changes in a way people must agree to again: everyone whose recorded
 * version is older is asked once more the next time they open the app.
 */
export const CONSENT_VERSION = '2026-10-27';

/**
 * How long a member account may sit unused before it is deleted, with
 * everything that hangs off it. Two years is long enough that nobody who
 * still goes to their place loses their account, and short enough that
 * infunion is not keeping phone numbers for people who moved on (GDPR
 * art. 5.1.e, storage limitation).
 */
export const INACTIVE_ACCOUNT_MONTHS = 24;

/** How long the superadmin journal keeps its entries. */
export const AUDIT_LOG_MONTHS = 12;

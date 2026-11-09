/**
 * Whether a community can take contributions (Seb, 9 Nov 2026): money goes
 * straight to the community's own Stripe account, never to infunion's, so
 * nothing can be paid until that account is linked and Stripe says it can
 * take payments and pay them out to the community's bank.
 *
 * Without STRIPE_SECRET_KEY (local demo, production before real payments)
 * a community "links" a demo account instead, so the flow can still be
 * shown end to end with no real money.
 */
export const DEMO_ACCOUNT = 'demo';

export type PayoutsState =
  // No account yet: the admin has to start Stripe's sign-up.
  | 'not_linked'
  // Signed up but Stripe still needs details (bank, ID, representative…).
  | 'incomplete'
  // Everything sent; Stripe is checking it before payments can start.
  | 'pending'
  // Payments allowed but Stripe holds the payouts to the bank.
  | 'payouts_paused'
  | 'ready';

type AccountFields = {
  stripeAccountId?: string | null;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
};

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function payoutsState(poi: AccountFields, configured = stripeConfigured()): PayoutsState {
  const account = poi.stripeAccountId;
  if (!account) return 'not_linked';
  // A demo account only counts while there is no real Stripe.
  if (account === DEMO_ACCOUNT) return configured ? 'not_linked' : 'ready';
  if (!poi.stripeDetailsSubmitted) return 'incomplete';
  if (!poi.stripeChargesEnabled) return 'pending';
  if (!poi.stripePayoutsEnabled) return 'payouts_paused';
  return 'ready';
}

export function payoutsReady(poi: AccountFields, configured = stripeConfigured()): boolean {
  return payoutsState(poi, configured) === 'ready';
}

/** The Stripe account to charge on, or null for a demo/unlinked one. */
export function connectedAccount(poi: AccountFields): string | null {
  const account = poi.stripeAccountId;
  return account && account !== DEMO_ACCOUNT ? account : null;
}

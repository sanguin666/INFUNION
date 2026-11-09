import { connectedAccount, payoutsState } from './payouts-account.js';

describe('payoutsState', () => {
  const ready = {
    stripeAccountId: 'acct_1',
    stripeDetailsSubmitted: true,
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
  };

  it('is not linked without an account', () => {
    expect(payoutsState({}, true)).toBe('not_linked');
    expect(payoutsState({}, false)).toBe('not_linked');
  });

  it('counts a demo account only while there is no real Stripe', () => {
    expect(payoutsState({ stripeAccountId: 'demo' }, false)).toBe('ready');
    expect(payoutsState({ stripeAccountId: 'demo' }, true)).toBe('not_linked');
  });

  it('follows Stripe through sign-up, checks and payouts', () => {
    expect(payoutsState({ ...ready, stripeDetailsSubmitted: false }, true)).toBe('incomplete');
    expect(payoutsState({ ...ready, stripeChargesEnabled: false }, true)).toBe('pending');
    expect(payoutsState({ ...ready, stripePayoutsEnabled: false }, true)).toBe('payouts_paused');
    expect(payoutsState(ready, true)).toBe('ready');
  });

  it('charges a real account only', () => {
    expect(connectedAccount(ready)).toBe('acct_1');
    expect(connectedAccount({ stripeAccountId: 'demo' })).toBeNull();
    expect(connectedAccount({})).toBeNull();
  });
});

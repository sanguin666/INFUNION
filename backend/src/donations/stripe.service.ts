import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { donationFee, donationFeePercent } from './platform-fee.js';

/**
 * Thin wrapper around the Stripe SDK so the rest of the donations module
 * never has to care whether Stripe is set up.
 *
 * Stripe is optional on purpose: the local demo has to keep working with no
 * account and no keys (`start.bat` on a fresh machine), so when
 * STRIPE_SECRET_KEY is missing this service reports itself as unconfigured
 * and the donate flow falls back to recording the gift without a payment.
 *
 * Test keys (`sk_test_…`) cost nothing and need no account activation, which
 * is how the demo runs a real end-to-end payment with Stripe's test cards.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly client: Stripe | null;
  readonly currency: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.currency = (this.configService.get<string>('DONATION_CURRENCY') ?? 'eur').toLowerCase();
    this.client = secretKey ? new Stripe(secretKey) : null;
    if (!this.client) {
      this.logger.log('No STRIPE_SECRET_KEY set — donations run in demo mode (no real payment).');
    }
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Request options for a call made on a community's own Stripe account
   * (Stripe Connect direct charges). null: infunion's own account, which
   * only gifts made before Connect still live on.
   */
  private on(account?: string | null): Stripe.RequestOptions | undefined {
    return account ? { stripeAccount: account } : undefined;
  }

  /** Throws if Stripe isn't configured — callers check isConfigured first. */
  private get stripe(): Stripe {
    if (!this.client) throw new Error('Stripe is not configured');
    return this.client;
  }

  createCheckoutSession(params: {
    amount: number;
    // What the payer sees on Stripe's page ("Donation to St. Mary's").
    productName: string;
    // Shown under the name on Stripe's page and kept on the payment: the
    // giver's note, when there is one.
    description?: string | null;
    donationId: string;
    poiId: string;
    // What the gift is for, kept on the payment in Stripe so the team's
    // Stripe dashboard says which project it went to, and the note with it.
    purpose: string;
    campaign?: { id: string; title: string } | null;
    message?: string | null;
    successUrl: string;
    cancelUrl: string;
    // Monthly: a subscription Stripe charges again every month until the
    // giver stops it, instead of a one-off payment.
    recurring?: boolean;
    // The community's own Stripe account: the payment is made there (it
    // pays Stripe's fee) and only infunion's fee comes back to infunion.
    account?: string | null;
  }): Promise<Stripe.Checkout.Session> {
    // Stripe caps a metadata value at 500 characters; titles and notes are
    // shorter than that already (120 and 300), the slice is only a guard.
    const metadata: Record<string, string> = {
      donationId: params.donationId,
      poiId: params.poiId,
      purpose: params.purpose,
      ...(params.campaign ? { projectId: params.campaign.id, project: params.campaign.title.slice(0, 500) } : {}),
      ...(params.message ? { note: params.message.slice(0, 500) } : {}),
    };
    const description = params.description?.trim() || undefined;
    // infunion's share, taken by Stripe on the community's payment and
    // sent to infunion's account (see platform-fee.ts).
    const feePercent = donationFeePercent();
    const feeCents = Math.round(donationFee(params.amount, feePercent) * 100);
    return this.stripe.checkout.sessions.create({
      mode: params.recurring ? 'subscription' : 'payment',
      // Stripe works in the currency's smallest unit, so euros become cents.
      // Rounding here rather than truncating keeps 10.005 from becoming 10.00.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: this.currency,
            unit_amount: Math.round(params.amount * 100),
            product_data: { name: params.productName, ...(description ? { description } : {}) },
            ...(params.recurring ? { recurring: { interval: 'month' as const } } : {}),
          },
        },
      ],
      // Echoed back on the webhook event, which otherwise only knows Stripe's
      // own ids and couldn't tell us which row to promote. A subscription
      // carries it too, so each later month's invoice can find its gift.
      metadata,
      // The payment itself carries it too: a one-off gift shows as a
      // payment in Stripe's dashboard, and its description is the note.
      ...(params.recurring
        ? {
            subscription_data: {
              metadata,
              ...(description ? { description } : {}),
              ...(params.account && feePercent > 0 ? { application_fee_percent: feePercent } : {}),
            },
          }
        : {
            payment_intent_data: {
              metadata,
              ...(description ? { description } : {}),
              ...(params.account && feeCents > 0 ? { application_fee_amount: feeCents } : {}),
            },
          }),
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    }, this.on(params.account));
  }

  retrieveSession(sessionId: string, account?: string | null): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.retrieve(sessionId, undefined, this.on(account));
  }

  /** Stops a monthly gift: Stripe charges nothing more after this. */
  async cancelSubscription(subscriptionId: string, account?: string | null): Promise<void> {
    await this.stripe.subscriptions.cancel(subscriptionId, undefined, this.on(account));
  }

  /**
   * Stripe's own page where a monthly giver replaces their card (the
   * customer portal; it needs to be switched on once in the Stripe
   * dashboard, under Settings > Billing > Customer portal).
   */
  async cardUpdateUrl(subscriptionId: string, returnUrl: string, account?: string | null): Promise<string> {
    const options = this.on(account);
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, undefined, options);
    const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const create = () =>
      this.stripe.billingPortal.sessions.create(
        { customer, return_url: returnUrl, flow_data: { type: 'payment_method_update' } },
        options,
      );
    try {
      return (await create()).url;
    } catch (error) {
      // A community's own Stripe account may have no customer portal set
      // up yet: give it the smallest one (update the card) and try again.
      if (!account) throw error;
      await this.stripe.billingPortal.configurations.create(
        {
          features: { payment_method_update: { enabled: true } },
          business_profile: {},
        },
        options,
      );
      return (await create()).url;
    }
  }

  /**
   * Whether the card a subscription will next be charged on runs out
   * before `chargeAt` (Stripe's `invoice.upcoming` tells us when).
   */
  async cardExpiresBefore(subscriptionId: string, chargeAt: Date, account?: string | null): Promise<boolean> {
    const subscription = await this.stripe.subscriptions.retrieve(
      subscriptionId,
      { expand: ['default_payment_method', 'customer.invoice_settings.default_payment_method'] },
      this.on(account),
    );
    const own = subscription.default_payment_method;
    const customer = subscription.customer;
    const fallback =
      typeof customer === 'object' && !customer.deleted ? customer.invoice_settings?.default_payment_method : null;
    const method = (typeof own === 'object' && own) || (typeof fallback === 'object' && fallback) || null;
    const card = method?.card;
    if (!card) return false;
    // A card is good until the end of its expiry month.
    const lastDay = new Date(card.exp_year, card.exp_month, 1);
    return lastDay <= chargeAt;
  }

  // ---- Stripe Connect: each community's own account ----

  /**
   * A new Stripe account for a community (a Standard account: the
   * community owns it, sees it in its own Stripe dashboard, pays Stripe's
   * fees and handles its refunds and disputes).
   */
  async createCommunityAccount(params: {
    poiId: string;
    name: string;
    email?: string | null;
    country: string;
  }): Promise<Stripe.Account> {
    return this.stripe.accounts.create({
      type: 'standard',
      country: params.country,
      ...(params.email ? { email: params.email } : {}),
      business_profile: { name: params.name },
      metadata: { poiId: params.poiId },
    });
  }

  /** Stripe's hosted sign-up page where the community fills in its details. */
  async onboardingUrl(account: string, refreshUrl: string, returnUrl: string): Promise<string> {
    const link = await this.stripe.accountLinks.create({
      account,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
    return link.url;
  }

  retrieveAccount(account: string): Promise<Stripe.Account> {
    return this.stripe.accounts.retrieve(account);
  }

  /**
   * Verifies the webhook signature against the raw request body. Returns null
   * when no webhook secret is configured, which is the normal case for the
   * local demo — the app confirms payments by polling instead.
   *
   * Two endpoints may call: infunion's own account (STRIPE_WEBHOOK_SECRET)
   * and the communities' accounts (Connect, STRIPE_CONNECT_WEBHOOK_SECRET).
   * Each has its own signing secret, so either one may sign.
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event | null {
    const secrets = [
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET'),
      this.configService.get<string>('STRIPE_CONNECT_WEBHOOK_SECRET'),
    ].filter((secret): secret is string => !!secret);
    if (secrets.length === 0) return null;
    let lastError: unknown;
    for (const secret of secrets) {
      try {
        return this.stripe.webhooks.constructEvent(payload, signature, secret);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

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

  /** Throws if Stripe isn't configured — callers check isConfigured first. */
  private get stripe(): Stripe {
    if (!this.client) throw new Error('Stripe is not configured');
    return this.client;
  }

  createCheckoutSession(params: {
    amount: number;
    // What the payer sees on Stripe's page ("Donation to St. Mary's").
    productName: string;
    donationId: string;
    poiId: string;
    successUrl: string;
    cancelUrl: string;
    // Monthly: a subscription Stripe charges again every month until the
    // giver stops it, instead of a one-off payment.
    recurring?: boolean;
  }): Promise<Stripe.Checkout.Session> {
    const metadata = { donationId: params.donationId, poiId: params.poiId };
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
            product_data: { name: params.productName },
            ...(params.recurring ? { recurring: { interval: 'month' as const } } : {}),
          },
        },
      ],
      // Echoed back on the webhook event, which otherwise only knows Stripe's
      // own ids and couldn't tell us which row to promote. A subscription
      // carries it too, so each later month's invoice can find its gift.
      metadata,
      ...(params.recurring ? { subscription_data: { metadata } } : {}),
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
  }

  retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.retrieve(sessionId);
  }

  /** Stops a monthly gift: Stripe charges nothing more after this. */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.cancel(subscriptionId);
  }

  /**
   * Stripe's own page where a monthly giver replaces their card (the
   * customer portal; it needs to be switched on once in the Stripe
   * dashboard, under Settings > Billing > Customer portal).
   */
  async cardUpdateUrl(subscriptionId: string, returnUrl: string): Promise<string> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const session = await this.stripe.billingPortal.sessions.create({
      customer,
      return_url: returnUrl,
      flow_data: { type: 'payment_method_update' },
    });
    return session.url;
  }

  /**
   * Whether the card a subscription will next be charged on runs out
   * before `chargeAt` (Stripe's `invoice.upcoming` tells us when).
   */
  async cardExpiresBefore(subscriptionId: string, chargeAt: Date): Promise<boolean> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method', 'customer.invoice_settings.default_payment_method'],
    });
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

  /**
   * Verifies the webhook signature against the raw request body. Returns null
   * when no webhook secret is configured, which is the normal case for the
   * local demo — the app confirms payments by polling instead.
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event | null {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) return null;
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}

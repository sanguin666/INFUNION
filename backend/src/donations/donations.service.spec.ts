import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Donation, DonationStatus } from './entities/donation.entity.js';
import { DonationCampaign } from './entities/donation-campaign.entity.js';
import { DonationsService } from './donations.service.js';
import { PoisService } from '../pois/pois.service.js';
import { StripeService } from './stripe.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

/**
 * Covers the Stripe checkout flow with the SDK stubbed out — the real round
 * trip needs a Stripe account, and what can go wrong here is our own state
 * machine: a gift must not count towards a parish's totals until Stripe says
 * it was paid.
 */
describe('DonationsService (Stripe checkout)', () => {
  const poi = { id: 'poi-1', name: "St. Mary's Community" };

  let service: DonationsService;
  let saved: Donation[];
  let stripe: {
    isConfigured: boolean;
    currency: string;
    createCheckoutSession: ReturnType<typeof vi.fn>;
    retrieveSession: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    saved = [];
    stripe = {
      isConfigured: true,
      currency: 'eur',
      createCheckoutSession: vi.fn().mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
      }),
      retrieveSession: vi.fn(),
    };

    const repository = {
      create: (data: Partial<Donation>) => ({ ...data }) as Donation,
      save: vi.fn(async (donation: Donation) => {
        donation.id ??= 'donation-1';
        if (!saved.includes(donation)) saved.push(donation);
        return donation;
      }),
      findOne: vi.fn(async () => saved[0] ?? null),
      find: vi.fn(async () => []),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationsService,
        { provide: getRepositoryToken(Donation), useValue: repository },
        { provide: getRepositoryToken(DonationCampaign), useValue: {} },
        { provide: PoisService, useValue: { findOne: async () => poi } },
        { provide: StripeService, useValue: stripe },
        { provide: NotificationsService, useValue: { fireAndForget: () => {}, notifyUserAlways: async () => {} } },
      ],
    }).compile();

    service = module.get(DonationsService);
  });

  it('records a gift as pending and hands back the Stripe checkout URL', async () => {
    const result = await service.startCheckout('poi-1', { amount: 50 }, 'http://localhost:3000');

    expect(result).toEqual({
      mode: 'stripe',
      donationId: 'donation-1',
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });
    expect(saved[0].status).toBe(DonationStatus.PENDING);
    expect(saved[0].stripeSessionId).toBe('cs_test_123');
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 50,
        successUrl: 'http://localhost:3000/donations/return?status=success',
        cancelUrl: 'http://localhost:3000/donations/return?status=cancelled',
      }),
    );
  });

  it('records the gift without a payment when Stripe is not configured', async () => {
    stripe.isConfigured = false;

    const result = await service.startCheckout('poi-1', { amount: 25 }, 'http://localhost:3000');

    expect(result).toEqual({ mode: 'demo', donationId: 'donation-1' });
    expect(saved[0].status).toBe(DonationStatus.COMPLETED);
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('completes a pending gift once Stripe reports it paid', async () => {
    await service.startCheckout('poi-1', { amount: 50 }, 'http://localhost:3000');
    stripe.retrieveSession.mockResolvedValue({
      payment_status: 'paid',
      status: 'complete',
      payment_intent: 'pi_test_123',
    });

    const status = await service.getStatus('poi-1', 'donation-1');

    expect(status.status).toBe(DonationStatus.COMPLETED);
    expect(saved[0].stripePaymentIntentId).toBe('pi_test_123');
  });

  it('leaves a gift pending while the payer is still on the checkout page', async () => {
    await service.startCheckout('poi-1', { amount: 50 }, 'http://localhost:3000');
    stripe.retrieveSession.mockResolvedValue({
      payment_status: 'unpaid',
      status: 'open',
      payment_intent: null,
    });

    const status = await service.getStatus('poi-1', 'donation-1');

    expect(status.status).toBe(DonationStatus.PENDING);
  });

  it('fails a gift whose checkout session expired', async () => {
    await service.startCheckout('poi-1', { amount: 50 }, 'http://localhost:3000');
    stripe.retrieveSession.mockResolvedValue({
      payment_status: 'unpaid',
      status: 'expired',
      payment_intent: null,
    });

    const status = await service.getStatus('poi-1', 'donation-1');

    expect(status.status).toBe(DonationStatus.FAILED);
  });
});

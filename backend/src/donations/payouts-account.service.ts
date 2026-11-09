import { ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type Stripe from 'stripe';
import { Poi } from '../pois/entities/poi.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Language } from '../common/enums/language.enum.js';
import { StripeService } from './stripe.service.js';
import { DEMO_ACCOUNT, connectedAccount, payoutsState, type PayoutsState } from './payouts-account.js';
import { donationFeePercent } from './platform-fee.js';

export type PayoutsAccountView = {
  state: PayoutsState;
  ready: boolean;
  // No STRIPE_SECRET_KEY: setting up links a demo account, no real money.
  demo: boolean;
  // What Stripe still asks for, as its own field names (for support).
  requirements: string[];
  // infunion's share of each contribution, in percent.
  feePercent: number;
};

/**
 * Each community's own payment account (Seb, 9 Nov 2026): contributions
 * are paid on it directly through Stripe Connect, the community receives
 * them minus Stripe's fees and infunion's 1 %, and infunion never holds
 * the community's money.
 */
@Injectable()
export class PayoutsAccountService {
  private readonly logger = new Logger(PayoutsAccountService.name);

  constructor(
    @InjectRepository(Poi) private readonly pois: Repository<Poi>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  /** Where the community stands; asks Stripe again while it isn't ready. */
  async status(poiId: string): Promise<PayoutsAccountView> {
    let poi = await this.findPoi(poiId);
    let requirements: string[] = [];
    const account = connectedAccount(poi);
    if (account && this.stripe.isConfigured) {
      try {
        const fresh = await this.stripe.retrieveAccount(account);
        poi = await this.save(poi, fresh);
        requirements = [...(fresh.requirements?.currently_due ?? []), ...(fresh.requirements?.past_due ?? [])];
      } catch (error) {
        this.logger.warn(`Could not read Stripe account ${account}: ${(error as Error).message}`);
      }
    }
    return this.view(poi, [...new Set(requirements)]);
  }

  /**
   * Starts or resumes the set-up: Stripe's hosted sign-up page for the
   * community's own account. Without Stripe (demo) the community gets the
   * demo account straight away and no page is opened.
   */
  async startOnboarding(poiId: string, userId: string): Promise<{ url: string | null; status: PayoutsAccountView }> {
    let poi = await this.findPoi(poiId);
    if (poi.closingRequestedAt || poi.closedAt) {
      throw new ConflictException('This community is closing');
    }

    if (!this.stripe.isConfigured) {
      poi.stripeAccountId = DEMO_ACCOUNT;
      poi = await this.pois.save(poi);
      return { url: null, status: this.view(poi, []) };
    }

    let account = connectedAccount(poi);
    try {
      if (!account) {
        const admin = await this.users.findOne({ where: { id: userId } });
        const created = await this.stripe.createCommunityAccount({
          poiId: poi.id,
          name: poi.legalName?.trim() || poi.name,
          email: admin?.email ?? null,
          country: countryFor(poi.language),
        });
        account = created.id;
        poi = await this.save(poi, created);
      }
      const back = `${this.adminUrl()}/poi/${poi.id}/donations`;
      const url = await this.stripe.onboardingUrl(account, `${back}?payouts=refresh`, `${back}?payouts=return`);
      return { url, status: this.view(poi, []) };
    } catch (error) {
      this.logger.error(`Stripe onboarding failed for ${poi.id}: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Could not open Stripe');
    }
  }

  /** Stripe's account.updated: keep the community's flags in step. */
  async applyAccount(account: Stripe.Account): Promise<void> {
    const poi = await this.pois.findOne({ where: { stripeAccountId: account.id } });
    if (poi) await this.save(poi, account);
  }

  private async save(poi: Poi, account: Stripe.Account): Promise<Poi> {
    poi.stripeAccountId = account.id;
    poi.stripeChargesEnabled = account.charges_enabled === true;
    poi.stripePayoutsEnabled = account.payouts_enabled === true;
    poi.stripeDetailsSubmitted = account.details_submitted === true;
    const saved = await this.pois.save(poi);
    saved.setPaymentsReady();
    return saved;
  }

  private view(poi: Poi, requirements: string[]): PayoutsAccountView {
    const state = payoutsState(poi, this.stripe.isConfigured);
    return {
      state,
      ready: state === 'ready',
      demo: !this.stripe.isConfigured,
      requirements,
      feePercent: donationFeePercent(),
    };
  }

  private async findPoi(poiId: string): Promise<Poi> {
    const poi = await this.pois.findOne({ where: { id: poiId } });
    if (!poi) throw new NotFoundException('Community not found');
    return poi;
  }

  /** ADMIN_URL, else the admin origin in CORS_ORIGINS, else production's. */
  private adminUrl(): string {
    const configured = this.config.get<string>('ADMIN_URL')?.trim();
    if (configured) return configured.replace(/\/$/, '');
    const fromCors = (this.config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((o) => o.trim())
      .find((o) => o.includes('admin'));
    return (fromCors ?? 'https://infunion-admin.up.railway.app').replace(/\/$/, '');
  }
}

/** The country Stripe opens the account in (infunion is Spanish first). */
function countryFor(language?: Language | null): string {
  switch (language) {
    case Language.FR:
      return 'FR';
    case Language.PT:
      return 'PT';
    default:
      return 'ES';
  }
}

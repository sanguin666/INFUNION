import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type Stripe from 'stripe';
import { InjectRepository } from '@nestjs/typeorm';
import { And, In, IsNull, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { Donation, DonationPurpose, DonationStatus, type PaymentProblem } from './entities/donation.entity.js';
import { DonationCampaign, type CampaignAllocationLine } from './entities/donation-campaign.entity.js';
import { PoisService } from '../pois/pois.service.js';
import type { Poi } from '../pois/entities/poi.entity.js';
import type { User } from '../users/entities/user.entity.js';
import { Language } from '../common/enums/language.enum.js';
import { RequestReceiptDto } from './dto/request-receipt.dto.js';
import { CreateDonationDto } from './dto/create-donation.dto.js';
import type { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto.js';
import { StripeService } from './stripe.service.js';
import { giftsCsv, groupDonors, type ReceiptDonor } from './receipts.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { text } from '../notifications/texts.js';
import { TaxScheme } from '../common/enums/tax-scheme.enum.js';
import { isRecurrentGiver } from './tax-deduction.js';
import { modelo182 } from './modelo182.js';

export type PeriodTotal = { total: number; count: number };

export type DailyTotal = { date: string; total: number; count: number };

/**
 * What the app should do next after asking to donate. 'demo' means no Stripe
 * key is configured, so the gift was recorded without a payment and the app
 * can go straight to its thank-you screen.
 */
export type CheckoutResult =
  | { mode: 'demo'; donationId: string }
  | { mode: 'stripe'; donationId: string; checkoutUrl: string };

/** A campaign as the app and the dashboard show it: with what it has raised. */
export type CampaignView = {
  id: string;
  title: string;
  description: string | null;
  goalAmount: number | null;
  endsAt: Date | null;
  active: boolean;
  raised: number;
  giftCount: number;
  imageUrl: string | null;
  allocation: CampaignAllocationLine[] | null;
};

/**
 * A project's split as the office typed it, tidied: blank lines dropped,
 * shares rounded to one decimal. They must add up to 100, or the page
 * would tell members something that can't be true.
 */
export function cleanAllocation(lines: CampaignAllocationLine[] | null | undefined): CampaignAllocationLine[] | null {
  const kept = (lines ?? [])
    .map((line) => ({ label: line.label.trim(), percent: Math.round(line.percent * 10) / 10 }))
    .filter((line) => line.label && line.percent > 0);
  if (kept.length === 0) return null;
  const sum = kept.reduce((total, line) => total + line.percent, 0);
  if (Math.abs(sum - 100) > 0.05) throw new BadRequestException('The shares must add up to 100 %');
  return kept;
}

/** One of a signed-in giver's own gifts, as "My gifts" lists it. */
export type MyGift = {
  id: string;
  amount: number;
  createdAt: Date;
  purpose: DonationPurpose;
  campaignTitle: string | null;
  recurring: boolean;
  wantsReceipt: boolean;
};

/** Anything the Stripe session tells us about how a checkout ended. */
export type SessionOutcome = {
  payment_status?: string | null;
  status?: string | null;
  payment_intent?: unknown;
  subscription?: unknown;
};

/** Options only the backend itself sets, never the request body. */
export type CheckoutOptions = {
  // The signed-in giver, if any.
  donorUserId?: string;
  // Set by the Mass intentions module for an intention's offering.
  purpose?: DonationPurpose;
};

// What the payer reads on Stripe's page, in the place's own language.
const PRODUCT_NAMES: Record<Language, Record<'gift' | 'monthly' | 'collection' | 'intention', string>> = {
  [Language.EN]: {
    gift: 'Donation to {name}',
    monthly: 'Monthly donation to {name}',
    collection: 'Day-to-day running — {name}',
    intention: 'Mass intention — {name}',
  },
  [Language.FR]: {
    gift: 'Don à {name}',
    monthly: 'Don mensuel à {name}',
    collection: 'Fonctionnement — {name}',
    intention: 'Intention de messe — {name}',
  },
  [Language.ES]: {
    gift: 'Donativo a {name}',
    monthly: 'Donativo mensual a {name}',
    collection: 'Día a día — {name}',
    intention: 'Intención de misa — {name}',
  },
  [Language.VA]: {
    gift: 'Donatiu a {name}',
    monthly: 'Donatiu mensual a {name}',
    collection: 'Dia a dia — {name}',
    intention: 'Intenció de missa — {name}',
  },
  [Language.GL]: {
    gift: 'Doazón a {name}',
    monthly: 'Doazón mensual a {name}',
    collection: 'Día a día — {name}',
    intention: 'Intención de misa — {name}',
  },
  [Language.PT]: {
    gift: 'Donativo a {name}',
    monthly: 'Donativo mensal a {name}',
    collection: 'Dia a dia — {name}',
    intention: 'Intenção de missa — {name}',
  },
};

function productName(poi: Poi, purpose: DonationPurpose, recurring: boolean): string {
  const names = PRODUCT_NAMES[poi.language] ?? PRODUCT_NAMES[Language.EN];
  const key =
    purpose === DonationPurpose.MASS_INTENTION
      ? 'intention'
      : recurring
        ? 'monthly'
        : purpose === DonationPurpose.COLLECTION
          ? 'collection'
          : 'gift';
  return names[key].replace('{name}', poi.name);
}

export type DonationStats = {
  dailyTotals: DailyTotal[];
  thisWeek: PeriodTotal;
  lastWeek: PeriodTotal;
  thisMonth: PeriodTotal;
  lastMonth: PeriodTotal;
};

const CHART_WINDOW_DAYS = 30;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Monday-start week, matching how most parishes think about "this week"
// (Sunday service closes the week rather than opening it).
function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function toDateKey(date: Date): string {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "12,50 €": the amount a notification names, the same in every language. */
function formatEuros(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',').replace(',00', '')} €`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);

  constructor(
    @InjectRepository(Donation)
    private readonly donationsRepository: Repository<Donation>,
    @InjectRepository(DonationCampaign)
    private readonly campaignsRepository: Repository<DonationCampaign>,
    private readonly poisService: PoisService,
    private readonly stripeService: StripeService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(poiId: string, dto: CreateDonationDto): Promise<Donation> {
    const poi = await this.poisService.findOne(poiId);
    const donation = this.donationsRepository.create({ ...dto, poi });
    return this.donationsRepository.save(donation);
  }

  /**
   * Starts a gift. With Stripe configured the row is created PENDING and the
   * caller is sent to Stripe's hosted checkout page; without it the gift is
   * recorded straight away so the demo still works on a machine with no keys.
   */
  async startCheckout(
    poiId: string,
    dto: CreateDonationDto,
    returnUrlBase: string,
    options: CheckoutOptions = {},
  ): Promise<CheckoutResult> {
    const poi = await this.poisService.findOne(poiId);
    const purpose = options.purpose ?? dto.purpose ?? DonationPurpose.GENERAL;
    const recurring = dto.recurring === true;

    // A project is supported with a gift, not a standing order: it ends,
    // and a monthly payment would outlive it.
    if (recurring && purpose === DonationPurpose.CAMPAIGN) {
      throw new BadRequestException('A project takes one-off gifts');
    }

    // A monthly gift has to belong to someone who can come back and stop it.
    if (recurring && !options.donorUserId) {
      throw new UnauthorizedException('Sign in to give every month');
    }

    let campaign: DonationCampaign | null = null;
    if (purpose === DonationPurpose.CAMPAIGN) {
      campaign = await this.campaignsRepository.findOne({
        where: { id: dto.campaignId, poi: { id: poiId }, active: true },
      });
      if (!campaign) throw new BadRequestException('This campaign is not open for gifts');
    }

    const fields: Partial<Donation> = {
      amount: dto.amount,
      donorName: dto.donorName,
      poi,
      purpose,
      campaign,
      donor: options.donorUserId ? ({ id: options.donorUserId } as User) : null,
      recurring,
      wantsReceipt: dto.wantsReceipt === true,
      ...(dto.wantsReceipt
        ? {
            donorAddress: dto.donorAddress,
            donorPostalCode: dto.donorPostalCode,
            donorCity: dto.donorCity,
            donorTaxId: dto.donorTaxId ?? null,
          }
        : {}),
    };

    if (!this.stripeService.isConfigured) {
      const donation = await this.donationsRepository.save(
        this.donationsRepository.create({ ...fields, status: DonationStatus.COMPLETED }),
      );
      return { mode: 'demo', donationId: donation.id };
    }

    const donation = await this.donationsRepository.save(
      this.donationsRepository.create({
        ...fields,
        currency: this.stripeService.currency,
        status: DonationStatus.PENDING,
      }),
    );

    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripeService.createCheckoutSession({
        amount: dto.amount,
        productName: productName(poi, purpose, recurring),
        donationId: donation.id,
        poiId: poi.id,
        successUrl: `${returnUrlBase}/donations/return?status=success`,
        cancelUrl: `${returnUrlBase}/donations/return?status=cancelled`,
        recurring,
      });
    } catch (error) {
      // A bad key or an unreachable Stripe shouldn't read as "the app is
      // broken" in the logs — the pending row is simply never promoted.
      this.logger.error(`Stripe checkout failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Could not start the payment');
    }

    donation.stripeSessionId = session.id;
    await this.donationsRepository.save(donation);

    if (!session.url) {
      throw new ServiceUnavailableException('Stripe did not return a checkout URL');
    }
    return { mode: 'stripe', donationId: donation.id, checkoutUrl: session.url };
  }

  /**
   * The app polls this after sending someone to Stripe. A still-pending gift
   * is re-checked against Stripe itself rather than waiting on the webhook,
   * so payments confirm even on a laptop Stripe can't reach.
   */
  async getStatus(poiId: string, donationId: string): Promise<{ status: DonationStatus; amount: number }> {
    const donation = await this.donationsRepository.findOne({
      where: { id: donationId, poi: { id: poiId } },
    });
    if (!donation) throw new NotFoundException('Donation not found');
    await this.refreshFromStripe(donation);
    return { status: donation.status, amount: donation.amount };
  }

  /** Re-checks a pending gift with Stripe. A no-op for anything else. */
  async refreshFromStripe(donation: Donation): Promise<void> {
    if (donation.status === DonationStatus.PENDING && donation.stripeSessionId && this.stripeService.isConfigured) {
      const session = await this.stripeService.retrieveSession(donation.stripeSessionId);
      await this.applySessionOutcome(donation, session);
    }
  }

  /** Promotes (or fails) a pending gift from a Stripe session, webhook or poll. */
  async applySessionOutcome(donation: Donation, session: SessionOutcome): Promise<void> {
    if (donation.status !== DonationStatus.PENDING) return;

    if (session.payment_status === 'paid') {
      donation.status = DonationStatus.COMPLETED;
      donation.stripePaymentIntentId =
        typeof session.payment_intent === 'string' ? session.payment_intent : donation.stripePaymentIntentId;
      // A monthly gift: remember the subscription, which is what later
      // months' invoices and the giver's "stop" both refer to.
      if (typeof session.subscription === 'string') {
        donation.stripeSubscriptionId = session.subscription;
      }
    } else if (session.status === 'expired') {
      donation.status = DonationStatus.FAILED;
    } else {
      // Still open — the payer hasn't finished yet, so leave it pending.
      return;
    }
    await this.donationsRepository.save(donation);
  }

  /**
   * A later month of a monthly gift, from Stripe's `invoice.paid`. The
   * first month is the checkout itself, so only renewals land here, each
   * as a completed gift of its own on the day it was charged.
   */
  async recordRenewal(subscriptionId: string, invoiceId: string, amount: number): Promise<void> {
    const first = await this.donationsRepository.findOne({
      where: { stripeSubscriptionId: subscriptionId, recurringParentId: IsNull() },
      relations: { poi: true, campaign: true, donor: true },
    });
    if (!first) return;
    const already = await this.donationsRepository.findOne({ where: { stripeInvoiceId: invoiceId } });
    if (already) return;
    if (first.paymentProblem) {
      first.paymentProblem = null;
      first.paymentProblemAt = null;
      await this.donationsRepository.save(first);
    }
    await this.donationsRepository.save(
      this.donationsRepository.create({
        poi: first.poi,
        amount,
        currency: first.currency,
        status: DonationStatus.COMPLETED,
        purpose: first.purpose,
        campaign: first.campaign,
        donor: first.donor,
        donorName: first.donorName,
        recurring: true,
        recurringParentId: first.id,
        stripeSubscriptionId: subscriptionId,
        stripeInvoiceId: invoiceId,
        wantsReceipt: first.wantsReceipt,
        donorAddress: first.donorAddress,
        donorPostalCode: first.donorPostalCode,
        donorCity: first.donorCity,
        donorTaxId: first.donorTaxId,
      }),
    );
  }

  /** A signed-in giver's monthly gifts at this place that are still running. */
  async listMyMonthly(poiId: string, userId: string): Promise<Donation[]> {
    return this.donationsRepository.find({
      where: {
        poi: { id: poiId },
        donor: { id: userId },
        recurring: true,
        recurringParentId: IsNull(),
        recurringCancelledAt: IsNull(),
        status: DonationStatus.COMPLETED,
      },
      relations: { campaign: true },
      order: { createdAt: 'DESC' },
    });
  }

  async stopMonthly(poiId: string, donationId: string, userId: string): Promise<void> {
    const donation = await this.donationsRepository.findOne({
      where: { id: donationId, poi: { id: poiId }, donor: { id: userId }, recurring: true },
    });
    if (!donation) throw new NotFoundException('Donation not found');
    if (donation.recurringCancelledAt) return;
    if (donation.stripeSubscriptionId && this.stripeService.isConfigured) {
      try {
        await this.stripeService.cancelSubscription(donation.stripeSubscriptionId);
      } catch (error) {
        this.logger.error(`Stripe cancel failed: ${(error as Error).message}`);
        throw new ServiceUnavailableException('Could not stop the monthly gift');
      }
    }
    donation.recurringCancelledAt = new Date();
    await this.donationsRepository.save(donation);
  }

  // ---- Campaigns ----

  async listCampaigns(poiId: string, includeInactive: boolean): Promise<CampaignView[]> {
    const campaigns = await this.campaignsRepository.find({
      where: { poi: { id: poiId }, ...(includeInactive ? {} : { active: true }) },
      order: { createdAt: 'DESC' },
    });
    return this.withRaised(campaigns);
  }

  async createCampaign(poiId: string, dto: CreateCampaignDto): Promise<CampaignView> {
    const poi = await this.poisService.findOne(poiId);
    const campaign = await this.campaignsRepository.save(
      this.campaignsRepository.create({
        ...dto,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        allocation: cleanAllocation(dto.allocation),
        poi,
      }),
    );
    return (await this.withRaised([campaign]))[0];
  }

  async updateCampaign(poiId: string, id: string, dto: UpdateCampaignDto): Promise<CampaignView> {
    const campaign = await this.findCampaign(poiId, id);
    Object.assign(campaign, {
      ...dto,
      endsAt: dto.endsAt === undefined ? campaign.endsAt : dto.endsAt ? new Date(dto.endsAt) : null,
      allocation: dto.allocation === undefined ? campaign.allocation : cleanAllocation(dto.allocation),
    });
    await this.campaignsRepository.save(campaign);
    return (await this.withRaised([campaign]))[0];
  }

  async removeCampaign(poiId: string, id: string): Promise<void> {
    const campaign = await this.findCampaign(poiId, id);
    await this.campaignsRepository.remove(campaign);
  }

  async setCampaignImage(poiId: string, id: string, imageUrl: string | null): Promise<CampaignView> {
    const campaign = await this.findCampaign(poiId, id);
    campaign.imageUrl = imageUrl;
    const [view] = await this.withRaised([await this.campaignsRepository.save(campaign)]);
    return view;
  }

  private async findCampaign(poiId: string, id: string): Promise<DonationCampaign> {
    const campaign = await this.campaignsRepository.findOne({ where: { id, poi: { id: poiId } } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  private async withRaised(campaigns: DonationCampaign[]): Promise<CampaignView[]> {
    if (campaigns.length === 0) return [];
    const rows: { campaignId: string; total: string; count: string }[] = await this.donationsRepository
      .createQueryBuilder('donation')
      .select('donation.campaign_id', 'campaignId')
      .addSelect('COALESCE(SUM(donation.amount), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('donation.campaign_id IN (:...ids)', { ids: campaigns.map((c) => c.id) })
      .andWhere('donation.status = :status', { status: DonationStatus.COMPLETED })
      .groupBy('donation.campaign_id')
      .getRawMany();
    const byId = new Map(rows.map((row) => [row.campaignId, row]));
    return campaigns.map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      description: campaign.description ?? null,
      goalAmount: campaign.goalAmount ?? null,
      endsAt: campaign.endsAt ?? null,
      active: campaign.active,
      raised: round2(Number(byId.get(campaign.id)?.total ?? 0)),
      giftCount: Number(byId.get(campaign.id)?.count ?? 0),
      imageUrl: campaign.imageUrl ?? null,
      allocation: campaign.allocation ?? null,
    }));
  }

  // ---- Tax receipts ----

  /** Every giver who asked for a receipt, with what they gave in `year`. */
  async receiptDonors(poiId: string, year: number): Promise<ReceiptDonor[]> {
    return groupDonors(await this.receiptDonations(poiId, year));
  }

  /**
   * One giver's receipt data for `year`, by the key groupDonors gave them.
   * `u:<userId>` also works for a signed-in giver asking for their own,
   * even when their gifts are grouped under their tax number.
   */
  async receiptDonor(poiId: string, year: number, key: string): Promise<ReceiptDonor | null> {
    const donations = await this.receiptDonations(poiId, year);
    const grouped = groupDonors(donations).find((donor) => donor.key === key);
    if (grouped) return grouped;
    if (key.startsWith('u:')) {
      const own = donations.filter((donation) => donation.donor?.id === key.slice(2));
      const [donor] = groupDonors(own.map((d) => ({ ...d, donorTaxId: null }) as Donation));
      return donor ? { ...donor, key, taxId: own.at(-1)?.donorTaxId ?? null } : null;
    }
    return null;
  }

  // ---- A giver's own gifts ----

  /** A signed-in giver's completed gifts to a place, newest first. */
  async listMyGifts(poiId: string, userId: string): Promise<MyGift[]> {
    const gifts = await this.donationsRepository.find({
      where: { poi: { id: poiId }, donor: { id: userId }, status: DonationStatus.COMPLETED },
      relations: { campaign: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return gifts.map((gift) => this.myGiftView(gift));
  }

  /** One of the giver's own completed gifts, for its receipt. */
  async findMyGift(poiId: string, donationId: string, userId: string): Promise<Donation> {
    const gift = await this.donationsRepository.findOne({
      where: { id: donationId, poi: { id: poiId }, donor: { id: userId }, status: DonationStatus.COMPLETED },
      relations: { campaign: true },
    });
    if (!gift) throw new NotFoundException('Gift not found');
    return gift;
  }

  /** A gift made without a receipt, given the details one needs. */
  async requestReceipt(poiId: string, donationId: string, userId: string, dto: RequestReceiptDto): Promise<MyGift> {
    const gift = await this.findMyGift(poiId, donationId, userId);
    Object.assign(gift, {
      wantsReceipt: true,
      donorName: dto.donorName.trim(),
      donorAddress: dto.donorAddress.trim(),
      donorPostalCode: dto.donorPostalCode.trim(),
      donorCity: dto.donorCity.trim(),
      donorTaxId: dto.donorTaxId?.trim() || null,
    });
    return this.myGiftView(await this.donationsRepository.save(gift));
  }

  /** A gift by id, for the receipt page a signed link opens. */
  async findReceiptGift(donationId: string): Promise<Donation | null> {
    return this.donationsRepository.findOne({
      where: { id: donationId, wantsReceipt: true, status: DonationStatus.COMPLETED },
      relations: { poi: true, donor: true },
    });
  }

  myGiftView(gift: Donation): MyGift {
    return {
      id: gift.id,
      amount: gift.amount,
      createdAt: gift.createdAt,
      purpose: gift.purpose,
      campaignTitle: gift.campaign?.title ?? null,
      recurring: gift.recurring,
      wantsReceipt: gift.wantsReceipt,
    };
  }

  /** The years a signed-in giver has receipt-worthy gifts in, newest first. */
  async myReceiptYears(poiId: string, userId: string): Promise<{ year: number; total: number }[]> {
    const donations = await this.donationsRepository.find({
      where: {
        poi: { id: poiId },
        donor: { id: userId },
        wantsReceipt: true,
        status: DonationStatus.COMPLETED,
      },
    });
    const byYear = new Map<number, number>();
    for (const donation of donations) {
      const year = donation.createdAt.getFullYear();
      byYear.set(year, round2((byYear.get(year) ?? 0) + donation.amount));
    }
    return [...byYear.entries()].sort((a, b) => b[0] - a[0]).map(([year, total]) => ({ year, total }));
  }

  private receiptDonations(poiId: string, year: number): Promise<Donation[]> {
    return this.donationsRepository.find({
      where: {
        poi: { id: poiId },
        wantsReceipt: true,
        status: DonationStatus.COMPLETED,
        createdAt: And(MoreThanOrEqual(new Date(year, 0, 1)), LessThan(new Date(year + 1, 0, 1))),
      },
      relations: { donor: true },
      order: { createdAt: 'ASC' },
    });
  }

  // ---- Monthly gifts whose card needs the giver ----

  /**
   * Stripe says a monthly gift's charge failed, or that its card runs out
   * before the next one. The giver hears it once per problem, in their
   * own language, whatever notifications they turned off: it is about
   * their own money, not the community's news.
   */
  async markPaymentProblem(subscriptionId: string, problem: PaymentProblem): Promise<void> {
    const first = await this.donationsRepository.findOne({
      where: { stripeSubscriptionId: subscriptionId, recurringParentId: IsNull() },
      relations: { poi: true, donor: true },
    });
    if (!first || first.recurringCancelledAt) return;
    // 'failed' outranks a card that is only about to run out.
    if (first.paymentProblem === problem || (first.paymentProblem === 'failed' && problem === 'card_expiring')) return;
    first.paymentProblem = problem;
    first.paymentProblemAt = new Date();
    await this.donationsRepository.save(first);
    if (!first.donor) return;
    const poi = first.poi;
    this.notificationsService.fireAndForget(() =>
      this.notificationsService.notifyUserAlways(first.donor!.id, poi.id, (reader) => ({
        title: poi.name,
        body: text(reader.language, problem === 'failed' ? 'monthlyGiftFailed' : 'monthlyGiftCardExpiring', {
          amount: formatEuros(first.amount),
        }),
        data: { screen: 'donations' },
      })),
    );
  }

  /**
   * A Stripe page where the giver puts in a new card for a monthly gift.
   * Stripe keeps the card; we never see it.
   */
  async updateCardUrl(poiId: string, donationId: string, userId: string, returnUrl: string): Promise<{ url: string }> {
    const donation = await this.donationsRepository.findOne({
      where: { id: donationId, poi: { id: poiId }, donor: { id: userId }, recurring: true, recurringParentId: IsNull() },
    });
    if (!donation) throw new NotFoundException('Donation not found');
    if (!donation.stripeSubscriptionId || !this.stripeService.isConfigured) {
      throw new ServiceUnavailableException('Card payments are not set up');
    }
    try {
      return { url: await this.stripeService.cardUpdateUrl(donation.stripeSubscriptionId, returnUrl) };
    } catch (error) {
      this.logger.error(`Stripe card update page failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Could not open the card page');
    }
  }

  // ---- The treasurer's files ----

  /**
   * Every completed gift of a year, one row each, for the community's
   * accountant: when, how much, infunion's share, what for, and who.
   */
  async giftsCsv(poiId: string, year: number): Promise<string> {
    const gifts = await this.donationsRepository.find({
      where: {
        poi: { id: poiId },
        status: DonationStatus.COMPLETED,
        createdAt: And(MoreThanOrEqual(new Date(year, 0, 1)), LessThan(new Date(year + 1, 0, 1))),
      },
      relations: { campaign: true },
      order: { createdAt: 'ASC' },
    });
    return giftsCsv(gifts);
  }

  /**
   * The year's modelo 182 file. Givers are the ones who asked for a
   * receipt (the only ones whose NIF we have); whether each one is
   * "recurrent" comes from what they gave the three years before.
   */
  async modelo182(poiId: string, year: number) {
    const poi = await this.poisService.findOne(poiId);
    if (poi.taxScheme === TaxScheme.NONE) {
      throw new BadRequestException('This community’s gifts give no tax deduction');
    }
    if (!poi.legalTaxId || !poi.legalName) {
      throw new BadRequestException('Fill in the community’s legal name and NIF first');
    }
    const donors = await this.receiptDonors(poiId, year);
    const earlier = await Promise.all([1, 2, 3].map((back) => this.receiptDonors(poiId, year - back)));
    const totalsBack = earlier.map((list) => new Map(list.map((donor) => [donor.key, donor.total])));
    return modelo182(
      {
        year,
        nif: poi.legalTaxId,
        name: poi.legalName,
        scheme: poi.taxScheme,
        phone: poi.legalPhone ?? null,
        contactName: poi.receiptSignatory?.split(',')[0] ?? null,
      },
      donors.map((donor) => ({
        name: donor.name,
        taxId: donor.taxId,
        postalCode: donor.postalCode,
        total: donor.total,
        recurrent: isRecurrentGiver({
          yearMinus1: totalsBack[0].get(donor.key) ?? 0,
          yearMinus2: totalsBack[1].get(donor.key) ?? 0,
          yearMinus3: totalsBack[2].get(donor.key) ?? 0,
        }),
      })),
    );
  }

  /**
   * What the app needs for a signed-in giver's "what it really costs you"
   * line: what they already gave here this year, and whether they count
   * as recurrent. A giver signed out gets the plain estimate.
   */
  async myTaxContext(poiId: string, userId: string): Promise<{ givenThisYear: number; recurrent: boolean }> {
    const year = new Date().getFullYear();
    const totals = await Promise.all(
      [0, 1, 2, 3].map(async (back) => {
        const gifts = await this.donationsRepository.find({
          where: {
            poi: { id: poiId },
            donor: { id: userId },
            status: DonationStatus.COMPLETED,
            createdAt: And(MoreThanOrEqual(new Date(year - back, 0, 1)), LessThan(new Date(year - back + 1, 0, 1))),
          },
        });
        return round2(gifts.reduce((sum, gift) => sum + gift.amount, 0));
      }),
    );
    return {
      givenThisYear: totals[0],
      recurrent: isRecurrentGiver({ yearMinus1: totals[1], yearMinus2: totals[2], yearMinus3: totals[3] }),
    };
  }

  async findBySessionId(sessionId: string): Promise<Donation | null> {
    return this.donationsRepository.findOne({ where: { stripeSessionId: sessionId } });
  }

  findForPoi(poiId: string, limit = 20): Promise<Donation[]> {
    return this.donationsRepository.find({
      where: { poi: { id: poiId }, status: DonationStatus.COMPLETED },
      relations: { campaign: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /** For the Mass intentions module: the offerings behind its intentions. */
  findByIds(ids: string[]): Promise<Donation[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.donationsRepository.find({ where: { id: In(ids) } });
  }

  async getStats(poiId: string): Promise<DonationStats> {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = addMonths(thisMonthStart, -1);
    const thisWeekStart = startOfWeek(now);
    const lastWeekStart = addDays(thisWeekStart, -7);

    // One query covers every window below: it's the earliest boundary we
    // need (last month, which always starts before last week).
    const rangeStart = lastMonthStart < lastWeekStart ? lastMonthStart : lastWeekStart;
    // Abandoned checkouts stay PENDING forever, so the parish's totals only
    // ever count gifts that actually went through.
    const donations = await this.donationsRepository.find({
      where: {
        poi: { id: poiId },
        status: DonationStatus.COMPLETED,
        createdAt: MoreThanOrEqual(rangeStart),
      },
    });

    const sumInRange = (from: Date, to: Date): PeriodTotal => {
      let total = 0;
      let count = 0;
      for (const donation of donations) {
        if (donation.createdAt >= from && donation.createdAt < to) {
          total += donation.amount;
          count += 1;
        }
      }
      return { total: round2(total), count };
    };

    const dailyMap = new Map<string, PeriodTotal>();
    for (const donation of donations) {
      const key = toDateKey(donation.createdAt);
      const entry = dailyMap.get(key) ?? { total: 0, count: 0 };
      entry.total += donation.amount;
      entry.count += 1;
      dailyMap.set(key, entry);
    }
    const today = startOfDay(now);
    const dailyTotals: DailyTotal[] = [];
    for (let i = CHART_WINDOW_DAYS - 1; i >= 0; i--) {
      const day = addDays(today, -i);
      const key = toDateKey(day);
      const entry = dailyMap.get(key) ?? { total: 0, count: 0 };
      dailyTotals.push({ date: key, total: round2(entry.total), count: entry.count });
    }

    // "Last week"/"last month" are cut off at the same elapsed time as the
    // current, still-in-progress period — comparing a few days of this week
    // against all 7 of last week (or a partial month against a full one)
    // would always read as a decline regardless of the real trend.
    const lastWeekComparableEnd = new Date(lastWeekStart.getTime() + (now.getTime() - thisWeekStart.getTime()));
    const lastMonthComparableEnd = new Date(lastMonthStart.getTime() + (now.getTime() - thisMonthStart.getTime()));

    return {
      dailyTotals,
      thisWeek: sumInRange(thisWeekStart, now),
      lastWeek: sumInRange(lastWeekStart, lastWeekComparableEnd),
      thisMonth: sumInRange(thisMonthStart, now),
      lastMonth: sumInRange(lastMonthStart, lastMonthComparableEnd),
    };
  }
}

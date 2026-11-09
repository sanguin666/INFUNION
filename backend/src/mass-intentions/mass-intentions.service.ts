import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { PoisService } from '../pois/pois.service.js';
import { Event } from '../events/entities/event.entity.js';
import { EventCategory } from '../events/entities/event-kinds.js';
import type { User } from '../users/entities/user.entity.js';
import { DonationsService, type CheckoutResult } from '../donations/donations.service.js';
import { Donation, DonationPurpose, DonationStatus } from '../donations/entities/donation.entity.js';
import { MassIntention, MassIntentionStatus } from './entities/mass-intention.entity.js';
import type {
  CreateMassIntentionDto,
  CreateOfficeMassIntentionDto,
  UpdateMassIntentionDto,
} from './dto/mass-intention.dto.js';

export type MassIntentionView = {
  id: string;
  intention: string;
  requesterName: string;
  requesterContact: string | null;
  celebrationAt: Date | null;
  celebrationTitle: string | null;
  offeringAmount: number | null;
  status: MassIntentionStatus;
  fromOffice: boolean;
  createdAt: Date;
};

function view(row: MassIntention): MassIntentionView {
  return {
    id: row.id,
    intention: row.intention,
    requesterName: row.requesterName,
    requesterContact: row.requesterContact ?? null,
    celebrationAt: row.celebrationAt ?? null,
    celebrationTitle: row.celebrationTitle ?? null,
    offeringAmount: row.offeringAmount ?? null,
    status: row.status,
    fromOffice: row.fromOffice,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class MassIntentionsService {
  constructor(
    @InjectRepository(MassIntention)
    private readonly intentions: Repository<MassIntention>,
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
    private readonly poisService: PoisService,
    private readonly donationsService: DonationsService,
  ) {}

  /** What the app needs before asking: the offering, if the place set one. */
  // paymentsReady false: no payment account yet, so the app asks for no
  // offering at all (payouts-account.ts).
  async settings(poiId: string): Promise<{ offeringAmount: number | null; paymentsReady: boolean }> {
    const poi = await this.poisService.findOne(poiId);
    return { offeringAmount: poi.massIntentionOffering ?? null, paymentsReady: poi.paymentsReady === true };
  }

  async updateSettings(
    poiId: string,
    offeringAmount: number | null,
  ): Promise<{ offeringAmount: number | null; paymentsReady: boolean }> {
    const poi = await this.poisService.update(poiId, { massIntentionOffering: offeringAmount });
    return { offeringAmount: poi.massIntentionOffering ?? null, paymentsReady: poi.paymentsReady === true };
  }

  /**
   * An intention asked for from the app. With an offering to pay it waits
   * on the payment (same Stripe flow as any gift); with none, or in the
   * demo with no Stripe key, it goes straight onto the list.
   */
  async create(
    poiId: string,
    dto: CreateMassIntentionDto,
    returnUrlBase: string,
    userId?: string,
  ): Promise<{ intention: MassIntentionView; checkout: CheckoutResult | null }> {
    const poi = await this.poisService.findOne(poiId);

    let celebrationTitle: string | null = null;
    if (dto.eventId) {
      const event = await this.events.findOne({ where: { id: dto.eventId, poi: { id: poiId } } });
      if (!event || event.category !== EventCategory.MASS) {
        throw new BadRequestException('Choose one of this place’s Masses');
      }
      if (!dto.celebrationAt) throw new BadRequestException('Say which day');
      celebrationTitle = event.title;
    }

    // No payment account set up yet (payouts-account.ts): the intention is
    // still taken, with nothing to pay in the app.
    const amount = poi.paymentsReady ? (poi.massIntentionOffering ?? dto.offeringAmount ?? 0) : 0;

    let checkout: CheckoutResult | null = null;
    if (amount > 0) {
      checkout = await this.donationsService.startCheckout(
        poiId,
        { amount, donorName: dto.requesterName },
        returnUrlBase,
        { donorUserId: userId, purpose: DonationPurpose.MASS_INTENTION },
      );
    }

    const intention = await this.intentions.save(
      this.intentions.create({
        poi,
        intention: dto.intention,
        requesterName: dto.requesterName,
        requesterContact: dto.requesterContact ?? null,
        requester: userId ? ({ id: userId } as User) : null,
        celebrationAt: dto.celebrationAt ? new Date(dto.celebrationAt) : null,
        eventId: dto.eventId ?? null,
        celebrationTitle,
        offeringAmount: amount > 0 ? amount : null,
        donation: checkout ? ({ id: checkout.donationId } as Donation) : null,
        status: checkout?.mode === 'stripe' ? MassIntentionStatus.PENDING_PAYMENT : MassIntentionStatus.CONFIRMED,
      }),
    );
    return { intention: view(intention), checkout };
  }

  /** The app polls this while the offering is being paid on Stripe. */
  async status(poiId: string, id: string): Promise<{ status: MassIntentionStatus }> {
    const intention = await this.intentions.findOne({
      where: { id, poi: { id: poiId } },
      relations: { donation: true },
    });
    if (!intention) throw new NotFoundException('Intention not found');
    if (intention.status === MassIntentionStatus.PENDING_PAYMENT && intention.donation) {
      await this.donationsService.refreshFromStripe(intention.donation);
      await this.settle(intention);
    }
    return { status: intention.status };
  }

  /** A signed-in member's own intentions here, newest first. */
  async listMine(poiId: string, userId: string): Promise<MassIntentionView[]> {
    const rows = await this.intentions.find({
      where: {
        poi: { id: poiId },
        requester: { id: userId },
        status: Not(MassIntentionStatus.PENDING_PAYMENT),
      },
      order: { createdAt: 'DESC' },
    });
    return rows.map(view);
  }

  /**
   * The office's register. By default what is still to be said
   * (confirmed); `all` adds the celebrated and cancelled ones. An
   * intention whose payment never finished is never listed.
   */
  async listForStaff(poiId: string, filter: 'upcoming' | 'all' = 'upcoming'): Promise<MassIntentionView[]> {
    await this.settlePending(poiId);
    const rows = await this.intentions.find({
      where: {
        poi: { id: poiId },
        status:
          filter === 'all'
            ? Not(MassIntentionStatus.PENDING_PAYMENT)
            : MassIntentionStatus.CONFIRMED,
      },
      order: { celebrationAt: { direction: 'ASC', nulls: 'FIRST' }, createdAt: 'ASC' },
    });
    return rows.map(view);
  }

  async createAtOffice(poiId: string, dto: CreateOfficeMassIntentionDto): Promise<MassIntentionView> {
    const poi = await this.poisService.findOne(poiId);
    const intention = await this.intentions.save(
      this.intentions.create({
        poi,
        intention: dto.intention,
        requesterName: dto.requesterName,
        requesterContact: dto.requesterContact ?? null,
        celebrationAt: dto.celebrationAt ? new Date(dto.celebrationAt) : null,
        celebrationTitle: dto.celebrationTitle ?? null,
        offeringAmount: dto.offeringAmount ?? null,
        status: MassIntentionStatus.CONFIRMED,
        fromOffice: true,
      }),
    );
    return view(intention);
  }

  async update(poiId: string, id: string, dto: UpdateMassIntentionDto): Promise<MassIntentionView> {
    const intention = await this.intentions.findOne({ where: { id, poi: { id: poiId } } });
    if (!intention) throw new NotFoundException('Intention not found');
    if (dto.status !== undefined) intention.status = dto.status;
    if (dto.celebrationAt !== undefined) {
      intention.celebrationAt = dto.celebrationAt ? new Date(dto.celebrationAt) : null;
    }
    if (dto.celebrationTitle !== undefined) intention.celebrationTitle = dto.celebrationTitle;
    await this.intentions.save(intention);
    return view(intention);
  }

  /**
   * Catches up intentions whose payment finished while nobody was polling
   * (the payer closed the app; the webhook completed the gift).
   */
  private async settlePending(poiId: string): Promise<void> {
    const pending = await this.intentions.find({
      where: { poi: { id: poiId }, status: MassIntentionStatus.PENDING_PAYMENT },
      relations: { donation: true },
    });
    for (const intention of pending) {
      await this.settle(intention);
    }
  }

  private async settle(intention: MassIntention): Promise<void> {
    const donationStatus = intention.donation?.status;
    if (donationStatus === DonationStatus.COMPLETED) {
      intention.status = MassIntentionStatus.CONFIRMED;
    } else if (donationStatus === DonationStatus.FAILED || !intention.donation) {
      intention.status = MassIntentionStatus.CANCELLED;
    } else {
      return;
    }
    await this.intentions.update(intention.id, { status: intention.status });
  }
}

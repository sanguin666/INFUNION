import { randomInt } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { PaymentLink } from './entities/payment-link.entity.js';
import { DonationCampaign } from './entities/donation-campaign.entity.js';
import { Donation, DonationStatus } from './entities/donation.entity.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { Language } from '../common/enums/language.enum.js';
import type { CreatePaymentLinkDto, UpdatePaymentLinkDto } from './dto/payment-link.dto.js';

// No 0/O, 1/I/L: a code read off a poster is typed right the first time.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

// The community's own always-on link, named in its language.
const DEFAULT_TITLES: Record<Language, string> = {
  [Language.EN]: 'Contribute to {name}',
  [Language.ES]: 'Contribuir a {name}',
  [Language.FR]: 'Contribuer à {name}',
  [Language.VA]: 'Contribuir a {name}',
  [Language.CA]: 'Contribuir a {name}',
  [Language.GL]: 'Contribuír a {name}',
  [Language.PT]: 'Contribuir para {name}',
};

export type PaymentLinkView = {
  id: string;
  code: string;
  title: string;
  campaignId: string | null;
  campaignTitle: string | null;
  amount: number | null;
  askName: boolean;
  endsOn: string | null;
  isDefault: boolean;
  paidCount: number;
  paidTotal: number;
  createdAt: Date;
};

export function newCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** Whether a link still takes payments on the given day (YYYY-MM-DD, Madrid). */
export function linkOpen(link: Pick<PaymentLink, 'archivedAt' | 'endsOn'>, today: string): boolean {
  if (link.archivedAt) return false;
  return !link.endsOn || link.endsOn >= today;
}

export function todayInMadrid(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(now);
}

@Injectable()
export class PaymentLinksService {
  constructor(
    @InjectRepository(PaymentLink) private readonly links: Repository<PaymentLink>,
    @InjectRepository(DonationCampaign) private readonly campaigns: Repository<DonationCampaign>,
    @InjectRepository(Donation) private readonly donations: Repository<Donation>,
    @InjectRepository(Poi) private readonly pois: Repository<Poi>,
  ) {}

  /** The community's links, its own "Contribute" link first (made on first look). */
  async list(poiId: string): Promise<PaymentLinkView[]> {
    await this.ensureDefault(poiId);
    const links = await this.links.find({
      where: { poi: { id: poiId }, archivedAt: IsNull() },
      relations: { campaign: true },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
    const totals = await this.totals(links.map((l) => l.id));
    return links.map((l) => this.view(l, totals.get(l.id)));
  }

  async create(poiId: string, dto: CreatePaymentLinkDto): Promise<PaymentLinkView> {
    const campaign = await this.campaignFor(poiId, dto.campaignId);
    const link = this.links.create({
      poi: { id: poiId } as Poi,
      code: await this.freeCode(),
      title: dto.title.trim(),
      campaign,
      amount: dto.amount ?? null,
      askName: dto.askName ?? true,
      endsOn: dto.endsOn ?? null,
    });
    const saved = await this.links.save(link);
    return this.view(saved, undefined);
  }

  async update(poiId: string, id: string, dto: UpdatePaymentLinkDto): Promise<PaymentLinkView> {
    const link = await this.find(poiId, id);
    if (dto.title !== undefined) link.title = dto.title.trim();
    if (dto.campaignId !== undefined) link.campaign = await this.campaignFor(poiId, dto.campaignId);
    if (dto.amount !== undefined) link.amount = dto.amount;
    if (dto.askName !== undefined) link.askName = dto.askName;
    if (dto.endsOn !== undefined) link.endsOn = dto.endsOn;
    const saved = await this.links.save(link);
    const totals = await this.totals([saved.id]);
    return this.view(saved, totals.get(saved.id));
  }

  /** Removes a link: it stops taking payments, its gifts stay. */
  async archive(poiId: string, id: string): Promise<void> {
    const link = await this.find(poiId, id);
    if (link.isDefault) throw new BadRequestException('The community link cannot be removed');
    link.archivedAt = new Date();
    await this.links.save(link);
  }

  /** The public side: a link by its code, with its community and project. */
  async findByCode(code: string): Promise<PaymentLink | null> {
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(clean)) return null;
    return this.links.findOne({ where: { code: clean }, relations: { poi: true, campaign: true } });
  }

  /** The community's own "Contribute" link, made the first time it is needed. */
  async ensureDefault(poiId: string): Promise<PaymentLink> {
    const existing = await this.links.findOne({ where: { poi: { id: poiId }, isDefault: true }, relations: { poi: true, campaign: true } });
    if (existing) return existing;
    const poi = await this.pois.findOne({ where: { id: poiId } });
    if (!poi) throw new NotFoundException('Community not found');
    const title = (DEFAULT_TITLES[poi.language] ?? DEFAULT_TITLES[Language.EN]).replace('{name}', poi.name).slice(0, 120);
    const link = this.links.create({ poi, code: await this.freeCode(), title, isDefault: true, askName: true });
    return this.links.save(link);
  }

  /** The named links' titles (not the community's own), for the contributions list. */
  async namedTitles(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const links = await this.links.find({ where: { id: In(unique), isDefault: false } });
    return new Map(links.map((l) => [l.id, l.title]));
  }

  private async find(poiId: string, id: string): Promise<PaymentLink> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException('Payment link not found');
    const link = await this.links.findOne({
      where: { id, poi: { id: poiId }, archivedAt: IsNull() },
      relations: { campaign: true },
    });
    if (!link) throw new NotFoundException('Payment link not found');
    return link;
  }

  private async campaignFor(poiId: string, campaignId: string | null | undefined): Promise<DonationCampaign | null> {
    if (!campaignId) return null;
    const campaign = await this.campaigns.findOne({ where: { id: campaignId, poi: { id: poiId } } });
    if (!campaign) throw new BadRequestException('Project not found');
    return campaign;
  }

  private async freeCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = newCode();
      if (!(await this.links.exists({ where: { code } }))) return code;
    }
    throw new Error('Could not find a free payment link code');
  }

  private async totals(ids: string[]): Promise<Map<string, { count: number; total: number }>> {
    const result = new Map<string, { count: number; total: number }>();
    if (ids.length === 0) return result;
    const rows = await this.donations
      .createQueryBuilder('d')
      .select('d.payment_link_id', 'id')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(d.amount), 0)', 'total')
      .where('d.payment_link_id IN (:...ids)', { ids })
      .andWhere('d.status = :status', { status: DonationStatus.COMPLETED })
      .groupBy('d.payment_link_id')
      .getRawMany<{ id: string; count: string; total: string }>();
    for (const row of rows) result.set(row.id, { count: Number(row.count), total: Number.parseFloat(row.total) });
    return result;
  }

  private view(link: PaymentLink, totals: { count: number; total: number } | undefined): PaymentLinkView {
    return {
      id: link.id,
      code: link.code,
      title: link.title,
      campaignId: link.campaign?.id ?? null,
      campaignTitle: link.campaign?.title ?? null,
      amount: link.amount ?? null,
      askName: link.askName,
      endsOn: link.endsOn ?? null,
      isDefault: link.isDefault,
      paidCount: totals?.count ?? 0,
      paidTotal: totals?.total ?? 0,
      createdAt: link.createdAt,
    };
  }
}

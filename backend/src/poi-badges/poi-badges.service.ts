import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PoiBadge } from './entities/poi-badge.entity.js';
import { BadgeKind } from '../common/enums/badge-kind.enum.js';
import { PoiType } from '../common/enums/poi-type.enum.js';
import { PoisService } from '../pois/pois.service.js';
import { CreateBadgeDto } from './dto/create-badge.dto.js';
import { UpdateBadgeDto } from './dto/update-badge.dto.js';

// What a place starts with before its staff touch anything: the two
// things people most often ring the office to ask. The other automatic
// kinds are there, switched off, for the staff to turn on.
const STARTER_BADGES: { kind: BadgeKind; enabled: boolean }[] = [
  { kind: BadgeKind.NEXT_MASS, enabled: true },
  { kind: BadgeKind.OFFICE_HOURS, enabled: true },
  { kind: BadgeKind.NEXT_CONFESSION, enabled: false },
  { kind: BadgeKind.CAMPAIGN, enabled: false },
];

// Masses and confessions only make sense for a church (Seb, 27 Oct 2026):
// other kinds of place never see these badges, even ones saved before.
const CHURCH_ONLY: BadgeKind[] = [
  BadgeKind.NEXT_MASS,
  BadgeKind.NEXT_CONFESSION,
];

function fitsPlace(kind: BadgeKind, type: PoiType): boolean {
  return type === PoiType.CHURCH || !CHURCH_ONLY.includes(kind);
}

/** Today as YYYY-MM-DD, the form `showUntil` is stored in. */
function today(now: Date): string {
  return now.toISOString().slice(0, 10);
}

@Injectable()
export class PoiBadgesService {
  constructor(
    @InjectRepository(PoiBadge)
    private readonly badgesRepository: Repository<PoiBadge>,
    private readonly poisService: PoisService,
  ) {}

  /**
   * The badges a member's phone should try to show, in order: switched
   * on and not past their last day. The phone drops the automatic ones
   * that have nothing to say (no Mass on the timetable) and keeps the
   * first few of the rest. A place that has never set any up gets the
   * starter set, unsaved, so the dashboard still shows it untouched.
   */
  async findShown(
    poiId: string,
    now = new Date(),
  ): Promise<Partial<PoiBadge>[]> {
    if ((await this.allForPoi(poiId)).length === 0) {
      const { type } = await this.poisService.findOne(poiId);
      return STARTER_BADGES.filter(
        (b) => b.enabled && fitsPlace(b.kind, type),
      ).map((b, position) => ({
        id: `default:${b.kind}`,
        kind: b.kind,
        position,
        enabled: true,
        text: null,
        important: false,
        linkModule: null,
        campaignId: null,
        showUntil: null,
      }));
    }
    return (await this.findForPoi(poiId)).filter(
      (badge) =>
        badge.enabled &&
        (!badge.showUntil || badge.showUntil >= today(now)) &&
        (badge.kind !== BadgeKind.MESSAGE || !!badge.text),
    );
  }

  /** Every badge, for the dashboard. The first look saves the starter set. */
  async findAll(poiId: string): Promise<PoiBadge[]> {
    if ((await this.allForPoi(poiId)).length > 0) return this.findForPoi(poiId);
    const poi = await this.poisService.findOne(poiId);
    await this.badgesRepository.save(
      STARTER_BADGES.filter((b) => fitsPlace(b.kind, poi.type)).map(
        (b, position) => this.badgesRepository.create({ ...b, poi, position }),
      ),
    );
    return this.findForPoi(poiId);
  }

  async create(poiId: string, dto: CreateBadgeDto): Promise<PoiBadge> {
    if (dto.kind === BadgeKind.MESSAGE && !dto.text) {
      throw new BadRequestException('A message badge needs its text');
    }
    // Saving the starter set first keeps it: otherwise the place's first
    // message would replace the badges it was already showing.
    const existing = await this.findAll(poiId);
    const poi = await this.poisService.findOne(poiId);
    if (!fitsPlace(dto.kind, poi.type)) {
      throw new BadRequestException('This badge is only for churches');
    }
    const badge = this.badgesRepository.create({
      ...dto,
      poi,
      position: Math.max(existing.length, (await this.allForPoi(poiId)).length),
    });
    return this.badgesRepository.save(badge);
  }

  async update(
    poiId: string,
    id: string,
    dto: UpdateBadgeDto,
  ): Promise<PoiBadge> {
    const badge = await this.findOneForPoi(poiId, id);
    Object.assign(badge, dto);
    if (badge.kind === BadgeKind.MESSAGE && !badge.text) {
      throw new BadRequestException('A message badge needs its text');
    }
    return this.badgesRepository.save(badge);
  }

  async remove(poiId: string, id: string): Promise<void> {
    const badge = await this.findOneForPoi(poiId, id);
    await this.badgesRepository.remove(badge);
    await this.persistOrder(await this.allForPoi(poiId));
  }

  /** Rewrites the order from a list naming every badge of the place once. */
  async reorder(poiId: string, ids: string[]): Promise<PoiBadge[]> {
    const badges = await this.badgesRepository.find({
      where: { id: In(ids), poi: { id: poiId } },
    });
    const visible = await this.findForPoi(poiId);
    if (badges.length !== ids.length || badges.length !== visible.length) {
      throw new BadRequestException(
        'Reorder must list every badge of this place exactly once',
      );
    }
    const byId = new Map(badges.map((badge) => [badge.id, badge]));
    // Badges this kind of place doesn't show keep their place at the end.
    const hidden = (await this.allForPoi(poiId)).filter(
      (badge) => !byId.has(badge.id),
    );
    await this.persistOrder([...ids.map((id) => byId.get(id)!), ...hidden]);
    return this.findForPoi(poiId);
  }

  /** The place's badges that fit its kind, in order. */
  private async findForPoi(poiId: string): Promise<PoiBadge[]> {
    const [{ type }, all] = await Promise.all([
      this.poisService.findOne(poiId),
      this.allForPoi(poiId),
    ]);
    return all.filter((badge) => fitsPlace(badge.kind, type));
  }

  private allForPoi(poiId: string): Promise<PoiBadge[]> {
    return this.badgesRepository.find({
      where: { poi: { id: poiId } },
      order: { position: 'ASC' },
    });
  }

  private async persistOrder(ordered: PoiBadge[]): Promise<void> {
    ordered.forEach((badge, index) => {
      badge.position = index;
    });
    if (ordered.length > 0) await this.badgesRepository.save(ordered);
  }

  private async findOneForPoi(poiId: string, id: string): Promise<PoiBadge> {
    const badge = await this.badgesRepository.findOne({
      where: { id, poi: { id: poiId } },
    });
    if (!badge) throw new NotFoundException(`Badge ${id} not found`);
    return badge;
  }
}

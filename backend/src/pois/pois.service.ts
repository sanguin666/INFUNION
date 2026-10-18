import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Poi } from './entities/poi.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { MemberRole } from '../common/enums/member-role.enum.js';
import { CreatePoiDto } from './dto/create-poi.dto.js';
import { UpdatePoiDto } from './dto/update-poi.dto.js';

@Injectable()
export class PoisService {
  constructor(
    @InjectRepository(Poi)
    private readonly poisRepository: Repository<Poi>,
    // The membership table directly, rather than UserPoisService: that
    // service depends on this one, so injecting it would make the two
    // modules circular. See auth/auth-guards.module.ts for the same reason.
    @InjectRepository(UserPoi)
    private readonly membershipRepository: Repository<UserPoi>,
  ) {}

  create(createPoiDto: CreatePoiDto): Promise<Poi> {
    const poi = this.poisRepository.create({
      ...createPoiDto,
      // Unique token used to generate the onboarding flyer's QR code.
      qrCodeToken: randomUUID(),
    });
    return this.poisRepository.save(poi);
  }

  /**
   * Creates a place and makes the creator its admin in one go, so a new
   * parish is manageable from the moment it exists. Without this the only
   * way to get an admin onto a place would be editing the database by hand.
   */
  async createOwnedBy(userId: string, createPoiDto: CreatePoiDto): Promise<Poi> {
    const poi = await this.create(createPoiDto);
    await this.membershipRepository.save(
      this.membershipRepository.create({
        user: { id: userId },
        poi: { id: poi.id },
        role: MemberRole.ADMIN,
      }),
    );
    return poi;
  }

  // The public directory: a suspended community is left out of it.
  findAll(): Promise<Poi[]> {
    return this.poisRepository.find({ where: { suspendedAt: IsNull() } });
  }

  async findOne(id: string): Promise<Poi> {
    const poi = await this.poisRepository.findOne({ where: { id } });
    if (!poi) {
      throw new NotFoundException(`POI ${id} not found`);
    }
    return poi;
  }

  async findByQrCodeToken(qrCodeToken: string): Promise<Poi> {
    const poi = await this.poisRepository.findOne({
      where: { qrCodeToken },
    });
    // Nobody joins a suspended community: its flyer reads as unknown.
    if (!poi || poi.suspendedAt) {
      throw new NotFoundException('Unknown QR code');
    }
    return poi;
  }

  // Accepts any partial update to the entity's own fields — not just
  // UpdatePoiDto — so the separate admin-gated endpoints in
  // PoiSettingsController (language, profile) can reuse this too.
  async update(id: string, updatePoiDto: UpdatePoiDto | Partial<Poi>): Promise<Poi> {
    const poi = await this.findOne(id);
    Object.assign(poi, updatePoiDto);
    return this.poisRepository.save(poi);
  }

  async remove(id: string): Promise<void> {
    const poi = await this.findOne(id);
    await this.poisRepository.remove(poi);
  }
}

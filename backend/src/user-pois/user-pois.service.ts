import { ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPoi } from './entities/user-poi.entity.js';
import { UsersService } from '../users/users.service.js';
import { PoisService } from '../pois/pois.service.js';
import { JoinPoiDto } from './dto/join-poi.dto.js';
import { MemberRole } from '../common/enums/member-role.enum.js';
import type { Poi } from '../pois/entities/poi.entity.js';
import { PoiType } from '../common/enums/poi-type.enum.js';

/** What the app looks for to ask the church question and try again. */
export const RELIGIOUS_CONSENT_REQUIRED = 'RELIGIOUS_CONSENT_REQUIRED';

@Injectable()
export class UserPoisService {
  constructor(
    @InjectRepository(UserPoi)
    private readonly membershipRepository: Repository<UserPoi>,
    private readonly usersService: UsersService,
    private readonly poisService: PoisService,
  ) {}

  /**
   * Joining a church records religious belief, so it needs the person's
   * explicit consent (GDPR art. 9.2.a). Without it the answer is 428 with
   * RELIGIOUS_CONSENT_REQUIRED, and the app asks and sends it again. A
   * membership from before the question is asked the same way the next
   * time the app opens the place; the office's own accounts never are.
   */
  async join(userId: string, dto: JoinPoiDto): Promise<UserPoi> {
    const user = await this.usersService.findOne(userId);
    const poi = await this.poisService.findByQrCodeToken(dto.qrCodeToken);
    const needsConsent = poi.type === PoiType.CHURCH;

    const existing = await this.membershipRepository.findOne({
      where: { user: { id: user.id }, poi: { id: poi.id } },
    });
    if (existing) {
      if (needsConsent && existing.role !== MemberRole.ADMIN && !existing.religiousConsentAt) {
        if (!dto.religiousConsent) throw religiousConsentRequired();
        existing.religiousConsentAt = new Date();
        await this.membershipRepository.save(existing);
      }
      throw new ConflictException('This user already belongs to this POI');
    }
    if (needsConsent && !dto.religiousConsent) throw religiousConsentRequired();

    const membership = this.membershipRepository.create({
      user,
      poi,
      religiousConsentAt: needsConsent ? new Date() : null,
    });
    return this.membershipRepository.save(membership);
  }

  // The membership someone already has for the place behind a QR token —
  // what "join" should hand back when they're a member already.
  async findMembership(userId: string, qrCodeToken: string): Promise<UserPoi | null> {
    const poi = await this.poisService.findByQrCodeToken(qrCodeToken);
    return this.membershipRepository.findOne({
      where: { user: { id: userId }, poi: { id: poi.id } },
      relations: { poi: true },
    });
  }

  findPoisForUser(userId: string): Promise<UserPoi[]> {
    return this.membershipRepository.find({
      where: { user: { id: userId } },
      relations: { poi: true },
    });
  }

  findMembersOfPoi(poiId: string): Promise<UserPoi[]> {
    return this.membershipRepository.find({
      where: { poi: { id: poiId } },
      relations: { user: true },
    });
  }

  async leave(userId: string, poiId: string): Promise<void> {
    await this.membershipRepository.delete({
      user: { id: userId },
      poi: { id: poiId },
    });
  }

  // Used by the admin dashboard: which POIs can this user manage, and are
  // they allowed to manage this specific one?
  async findAdminPoisForUser(userId: string): Promise<Poi[]> {
    const memberships = await this.membershipRepository.find({
      where: { user: { id: userId }, role: MemberRole.ADMIN },
      relations: { poi: true },
    });
    return memberships.map((m) => m.poi);
  }

  async isAdminOfPoi(userId: string, poiId: string): Promise<boolean> {
    const membership = await this.membershipRepository.findOne({
      where: { user: { id: userId }, poi: { id: poiId }, role: MemberRole.ADMIN },
    });
    return membership !== null;
  }
}

function religiousConsentRequired(): HttpException {
  return new HttpException(
    {
      statusCode: HttpStatus.PRECONDITION_REQUIRED,
      code: RELIGIOUS_CONSENT_REQUIRED,
      message: 'Following a church records your religious belief. Agree to it to join.',
    },
    HttpStatus.PRECONDITION_REQUIRED,
  );
}

import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPoi } from '../../user-pois/entities/user-poi.entity.js';
import { MemberRole } from '../../common/enums/member-role.enum.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';
import { SuperadminAccess } from '../superadmin-access.service.js';

// Must run after JwtAuthGuard (which sets request.userId). Requires the
// authenticated user to be an ADMIN member of the POI named by the route's
// `:poiId` param — the same param every POI-scoped controller already uses.
// The superadmin passes too, with a superadmin token; a suspended
// community's own admins don't.
//
// Queries the `user_pois` table directly rather than going through
// UserPoisService: that service depends on PoisService and UsersService, so
// injecting it here would make every module that guards a route import the
// modules it is guarding. See auth-guards.module.ts.
@Injectable()
export class PoiAdminGuard implements CanActivate {
  constructor(
    @InjectRepository(UserPoi)
    private readonly membershipRepository: Repository<UserPoi>,
    private readonly access: SuperadminAccess,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const poiId = request.params.poiId;
    if (typeof poiId !== 'string') {
      throw new BadRequestException('Missing poiId route param');
    }
    const membership = await this.membershipRepository.findOne({
      where: {
        user: { id: request.userId },
        poi: { id: poiId },
        role: MemberRole.ADMIN,
      },
      relations: { poi: true },
    });
    if (membership) {
      if (membership.poi.suspendedAt) throw new ForbiddenException('community_suspended');
      return true;
    }
    // "Ouvrir son admin" from the superadmin: only with a superadmin token
    // (past the six-digit code), never an ordinary one, and every change
    // made that way goes in the Journal.
    const superadmin = await this.access.fromRequest(request);
    if (!superadmin) {
      throw new ForbiddenException('You are not an admin of this POI');
    }
    if (request.method !== 'GET') {
      await this.access.record({
        action: 'superadmin.poi_admin.write',
        actorId: superadmin.userId,
        actorEmail: superadmin.email,
        poiId,
        details: { method: request.method, path: request.originalUrl?.split('?')[0] },
        request,
      });
    }
    return true;
  }
}

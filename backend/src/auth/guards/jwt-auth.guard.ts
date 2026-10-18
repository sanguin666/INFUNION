import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { SuperadminAccess } from '../superadmin-access.service.js';
import { extractBearerToken } from '../bearer.js';

export type AuthenticatedRequest = Request & { userId: string };

// Verifies the `Authorization: Bearer <token>` header and attaches the
// authenticated user's id to the request as `userId`. Used on its own for
// "must be logged in" routes, and combined with PoiAdminGuard for "must be
// an admin of this POI" routes.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly access: SuperadminAccess,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: unknown }>(token);
      // A token that names nobody must not pass as somebody: the guards
      // after this one look people up by this id, and TypeORM drops an
      // undefined condition from a query instead of matching nothing.
      if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('No subject');
      (request as AuthenticatedRequest).userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    this.access.touchLastSeen((request as AuthenticatedRequest).userId);
    return true;
  }
}

/**
 * For routes anyone may call, where being signed in only adds something —
 * a Mass intention or a gift made while signed in is remembered against
 * the account. Sets `userId` when a valid token came with the request and
 * lets the request through either way; a bad token is treated as none.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) return true;
    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: unknown }>(token);
      if (typeof payload.sub === 'string' && payload.sub) {
        (request as AuthenticatedRequest).userId = payload.sub;
      }
    } catch {
      // Signed out as far as this route is concerned.
    }
    return true;
  }
}

export type MaybeAuthenticatedRequest = Request & { userId?: string };

export { extractBearerToken };

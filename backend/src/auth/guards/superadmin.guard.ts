import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SuperadminAccess, type SuperadminIdentity } from '../superadmin-access.service.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';

export type SuperadminRequest = Request & { userId: string; superadmin: SuperadminIdentity };

/**
 * Every /superadmin route but the code check itself: a superadmin token
 * (password, then the six-digit code, under an hour old) and an account
 * that is still the superadmin right now.
 */
@Injectable()
export class SuperadminGuard implements CanActivate {
  constructor(private readonly access: SuperadminAccess) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SuperadminRequest>();
    const identity = await this.access.fromRequest(request);
    if (!identity) throw new UnauthorizedException('superadmin_code_required');
    request.userId = identity.userId;
    request.superadmin = identity;
    return true;
  }
}

/**
 * The step before: signed in with the password (JwtAuthGuard ran first)
 * as the superadmin account, not yet past the code.
 */
@Injectable()
export class SuperadminAccountGuard implements CanActivate {
  constructor(private readonly access: SuperadminAccess) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { superadmin?: SuperadminIdentity }>();
    const identity = await this.access.identify(request.userId);
    if (!identity) throw new ForbiddenException('Not allowed');
    request.superadmin = identity;
    return true;
  }
}

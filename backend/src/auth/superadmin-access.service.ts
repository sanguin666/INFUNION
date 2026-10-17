import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { User } from '../users/entities/user.entity.js';
import { AuditLog } from '../superadmin/entities/audit-log.entity.js';
import { extractBearerToken } from './bearer.js';

/**
 * A superadmin token is a second, short-lived token, minted only after the
 * six-digit code (see SuperadminAuthService). Its audience is what tells
 * it apart: an ordinary admin or member token has none, so it can never
 * pass for one.
 */
export const SUPERADMIN_AUDIENCE = 'ansae-superadmin';
export const SUPERADMIN_SESSION_SECONDS = 60 * 60;
const LAST_SEEN_EVERY_MS = 60 * 60 * 1000;

export type SuperadminIdentity = { userId: string; email: string };

/**
 * Who counts as the superadmin, decided in one place. Both must hold: the
 * account carries is_superadmin, and its email is the one SUPERADMIN_EMAIL
 * names on the server. Neither the database alone nor the variable alone
 * is enough.
 */
@Injectable()
export class SuperadminAccess {
  private readonly lastSeenWrites = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuditLog) private readonly audit: Repository<AuditLog>,
  ) {}

  configuredEmail(): string | null {
    const email = this.config.get<string>('SUPERADMIN_EMAIL')?.trim().toLowerCase();
    return email || null;
  }

  async identify(userId: string): Promise<SuperadminIdentity | null> {
    const wanted = this.configuredEmail();
    if (!wanted) return null;
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, email: true, isSuperadmin: true },
    });
    if (!user?.isSuperadmin || user.email?.toLowerCase() !== wanted) return null;
    return { userId: user.id, email: wanted };
  }

  /** The superadmin behind a request's bearer, if it is a superadmin token. */
  async fromRequest(request: Request): Promise<SuperadminIdentity | null> {
    const token = extractBearerToken(request);
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: unknown }>(token, { audience: SUPERADMIN_AUDIENCE });
      if (typeof payload.sub !== 'string' || !payload.sub) return null;
      return await this.identify(payload.sub);
    } catch {
      return null;
    }
  }

  async record(entry: {
    action: string;
    actorId?: string | null;
    actorEmail?: string | null;
    poiId?: string | null;
    poiName?: string | null;
    details?: Record<string, unknown>;
    request?: Request;
  }): Promise<void> {
    await this.audit.save(this.audit.create({
      action: entry.action,
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      poiId: entry.poiId ?? null,
      poiName: entry.poiName ?? null,
      details: entry.details ?? {},
      ip: entry.request ? clientIp(entry.request) : null,
    }));
  }

  /** "Active over 30 days": written at most once an hour per account. */
  touchLastSeen(userId: string): void {
    const now = Date.now();
    if (now - (this.lastSeenWrites.get(userId) ?? 0) < LAST_SEEN_EVERY_MS) return;
    this.lastSeenWrites.set(userId, now);
    if (this.lastSeenWrites.size > 50_000) this.lastSeenWrites.clear();
    this.users.update(userId, { lastSeenAt: new Date(now) }).catch(() => undefined);
  }
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || request.ip || null;
}

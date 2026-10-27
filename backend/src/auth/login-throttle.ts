import type { DataSource } from 'typeorm';
import { RateLimit } from '../common/rate-limit/rate-limit.entity.js';

/**
 * Counts failed attempts per key (an email, an account) and locks the key
 * for a while after too many: the admin password and the superadmin's
 * six-digit code would otherwise be open to guessing at network speed.
 *
 * Kept in Postgres once the app has started (see useDatabaseThrottles), so
 * every copy of the API shares one count; in memory before that, which is
 * what the unit tests use.
 */
export class LoginThrottle {
  constructor(
    private readonly scope: string,
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly lockMs: number,
  ) {}

  /** Milliseconds left on a lock, or 0. */
  lockedFor(key: string, now = Date.now()): Promise<number> {
    return backend.lockedFor(`${this.scope}:${key}`, now);
  }

  fail(key: string, now = Date.now()): Promise<void> {
    return backend.fail(`${this.scope}:${key}`, now, this);
  }

  succeed(key: string): Promise<void> {
    return backend.succeed(`${this.scope}:${key}`);
  }

  get limits(): Limits {
    return { maxFailures: this.maxFailures, windowMs: this.windowMs, lockMs: this.lockMs };
  }
}

interface Limits {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
}

interface Entry {
  count: number;
  firstAt: number;
  lockedUntil?: number | null;
}

interface ThrottleBackend {
  lockedFor(key: string, now: number): Promise<number>;
  fail(key: string, now: number, throttle: LoginThrottle): Promise<void>;
  succeed(key: string): Promise<void>;
}

/** The entry after one more failure: a new window if the old one ran out. */
export function afterFailure(entry: Entry | undefined, now: number, limits: Limits): Entry {
  const next =
    !entry || now - entry.firstAt > limits.windowMs
      ? { count: 1, firstAt: now, lockedUntil: null as number | null }
      : { ...entry, count: entry.count + 1 };
  if (next.count >= limits.maxFailures) next.lockedUntil = now + limits.lockMs;
  return next;
}

class MemoryBackend implements ThrottleBackend {
  private readonly entries = new Map<string, Entry>();

  async lockedFor(key: string, now: number): Promise<number> {
    const entry = this.entries.get(key);
    if (!entry?.lockedUntil) return 0;
    if (entry.lockedUntil <= now) {
      this.entries.delete(key);
      return 0;
    }
    return entry.lockedUntil - now;
  }

  async fail(key: string, now: number, throttle: LoginThrottle): Promise<void> {
    this.entries.set(key, afterFailure(this.entries.get(key), now, throttle.limits));
    if (this.entries.size > 10_000) {
      for (const [k, e] of this.entries) {
        if ((e.lockedUntil ?? e.firstAt + throttle.limits.windowMs) < now) this.entries.delete(k);
      }
    }
  }

  async succeed(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

class DatabaseBackend implements ThrottleBackend {
  constructor(private readonly dataSource: DataSource) {}

  async lockedFor(key: string, now: number): Promise<number> {
    const row = await this.dataSource.getRepository(RateLimit).findOne({ where: { key } });
    const until = row?.lockedUntil?.getTime() ?? 0;
    return until > now ? until - now : 0;
  }

  async fail(key: string, now: number, throttle: LoginThrottle): Promise<void> {
    // Row-locked, so two copies counting the same key at once both count.
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .insert()
        .into(RateLimit)
        .values({ key, count: 0, firstAt: new Date(now) })
        .orIgnore()
        .execute();
      const row = await manager
        .getRepository(RateLimit)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.key = :key', { key })
        .getOneOrFail();
      const current: Entry | undefined =
        row.count > 0
          ? { count: row.count, firstAt: row.firstAt.getTime(), lockedUntil: row.lockedUntil?.getTime() ?? null }
          : undefined;
      const next = afterFailure(current, now, throttle.limits);
      await manager.getRepository(RateLimit).update(
        { key },
        {
          count: next.count,
          firstAt: new Date(next.firstAt),
          lockedUntil: next.lockedUntil ? new Date(next.lockedUntil) : null,
        },
      );
    });
  }

  async succeed(key: string): Promise<void> {
    await this.dataSource.getRepository(RateLimit).delete({ key });
  }
}

let backend: ThrottleBackend = new MemoryBackend();

/** Called once the database is up: from then on every copy shares counts. */
export function useDatabaseThrottles(dataSource: DataSource): void {
  backend = new DatabaseBackend(dataSource);
}

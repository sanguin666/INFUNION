/**
 * Counts failed attempts per key (an email, an account) and locks the key
 * for a while after too many: the admin password and the superadmin's
 * six-digit code would otherwise be open to guessing at network speed.
 *
 * In memory, so a restart forgets; INFUNION runs one backend replica, and a
 * restart costs an attacker more time than it gives back.
 */
export class LoginThrottle {
  private readonly failures = new Map<string, { count: number; firstAt: number; lockedUntil?: number }>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly lockMs: number,
  ) {}

  /** Milliseconds left on a lock, or 0. */
  lockedFor(key: string, now = Date.now()): number {
    const entry = this.failures.get(key);
    if (!entry?.lockedUntil) return 0;
    if (entry.lockedUntil <= now) {
      this.failures.delete(key);
      return 0;
    }
    return entry.lockedUntil - now;
  }

  fail(key: string, now = Date.now()): void {
    let entry = this.failures.get(key);
    if (!entry || now - entry.firstAt > this.windowMs) {
      entry = { count: 0, firstAt: now };
      this.failures.set(key, entry);
    }
    entry.count += 1;
    if (entry.count >= this.maxFailures) entry.lockedUntil = now + this.lockMs;
    if (this.failures.size > 10_000) this.prune(now);
  }

  succeed(key: string): void {
    this.failures.delete(key);
  }

  private prune(now: number): void {
    for (const [key, entry] of this.failures) {
      if ((entry.lockedUntil ?? entry.firstAt + this.windowMs) < now) this.failures.delete(key);
    }
  }
}

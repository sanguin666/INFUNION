import type { DataSource } from 'typeorm';

/**
 * Runs `task` on one copy of the API at a time, using a Postgres advisory
 * lock named `name`. The API runs as several copies behind the load
 * balancer, and each starts the same timers (reminders every minute, the
 * daily retention sweep): without this, two copies could pick up the same
 * reminder in the same second and send it twice.
 *
 * Returns false, without waiting, when another copy holds the lock: that
 * copy is doing the work. The sweeps themselves stay safe to run again
 * afterwards (they mark what they sent), so this is about two at once,
 * not about once ever.
 *
 * Session-level lock on a connection of its own, released on every path,
 * and dropped by Postgres anyway if the copy holding it dies.
 */
export async function runExclusive(dataSource: DataSource, name: string, task: () => Promise<unknown>): Promise<boolean> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    const [{ locked }] = (await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [name])) as {
      locked: boolean;
    }[];
    if (!locked) return false;
    try {
      await task();
    } finally {
      await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [name]);
    }
    return true;
  } finally {
    await runner.release();
  }
}

import { describe, expect, it } from 'vitest';
import { LoginThrottle } from './login-throttle.js';

describe('LoginThrottle', () => {
  it('locks after the last allowed failure, then lets go', async () => {
    const throttle = new LoginThrottle('test-a', 3, 60_000, 300_000);
    await throttle.fail('a', 0);
    await throttle.fail('a', 1);
    expect(await throttle.lockedFor('a', 2)).toBe(0);
    await throttle.fail('a', 2);
    expect(await throttle.lockedFor('a', 3)).toBeGreaterThan(0);
    expect(await throttle.lockedFor('b', 3)).toBe(0);
    expect(await throttle.lockedFor('a', 300_003)).toBe(0);
  });

  it('forgets failures outside the window, and on success', async () => {
    const throttle = new LoginThrottle('test-b', 2, 1_000, 5_000);
    await throttle.fail('a', 0);
    await throttle.fail('a', 2_000);
    expect(await throttle.lockedFor('a', 2_001)).toBe(0);
    await throttle.fail('a', 2_002);
    await throttle.succeed('a');
    expect(await throttle.lockedFor('a', 2_003)).toBe(0);
  });

  it('keeps scopes apart', async () => {
    const one = new LoginThrottle('test-c', 1, 60_000, 60_000);
    const other = new LoginThrottle('test-d', 1, 60_000, 60_000);
    await one.fail('a', 0);
    expect(await one.lockedFor('a', 1)).toBeGreaterThan(0);
    expect(await other.lockedFor('a', 1)).toBe(0);
  });
});

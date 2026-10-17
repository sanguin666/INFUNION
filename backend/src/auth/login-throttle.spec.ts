import { describe, expect, it } from 'vitest';
import { LoginThrottle } from './login-throttle.js';

describe('LoginThrottle', () => {
  it('locks after the last allowed failure, then lets go', () => {
    const throttle = new LoginThrottle(3, 60_000, 300_000);
    throttle.fail('a', 0);
    throttle.fail('a', 1);
    expect(throttle.lockedFor('a', 2)).toBe(0);
    throttle.fail('a', 2);
    expect(throttle.lockedFor('a', 3)).toBeGreaterThan(0);
    expect(throttle.lockedFor('b', 3)).toBe(0);
    expect(throttle.lockedFor('a', 300_003)).toBe(0);
  });

  it('forgets failures outside the window, and on success', () => {
    const throttle = new LoginThrottle(2, 1_000, 5_000);
    throttle.fail('a', 0);
    throttle.fail('a', 2_000);
    expect(throttle.lockedFor('a', 2_001)).toBe(0);
    throttle.fail('a', 2_002);
    throttle.succeed('a');
    expect(throttle.lockedFor('a', 2_003)).toBe(0);
  });
});

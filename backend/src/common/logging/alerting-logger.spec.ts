import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlertableError } from '../../superadmin/error-alerts.js';
import { AlertingLogger, setErrorSink } from './alerting-logger.js';

describe('AlertingLogger', () => {
  let received: AlertableError[];

  beforeEach(() => {
    received = [];
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    Logger.overrideLogger(new AlertingLogger());
    setErrorSink((error) => received.push(error));
  });

  afterEach(() => {
    setErrorSink(null);
    vi.restoreAllMocks();
  });

  it("passes a job's logged error on, with its context", () => {
    new Logger('PrivacyService').error('Retention sweep failed: deadlock detected');
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      where: 'PrivacyService',
      status: null,
      message: 'Retention sweep failed: deadlock detected',
      detail: null,
    });
  });

  it('keeps the stack when one is given', () => {
    const error = new Error('Stripe is down');
    new Logger('DonationsService').error(error.message, error.stack);
    expect(received[0].detail).toContain('at ');
    new Logger('DonationsService').error(new Error('as an object'));
    expect(received[1].message).toBe('as an object');
    expect(received[1].detail).toContain('at ');
  });

  it('skips warnings, route errors Nest logs, and its own errors', () => {
    new Logger('PrivacyService').warn('Something odd');
    new Logger('ExceptionsHandler').error(new Error('already reported by ErrorTracker'));
    new Logger('ErrorAlerts').error('would loop');
    expect(received).toHaveLength(0);
  });

  it('logs as before when nothing listens', () => {
    setErrorSink(null);
    expect(() => new Logger('X').error('no sink')).not.toThrow();
    expect(received).toHaveLength(0);
  });
});

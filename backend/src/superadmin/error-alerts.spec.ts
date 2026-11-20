import { HttpException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { lastValueFrom, throwError } from 'rxjs';
import type { DataSource } from 'typeorm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmailMessage, EmailSender } from '../auth/email/email-sender.js';
import { errorFingerprint, routePattern, scrub, stackTop, type AlertableError } from './error-alerts.js';
import { ErrorAlerts } from './error-alerts.service.js';
import { ErrorTracker } from './error-tracker.js';

const A = '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b';
const B = '9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b';

describe('error alert helpers', () => {
  it('turns a route into a pattern', () => {
    expect(routePattern(`/pois/${A}/donations`)).toBe('/pois/:id/donations');
    expect(routePattern(`/pois/${B}/donations?page=2`)).toBe('/pois/:id/donations');
    expect(routePattern('/events/42/reminders')).toBe('/events/:n/reminders');
    expect(routePattern('/m/pay/Xk29fPq7')).toBe('/m/pay/:key');
    expect(routePattern('/superadmin/health')).toBe('/superadmin/health');
    expect(routePattern('/c/nuestra-senora-del-carmen')).toBe('/c/nuestra-senora-del-carmen');
  });

  it('scrubs email addresses and tokens', () => {
    const text = scrub('Reset email to ana.garcia@example.org failed (key 4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c)');
    expect(text).not.toContain('ana.garcia');
    expect(text).toContain('<email>');
    expect(text).not.toContain('4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c');
  });

  it('gives the same fingerprint to the same error on another community', () => {
    const one = errorFingerprint({ where: 'PrivacyService', message: `Sweep failed for ${A} after 3 tries` });
    const two = errorFingerprint({ where: 'PrivacyService', message: `Sweep failed for ${B} after 12 tries` });
    const other = errorFingerprint({ where: 'DonationsService', message: `Sweep failed for ${A} after 3 tries` });
    expect(one).toBe(two);
    expect(one).not.toBe(other);
    expect(errorFingerprint({ where: 'Email', message: 'to a@b.org' })).toBe(
      errorFingerprint({ where: 'Email', message: 'to c@d.org' }),
    );
  });

  it('keeps only the top stack frames', () => {
    const error = new Error('boom');
    const top = stackTop(error, 2)!;
    expect(top.split('\n')).toHaveLength(2);
    expect(top).not.toContain('boom');
    expect(stackTop('not an error')).toBeNull();
  });
});

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string, fallback?: string) => values[key] ?? fallback } as unknown as ConfigService;
}

function fakeSender() {
  const sent: EmailMessage[] = [];
  const sender = {
    delivers: true,
    send: vi.fn((message: EmailMessage) => {
      sent.push(message);
      return Promise.resolve();
    }),
  } as unknown as EmailSender & { send: ReturnType<typeof vi.fn> };
  return { sender, sent };
}

// A database that is down: every query fails.
const downDatabase = {
  query: () => Promise.reject(new Error('connect ECONNREFUSED')),
} as unknown as DataSource;

const PRODUCTION = { NODE_ENV: 'production', SUPERADMIN_EMAIL: 'boss@infunion.test' };

describe('ErrorAlerts settings', () => {
  const { sender } = fakeSender();
  const recipient = (values: Record<string, string>) => new ErrorAlerts(config(values), sender, downDatabase).recipient;

  it('is on in production and goes to the superadmin', () => {
    expect(recipient(PRODUCTION)).toBe('boss@infunion.test');
    expect(recipient({ ...PRODUCTION, ERROR_ALERTS_EMAIL: 'alerts@infunion.test' })).toBe('alerts@infunion.test');
  });

  it('is off elsewhere unless ERROR_ALERTS=on, and ERROR_ALERTS=off stops it', () => {
    expect(recipient({ SUPERADMIN_EMAIL: 'boss@infunion.test' })).toBeNull();
    expect(recipient({ SUPERADMIN_EMAIL: 'boss@infunion.test', ERROR_ALERTS: 'on' })).toBe('boss@infunion.test');
    expect(recipient({ ...PRODUCTION, ERROR_ALERTS: 'off' })).toBeNull();
    expect(recipient({ NODE_ENV: 'production' })).toBeNull();
  });
});

describe('ErrorAlerts without a database', () => {
  afterEach(() => vi.useRealTimers());

  it('still emails when the database is down, once per error', async () => {
    const { sender, sent } = fakeSender();
    const alerts = new ErrorAlerts(config(PRODUCTION), sender, downDatabase);
    const error = { at: new Date().toISOString(), where: 'GET /health', status: 503, message: 'Database unreachable' };
    alerts.report(error);
    expect(await alerts.flush()).toBe(1);
    expect(sent[0].to).toBe('boss@infunion.test');
    expect(sent[0].subject).toBe('[infunion production] New error: GET /health');
    alerts.report(error);
    expect(await alerts.flush()).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('sends a minute after the first error, all of the minute in one email', async () => {
    vi.useFakeTimers();
    const { sender, sent } = fakeSender();
    const alerts = new ErrorAlerts(config({ ...PRODUCTION, RAILWAY_ENVIRONMENT_NAME: 'staging' }), sender, downDatabase);
    alerts.report({ at: new Date().toISOString(), where: 'PrivacyService', status: null, message: 'Retention sweep failed: x' });
    await vi.advanceTimersByTimeAsync(30_000);
    alerts.report({ at: new Date().toISOString(), where: 'GET /pois/:id', status: 500, message: 'boom' });
    expect(sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe('[infunion staging] 2 new errors');
  });

  it('does nothing when off', async () => {
    const { sender } = fakeSender();
    const alerts = new ErrorAlerts(config({ ...PRODUCTION, ERROR_ALERTS: 'off' }), sender, downDatabase);
    alerts.report({ at: new Date().toISOString(), where: 'X', status: null, message: 'y' });
    expect(await alerts.flush()).toBe(0);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('never throws, and tries again after a failed send', async () => {
    const { sender, sent } = fakeSender();
    sender.send.mockRejectedValueOnce(new Error('Brevo unreachable'));
    const alerts = new ErrorAlerts(config(PRODUCTION), sender, downDatabase);
    vi.spyOn(alerts['logger'], 'warn').mockImplementation(() => undefined);
    const error = { at: new Date().toISOString(), where: 'X', status: null, message: 'y' };
    alerts.report(error);
    expect(await alerts.flush()).toBe(0);
    alerts.report(error);
    expect(await alerts.flush()).toBe(1);
    expect(sent).toHaveLength(1);
  });
});

describe('ErrorTracker', () => {
  function run(error: unknown, url = `/pois/${A}/donations?amount=5`) {
    const reported: AlertableError[] = [];
    const tracker = new ErrorTracker({ report: (e: AlertableError) => reported.push(e) } as unknown as ErrorAlerts);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ method: 'POST', originalUrl: url }) }),
    } as never;
    const result = lastValueFrom(tracker.intercept(context, { handle: () => throwError(() => error) }));
    return { tracker, reported, result };
  }

  it('reports a 500 with its route pattern and no query string', async () => {
    const { reported, result, tracker } = run(new Error('relation "x" does not exist'));
    await expect(result).rejects.toThrow('relation');
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({ where: 'POST /pois/:id/donations', status: 500, message: 'relation "x" does not exist' });
    expect(reported[0].detail).toContain('at ');
    expect(tracker.recent(1)[0].path).toBe(`/pois/${A}/donations`);
  });

  it("adds a 503's cause, and leaves 4xx alone", async () => {
    const failed = run(
      new ServiceUnavailableException('assistant_failed', { cause: new Error('Your credit balance is too low') }),
    );
    await expect(failed.result).rejects.toBeInstanceOf(HttpException);
    expect(failed.reported[0]).toMatchObject({
      status: 503,
      message: 'assistant_failed: Your credit balance is too low',
    });
    const missing = run(new NotFoundException('Unknown community'));
    await expect(missing.result).rejects.toBeInstanceOf(NotFoundException);
    expect(missing.reported).toHaveLength(0);
  });
});

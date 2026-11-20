import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailMessage, EmailSender } from '../src/auth/email/email-sender.js';
import type { AlertableError } from '../src/superadmin/error-alerts.js';
import { ErrorAlerts } from '../src/superadmin/error-alerts.service.js';
import { createTestApp, resetDatabase } from './harness.js';

// The alerts' memory of what was sent lives in rate_limits, shared by
// every copy of the API: these tests run against the real table.
describe('Error alerts', () => {
  let app: INestApplication;
  let data: DataSource;
  let sent: EmailMessage[];
  let sender: EmailSender;

  const config = {
    get: (key: string, fallback?: string) =>
      ({
        NODE_ENV: 'production',
        SUPERADMIN_EMAIL: 'boss@infunion.test',
        RAILWAY_ENVIRONMENT_NAME: 'production',
        ADMIN_URL: 'https://admin.infunion.test/',
      })[key] ?? fallback,
  } as unknown as ConfigService;

  // A fresh copy of the API: nothing in memory, only the database.
  const copy = () => new ErrorAlerts(config, sender, data);

  const failure = (where: string, message: string): AlertableError => ({
    at: '2026-11-20T14:03:07.000Z',
    where,
    status: 500,
    message,
  });

  beforeAll(async () => {
    app = await createTestApp();
    data = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    sent = [];
    sender = {
      delivers: true,
      send: vi.fn((message: EmailMessage) => {
        sent.push(message);
        return Promise.resolve();
      }),
    } as unknown as EmailSender;
  });

  it('groups the same error on two communities, scrubs it, and links to Technical health', async () => {
    const alerts = copy();
    alerts.report(failure('POST /pois/:id/donations', 'Stripe refused 3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b for ana@example.org'));
    alerts.report(failure('POST /pois/:id/donations', 'Stripe refused 9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b for luis@example.org'));
    alerts.report({ ...failure('PrivacyService', 'Retention sweep failed: deadlock detected'), status: null });
    expect(await alerts.flush()).toBe(2);

    expect(sent).toHaveLength(1);
    const [email] = sent;
    expect(email.to).toBe('boss@infunion.test');
    expect(email.subject).toBe('[infunion production] 2 new errors');
    expect(email.text).toContain('Where: POST /pois/:id/donations');
    expect(email.text).toContain('Times: 2 in a minute');
    expect(email.text).toContain('Where: PrivacyService');
    expect(email.text).toContain('When: 20 Nov 2026, 14:03:07 UTC');
    expect(email.text).toContain('https://admin.infunion.test/superadmin/health');
    expect(email.html).toContain('https://admin.infunion.test/superadmin/health');
    for (const body of [email.text, email.html]) {
      expect(body).not.toContain('ana@example.org');
      expect(body).not.toContain('luis@example.org');
    }
  });

  it('emails the same error once every 6 hours, across every copy of the API', async () => {
    const error = failure('GET /pois/:id/events', 'column "x" does not exist');
    const one = copy();
    one.report(error);
    expect(await one.flush()).toBe(1);

    // Another copy, or this one after a restart: the database remembers.
    const two = copy();
    two.report(error);
    expect(await two.flush()).toBe(0);
    expect(sent).toHaveLength(1);

    await data.query(
      `UPDATE rate_limits SET first_at = now() - interval '7 hours' WHERE key LIKE 'error-alert:%' AND key NOT LIKE 'error-alert:day:%'`,
    );
    const three = copy();
    three.report(error);
    expect(await three.flush()).toBe(1);
    expect(sent).toHaveLength(2);
  });

  it('sends at most 20 alerts a day, and says so in the last one', async () => {
    const day = new Date().toISOString().slice(0, 10);
    await data.query(`INSERT INTO rate_limits (key, count, first_at, updated_at) VALUES ($1, 19, now(), now())`, [
      `error-alert:day:${day}`,
    ]);
    const alerts = copy();
    alerts.report(failure('A', 'first'));
    expect(await alerts.flush()).toBe(1);
    expect(sent[0].text).toContain('This is the last alert today (20)');

    alerts.report(failure('B', 'second'));
    expect(await alerts.flush()).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('forgets a claim when the email could not be sent', async () => {
    vi.mocked(sender.send).mockRejectedValueOnce(new Error('Brevo unreachable'));
    const error = failure('C', 'third');
    const one = copy();
    vi.spyOn(one['logger'], 'warn').mockImplementation(() => undefined);
    one.report(error);
    expect(await one.flush()).toBe(0);

    const two = copy();
    two.report(error);
    expect(await two.flush()).toBe(1);
    expect(sent).toHaveLength(1);
  });
});

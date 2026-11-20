import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { EmailSender } from '../auth/email/email-sender.js';
import {
  emailButton,
  emailDetails,
  emailHeading,
  emailLayout,
  emailParagraph,
  emailQuote,
} from '../common/email/email-layout.js';
import { setErrorSink } from '../common/logging/alerting-logger.js';
import { errorFingerprint, scrub, type AlertableError } from './error-alerts.js';

// Errors that happen together go out in one email, a minute after the first.
const BATCH_MS = 60_000;
// The same error is emailed again only after this long.
const REPEAT_HOURS = 6;
// A storm of different errors still sends at most this many emails a day.
const DAILY_CAP = 20;
// Distinct errors waiting for the next email, at most.
const PENDING_MAX = 50;

type Pending = { error: AlertableError; count: number };

/**
 * Emails the superadmin when the API hits a new error (launch checklist,
 * 20 Nov 2026), so a failure is noticed the day it happens instead of
 * vanishing with the next restart.
 *
 * Two sources report here: ErrorTracker (a 500 on a route) and the app's
 * logger (an error a background job logged). The same error on another
 * community is the same alert (see errorFingerprint), and is emailed at
 * most once every REPEAT_HOURS across every copy of the API: the claim is
 * a row in rate_limits. If the database itself is down, this copy's own
 * memory decides, so "Database unreachable" still gets out.
 *
 * On in production (and staging) by default; ERROR_ALERTS=off stops it,
 * ERROR_ALERTS=on turns it on elsewhere. The emails go to
 * ERROR_ALERTS_EMAIL, else SUPERADMIN_EMAIL. Messages are scrubbed of
 * email addresses and tokens; no request body or query string is ever
 * included.
 */
@Injectable()
export class ErrorAlerts implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ErrorAlerts');
  private readonly pending = new Map<string, Pending>();
  // This copy's own record of what it sent, for when the database can't say.
  private readonly lastSent = new Map<string, number>();
  private sentToday = { day: '', count: 0 };
  private timer: NodeJS.Timeout | null = null;
  private flushing: Promise<number> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly sender: EmailSender,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    if (this.enabled) setErrorSink((error) => this.report(error));
  }

  async onModuleDestroy(): Promise<void> {
    setErrorSink(null);
    await this.flush();
  }

  /** Who gets the alerts, or null when they are off. */
  get recipient(): string | null {
    const setting = (this.config.get<string>('ERROR_ALERTS') ?? '').trim().toLowerCase();
    if (setting === 'off') return null;
    const production = this.config.get<string>('NODE_ENV', 'development') === 'production';
    if (!production && setting !== 'on') return null;
    const to =
      this.config.get<string>('ERROR_ALERTS_EMAIL')?.trim() || this.config.get<string>('SUPERADMIN_EMAIL')?.trim();
    return to || null;
  }

  get enabled(): boolean {
    return this.recipient !== null;
  }

  /** Queues an error for the next email. Never throws. */
  report(error: AlertableError): void {
    if (!this.enabled) return;
    try {
      const fingerprint = errorFingerprint(error);
      const queued = this.pending.get(fingerprint);
      if (queued) {
        queued.count += 1;
      } else if (this.pending.size < PENDING_MAX) {
        this.pending.set(fingerprint, { error, count: 1 });
      }
      if (!this.timer) {
        this.timer = setTimeout(() => void this.flush(), BATCH_MS);
        this.timer.unref();
      }
    } catch {
      // An alert must never become an error of its own.
    }
  }

  /**
   * Sends what is queued: the errors not emailed in the last REPEAT_HOURS,
   * in one email. Returns how many errors the email listed (0 if none was
   * sent). Never throws.
   */
  async flush(): Promise<number> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    // One flush at a time, so two can't both claim the same error.
    while (this.flushing) await this.flushing;
    this.flushing = this.send().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async send(): Promise<number> {
    const batch = [...this.pending.entries()];
    this.pending.clear();
    const to = this.recipient;
    if (batch.length === 0 || !to) return 0;
    const claimed: string[] = [];
    try {
      const fresh: Pending[] = [];
      for (const [fingerprint, item] of batch) {
        if (await this.claim(fingerprint)) {
          claimed.push(fingerprint);
          fresh.push(item);
        }
      }
      if (fresh.length === 0) return 0;
      const sentToday = await this.countEmailToday();
      if (sentToday > DAILY_CAP) return 0;
      await this.sender.send(this.compose(to, fresh, sentToday === DAILY_CAP));
      return fresh.length;
    } catch (error) {
      // warn, not error: an error here would only come back to this service.
      this.logger.warn(`Error alert not sent: ${(error as Error).message}`);
      // Not sent, so not "already emailed": the next occurrence tries again.
      await this.release(claimed);
      return 0;
    }
  }

  private async release(fingerprints: string[]): Promise<void> {
    if (fingerprints.length === 0) return;
    for (const fingerprint of fingerprints) this.lastSent.delete(fingerprint);
    try {
      await this.dataSource.query('DELETE FROM rate_limits WHERE key = ANY($1)', [
        fingerprints.map((fingerprint) => `error-alert:${fingerprint}`),
      ]);
    } catch {
      // The rows expire on their own.
    }
  }

  /** True when this error wasn't emailed in the last REPEAT_HOURS, and is now this copy's to email. */
  private async claim(fingerprint: string): Promise<boolean> {
    const now = Date.now();
    for (const [key, at] of this.lastSent) {
      if (now - at >= REPEAT_HOURS * 3_600_000) this.lastSent.delete(key);
    }
    if (this.lastSent.has(fingerprint)) return false;
    let claimed = true;
    try {
      const rows = (await this.dataSource.query(
        `INSERT INTO rate_limits (key, count, first_at, updated_at) VALUES ($1, 1, now(), now())
         ON CONFLICT (key) DO UPDATE SET count = 1, first_at = now(), updated_at = now()
         WHERE rate_limits.first_at < now() - make_interval(hours => $2)
         RETURNING key`,
        [`error-alert:${fingerprint}`, REPEAT_HOURS],
      )) as unknown[];
      claimed = rows.length > 0;
    } catch {
      // The database is down: this copy's memory alone decides.
    }
    if (claimed) this.lastSent.set(fingerprint, now);
    return claimed;
  }

  /** Counts this email in today's total (UTC) and returns the new total. */
  private async countEmailToday(): Promise<number> {
    const day = new Date().toISOString().slice(0, 10);
    if (this.sentToday.day !== day) this.sentToday = { day, count: 0 };
    this.sentToday.count += 1;
    try {
      const rows = (await this.dataSource.query(
        `INSERT INTO rate_limits (key, count, first_at, updated_at) VALUES ($1, 1, now(), now())
         ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1, updated_at = now()
         RETURNING count`,
        [`error-alert:day:${day}`],
      )) as { count: number }[];
      return Number(rows[0]?.count ?? this.sentToday.count);
    } catch {
      return this.sentToday.count;
    }
  }

  private compose(to: string, errors: Pending[], lastToday: boolean) {
    const environment =
      this.config.get<string>('RAILWAY_ENVIRONMENT_NAME') || this.config.get<string>('NODE_ENV', 'development');
    const version = (this.config.get<string>('RAILWAY_GIT_COMMIT_SHA') ?? '').slice(0, 7);
    const healthUrl = `${this.dashboardUrl()}/superadmin/health`;
    const first = errors[0].error;
    const subject =
      errors.length === 1
        ? `[infunion ${environment}] New error: ${first.where}`.slice(0, 150)
        : `[infunion ${environment}] ${errors.length} new errors`;
    const heading = errors.length === 1 ? 'The API hit a new error' : `The API hit ${errors.length} new errors`;
    const about = `Environment: ${environment}${version ? `, version ${version}` : ''}.`;
    const rules =
      `The same error is emailed at most once every ${REPEAT_HOURS} hours, and at most ${DAILY_CAP} alerts go out a day. ` +
      'Technical health lists every error until the API restarts; Railway keeps the full logs. ' +
      'ERROR_ALERTS=off on the API stops these emails.';
    const last = lastToday ? `This is the last alert today (${DAILY_CAP}). Check Technical health for the rest.` : null;

    const rows = errors.map(({ error, count }) => {
      const details = [
        { label: 'When', value: formatTime(error.at) },
        { label: 'Where', value: error.where },
        ...(error.status ? [{ label: 'Status', value: String(error.status) }] : []),
        { label: 'Message', value: scrub(error.message).slice(0, 500) },
        ...(count > 1 ? [{ label: 'Times', value: `${count} in a minute` }] : []),
      ];
      const detail = error.detail ? scrub(error.detail).slice(0, 1200) : null;
      return { details, detail };
    });

    const html = emailLayout(
      [
        emailHeading(heading),
        ...rows.map(({ details, detail }) => emailDetails(details) + (detail ? emailQuote(detail) : '')),
        emailParagraph(about, { muted: true, small: true }),
        ...(last ? [emailParagraph(last)] : []),
        emailButton('Open Technical health', healthUrl),
        emailParagraph(rules, { muted: true, small: true }),
      ].join(''),
      'en',
    );
    const text = [
      heading,
      '',
      ...rows.flatMap(({ details, detail }) => [
        ...details.map((row) => `${row.label}: ${row.value}`),
        ...(detail ? [detail] : []),
        '',
      ]),
      about,
      ...(last ? [last] : []),
      `Technical health: ${healthUrl}`,
      '',
      rules,
    ].join('\n');
    return { to, subject, text, html };
  }

  /** ADMIN_URL, else the admin origin in CORS_ORIGINS, else production's. */
  private dashboardUrl(): string {
    const configured = this.config.get<string>('ADMIN_URL')?.trim();
    if (configured) return configured.replace(/\/$/, '');
    const fromCors = (this.config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .find((origin) => origin.includes('admin'));
    return (fromCors ?? 'https://infunion-admin.up.railway.app').replace(/\/$/, '');
  }
}

/** "20 Nov 2026, 14:03:07 UTC". */
function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `${day}, ${date.toISOString().slice(11, 19)} UTC`;
}

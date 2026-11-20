import { createHash } from 'node:crypto';

/**
 * What an error alert is about: a server error on a route (a 500 the
 * interceptor saw) or an error a background job logged.
 */
export type AlertableError = {
  at: string;
  // "GET /pois/:id/donations" for a request, the logger's context ("PrivacyService") for a job.
  where: string;
  status: number | null;
  message: string;
  // The first lines of the stack trace, when there is one: code paths only.
  detail?: string | null;
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL = /[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}/gi;

/** Removes what could identify a person (email addresses), and long tokens, from an error's text. */
export function scrub(text: string): string {
  return text.replace(EMAIL, '<email>').replace(/\b[0-9a-f]{24,}\b/gi, '<token>');
}

/**
 * A route as a pattern: ids, numbers and codes become placeholders, so the
 * same failure on two communities is one alert, not two.
 */
export function routePattern(path: string): string {
  return path
    .split('?')[0]
    .split('/')
    .map((part) => {
      if (!part) return part;
      if (UUID.test(part)) {
        UUID.lastIndex = 0;
        return ':id';
      }
      UUID.lastIndex = 0;
      if (/^\d+$/.test(part)) return ':n';
      // Payment link codes, tokens, QR codes: letters and digits mixed.
      if (/^(?=.*\d)[A-Za-z0-9_-]{6,}$/.test(part)) return ':key';
      return part;
    })
    .join('/');
}

/** The first few frames of an error's stack trace (without its message line). */
export function stackTop(error: unknown, frames = 5): string | null {
  if (!(error instanceof Error) || !error.stack) return null;
  const lines = error.stack
    .split('\n')
    .filter((line) => /^\s+at /.test(line))
    .slice(0, frames)
    .map((line) => line.trim());
  return lines.length > 0 ? lines.join('\n') : null;
}

/** The same error, whichever community or record it happened on. */
export function errorFingerprint(error: Pick<AlertableError, 'where' | 'message'>): string {
  const message = scrub(error.message)
    .replace(UUID, ':id')
    .replace(/\d+/g, 'N')
    .slice(0, 200);
  return createHash('sha256').update(`${error.where}\n${message}`).digest('hex').slice(0, 24);
}

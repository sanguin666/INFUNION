import { ConsoleLogger } from '@nestjs/common';
import { stackTop, type AlertableError } from '../../superadmin/error-alerts.js';

type ErrorSink = (error: AlertableError) => void;

let sink: ErrorSink | null = null;

/** Where logged errors go besides the console: ErrorAlerts, once it starts. */
export function setErrorSink(next: ErrorSink | null): void {
  sink = next;
}

// Already reported another way, or would loop back: Nest's handler logs
// the route errors ErrorTracker reports with their route, and ErrorAlerts
// must never alert about itself.
const SKIP_CONTEXTS = new Set(['ExceptionsHandler', 'ErrorAlerts']);

/**
 * The app's logger: Nest's console output, unchanged, plus every
 * logger.error() passed on to the error alerts. That is how a background
 * job's failure (a sweep, a Stripe call) reaches the superadmin's inbox.
 */
export class AlertingLogger extends ConsoleLogger {
  error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message, ...(optionalParams as [string?, string?]));
    if (!sink) return;
    try {
      const context = optionalParams.length > 0 ? optionalParams[optionalParams.length - 1] : undefined;
      const where = typeof context === 'string' && context ? context : 'App';
      if (SKIP_CONTEXTS.has(where)) return;
      const stack = optionalParams.length > 1 ? optionalParams[optionalParams.length - 2] : undefined;
      const text =
        message instanceof Error ? message.message : typeof message === 'string' ? message : JSON.stringify(message);
      sink({
        at: new Date().toISOString(),
        where,
        status: null,
        message: (text ?? '').slice(0, 500),
        detail: typeof stack === 'string' && stack ? stack.split('\n').slice(0, 6).join('\n') : stackTop(message),
      });
    } catch {
      // Logging must never throw.
    }
  }
}

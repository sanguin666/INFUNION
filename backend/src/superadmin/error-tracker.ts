import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, throwError, type Observable } from 'rxjs';
import { ErrorAlerts } from './error-alerts.service.js';
import { routePattern, stackTop } from './error-alerts.js';

export type TrackedError = { at: string; method: string; path: string; status: number; message: string };

const KEEP = 200;

/**
 * Server errors (500s), kept in memory for Technical health: when the last
 * ones happened, on which route, with what message. No request bodies and
 * no query strings, so nothing a member typed ends up here. Each one is
 * also passed to ErrorAlerts, which emails the superadmin about new ones.
 */
@Injectable()
export class ErrorTracker implements NestInterceptor {
  private readonly errors: TrackedError[] = [];

  constructor(private readonly alerts: ErrorAlerts) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        const status = error instanceof HttpException ? error.getStatus() : 500;
        if (status >= 500) {
          const request = context.switchToHttp().getRequest<Request>();
          const tracked: TrackedError = {
            at: new Date().toISOString(),
            method: request?.method ?? '',
            path: (request?.originalUrl ?? '').split('?')[0],
            status,
            message: (error instanceof Error ? error.message : String(error)).slice(0, 300),
          };
          this.errors.push(tracked);
          if (this.errors.length > KEEP) this.errors.splice(0, this.errors.length - KEEP);
          // A 503 such as "assistant_failed" carries the real reason as its cause.
          const cause = error instanceof HttpException && error.cause instanceof Error ? error.cause : null;
          this.alerts.report({
            at: tracked.at,
            where: `${tracked.method} ${routePattern(tracked.path)}`.trim(),
            status,
            message: cause ? `${tracked.message}: ${cause.message}`.slice(0, 500) : tracked.message,
            detail: error instanceof HttpException ? stackTop(cause) : stackTop(error),
          });
        }
        return throwError(() => error);
      }),
    );
  }

  recent(limit = 20): TrackedError[] {
    return this.errors.slice(-limit).reverse();
  }

  countSince(since: Date): number {
    const iso = since.toISOString();
    return this.errors.filter((error) => error.at >= iso).length;
  }
}

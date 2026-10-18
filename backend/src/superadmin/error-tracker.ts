import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, throwError, type Observable } from 'rxjs';

export type TrackedError = { at: string; method: string; path: string; status: number; message: string };

const KEEP = 200;

/**
 * Server errors (500s), kept in memory for Santé technique: when the last
 * ones happened, on which route, with what message. No request bodies and
 * no query strings, so nothing a member typed ends up here.
 */
@Injectable()
export class ErrorTracker implements NestInterceptor {
  private readonly errors: TrackedError[] = [];

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        const status = error instanceof HttpException ? error.getStatus() : 500;
        if (status >= 500) {
          const request = context.switchToHttp().getRequest<Request>();
          this.errors.push({
            at: new Date().toISOString(),
            method: request?.method ?? '',
            path: (request?.originalUrl ?? '').split('?')[0],
            status,
            message: (error instanceof Error ? error.message : String(error)).slice(0, 300),
          });
          if (this.errors.length > KEEP) this.errors.splice(0, this.errors.length - KEEP);
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

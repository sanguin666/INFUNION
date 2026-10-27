import { Global, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { useDatabaseThrottles } from '../../auth/login-throttle.js';

/** Switches the login throttles to the shared table once Postgres is up. */
@Injectable()
class DatabaseThrottles implements OnModuleInit {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    useDatabaseThrottles(this.dataSource);
  }
}

@Global()
@Module({ providers: [DatabaseThrottles] })
export class RateLimitModule {}

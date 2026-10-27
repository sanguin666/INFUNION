import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppService } from './app.service.js';
import { fileStore } from './common/storage/file-store.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * For Railway's health check and an uptime monitor: answers 200 only when
   * this copy can reach its database, so a broken copy is taken out of the
   * load balancer and a deploy that can't connect never goes live. REGION
   * says which regional copy of infunion answered (eu, americas, asia).
   */
  @Get('health')
  async health(): Promise<{ status: 'ok'; region: string; storage: string }> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Database unreachable');
    }
    return { status: 'ok', region: process.env.REGION ?? 'eu', storage: fileStore().kind };
  }
}

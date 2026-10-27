import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { DataSource } from 'typeorm';
import { fileStore, migrateLocalFiles, S3FileStore, UPLOADS_ROOT } from './common/storage/file-store.js';
import { runExclusive } from './common/locks/run-exclusive.js';

/**
 * Who may call the API from a browser.
 *
 * Development allows anything: the app runs from Expo on a phone, from a
 * browser on localhost, and sometimes through an ngrok URL, and pinning
 * that list down would only cost time. Production takes the list from
 * CORS_ORIGINS, and allows nothing cross-origin if it isn't set — the admin
 * dashboard is the only browser client, so a deployment that forgets the
 * variable should break loudly rather than stay open to every site.
 *
 * Note this bounds browsers, not clients in general: the mobile app isn't
 * subject to CORS at all, so this is not what keeps the API safe. The
 * guards are.
 */
function corsOrigins(configService: ConfigService): string[] | boolean {
  const configured = configService.get<string>('CORS_ORIGINS');
  if (configured) {
    return configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
  const isProduction =
    configService.get<string>('NODE_ENV', 'development') === 'production';
  if (isProduction) {
    new Logger('Bootstrap').warn(
      'CORS_ORIGINS is not set: no cross-origin browser requests will be allowed. The admin dashboard needs its URL listed here.',
    );
    return false;
  }
  return true;
}

async function bootstrap() {
  // rawBody keeps the untouched request body around for Stripe's webhook
  // signature check, which is computed over the exact bytes Stripe sent.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  app.enableCors({ origin: corsOrigins(configService) });
  // Railway's proxy (and Cloudflare in front of it) sits between the
  // client and the API: trust it for the client's address and https.
  app.set('trust proxy', true);
  // Lets a deploy or a scale-down finish the requests in flight and close
  // the database pool before the copy goes away.
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  // Serves recorded voice messages etc. — see common/storage/file-store.ts.
  // From disk here; from the bucket, PublicFilesController does it.
  const store = fileStore();
  if (store.kind === 'disk') app.useStaticAssets(UPLOADS_ROOT, { prefix: '/uploads/' });
  await app.listen(process.env.PORT ?? 3000);

  if (store instanceof S3FileStore && configService.get<string>('MIGRATE_LOCAL_FILES') === 'on') {
    copyOldFilesToBucket(app.get(DataSource), store);
  }
}

/**
 * The one-time move from the Railway volume to the bucket, in the
 * background so the API serves meanwhile (files not copied yet are read
 * from the volume). Safe to leave on: later starts find nothing to copy.
 */
function copyOldFilesToBucket(dataSource: DataSource, store: S3FileStore): void {
  const logger = new Logger('FileMigration');
  runExclusive(dataSource, 'migrate-local-files', async () => {
    const copied = await migrateLocalFiles(store);
    logger.log(`Copied ${copied} file(s) from disk to the bucket`);
  }).catch((error: Error) => logger.error(`Copying files to the bucket failed: ${error.message}`));
}
await bootstrap();

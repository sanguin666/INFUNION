import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { ENTITIES } from './config/typeorm.config.js';

// The CLI runs outside Nest, so nothing has read .env for us here.
loadEnv();

/**
 * The DataSource the TypeORM CLI loads, and the only reason it exists —
 * the running app builds its own connection through Nest (see
 * config/typeorm.config.ts, which this shares its entity list with).
 *
 * It points at the compiled output rather than the sources, which is why
 * `npm run migration:generate` builds first.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || undefined,
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'ansae',
  password: process.env.DB_PASSWORD ?? 'ansae',
  database: process.env.DB_NAME ?? 'ansae',
  entities: ENTITIES,
  migrations: ['dist/migrations/*.js'],
});

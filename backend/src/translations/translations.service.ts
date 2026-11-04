import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import {
  ContentTranslation,
  type TranslatableKind,
} from './entities/content-translation.entity.js';
import { ContentLanguage } from './entities/content-language.entity.js';
import { Translator, TRANSLATION_LANGUAGES } from './translator.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { effectivePlan } from '../active-modules/billing-rules.js';
import { PlanTier } from '../common/enums/plan-tier.enum.js';
import { runExclusive } from '../common/locks/run-exclusive.js';

export type TranslationView = {
  id: string;
  sourceLanguage: string;
  alreadyInTarget: boolean;
  fields: Record<string, string>;
};

// Where each kind's words are, and which columns get translated.
const SOURCES: Record<
  TranslatableKind,
  { table: string; columns: string[]; poiJoin?: string; poiColumn?: string }
> = {
  post: { table: 'community_posts', columns: ['message'] },
  comment: {
    table: 'community_comments',
    columns: ['message'],
    poiJoin: 'JOIN community_posts parent ON parent.id = t.post_id',
  },
  prayer: { table: 'prayer_requests', columns: ['message'] },
  announcement: { table: 'announcements', columns: ['title', 'body'] },
  event: { table: 'events', columns: ['title', 'description'] },
  // The home page (Seb, 4 Nov 2026): the team's text blocks, and the
  // community's description shown while it has no page of its own.
  block: { table: 'poi_page_blocks', columns: ['title', 'body'] },
  about: { table: 'pois', columns: ['description'], poiColumn: 't.id' },
};

const HOUR_MS = 60 * 60 * 1000;
// At most this many texts translated at the same time for one request.
const PARALLEL = 4;

/**
 * Automatic translation, Complete plan only (Seb, 4 Nov 2026): a member
 * taps Translate, or has "Translate automatically" on. Each text is
 * translated once per language and kept; teams can't switch it off.
 */
@Injectable()
export class TranslationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TranslationsService.name);
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(ContentTranslation)
    private readonly translations: Repository<ContentTranslation>,
    @InjectRepository(ContentLanguage)
    private readonly languages: Repository<ContentLanguage>,
    @InjectRepository(Poi)
    private readonly pois: Repository<Poi>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly translator: Translator,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    this.sweepTimer = setInterval(() => {
      runExclusive(this.dataSource, 'translations-sweep', () => this.sweep()).catch(
        (error: Error) => this.logger.warn(`Translation sweep failed: ${error.message}`),
      );
    }, HOUR_MS);
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  private async assertAvailable(poiId: string): Promise<void> {
    const poi = await this.pois.findOne({
      where: { id: poiId },
      select: { id: true, plan: true, billingComped: true },
    });
    if (!poi) throw new NotFoundException('Unknown community');
    if (effectivePlan(poi) !== PlanTier.COMPLETE) {
      throw new ForbiddenException('not_in_plan');
    }
    if (!this.translator.enabled) {
      throw new ServiceUnavailableException('translation_off');
    }
  }

  /**
   * The language each text is written in, so the app offers Translate only
   * where it helps. Found once per text (one call for all the new ones)
   * and kept.
   */
  async detect(
    poiId: string,
    kind: TranslatableKind,
    ids: string[],
  ): Promise<Record<string, string>> {
    await this.assertAvailable(poiId);
    const sources = await this.loadSources(poiId, kind, [...new Set(ids)]);
    if (sources.size === 0) return {};
    const known = await this.languages.find({
      where: { kind, targetId: In([...sources.keys()]) },
    });
    const byId = new Map(known.map((k) => [k.targetId, k]));
    const result: Record<string, string> = {};
    const missing: Record<string, string> = {};
    const hashes = new Map<string, string>();
    for (const [id, fields] of sources) {
      const hash = hashOf(fields);
      hashes.set(id, hash);
      const hit = byId.get(id);
      if (hit && hit.sourceHash === hash) result[id] = hit.language;
      else missing[id] = Object.values(fields).join('\n');
    }
    if (Object.keys(missing).length > 0) {
      try {
        const found = await this.translator.detect(missing).catch((error: Error) => this.failed('detect', error));
        const rows = Object.entries(found).map(([id, language]) =>
          this.languages.create({ kind, targetId: id, sourceHash: hashes.get(id)!, language }),
        );
        if (rows.length > 0) await this.languages.upsert(rows, ['kind', 'targetId']);
        Object.assign(result, found);
      } catch (error) {
        this.logger.warn(`Detecting languages failed: ${(error as Error).message}`);
      }
    }
    return result;
  }

  async translate(
    poiId: string,
    kind: TranslatableKind,
    ids: string[],
    language: string,
  ): Promise<TranslationView[]> {
    if (!TRANSLATION_LANGUAGES.includes(language)) {
      throw new BadRequestException('Unknown language');
    }
    await this.assertAvailable(poiId);

    const sources = await this.loadSources(poiId, kind, [...new Set(ids)]);
    if (sources.size === 0) return [];
    const cached = await this.translations.find({
      where: { kind, targetId: In([...sources.keys()]), language },
    });
    const byId = new Map(cached.map((c) => [c.targetId, c]));

    const work = [...sources.entries()];
    const results: TranslationView[] = [];
    for (let i = 0; i < work.length; i += PARALLEL) {
      const batch = work.slice(i, i + PARALLEL);
      const done = await Promise.all(
        batch.map(async ([id, fields]) => {
          const hash = hashOf(fields);
          const hit = byId.get(id);
          if (hit && hit.sourceHash === hash) return view(hit);
          try {
            const translated = await this.translator.translate(fields, language);
            const row = this.translations.create({
              ...(hit ? { id: hit.id } : {}),
              kind,
              targetId: id,
              language,
              sourceLanguage: translated.sourceLanguage,
              sourceHash: hash,
              fields: translated.alreadyInTarget ? null : translated.fields,
            });
            await this.translations.upsert(row, ['kind', 'targetId', 'language']);
            return view(row);
          } catch (error) {
            this.logger.warn(`Translating ${kind} ${id} failed: ${(error as Error).message}`);
            return null;
          }
        }),
      );
      for (const r of done) if (r) results.push(r);
    }
    return results;
  }

  /** Each text's fields, only for this community's items, empty ones left out. */
  private async loadSources(
    poiId: string,
    kind: TranslatableKind,
    ids: string[],
  ): Promise<Map<string, Record<string, string>>> {
    const source = SOURCES[kind];
    const poiColumn = source.poiColumn ?? (source.poiJoin ? 'parent.poi_id' : 't.poi_id');
    const rows: Record<string, string | null>[] = await this.dataSource.query(
      `SELECT t.id, ${source.columns.map((c) => `t."${c}"`).join(', ')}
         FROM "${source.table}" t ${source.poiJoin ?? ''}
        WHERE t.id = ANY($1::uuid[]) AND ${poiColumn} = $2`,
      [ids, poiId],
    );
    const map = new Map<string, Record<string, string>>();
    for (const row of rows) {
      const fields: Record<string, string> = {};
      for (const c of source.columns) {
        const value = row[c];
        if (typeof value === 'string' && value.trim()) fields[c] = value;
      }
      if (Object.keys(fields).length > 0) map.set(row.id as string, fields);
    }
    return map;
  }

  /** A removed text takes its translations with it (members' words, GDPR). */
  // A failed call to Claude is logged (Railway shows it) and answered as
  // 503, so the app keeps the original text.
  private failed(step: string, error: Error): never {
    this.logger.warn(`Translation ${step} failed: ${error.message}`);
    throw new ServiceUnavailableException('translation_failed');
  }

  async sweep(): Promise<void> {
    for (const [kind, source] of Object.entries(SOURCES)) {
      for (const table of ['content_translations', 'content_languages']) {
        await this.dataSource.query(
          `DELETE FROM ${table} ct
            WHERE ct.kind = $1
              AND NOT EXISTS (SELECT 1 FROM "${source.table}" t WHERE t.id = ct.target_id)`,
          [kind],
        );
      }
    }
  }
}

function hashOf(fields: Record<string, string>): string {
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

function view(row: ContentTranslation): TranslationView {
  return {
    id: row.targetId,
    sourceLanguage: row.sourceLanguage,
    alreadyInTarget: row.fields === null,
    fields: row.fields ?? {},
  };
}

import { HttpException, HttpStatus, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AssistantModel, type AssistantTurn } from './assistant-model.js';
import { ADMIN_GUIDE, ADMIN_PAGES } from './admin-guide.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { ActiveModulesService } from '../active-modules/active-modules.service.js';
import { effectivePlan, planIncludes, planOf } from '../active-modules/billing-rules.js';
import { modulesForPlace } from '../active-modules/module-places.js';
import { ModuleType } from '../common/enums/module-type.enum.js';
import { recordAssistantQuestion } from './assistant-questions.js';

// Questions per admin per day (Seb, 6 Nov 2026), across communities.
export const ADMIN_DAILY_QUESTIONS = 30;

// The dashboard page of each module.
const MODULE_PAGE: Record<ModuleType, string> = {
  [ModuleType.EVENTS]: 'events',
  [ModuleType.DONATIONS]: 'donations',
  [ModuleType.ANNOUNCEMENTS]: 'announcements',
  [ModuleType.REQUESTS]: 'requests',
  [ModuleType.MESSAGES]: 'members',
  [ModuleType.COMMUNITY]: 'community',
  [ModuleType.LIVESTREAMS]: 'livestreams',
  [ModuleType.PRAYER_REQUESTS]: 'prayer-requests',
  [ModuleType.DAILY_READINGS]: 'readings',
  [ModuleType.MASS_INTENTIONS]: 'mass-intentions',
};

export type AdminAssistantStatus = { available: boolean; remaining: number };
export type AdminAssistantAnswer = { answer: string; actions: string[]; remaining: number };

/**
 * The admin assistant (Seb, 6 Nov 2026): the community's team asks how to
 * do something in the dashboard, about modules or plans, and gets a short
 * answer in its language from the admin guide and a few facts about the
 * community (plan, modules), with links to the right pages. On every plan;
 * it never sees members' data. PoiAdminGuard keeps it to the community's
 * admins.
 */
@Injectable()
export class AdminAssistantService {
  private readonly logger = new Logger(AdminAssistantService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly model: AssistantModel,
    private readonly modules: ActiveModulesService,
  ) {}

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async load(poiId: string): Promise<Poi> {
    const poi = await this.dataSource.getRepository(Poi).findOne({ where: { id: poiId } });
    if (!poi) throw new NotFoundException('Unknown community');
    return poi;
  }

  async status(poiId: string, userId: string): Promise<AdminAssistantStatus> {
    await this.load(poiId);
    const rows: { count: number }[] = await this.dataSource.query(
      `SELECT count FROM admin_assistant_usage WHERE user_id = $1 AND day = $2`,
      [userId, this.today()],
    );
    return { available: this.model.adminEnabled, remaining: Math.max(0, ADMIN_DAILY_QUESTIONS - (rows[0]?.count ?? 0)) };
  }

  async ask(poiId: string, userId: string, turns: AssistantTurn[], language: string): Promise<AdminAssistantAnswer> {
    const poi = await this.load(poiId);
    if (!this.model.adminEnabled) throw new ServiceUnavailableException('assistant_off');
    if (turns.length === 0 || turns[turns.length - 1].role !== 'member') {
      throw new HttpException('last_turn_not_member', HttpStatus.BAD_REQUEST);
    }
    const counted: { count: number }[] = await this.dataSource.query(
      `INSERT INTO admin_assistant_usage (user_id, day, count) VALUES ($1, $2, 1)
       ON CONFLICT (user_id, day) DO UPDATE SET count = admin_assistant_usage.count + 1
       WHERE admin_assistant_usage.count < $3
       RETURNING count`,
      [userId, this.today(), ADMIN_DAILY_QUESTIONS],
    );
    if (counted.length === 0) throw new HttpException('daily_limit', HttpStatus.TOO_MANY_REQUESTS);
    const remaining = ADMIN_DAILY_QUESTIONS - counted[0].count;

    try {
      const { facts, pages } = await this.facts(poi);
      const { insight, ...reply } = await this.model.answerAdmin({
        community: poi.name,
        facts,
        guide: ADMIN_GUIDE,
        pages,
        language,
        turns,
      });
      // A visiting superadmin's questions are not the team's: kept out of the stats.
      if (await this.isTeamAdmin(poi.id, userId)) {
        await recordAssistantQuestion(this.dataSource, this.logger, poi.id, 'admin', language, insight);
      }
      return { ...reply, remaining };
    } catch (error) {
      await this.dataSource.query(
        `UPDATE admin_assistant_usage SET count = GREATEST(count - 1, 0) WHERE user_id = $1 AND day = $2`,
        [userId, this.today()],
      );
      this.logger.warn(`Admin assistant failed for ${poi.id}: ${(error as Error).message}`);
      throw new ServiceUnavailableException('assistant_failed');
    }
  }

  private async isTeamAdmin(poiId: string, userId: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM user_pois WHERE poi_id = $1 AND user_id = $2 AND role = 'admin' LIMIT 1`,
      [poiId, userId],
    );
    return rows.length > 0;
  }

  /** The community's plan and modules, and the pages its menu shows. */
  private async facts(poi: Poi): Promise<{ facts: string; pages: Record<string, string> }> {
    const plan = effectivePlan(poi);
    const rows = await this.modules.findActiveModulesForPoi(poi.id);
    const status = new Map(rows.map((m) => [m.moduleType, m.status]));
    const fits = modulesForPlace(poi.type);
    const lines = [
      `Community: ${poi.name}`,
      `Kind of community: ${poi.type.replace('_', ' ')}`,
      `Plan: ${plan}${poi.planOffered ? ' (offered by infunion, nothing to pay)' : ''}${poi.planTrialEndsAt && new Date(poi.planTrialEndsAt) > new Date() ? ` (free trial until ${new Date(poi.planTrialEndsAt).toISOString().slice(0, 10)})` : ''}`,
    ];
    const on: string[] = [];
    const off: string[] = [];
    const notInPlan: string[] = [];
    for (const type of fits) {
      const s = status.get(type);
      if (s === 'trial' || s === 'active') on.push(type);
      else if (planIncludes(plan, type)) off.push(type);
      else notInPlan.push(`${type} (${planOf(type)} plan)`);
    }
    lines.push(`Modules on: ${on.join(', ') || 'none'}`);
    if (off.length) lines.push(`In the plan but hidden from the app: ${off.join(', ')}`);
    if (notInPlan.length) lines.push(`Not in this plan: ${notInPlan.join(', ')}`);
    const unfit = Object.values(ModuleType).filter((type) => !fits.includes(type));
    if (unfit.length) lines.push(`Not available for this kind of community: ${unfit.join(', ')}`);
    lines.push(`Today: ${this.today()}`);

    const live = new Set(on.map((type) => MODULE_PAGE[type as ModuleType]));
    const modulePages = new Set(Object.values(MODULE_PAGE));
    const pages = Object.fromEntries(
      Object.entries(ADMIN_PAGES).filter(([key]) => key === 'members' || !modulePages.has(key) || live.has(key)),
    );
    return { facts: lines.join('\n'), pages };
  }
}

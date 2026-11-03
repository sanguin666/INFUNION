import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ContentReport,
  type ReportKind,
  type ReportReason,
} from './entities/content-report.entity.js';
import { HiddenPerson } from './entities/hidden-person.entity.js';
import { PostingBan } from './entities/posting-ban.entity.js';
import { CommunityPost } from '../community/entities/community-post.entity.js';
import { CommunityComment } from '../community/entities/community-comment.entity.js';
import { PrayerRequest } from '../prayer-requests/entities/prayer-request.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { MemberRole } from '../common/enums/member-role.enum.js';
import { Language } from '../common/enums/language.enum.js';
import { EmailSender } from '../auth/email/email-sender.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailParagraph,
  emailQuote,
} from '../common/email/email-layout.js';
import { fill, moderationTexts } from './moderation-texts.js';
import { countsFrom, OPEN_REPORT_COUNTS_SQL } from './open-report-counts.js';
import type {
  CreateReportDto,
  HidePersonDto,
  ResolveReportDto,
} from './dto/moderation.dto.js';

/** What a member can report or hide, as found in the database. */
type Target = {
  kind: ReportKind;
  id: string;
  poiId: string;
  postId: string | null;
  message: string;
  authorName: string | null;
  authorId: string | null;
  createdAt: Date;
};

export type OpenReport = {
  kind: ReportKind;
  targetId: string;
  postId: string | null;
  excerpt: string;
  authorName: string | null;
  canBan: boolean;
  contentCreatedAt: string | null;
  firstReportedAt: string;
  count: number;
  reasons: Partial<Record<ReportReason, number>>;
  reason: ReportReason;
};

/**
 * Reports, hidden people and posting bans for what members write in a
 * community: posts and replies in Our group, and prayer requests. What
 * Apple asks of an app with content from its users (guideline 1.2): a way
 * to report it, a way to block someone, and a team that acts on reports.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    @InjectRepository(ContentReport)
    private readonly reports: Repository<ContentReport>,
    @InjectRepository(HiddenPerson)
    private readonly hidden: Repository<HiddenPerson>,
    @InjectRepository(PostingBan)
    private readonly bans: Repository<PostingBan>,
    @InjectRepository(CommunityPost)
    private readonly posts: Repository<CommunityPost>,
    @InjectRepository(CommunityComment)
    private readonly comments: Repository<CommunityComment>,
    @InjectRepository(PrayerRequest)
    private readonly prayers: Repository<PrayerRequest>,
    @InjectRepository(UserPoi)
    private readonly memberships: Repository<UserPoi>,
    @InjectRepository(Poi)
    private readonly pois: Repository<Poi>,
    private readonly config: ConfigService,
    private readonly emailSender: EmailSender,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------ members

  /**
   * Leaves out, for this viewer, what they reported and everything from
   * the people they hid. Signed out, everything shows.
   */
  async visibleFor<T extends { id: string }>(
    viewerId: string | undefined,
    kind: ReportKind,
    items: T[],
  ): Promise<T[]> {
    if (!viewerId || items.length === 0) return items;
    const [hiddenRows, reportedRows] = await Promise.all([
      this.hidden.find({
        where: { user: { id: viewerId } },
        relations: { hidden: true },
        select: { id: true, hidden: { id: true } },
      }),
      this.reports.find({
        where: {
          reporter: { id: viewerId },
          kind,
          targetId: In(items.map((i) => i.id)),
        },
        select: { id: true, targetId: true },
      }),
    ]);
    const reported = new Set(reportedRows.map((r) => r.targetId));
    let visible = items.filter((i) => !reported.has(i.id));
    if (hiddenRows.length === 0 || visible.length === 0) return visible;
    const hiddenIds = new Set(hiddenRows.map((h) => h.hidden.id));
    const authors = await this.authorsOf(
      kind,
      visible.map((i) => i.id),
    );
    visible = visible.filter((i) => {
      const author = authors.get(i.id);
      return !author || !hiddenIds.has(author);
    });
    return visible;
  }

  /** Throws when the team blocked this member from posting here. */
  async assertCanPost(poiId: string, userId: string): Promise<void> {
    const ban = await this.bans.findOne({
      where: { poi: { id: poiId }, user: { id: userId } },
      select: { id: true },
    });
    if (ban) throw new ForbiddenException('posting_blocked');
  }

  async report(
    poiId: string,
    reporterId: string,
    dto: CreateReportDto,
  ): Promise<{ ok: true }> {
    const target = await this.findTarget(dto.kind, dto.targetId);
    if (!target || target.poiId !== poiId) {
      throw new NotFoundException('Nothing to report');
    }
    const already = await this.reports.findOne({
      where: {
        reporter: { id: reporterId },
        kind: dto.kind,
        targetId: dto.targetId,
      },
      select: { id: true },
    });
    if (already) return { ok: true };
    const openBefore = await this.reports.count({
      where: { kind: dto.kind, targetId: dto.targetId, status: 'open' },
    });
    await this.reports.save(
      this.reports.create({
        poi: { id: poiId },
        kind: dto.kind,
        targetId: dto.targetId,
        postId: target.postId,
        reporter: { id: reporterId },
        reason: dto.reason,
        excerpt: target.message.slice(0, 2000),
        authorName: target.authorName,
        author: target.authorId ? { id: target.authorId } : null,
        contentCreatedAt: target.createdAt,
        status: 'open',
      }),
    );
    // The team hears about it once per item, not once per report.
    if (openBefore === 0) {
      this.notifications.fireAndForget(() =>
        this.tellTeam(poiId, target, dto.reason),
      );
    }
    return { ok: true };
  }

  async hide(
    userId: string,
    dto: HidePersonDto,
  ): Promise<{ id: string; name: string | null }> {
    const target = await this.findTarget(dto.kind, dto.targetId);
    if (!target) throw new NotFoundException('Nothing to hide');
    if (!target.authorId) throw new BadRequestException('no_author');
    if (target.authorId === userId) throw new BadRequestException('own_content');
    const existing = await this.hidden.findOne({
      where: { user: { id: userId }, hidden: { id: target.authorId } },
    });
    if (existing) return { id: existing.id, name: existing.hiddenName };
    const saved = await this.hidden.save(
      this.hidden.create({
        user: { id: userId },
        hidden: { id: target.authorId },
        hiddenName: target.authorName,
      }),
    );
    return { id: saved.id, name: saved.hiddenName };
  }

  async listHidden(
    userId: string,
  ): Promise<{ id: string; name: string | null; createdAt: Date }[]> {
    const rows = await this.hidden.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.hiddenName,
      createdAt: r.createdAt,
    }));
  }

  async unhide(userId: string, id: string): Promise<void> {
    await this.hidden.delete({ id, user: { id: userId } });
  }

  // --------------------------------------------------------------- team

  async openCount(poiId: string): Promise<{ total: number; community: number; prayer: number }> {
    const { community, prayer } = countsFrom(
      await this.reports.query(OPEN_REPORT_COUNTS_SQL, [poiId]),
    );
    return { total: community + prayer, community, prayer };
  }

  /** Open reports, one entry per reported item, oldest first. */
  async listOpen(poiId: string, area: 'community' | 'prayer'): Promise<OpenReport[]> {
    const kinds: ReportKind[] = area === 'prayer' ? ['prayer'] : ['post', 'comment'];
    const rows = await this.reports.find({
      where: { poi: { id: poiId }, status: 'open', kind: In(kinds) },
      relations: { author: true },
      select: {
        id: true,
        kind: true,
        targetId: true,
        postId: true,
        reason: true,
        excerpt: true,
        authorName: true,
        contentCreatedAt: true,
        createdAt: true,
        author: { id: true },
      },
      order: { createdAt: 'ASC' },
    });
    const groups = new Map<string, ContentReport[]>();
    for (const row of rows) {
      const key = `${row.kind}:${row.targetId}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const result: OpenReport[] = [];
    for (const group of groups.values()) {
      const first = group[0];
      // Removed meanwhile (from the posts list, say): nothing left to decide.
      if (!(await this.findTarget(first.kind, first.targetId))) {
        await this.closeReports(first.kind, first.targetId, 'removed');
        continue;
      }
      const reasons: Partial<Record<ReportReason, number>> = {};
      for (const r of group) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
      const reason = (Object.entries(reasons) as [ReportReason, number][]).sort(
        (a, b) => b[1] - a[1],
      )[0][0];
      result.push({
        kind: first.kind,
        targetId: first.targetId,
        postId: first.postId,
        excerpt: first.excerpt,
        authorName: first.authorName,
        canBan: Boolean(first.author),
        contentCreatedAt: first.contentCreatedAt?.toISOString() ?? null,
        firstReportedAt: first.createdAt.toISOString(),
        count: group.length,
        reasons,
        reason,
      });
    }
    return result;
  }

  async resolve(poiId: string, dto: ResolveReportDto): Promise<{ ok: true }> {
    const report = await this.reports.findOne({
      where: { poi: { id: poiId }, kind: dto.kind, targetId: dto.targetId },
      relations: { author: true },
      select: { id: true, author: { id: true } },
    });
    if (!report) throw new NotFoundException('No report for this item');
    if (dto.action === 'keep') {
      await this.closeReports(dto.kind, dto.targetId, 'kept');
      return { ok: true };
    }
    await this.removeTarget(dto.kind, dto.targetId);
    if (dto.action === 'remove_and_ban' && report.author) {
      const banned = await this.bans.findOne({
        where: { poi: { id: poiId }, user: { id: report.author.id } },
      });
      if (!banned) {
        await this.bans.save(
          this.bans.create({ poi: { id: poiId }, user: { id: report.author.id } }),
        );
      }
    }
    await this.closeReports(dto.kind, dto.targetId, 'removed');
    return { ok: true };
  }

  async listBans(poiId: string): Promise<{ id: string; name: string; createdAt: Date }[]> {
    const rows = await this.bans.find({
      where: { poi: { id: poiId } },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((b) => ({
      id: b.id,
      name:
        [b.user.firstName, b.user.lastName].filter(Boolean).join(' ') ||
        b.user.email ||
        b.user.phone ||
        '',
      createdAt: b.createdAt,
    }));
  }

  async liftBan(poiId: string, id: string): Promise<void> {
    await this.bans.delete({ id, poi: { id: poiId } });
  }

  // ------------------------------------------------------------ helpers

  private async closeReports(
    kind: ReportKind,
    targetId: string,
    status: 'removed' | 'kept',
  ): Promise<void> {
    await this.reports.update(
      { kind, targetId, status: 'open' },
      { status, resolvedAt: new Date() },
    );
  }

  private async removeTarget(kind: ReportKind, id: string): Promise<void> {
    if (kind === 'post') await this.posts.delete({ id });
    else if (kind === 'comment') await this.comments.delete({ id });
    else await this.prayers.delete({ id });
  }

  private async authorsOf(kind: ReportKind, ids: string[]): Promise<Map<string, string>> {
    const table =
      kind === 'post'
        ? 'community_posts'
        : kind === 'comment'
          ? 'community_comments'
          : 'prayer_requests';
    const rows: { id: string; author_id: string | null }[] = await this.reports.query(
      `SELECT id, author_id FROM "${table}" WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    const map = new Map<string, string>();
    for (const row of rows) if (row.author_id) map.set(row.id, row.author_id);
    return map;
  }

  private async findTarget(kind: ReportKind, id: string): Promise<Target | null> {
    if (kind === 'comment') {
      const comment = await this.comments.findOne({
        where: { id },
        relations: { post: { poi: true }, author: true },
        select: {
          id: true,
          message: true,
          authorName: true,
          createdAt: true,
          post: { id: true, poi: { id: true } },
          author: { id: true },
        },
      });
      if (!comment) return null;
      return {
        kind,
        id,
        poiId: comment.post.poi.id,
        postId: comment.post.id,
        message: comment.message,
        authorName: comment.authorName ?? null,
        authorId: comment.author?.id ?? null,
        createdAt: comment.createdAt,
      };
    }
    const repo: Repository<CommunityPost | PrayerRequest> =
      kind === 'post' ? this.posts : this.prayers;
    const item = await repo.findOne({
      where: { id },
      relations: { poi: true, author: true },
      select: {
        id: true,
        message: true,
        authorName: true,
        createdAt: true,
        poi: { id: true },
        author: { id: true },
      },
    });
    if (!item) return null;
    return {
      kind,
      id,
      poiId: item.poi.id,
      postId: null,
      message: item.message,
      authorName: item.authorName ?? null,
      authorId: item.author?.id ?? null,
      createdAt: item.createdAt,
    };
  }

  private dashboardUrl(): string {
    const configured = this.config.get<string>('ADMIN_URL')?.trim();
    if (configured) return configured.replace(/\/$/, '');
    const fromCors = (this.config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((o) => o.trim())
      .find((o) => o.includes('admin'));
    return fromCors ?? 'https://infunion-admin.up.railway.app';
  }

  /** One email and one push to each admin of the community. */
  private async tellTeam(poiId: string, target: Target, reason: ReportReason): Promise<void> {
    const poi = await this.pois.findOne({
      where: { id: poiId },
      select: { id: true, name: true, language: true },
    });
    if (!poi) return;
    const admins = await this.memberships.find({
      where: { poi: { id: poiId }, role: MemberRole.ADMIN },
      relations: { user: true },
    });
    const page = target.kind === 'prayer' ? 'prayer-requests' : 'community';
    const url = `${this.dashboardUrl()}/poi/${poiId}/${page}?tab=reported`;
    const excerpt =
      target.message.length > 300 ? `${target.message.slice(0, 300)}…` : target.message;
    for (const membership of admins) {
      const user = membership.user;
      const language = user.language ?? poi.language ?? Language.EN;
      const t = moderationTexts(language);
      const values = {
        place: poi.name,
        kind: t.kinds[target.kind],
        reason: t.reasons[reason],
        excerpt: excerpt.length > 80 ? `${excerpt.slice(0, 80)}…` : excerpt,
      };
      if (user.email) {
        const subject = fill(t.subject, values);
        const html = emailLayout(
          emailHeading(t.heading) +
            emailParagraph(fill(t.intro, values)) +
            emailQuote(excerpt) +
            emailParagraph(t.soon, { muted: true }) +
            emailButton(t.button, url),
          language,
        );
        const text = [t.heading, fill(t.intro, values), excerpt, t.soon, url].join('\n\n');
        try {
          await this.emailSender.send({ to: user.email, subject, text, html });
        } catch (error) {
          this.logger.warn(`Report email to ${user.email} failed: ${(error as Error).message}`);
        }
      }
      await this.notifications
        .notifyUserAlways(user.id, poiId, {
          title: poi.name,
          body: fill(t.push, values),
        })
        .catch(() => undefined);
    }
  }
}

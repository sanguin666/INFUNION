import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Request } from 'express';
import {
  DataSource,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  Not,
  type EntityManager,
} from 'typeorm';
import { Poi } from '../pois/entities/poi.entity.js';
import { User } from '../users/entities/user.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { MemberRole } from '../common/enums/member-role.enum.js';
import { Announcement } from '../announcements/entities/announcement.entity.js';
import { Event } from '../events/entities/event.entity.js';
import { Livestream } from '../livestreams/entities/livestream.entity.js';
import { DailyReading } from '../daily-readings/entities/daily-reading.entity.js';
import { PoiBadge } from '../poi-badges/entities/poi-badge.entity.js';
import { PoiPageBlock } from '../poi-page/entities/poi-page-block.entity.js';
import { CommunityPost } from '../community/entities/community-post.entity.js';
import { CommunityComment } from '../community/entities/community-comment.entity.js';
import { PrayerRequest } from '../prayer-requests/entities/prayer-request.entity.js';
import { ServiceRequest } from '../service-requests/entities/service-request.entity.js';
import { ServiceRequestDocument } from '../service-requests/entities/service-request-document.entity.js';
import { ServiceRequestMessage } from '../service-requests/entities/service-request-message.entity.js';
import { MemberConversation } from '../member-messages/entities/member-conversation.entity.js';
import { MassIntention } from '../mass-intentions/entities/mass-intention.entity.js';
import {
  Donation,
  DonationStatus,
} from '../donations/entities/donation.entity.js';
import { DonationCampaign } from '../donations/entities/donation-campaign.entity.js';
import { ActiveModule } from '../active-modules/entities/active-module.entity.js';
import { BillingInvoice } from '../active-modules/entities/billing-invoice.entity.js';
import { PlaceRegistration } from '../registrations/entities/place-registration.entity.js';
import { DonationsService } from '../donations/donations.service.js';
import { StripeService } from '../donations/stripe.service.js';
import { donorsCsv, receiptHtml } from '../donations/receipts.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SuperadminAccess } from '../auth/superadmin-access.service.js';
import { EmailSender } from '../auth/email/email-sender.js';
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailParagraph,
} from '../common/email/email-layout.js';
import { intlLocale, Language } from '../common/enums/language.enum.js';
import { fileStore, type FileArea } from '../common/storage/file-store.js';
import { runExclusive } from '../common/locks/run-exclusive.js';
import {
  closesAtFrom,
  GRACE_DAYS,
  lastAnonymisableGiftYear,
  RECORD_YEARS,
  type ClosingReason,
} from './closure-rules.js';
import { closureText, type ClosureTextKey } from './closure-texts.js';
import { zip, type ZipEntry } from './zip.js';

const HOUR_MS = 60 * 60 * 1000;
const ANONYMOUS = '—';

export type ClosureState = 'open' | 'closing' | 'closed';

export interface ClosureStatus {
  state: ClosureState;
  requestedAt: string | null;
  closesAt: string | null;
  closedAt: string | null;
  requestedBy: string | null;
  graceDays: number;
  /** The place's name as it must be typed to confirm. */
  name: string;
  members: number;
  monthlyGifts: number;
  /** Whether the person asking has to give their password to confirm. */
  passwordRequired: boolean;
}

export interface CloseRequest {
  confirmName: string;
  password?: string;
  authority: boolean;
  reason?: ClosingReason;
}

type StoredFile = { area: FileArea; key: string };

/**
 * A place's admins closing its account themselves (Seb, 2 Nov 2026).
 *
 * Asked: the place leaves the map, search and QR join, takes no more
 * gifts, stops its monthly gifts and renews nothing; members still read
 * it, and any admin can take it back, for GRACE_DAYS. Then the hourly
 * sweep erases what the community wrote, its files and its member list.
 *
 * What stays is what the law keeps (GDPR art. 28.3.g with LOPDGDD art.
 * 32 and 33.3: a processor returns the data, then deletes it, but may
 * keep it blocked while liabilities can arise): the place as a shell
 * with its legal identity, gifts and tax receipts (givers erased once the
 * tax office can no longer check them), infunion's invoices and the
 * signed agreement (RECORD_YEARS). The superadmin's "Close now" is the
 * same erasure without the wait.
 *
 * Members' accounts are theirs and stay: they only lose the link.
 */
@Injectable()
export class PlaceClosureService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlaceClosureService.name);
  private sweepTimer?: NodeJS.Timeout;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly access: SuperadminAccess,
    private readonly notifications: NotificationsService,
    private readonly donations: DonationsService,
    private readonly stripe: StripeService,
    private readonly emailSender: EmailSender,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    this.sweepTimer = setInterval(() => {
      runExclusive(this.dataSource, 'place-closure', () => this.sweep()).catch(
        (error: Error) =>
          this.logger.warn(`Place closure sweep failed: ${error.message}`),
      );
    }, HOUR_MS);
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  private get pois() {
    return this.dataSource.getRepository(Poi);
  }

  private async findPoi(poiId: string): Promise<Poi> {
    const poi = await this.pois.findOne({ where: { id: poiId } });
    if (!poi) throw new NotFoundException('Unknown community');
    return poi;
  }

  async status(poiId: string, userId?: string): Promise<ClosureStatus> {
    const poi = await this.findPoi(poiId);
    const [members, monthlyGifts, user] = await Promise.all([
      this.dataSource
        .getRepository(UserPoi)
        .count({ where: { poi: { id: poiId }, role: MemberRole.MEMBER } }),
      this.dataSource.getRepository(Donation).count({
        where: {
          poi: { id: poiId },
          recurring: true,
          recurringParentId: IsNull(),
          recurringCancelledAt: IsNull(),
          status: DonationStatus.COMPLETED,
        },
      }),
      userId
        ? this.dataSource
            .getRepository(User)
            .findOne({
              where: { id: userId },
              select: { id: true, passwordHash: true },
            })
        : Promise.resolve(null),
    ]);
    return {
      state: poi.closedAt
        ? 'closed'
        : poi.closingRequestedAt
          ? 'closing'
          : 'open',
      requestedAt: poi.closingRequestedAt?.toISOString() ?? null,
      closesAt: poi.closesAt?.toISOString() ?? null,
      closedAt: poi.closedAt?.toISOString() ?? null,
      requestedBy: poi.closingRequestedBy ?? null,
      graceDays: GRACE_DAYS,
      name: poi.name,
      members,
      monthlyGifts,
      passwordRequired: Boolean(user?.passwordHash),
    };
  }

  /**
   * An admin asks to close the place. Checked: they really are one of its
   * admins (not the superadmin looking in, who has Close now), they typed
   * the name, ticked that they may, and gave their password.
   */
  async request(
    poiId: string,
    userId: string,
    dto: CloseRequest,
    request?: Request,
    now = new Date(),
  ): Promise<ClosureStatus> {
    const poi = await this.findPoi(poiId);
    if (poi.closedAt) throw new ConflictException('already_closed');
    if (poi.closingRequestedAt) throw new ConflictException('already_closing');

    const membership = await this.dataSource.getRepository(UserPoi).findOne({
      where: {
        user: { id: userId },
        poi: { id: poiId },
        role: MemberRole.ADMIN,
      },
    });
    if (!membership)
      throw new ForbiddenException('Only the community’s own admins can close it');
    if (!dto.authority) throw new BadRequestException('authority_required');
    if (normalise(dto.confirmName) !== normalise(poi.name))
      throw new BadRequestException('name_mismatch');

    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        passwordHash: true,
      },
    });
    if (!user) throw new NotFoundException('No such person');
    if (
      user.passwordHash &&
      !(dto.password && (await bcrypt.compare(dto.password, user.passwordHash)))
    ) {
      throw new BadRequestException('wrong_password');
    }

    const requestedBy = personName(user);
    poi.closingRequestedAt = now;
    poi.closesAt = closesAtFrom(now);
    poi.closingRequestedBy = requestedBy;
    poi.closingReason = dto.reason ?? null;
    await this.pois.save(poi);

    const monthlyStopped = await this.donations.stopAllMonthly(poiId);
    await this.access.record({
      action: 'poi.closure.requested',
      actorId: userId,
      actorEmail: user.email ?? null,
      poiId,
      poiName: poi.name,
      details: {
        closesAt: poi.closesAt.toISOString(),
        reason: dto.reason ?? null,
        monthlyStopped,
      },
      request,
    });

    this.notifications.fireAndForget(() =>
      this.notifications.notifyEveryMember(poiId, (reader) => ({
        title: closureText(reader.language, 'pushClosingTitle', {
          place: poi.name,
        }),
        body: closureText(reader.language, 'pushClosingBody', {
          date: formatDay(poi.closesAt!, reader.language),
        }),
        data: { screen: 'home' },
      })),
    );
    await this.mailAdmins(poi, 'closing', requestedBy);
    return this.status(poiId, userId);
  }

  /** "Keep my place": any admin, any time before the closing date. */
  async cancel(
    poiId: string,
    userId: string,
    request?: Request,
  ): Promise<ClosureStatus> {
    const poi = await this.findPoi(poiId);
    if (poi.closedAt) throw new ConflictException('already_closed');
    if (!poi.closingRequestedAt) return this.status(poiId, userId);
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: userId } });
    const keptBy = user ? personName(user) : 'infunion';

    poi.closingRequestedAt = null;
    poi.closesAt = null;
    poi.closingRequestedBy = null;
    poi.closingReason = null;
    await this.pois.save(poi);
    await this.access.record({
      action: 'poi.closure.cancelled',
      actorId: userId,
      actorEmail: user?.email ?? null,
      poiId,
      poiName: poi.name,
      request,
    });
    this.notifications.fireAndForget(() =>
      this.notifications.notifyEveryMember(poiId, (reader) => ({
        title: closureText(reader.language, 'pushStaysTitle', {
          place: poi.name,
        }),
        body: closureText(reader.language, 'pushStaysBody'),
        data: { screen: 'home' },
      })),
    );
    await this.mailAdmins(poi, 'stays', keptBy);
    return this.status(poiId, userId);
  }

  /**
   * The superadmin's Close now: the same erasure, today. The name typed
   * again so a slip of the mouse closes nothing.
   */
  async closeNow(
    poiId: string,
    confirmName: string,
    actor: { userId: string; email?: string | null },
    now = new Date(),
  ): Promise<void> {
    const poi = await this.findPoi(poiId);
    if (confirmName.trim() !== poi.name.trim())
      throw new BadRequestException('name_mismatch');
    if (poi.closedAt) return;
    poi.closingRequestedAt ??= now;
    poi.closingRequestedBy ??= 'infunion';
    poi.closesAt = now;
    await this.pois.save(poi);
    await this.donations.stopAllMonthly(poiId);
    await this.erase(poiId, now, actor);
  }

  /**
   * Erases a place whose closing date has come: what the community wrote,
   * its files, its members' links and its admins' roles. Keeps the place
   * as a shell (name, legal identity, dates) for its gifts, receipts and
   * invoices, which stay as they are.
   */
  async erase(
    poiId: string,
    now = new Date(),
    actor?: { userId: string; email?: string | null },
  ): Promise<void> {
    const poi = await this.findPoi(poiId);
    if (poi.closedAt) return;
    const admins = await this.adminEmails(poiId);

    const files = await this.dataSource.transaction(async (manager) => {
      const files: StoredFile[] = [];
      const where = { poi: { id: poiId } };

      for (const url of [poi.logoUrl, poi.pictureUrl]) pushPublic(files, url);
      for (const a of await manager.find(Announcement, { where })) {
        pushPublic(files, a.imageUrl);
        pushPublic(files, a.audioUrl);
      }
      for (const b of await manager.find(PoiPageBlock, { where }))
        pushPublic(files, b.imageUrl);

      const requests = await manager.find(ServiceRequest, {
        where,
        select: { id: true },
      });
      if (requests.length) {
        const ids = requests.map((r) => r.id);
        for (const d of await manager.find(ServiceRequestDocument, {
          where: { request: { id: In(ids) } },
        }))
          if (d.filePath) files.push({ area: 'private', key: d.filePath });
        for (const m of await manager.find(ServiceRequestMessage, {
          where: { request: { id: In(ids) } },
        }))
          if (m.attachmentPath)
            files.push({ area: 'private', key: m.attachmentPath });
      }

      // Intentions paid with an offering keep the payment's trace (a gift);
      // what was asked, and by whom, goes. The others go entirely.
      await manager.update(
        MassIntention,
        { poi: { id: poiId }, donation: Not(IsNull()) },
        {
          intention: ANONYMOUS,
          requesterName: ANONYMOUS,
          requesterContact: null,
          requester: null,
          celebrationTitle: null,
        },
      );
      await manager.delete(MassIntention, {
        poi: { id: poiId },
        donation: IsNull(),
      });

      // Projects stay (gifts point at them) without their pictures.
      for (const c of await manager.find(DonationCampaign, { where }))
        pushPublic(files, c.imageUrl);
      await manager.update(DonationCampaign, where, {
        imageUrl: null,
        active: false,
      });

      for (const entity of [
        CommunityPost,
        PrayerRequest,
        MemberConversation,
        ServiceRequest,
        Announcement,
        Event,
        Livestream,
        DailyReading,
        PoiBadge,
        PoiPageBlock,
        ActiveModule,
        UserPoi,
      ]) {
        await manager.delete(entity, where);
      }
      await manager.update(
        User,
        { lastActivePoiId: poiId },
        { lastActivePoiId: null as unknown as string },
      );

      await manager.update(Poi, poiId, {
        closedAt: now,
        closesAt: poi.closesAt ?? now,
        description: null as unknown as string,
        pictureUrl: null as unknown as string,
        logoUrl: null,
        qrFlyerHeadline: null as unknown as string,
        qrFlyerSubtext: null as unknown as string,
        readingsLinkUrl: null,
        menuOrder: [],
        latitude: null,
        longitude: null,
        mapVisible: false,
        // The old flyers lead nowhere, for good.
        qrCodeToken: `closed-${randomUUID()}`,
        paymentMethodLabel: null,
        billingRenewsAt: null,
        pendingPlan: null,
      });
      return files;
    });

    for (const { area, key } of files) await fileStore().remove(area, key);
    await this.access.record({
      action: 'poi.closure.done',
      actorId: actor?.userId ?? null,
      actorEmail: actor?.email ?? null,
      poiId,
      poiName: poi.name,
      details: { files: files.length },
    });
    const closed = { ...poi, closedAt: now } as Poi;
    await this.sendMail(admins, closed, 'closed', '');
  }

  /**
   * The hourly sweep: places whose closing date has come, then the
   * storage limits on what closed places keep.
   */
  async sweep(
    now = new Date(),
  ): Promise<{
    erased: number;
    giftsAnonymised: number;
    recordsDeleted: number;
  }> {
    const due = await this.pois.find({
      where: {
        closesAt: LessThanOrEqual(now),
        closedAt: IsNull(),
        closingRequestedAt: Not(IsNull()),
      },
    });
    let erased = 0;
    for (const poi of due) {
      try {
        await this.erase(poi.id, now);
        erased += 1;
      } catch (error) {
        this.logger.warn(
          `Could not erase closed place ${poi.id}: ${(error as Error).message}`,
        );
      }
    }

    // Givers of closed places, once the tax office can no longer check.
    const year = lastAnonymisableGiftYear(now);
    const giftsAnonymised =
      (
        await this.dataSource
          .createQueryBuilder()
          .update(Donation)
          .set({
            donorName: ANONYMOUS,
            message: null,
            donorAddress: null,
            donorPostalCode: null,
            donorCity: null,
            donorTaxId: null,
            donor: null,
          })
          .where('created_at < :end', {
            end: new Date(Date.UTC(year + 1, 0, 1)),
          })
          .andWhere(
            'poi_id IN (SELECT id FROM pois WHERE closed_at IS NOT NULL)',
          )
          .andWhere(
            `(donor_name IS DISTINCT FROM :anonymous OR donor_id IS NOT NULL OR donor_tax_id IS NOT NULL)`,
            {
              anonymous: ANONYMOUS,
            },
          )
          .execute()
      ).affected ?? 0;

    // After RECORD_YEARS, nothing of the place is left.
    const ended = await this.pois.find({
      where: { closedAt: LessThan(recordsCutoff(now)) },
      select: { id: true, name: true },
    });
    for (const poi of ended) {
      try {
        await this.deleteRecords(poi.id);
      } catch (error) {
        this.logger.warn(
          `Could not delete records of ${poi.id}: ${(error as Error).message}`,
        );
      }
    }
    if (erased || giftsAnonymised || ended.length) {
      this.logger.log(
        `Closed places: ${erased} erased, ${giftsAnonymised} gift(s) anonymised, ${ended.length} record(s) deleted`,
      );
    }
    return { erased, giftsAnonymised, recordsDeleted: ended.length };
  }

  private async deleteRecords(poiId: string): Promise<void> {
    const proofs = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        const registrations = await manager.find(PlaceRegistration, {
          where: { poiId },
        });
        await manager.update(
          MassIntention,
          { poi: { id: poiId } },
          { donation: null },
        );
        await manager.delete(Donation, { poi: { id: poiId } });
        await manager.delete(DonationCampaign, { poi: { id: poiId } });
        await manager.delete(BillingInvoice, { poi: { id: poiId } });
        if (registrations.length)
          await manager.delete(PlaceRegistration, {
            id: In(registrations.map((r) => r.id)),
          });
        await manager.delete(Poi, { id: poiId });
        return registrations
          .map((r) => r.documentPath)
          .filter((path): path is string => Boolean(path));
      },
    );
    for (const key of proofs) await fileStore().remove('private', key);
  }

  // ------------------------------------------------------------- export

  /**
   * Everything the community has here, as one ZIP: GDPR art. 20 for the
   * community, and art. 28.3.g (handing the data back) before a closing.
   */
  async exportZip(
    poiId: string,
    now = new Date(),
  ): Promise<{ name: string; data: Buffer }> {
    const poi = await this.findPoi(poiId);
    const manager = this.dataSource.manager;
    const where = { poi: { id: poiId } };
    const entries: ZipEntry[] = [];
    const json = (name: string, value: unknown) =>
      entries.push({ name, data: JSON.stringify(value, null, 2) });

    const memberships = await manager.find(UserPoi, {
      where,
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });
    entries.push({
      name: 'members.csv',
      data: csv(
        [
          'First name',
          'Last name',
          'Phone',
          'Email',
          'Role',
          'Joined',
          'Religious consent',
        ],
        memberships.map((m) => [
          m.user.firstName ?? '',
          m.user.lastName ?? '',
          m.user.phone ?? '',
          m.user.email ?? '',
          m.role,
          m.joinedAt.toISOString(),
          m.religiousConsentAt?.toISOString() ?? '',
        ]),
      ),
    });

    const { qrCodeToken: _qr, ...place } = poi;
    json('place.json', place);
    json(
      'content/announcements.json',
      await manager.find(Announcement, { where, order: { createdAt: 'ASC' } }),
    );
    json('content/events.json', await manager.find(Event, { where }));
    json('content/livestreams.json', await manager.find(Livestream, { where }));
    json(
      'content/daily-readings.json',
      await manager.find(DailyReading, { where }),
    );
    json('content/home-badges.json', await manager.find(PoiBadge, { where }));
    json('content/home-page.json', await manager.find(PoiPageBlock, { where }));
    json(
      'content/projects.json',
      await manager.find(DonationCampaign, { where }),
    );
    json('content/modules.json', await manager.find(ActiveModule, { where }));
    json(
      'members/prayer-requests.json',
      await manager.find(PrayerRequest, { where, order: { createdAt: 'ASC' } }),
    );
    json(
      'members/community-posts.json',
      (
        await manager.find(CommunityPost, {
          where,
          relations: { author: true },
          order: { createdAt: 'ASC' },
        })
      ).map((post) => ({
        ...post,
        author: post.author ? personName(post.author) : null,
      })),
    );
    json(
      'members/community-comments.json',
      (
        await manager.find(CommunityComment, {
          where: { post: { poi: { id: poiId } } },
          relations: { author: true, post: true },
          order: { createdAt: 'ASC' },
        })
      ).map((c) => ({
        ...c,
        post: c.post?.id ?? null,
        author: c.author ? personName(c.author) : null,
      })),
    );
    json(
      'members/requests.json',
      (
        await manager.find(ServiceRequest, {
          where,
          relations: { requester: true, messages: true, documents: true },
          order: { createdAt: 'ASC' },
        })
      ).map((r) => ({
        ...r,
        requester: r.requester ? personName(r.requester) : null,
      })),
    );
    json(
      'members/messages.json',
      (
        await manager.find(MemberConversation, {
          where,
          relations: { member: true, messages: true },
        })
      ).map((c) => ({
        ...c,
        member: c.member ? personName(c.member) : null,
      })),
    );
    json(
      'members/mass-intentions.json',
      await manager.find(MassIntention, { where, order: { createdAt: 'ASC' } }),
    );
    json(
      'infunion/invoices.json',
      await manager.find(BillingInvoice, { where, order: { issuedAt: 'ASC' } }),
    );

    // Gifts, receipts and modelo 182, year by year.
    const years: { year: number }[] = await manager.query(
      `SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int AS year FROM donations WHERE poi_id = $1 AND status = $2 ORDER BY 1`,
      [poiId, DonationStatus.COMPLETED],
    );
    for (const { year } of years) {
      entries.push({
        name: `gifts/${year}/gifts.csv`,
        data: await this.donations.giftsCsv(poiId, year),
      });
      const donors = await this.donations.receiptDonors(poiId, year);
      entries.push({
        name: `gifts/${year}/donors.csv`,
        data: donorsCsv(donors),
      });
      for (const [index, donor] of donors.entries()) {
        entries.push({
          name: `gifts/${year}/receipts/${String(index + 1).padStart(3, '0')}-${safeName(donor.name || 'donor')}.html`,
          data: receiptHtml(poi, donor, year, this.stripe.currency),
        });
      }
      try {
        const { content } = await this.donations.modelo182(poiId, year);
        entries.push({
          name: `gifts/${year}/modelo182-${year}.txt`,
          data: Buffer.from(content, 'latin1'),
        });
      } catch {
        // No tax deduction here, or no NIF yet: no modelo 182 to give.
      }
    }

    // The files themselves.
    const files: StoredFile[] = [];
    for (const url of [poi.logoUrl, poi.pictureUrl]) pushPublic(files, url);
    for (const a of await manager.find(Announcement, { where })) {
      pushPublic(files, a.imageUrl);
      pushPublic(files, a.audioUrl);
    }
    for (const b of await manager.find(PoiPageBlock, { where }))
      pushPublic(files, b.imageUrl);
    for (const c of await manager.find(DonationCampaign, { where }))
      pushPublic(files, c.imageUrl);
    const requestIds = (
      await manager.find(ServiceRequest, { where, select: { id: true } })
    ).map((r) => r.id);
    if (requestIds.length) {
      for (const d of await manager.find(ServiceRequestDocument, {
        where: { request: { id: In(requestIds) } },
      }))
        if (d.filePath) files.push({ area: 'private', key: d.filePath });
      for (const m of await manager.find(ServiceRequestMessage, {
        where: { request: { id: In(requestIds) } },
      }))
        if (m.attachmentPath)
          files.push({ area: 'private', key: m.attachmentPath });
    }
    for (const { area, key } of files) {
      const data = await readFile(area, key);
      if (data)
        entries.push({
          name: `files/${area === 'public' ? 'pictures' : 'documents'}/${key}`,
          data,
        });
    }

    entries.unshift({
      name: 'README.txt',
      data: [
        `${poi.name} — data exported from infunion on ${now.toISOString()}`,
        '',
        'members.csv                 the member list',
        'place.json                  the community’s profile and settings',
        'content/                    what the team published',
        'members/                    what members sent: requests, messages, prayer requests, posts',
        'gifts/<year>/               every gift, the donors list, each tax receipt, the modelo 182 file',
        'infunion/invoices.json      infunion’s invoices to the community',
        'files/                      pictures, audio and documents',
        '',
        'This file contains personal data. Keep it safe, and only as long as you need it.',
      ].join('\n'),
    });

    const day = now.toISOString().slice(0, 10);
    await this.access.record({
      action: 'poi.export',
      poiId,
      poiName: poi.name,
      details: { entries: entries.length },
    });
    return {
      name: `${safeName(poi.name)}-${day}.zip`,
      data: zip(entries, now),
    };
  }

  // ------------------------------------------------------------- email

  /** Same rule as the registration emails: ADMIN_URL, else CORS_ORIGINS. */
  private dashboardUrl(): string {
    const configured = this.config.get<string>('ADMIN_URL')?.trim();
    if (configured) return configured.replace(/\/$/, '');
    const fromCors = (this.config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((o) => o.trim())
      .find((o) => o.includes('admin'));
    return fromCors ?? 'https://infunion-admin.up.railway.app';
  }

  private async adminEmails(poiId: string): Promise<string[]> {
    const admins = await this.dataSource.getRepository(UserPoi).find({
      where: { poi: { id: poiId }, role: MemberRole.ADMIN },
      relations: { user: true },
    });
    return admins
      .map((m) => m.user.email)
      .filter((email): email is string => Boolean(email));
  }

  private async mailAdmins(
    poi: Poi,
    kind: 'closing' | 'stays',
    name: string,
  ): Promise<void> {
    await this.sendMail(await this.adminEmails(poi.id), poi, kind, name);
  }

  private async sendMail(
    to: string[],
    poi: Poi,
    kind: 'closing' | 'stays' | 'closed',
    name: string,
  ): Promise<void> {
    const language = poi.language ?? Language.EN;
    const values = {
      place: poi.name,
      name,
      date: formatDay(
        (kind === 'closed' ? poi.closedAt : poi.closesAt) ?? new Date(),
        language,
      ),
    };
    const t = (key: ClosureTextKey) => closureText(language, key, values);
    const adminUrl = this.dashboardUrl();
    const keys: ClosureTextKey[] =
      kind === 'closing'
        ? [
            'mailClosingIntro',
            'mailClosingNow',
            'mailClosingThen',
            'mailClosingExport',
            'mailClosingUndo',
          ]
        : kind === 'stays'
          ? ['mailStaysIntro']
          : ['mailClosedIntro'];
    const subject = t(
      kind === 'closing'
        ? 'mailClosingSubject'
        : kind === 'stays'
          ? 'mailStaysSubject'
          : 'mailClosedSubject',
    );
    const heading = t(
      kind === 'closing'
        ? 'mailClosingHeading'
        : kind === 'stays'
          ? 'mailStaysHeading'
          : 'mailClosedHeading',
    );
    const html = emailLayout(
      emailHeading(heading) +
        keys.map((key) => emailParagraph(t(key))).join('') +
        (kind === 'closed'
          ? ''
          : emailButton(
              t('openAdmin'),
              `${adminUrl}/poi/${poi.id}/settings?tab=account`,
            )),
      language,
    );
    const text = [heading, ...keys.map(t)].join('\n\n');
    for (const address of to) {
      try {
        await this.emailSender.send({ to: address, subject, text, html });
      } catch (error) {
        this.logger.warn(
          `Closure email to ${address} failed: ${(error as Error).message}`,
        );
      }
    }
  }
}

function normalise(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function personName(
  user: Pick<User, 'firstName' | 'lastName' | 'email'>,
): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.email ||
    'An admin'
  );
}

function pushPublic(files: StoredFile[], url: string | null | undefined): void {
  if (url && url.startsWith('/uploads/'))
    files.push({ area: 'public', key: url.slice('/uploads/'.length) });
}

async function readFile(area: FileArea, key: string): Promise<Buffer | null> {
  try {
    const opened = await fileStore().open(area, key);
    if (!opened) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of opened.body)
      chunks.push(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array),
      );
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

function formatDay(date: Date, language: Language | string): string {
  return new Intl.DateTimeFormat(intlLocale(language as Language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(date);
}

function safeName(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'place'
  );
}

function csv(header: string[], rows: string[][]): string {
  const cell = (value: string) =>
    /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  // Same conventions as the gifts spreadsheets: semicolons, a BOM, CRLF.
  return (
    '﻿' +
    [header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n') +
    '\r\n'
  );
}

function recordsCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - RECORD_YEARS);
  return cutoff;
}

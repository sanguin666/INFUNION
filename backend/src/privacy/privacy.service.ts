import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, LessThan, type EntityManager } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { MemberRole } from '../common/enums/member-role.enum.js';
import { CommunityPost } from '../community/entities/community-post.entity.js';
import { CommunityComment } from '../community/entities/community-comment.entity.js';
import { PrayerRequest } from '../prayer-requests/entities/prayer-request.entity.js';
import { MemberConversation } from '../member-messages/entities/member-conversation.entity.js';
import { MemberMessage } from '../member-messages/entities/member-message.entity.js';
import { ServiceRequest } from '../service-requests/entities/service-request.entity.js';
import { ServiceRequestMessage } from '../service-requests/entities/service-request-message.entity.js';
import { ServiceRequestDocument } from '../service-requests/entities/service-request-document.entity.js';
import { MassIntention } from '../mass-intentions/entities/mass-intention.entity.js';
import { Donation } from '../donations/entities/donation.entity.js';
import { PushToken } from '../notifications/entities/push-token.entity.js';
import { EventReminder } from '../notifications/entities/event-reminder.entity.js';
import { AuditLog } from '../superadmin/entities/audit-log.entity.js';
import { PhoneVerificationCode } from '../auth/entities/phone-verification-code.entity.js';
import { fileStore, type FileArea } from '../common/storage/file-store.js';
import { runExclusive } from '../common/locks/run-exclusive.js';
import { RateLimit } from '../common/rate-limit/rate-limit.entity.js';
import { SuperadminAccess } from '../auth/superadmin-access.service.js';
import {
  AUDIT_LOG_MONTHS,
  CONSENT_VERSION,
  INACTIVE_ACCOUNT_MONTHS,
} from './consent.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// What a Mass intention keeps in place of the name of someone who has
// gone: the intention itself is the community's record of a celebration.
const ANONYMOUS = '—';

/**
 * Everything the GDPR gives a person over their own data, in one place:
 * consent (art. 7), a copy (art. 15 and 20), erasure (art. 17), and the
 * storage limits infunion promises (art. 5.1.e).
 *
 * The same export and erasure, narrowed to one place, are what a
 * community office uses to answer a member who asks it directly, since
 * the community is the controller of what its members do in its space.
 *
 * Gifts are the one thing erasure keeps: Spanish accounting and tax rules
 * (the yearly Modelo 182 and six years of books) oblige the community to
 * keep them. They lose their link to the account and nothing else.
 */
@Injectable()
export class PrivacyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrivacyService.name);
  private sweep?: NodeJS.Timeout;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly access: SuperadminAccess,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    // Tests run the retention sweep themselves, with a clock of their own.
    if (this.configService.get<string>('NODE_ENV') === 'test') return;
    // Every copy of the API ticks; one at a time does the sweep. Hourly
    // rather than daily: a copy rarely lives a whole day between deploys,
    // and every step of the sweep is safe to repeat.
    this.sweep = setInterval(() => {
      runExclusive(this.dataSource, 'privacy-retention', () => this.applyRetention()).catch((error: Error) =>
        this.logger.warn(`Retention sweep failed: ${error.message}`),
      );
    }, 60 * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.sweep) clearInterval(this.sweep);
  }

  async recordConsent(userId: string, version: string): Promise<void> {
    if (version !== CONSENT_VERSION) {
      throw new BadRequestException(
        'These are not the current terms. Update the app and try again.',
      );
    }
    await this.dataSource.getRepository(User).update(userId, {
      consentVersion: version,
      consentedAt: new Date(),
    });
  }

  /**
   * A copy of what infunion holds about someone, readable and reusable:
   * the account, then what they did in each place. With `poiId`, only what
   * they did in that place (the office's export for one member).
   */
  async exportFor(
    userId: string,
    poiId?: string,
  ): Promise<Record<string, unknown>> {
    const manager = this.dataSource.manager;
    const user = await manager.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('No such person');
    const inPlace = poiId ? { poi: { id: poiId } } : {};

    const memberships = await manager.find(UserPoi, {
      where: { user: { id: userId }, ...inPlace },
      relations: { poi: true },
      order: { joinedAt: 'ASC' },
    });
    if (poiId && memberships.length === 0)
      throw new NotFoundException('Not a member of this place');

    const [
      requests,
      prayerRequests,
      posts,
      comments,
      conversations,
      intentions,
      gifts,
      reminders,
      devices,
    ] = await Promise.all([
      manager.find(ServiceRequest, {
        where: { requester: { id: userId }, ...inPlace },
        relations: { poi: true, messages: true, documents: true },
        order: { createdAt: 'ASC' },
      }),
      manager.find(PrayerRequest, {
        where: { author: { id: userId }, ...inPlace },
        relations: { poi: true },
        order: { createdAt: 'ASC' },
      }),
      manager.find(CommunityPost, {
        where: { author: { id: userId }, ...inPlace },
        relations: { poi: true },
        order: { createdAt: 'ASC' },
      }),
      manager.find(CommunityComment, {
        where: {
          author: { id: userId },
          ...(poiId ? { post: { poi: { id: poiId } } } : {}),
        },
        relations: { post: { poi: true } },
        order: { createdAt: 'ASC' },
      }),
      manager.find(MemberConversation, {
        where: { member: { id: userId }, ...inPlace },
        relations: { poi: true, messages: true },
      }),
      manager.find(MassIntention, {
        where: { requester: { id: userId }, ...inPlace },
        relations: { poi: true },
        order: { createdAt: 'ASC' },
      }),
      manager.find(Donation, {
        where: { donor: { id: userId }, ...inPlace },
        relations: { poi: true, campaign: true },
        order: { createdAt: 'ASC' },
      }),
      manager.find(EventReminder, {
        where: {
          user: { id: userId },
          ...(poiId ? { event: { poi: { id: poiId } } } : {}),
        },
        relations: { event: { poi: true } },
      }),
      poiId
        ? Promise.resolve([])
        : manager.find(PushToken, { where: { user: { id: userId } } }),
    ]);

    const place = (poi: { name: string } | undefined) => poi?.name ?? null;
    return {
      exportedAt: new Date().toISOString(),
      ...(poiId ? { place: memberships[0]?.poi.name } : {}),
      account: {
        id: user.id,
        phone: user.phone ?? null,
        email: user.email ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        pictureUrl: user.avatarUrl ?? null,
        language: user.language,
        createdAt: user.createdAt,
        lastSeenAt: user.lastSeenAt ?? null,
        termsAccepted: user.consentVersion ?? null,
        termsAcceptedAt: user.consentedAt ?? null,
      },
      memberships: memberships.map((m) => ({
        place: m.poi.name,
        role: m.role,
        joinedAt: m.joinedAt,
        religiousConsentAt: m.religiousConsentAt ?? null,
        notifications: {
          news: m.notifyNews,
          requests: m.notifyRequests,
          events: m.notifyEvents,
          live: m.notifyLive,
          readings: m.notifyReadings,
          messages: m.notifyMessages,
        },
      })),
      requests: requests.map((r) => ({
        place: place(r.poi),
        type: r.type,
        status: r.status,
        contactName: r.contactName,
        contactPhone: r.contactPhone ?? null,
        details: r.details,
        preferredDate: r.preferredDate ?? null,
        appointmentAt: r.appointmentAt ?? null,
        appointmentPlace: r.appointmentPlace ?? null,
        createdAt: r.createdAt,
        messages: [...r.messages]
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((m) => ({
            from: m.fromStaff ? 'office' : 'you',
            body: m.body ?? null,
            attachment: m.attachmentName ?? null,
            createdAt: m.createdAt,
          })),
        documents: r.documents.map((d) => ({
          label: d.label,
          note: d.note ?? null,
          file: d.fileName ?? null,
          receivedAt: d.receivedAt ?? null,
        })),
      })),
      prayerRequests: prayerRequests.map((p) => ({
        place: place(p.poi),
        name: p.authorName ?? null,
        message: p.message,
        createdAt: p.createdAt,
      })),
      communityPosts: posts.map((p) => ({
        place: place(p.poi),
        message: p.message,
        createdAt: p.createdAt,
      })),
      communityComments: comments.map((c) => ({
        place: place(c.post?.poi),
        message: c.message,
        createdAt: c.createdAt,
      })),
      messages: conversations.map((c) => ({
        place: place(c.poi),
        messages: [...c.messages]
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((m) => ({
            from: m.fromStaff ? 'office' : 'you',
            body: m.body,
            createdAt: m.createdAt,
          })),
      })),
      massIntentions: intentions.map((i) => ({
        place: place(i.poi),
        intention: i.intention,
        requesterName: i.requesterName,
        requesterContact: i.requesterContact ?? null,
        celebrationAt: i.celebrationAt ?? null,
        offeringAmount: i.offeringAmount ?? null,
        status: i.status,
        createdAt: i.createdAt,
      })),
      gifts: gifts.map((g) => ({
        place: place(g.poi),
        amount: g.amount,
        currency: g.currency,
        status: g.status,
        purpose: g.purpose,
        campaign: g.campaign?.title ?? null,
        recurring: g.recurring,
        donorName: g.donorName ?? null,
        donorAddress: g.donorAddress ?? null,
        donorPostalCode: g.donorPostalCode ?? null,
        donorCity: g.donorCity ?? null,
        donorTaxId: g.donorTaxId ?? null,
        createdAt: g.createdAt,
      })),
      eventReminders: reminders.map((r) => ({
        place: place(r.event?.poi),
        event: r.event?.title ?? null,
        onlyDate: r.onlyDate ?? null,
      })),
      devices: devices.map((d) => ({
        language: d.language,
        timeZone: d.timeZone ?? null,
        registeredAt: d.createdAt,
      })),
    };
  }

  /**
   * Deletes someone's account and what they wrote. Refused for the
   * accounts that run a place, which would leave a community without an
   * office: those are closed by hand once the place has a new admin.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('No such person');
    if (user.email || user.isSuperadmin) {
      throw new ConflictException(
        'Office accounts are closed by infunion. Write to hello@infunion.app.',
      );
    }
    const runs = await this.dataSource.getRepository(UserPoi).count({
      where: { user: { id: userId }, role: MemberRole.ADMIN },
    });
    if (runs > 0) {
      throw new ConflictException(
        'You manage a place. Hand it over to someone else first.',
      );
    }

    const files = await this.dataSource.transaction(async (manager) => {
      const files = await this.erase(manager, userId);
      if (user.avatarUrl)
        files.push({
          area: 'public',
          path: user.avatarUrl.replace(/^\/uploads\//, ''),
        });
      // Everything else that points at the account goes with it or loses
      // the link: see each entity's onDelete.
      await manager.delete(User, { id: userId });
      return files;
    });
    await removeFiles(files);
    // No id or number: the journal only says that an account was closed.
    await this.access.record({ action: 'member.account.deleted' });
  }

  /**
   * The office's version of erasure: one member's membership and what they
   * wrote in this place, at their request. Their account and what they did
   * elsewhere stay. Not for the office's own accounts.
   */
  async removeMemberFromPlace(
    poiId: string,
    userId: string,
    actorId: string,
  ): Promise<void> {
    const membership = await this.dataSource.getRepository(UserPoi).findOne({
      where: { user: { id: userId }, poi: { id: poiId } },
      relations: { poi: true },
    });
    if (!membership) throw new NotFoundException('Not a member of this place');
    if (membership.role === MemberRole.ADMIN) {
      throw new ConflictException('This is one of the office’s own accounts.');
    }

    const files = await this.dataSource.transaction(async (manager) => {
      const files = await this.erase(manager, userId, poiId);
      await manager.delete(UserPoi, { id: membership.id });
      return files;
    });
    await removeFiles(files);
    await this.access.record({
      action: 'member.data.removed',
      actorId,
      poiId,
      poiName: membership.poi.name,
    });
  }

  /**
   * What erasure removes, everywhere or in one place: what the person
   * wrote, their requests with the files sent with them, their messages
   * with the office, their reminders. Returns the files to delete once
   * the transaction has committed.
   */
  private async erase(
    manager: EntityManager,
    userId: string,
    poiId?: string,
  ): Promise<{ area: FileArea; path: string }[]> {
    const inPlace = poiId ? { poi: { id: poiId } } : {};
    const files: { area: FileArea; path: string }[] = [];

    const requests = await manager.find(ServiceRequest, {
      where: { requester: { id: userId }, ...inPlace },
      select: { id: true },
    });
    const requestIds = requests.map((r) => r.id);
    if (requestIds.length > 0) {
      const [documents, messages] = await Promise.all([
        manager.find(ServiceRequestDocument, {
          where: { request: { id: In(requestIds) } },
        }),
        manager.find(ServiceRequestMessage, {
          where: { request: { id: In(requestIds) } },
        }),
      ]);
      for (const d of documents)
        if (d.filePath)
          files.push({ area: 'private', path: d.filePath });
      for (const m of messages)
        if (m.attachmentPath)
          files.push({ area: 'private', path: m.attachmentPath });
      await manager.delete(ServiceRequest, { id: In(requestIds) });
    }

    await manager.delete(PrayerRequest, { author: { id: userId }, ...inPlace });
    await manager.delete(CommunityPost, { author: { id: userId }, ...inPlace });

    const comments = await manager.find(CommunityComment, {
      where: {
        author: { id: userId },
        ...(poiId ? { post: { poi: { id: poiId } } } : {}),
      },
      select: { id: true },
    });
    if (comments.length > 0)
      await manager.delete(CommunityComment, {
        id: In(comments.map((c) => c.id)),
      });

    const conversations = await manager.find(MemberConversation, {
      where: { member: { id: userId }, ...inPlace },
      select: { id: true },
    });
    if (conversations.length > 0) {
      const ids = conversations.map((c) => c.id);
      await manager.delete(MemberMessage, { conversation: { id: In(ids) } });
      await manager.delete(MemberConversation, { id: In(ids) });
    }

    const reminders = await manager.find(EventReminder, {
      where: {
        user: { id: userId },
        ...(poiId ? { event: { poi: { id: poiId } } } : {}),
      },
      select: { id: true },
    });
    if (reminders.length > 0)
      await manager.delete(EventReminder, {
        id: In(reminders.map((r) => r.id)),
      });

    const intentions = await manager.find(MassIntention, {
      where: { requester: { id: userId }, ...inPlace },
      select: { id: true },
    });
    if (intentions.length > 0) {
      await manager.update(
        MassIntention,
        { id: In(intentions.map((i) => i.id)) },
        { requester: null, requesterName: ANONYMOUS, requesterContact: null },
      );
    }

    return files;
  }

  /**
   * The storage limits: member accounts unused for INACTIVE_ACCOUNT_MONTHS,
   * sign-in codes past their day, and journal entries past
   * AUDIT_LOG_MONTHS. Runs once a day; `now` is for the tests.
   */
  async applyRetention(now = new Date()): Promise<{ accountsDeleted: number }> {
    const inactiveSince = monthsBefore(now, INACTIVE_ACCOUNT_MONTHS);
    const stale: { id: string }[] = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .select('user.id', 'id')
      .where('user.phone IS NOT NULL')
      .andWhere('user.email IS NULL')
      .andWhere('user.is_superadmin = false')
      .andWhere(
        'COALESCE(user.last_seen_at, user.created_at) < :inactiveSince',
        { inactiveSince },
      )
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM user_pois m WHERE m.user_id = user.id AND m.role = :admin)`,
        { admin: MemberRole.ADMIN },
      )
      .getRawMany();

    let accountsDeleted = 0;
    for (const { id } of stale) {
      try {
        await this.deleteAccount(id);
        accountsDeleted += 1;
      } catch (error) {
        this.logger.warn(
          `Could not delete inactive account: ${(error as Error).message}`,
        );
      }
    }

    await this.dataSource
      .getRepository(PhoneVerificationCode)
      .delete({ expiresAt: LessThan(new Date(now.getTime() - DAY_MS)) });
    await this.dataSource
      .getRepository(AuditLog)
      .delete({ createdAt: LessThan(monthsBefore(now, AUDIT_LOG_MONTHS)) });
    // Failed-login counts (they hold e-mail addresses) once they no longer
    // lock anything. The geocoder's shared clock stays.
    await this.dataSource
      .getRepository(RateLimit)
      .createQueryBuilder()
      .delete()
      .where('updated_at < :before', { before: new Date(now.getTime() - DAY_MS) })
      .andWhere('(locked_until IS NULL OR locked_until < :now)', { now })
      .andWhere("key NOT LIKE 'geocoder:%'")
      .execute();

    if (accountsDeleted > 0)
      this.logger.log(`Deleted ${accountsDeleted} inactive account(s)`);
    return { accountsDeleted };
  }
}

function monthsBefore(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

/** Best effort, and never outside the area a file belongs to. */
async function removeFiles(
  files: { area: FileArea; path: string }[],
): Promise<void> {
  for (const { area, path } of files) {
    await fileStore().remove(area, path);
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { MemberRole } from '../common/enums/member-role.enum.js';
import { ActiveModulesService } from '../active-modules/active-modules.service.js';
import { ModuleType } from '../common/enums/module-type.enum.js';
import { ModuleStatus } from '../common/enums/module-status.enum.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { text } from '../notifications/texts.js';
import { MemberConversation } from './entities/member-conversation.entity.js';
import { MemberMessage } from './entities/member-message.entity.js';

export type MemberMessageView = {
  id: string;
  fromStaff: boolean;
  authorName: string | null;
  body: string;
  createdAt: Date;
};

/** A member as the office's Membres page lists them. */
export type MemberRow = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  joinedAt: Date;
  // The last message either way, if they have ever been written to.
  lastMessage: { body: string; fromStaff: boolean; createdAt: Date } | null;
  // The member wrote since the office last opened the conversation.
  unread: boolean;
};

export type StaffConversation = {
  member: Omit<MemberRow, 'lastMessage' | 'unread'>;
  messages: MemberMessageView[];
};

/**
 * Messages: the office writes to one member, the member gets a push and
 * reads it (and answers) in the place's Messages section. The members
 * list itself is open to every office; reading and writing need the
 * Messages module running, so a place without it is shown the offer.
 */
@Injectable()
export class MemberMessagesService {
  constructor(
    @InjectRepository(MemberConversation) private readonly conversations: Repository<MemberConversation>,
    @InjectRepository(MemberMessage) private readonly messages: Repository<MemberMessage>,
    @InjectRepository(UserPoi) private readonly memberships: Repository<UserPoi>,
    private readonly modules: ActiveModulesService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Everyone who joined the place, the conversations with news first.
   * The office's own accounts are left out: nobody writes to themselves.
   */
  async listMembers(poiId: string): Promise<MemberRow[]> {
    const memberships = await this.memberships.find({
      where: { poi: { id: poiId }, role: MemberRole.MEMBER },
      relations: { user: true },
    });
    const conversations = await this.conversations.find({ where: { poi: { id: poiId } }, relations: { member: true } });
    const byMember = new Map(conversations.map((c) => [c.member.id, c]));
    const last = await this.lastMessages(conversations.map((c) => c.id));

    const rows = memberships.map((m): MemberRow => {
      const conversation = byMember.get(m.user.id);
      const lastMessage = conversation ? (last.get(conversation.id) ?? null) : null;
      return {
        ...memberOf(m),
        lastMessage,
        unread: !!conversation && !!lastMessage && !lastMessage.fromStaff && isAfter(lastMessage.createdAt, conversation.staffSeenAt),
      };
    });
    return rows.sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      const at = a.lastMessage?.createdAt.getTime() ?? 0;
      const bt = b.lastMessage?.createdAt.getTime() ?? 0;
      if (at !== bt) return bt - at;
      return displayName(a).localeCompare(displayName(b));
    });
  }

  async openForStaff(poiId: string, memberId: string): Promise<StaffConversation> {
    await this.assertLive(poiId);
    const membership = await this.findMembership(poiId, memberId);
    const conversation = await this.findConversation(poiId, memberId);
    if (conversation) await this.conversations.update(conversation.id, { staffSeenAt: new Date() });
    return { member: memberOf(membership), messages: await this.thread(conversation) };
  }

  async sendFromStaff(poiId: string, memberId: string, staffId: string, body: string): Promise<StaffConversation> {
    await this.assertLive(poiId);
    const membership = await this.findMembership(poiId, memberId);
    const words = clean(body);
    const conversation = await this.append(membership.poi, memberId, staffId, true, words);
    const author = await this.memberships.manager.findOne(User, { where: { id: staffId } });
    const poi = membership.poi;
    this.notifications.fireAndForget(() =>
      this.notifications.notifyUsers([memberId], poi.id, 'messages', (reader) => ({
        title: poi.name,
        body: text(reader.language, 'messageFrom', {
          name: fullName(author) ?? text(reader.language, 'office'),
          body: shorten(words),
        }),
        data: { screen: 'messages', id: conversation.id },
      })),
    );
    return { member: memberOf(membership), messages: await this.thread(conversation) };
  }

  /** The member's side: their conversation with the place, marked read. */
  async openMine(poiId: string, userId: string): Promise<MemberMessageView[]> {
    await this.assertLive(poiId);
    await this.findMembership(poiId, userId);
    const conversation = await this.findConversation(poiId, userId);
    if (conversation) await this.conversations.update(conversation.id, { memberSeenAt: new Date() });
    return this.thread(conversation);
  }

  /** For the dot on the Messages tab; does not mark anything read. */
  async unreadForMember(poiId: string, userId: string): Promise<{ unread: boolean }> {
    const conversation = await this.findConversation(poiId, userId);
    if (!conversation || !(await this.isLive(poiId))) return { unread: false };
    const last = (await this.lastMessages([conversation.id])).get(conversation.id);
    return { unread: !!last && last.fromStaff && isAfter(last.createdAt, conversation.memberSeenAt) };
  }

  async sendMine(poiId: string, userId: string, body: string): Promise<MemberMessageView[]> {
    await this.assertLive(poiId);
    const membership = await this.findMembership(poiId, userId);
    const conversation = await this.append(membership.poi, userId, userId, false, clean(body));
    return this.thread(conversation);
  }

  private async append(
    poi: Poi,
    memberId: string,
    authorId: string,
    fromStaff: boolean,
    body: string,
  ): Promise<MemberConversation> {
    const now = new Date();
    let conversation = await this.findConversation(poi.id, memberId);
    if (!conversation) {
      conversation = await this.conversations.save(
        this.conversations.create({ poi, member: { id: memberId } as User, lastMessageAt: now }),
      );
    }
    await this.messages.save(
      this.messages.create({ conversation, author: { id: authorId } as User, fromStaff, body }),
    );
    // Writing is reading: whoever writes has seen everything before it.
    await this.conversations.update(conversation.id, {
      lastMessageAt: now,
      ...(fromStaff ? { staffSeenAt: now } : { memberSeenAt: now }),
    });
    return conversation;
  }

  private async thread(conversation: MemberConversation | null): Promise<MemberMessageView[]> {
    if (!conversation) return [];
    const rows = await this.messages.find({
      where: { conversation: { id: conversation.id } },
      relations: { author: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((m) => ({
      id: m.id,
      fromStaff: m.fromStaff,
      authorName: fullName(m.author),
      body: m.body,
      createdAt: m.createdAt,
    }));
  }

  private async lastMessages(
    conversationIds: string[],
  ): Promise<Map<string, { body: string; fromStaff: boolean; createdAt: Date }>> {
    if (conversationIds.length === 0) return new Map();
    const rows = await this.messages
      .createQueryBuilder('m')
      .distinctOn(['m.conversation_id'])
      .where({ conversation: { id: In(conversationIds) } })
      .orderBy('m.conversation_id')
      .addOrderBy('m.created_at', 'DESC')
      .addSelect('m.conversation_id', 'conversation_id')
      .getRawAndEntities();
    const map = new Map<string, { body: string; fromStaff: boolean; createdAt: Date }>();
    rows.entities.forEach((m, i) => {
      const raw = rows.raw[i] as { conversation_id: string };
      map.set(raw.conversation_id, { body: m.body, fromStaff: m.fromStaff, createdAt: m.createdAt });
    });
    return map;
  }

  private findConversation(poiId: string, memberId: string): Promise<MemberConversation | null> {
    return this.conversations.findOne({ where: { poi: { id: poiId }, member: { id: memberId } } });
  }

  // A 404 for anyone not in the place, so ids can't be probed.
  private async findMembership(poiId: string, userId: string): Promise<UserPoi> {
    const membership = await this.memberships.findOne({
      where: { poi: { id: poiId }, user: { id: userId } },
      relations: { user: true, poi: true },
    });
    if (!membership) throw new NotFoundException('Not a member of this place');
    return membership;
  }

  private async isLive(poiId: string): Promise<boolean> {
    const modules = await this.modules.findActiveModulesForPoi(poiId);
    return modules.some(
      (m) => m.moduleType === ModuleType.MESSAGES && (m.status === ModuleStatus.TRIAL || m.status === ModuleStatus.ACTIVE),
    );
  }

  // The admin reads this code to show the offer instead of an error.
  private async assertLive(poiId: string): Promise<void> {
    if (!(await this.isLive(poiId))) throw new ForbiddenException('messages_module_off');
  }
}

function memberOf(m: UserPoi): Omit<MemberRow, 'lastMessage' | 'unread'> {
  return {
    userId: m.user.id,
    firstName: m.user.firstName ?? null,
    lastName: m.user.lastName ?? null,
    phone: m.user.phone ?? null,
    joinedAt: m.joinedAt,
  };
}

function fullName(user: User | null | undefined): string | null {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || null;
}

function displayName(row: MemberRow): string {
  return [row.firstName, row.lastName].filter(Boolean).join(' ') || row.phone || '';
}

function isAfter(at: Date, seen: Date | null | undefined): boolean {
  return !seen || at.getTime() > seen.getTime();
}

function clean(body: string): string {
  const words = body.trim();
  if (!words) throw new BadRequestException('Write a message');
  return words;
}

function shorten(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 120 ? `${flat.slice(0, 117)}…` : flat;
}

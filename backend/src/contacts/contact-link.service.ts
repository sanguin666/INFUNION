import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Contact } from './entities/contact.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { MemberRole } from '../common/enums/member-role.enum.js';
import { phoneKey } from './contact-rules.js';

/**
 * Turns "not in the app yet" into a member: when someone signs in with an
 * email or phone that a community has on its list, the contact is linked
 * to their account and they join that community. The 6-digit code has
 * just proved the email or phone is theirs.
 *
 * A church membership made this way has no religious consent yet: the app
 * asks for it the first time it opens the community, as it does for older
 * memberships, and "Not now" ends it.
 *
 * Kept in a module of its own (no guards, no other services) so sign-in
 * and joining can use it without pulling the contacts pages in.
 */
@Injectable()
export class ContactLinkService {
  private readonly logger = new Logger('Contacts');

  constructor(
    @InjectRepository(Contact) private readonly contacts: Repository<Contact>,
    @InjectRepository(UserPoi) private readonly memberships: Repository<UserPoi>,
  ) {}

  /** Never fails the sign-in: linking is a bonus, not a gate. */
  async linkOnSignIn(userId: string, login: { email?: string | null; phone?: string | null }): Promise<void> {
    try {
      await this.link(userId, login);
    } catch (error) {
      this.logger.warn(`Could not link contacts: ${(error as Error).message}`);
    }
  }

  async link(userId: string, login: { email?: string | null; phone?: string | null }): Promise<number> {
    const where: object[] = [];
    const email = login.email?.trim().toLowerCase();
    if (email) where.push({ email, user: IsNull() });
    const key = phoneKey(login.phone);
    if (key) where.push({ phoneKey: key, user: IsNull() });
    if (where.length === 0) return 0;

    const found = await this.contacts.find({ where, relations: { poi: true } });
    // A community that is closing takes no new members.
    const open = found.filter((c) => !c.poi.closingRequestedAt && !c.poi.closedAt);
    const now = new Date();
    for (const contact of open) {
      await this.contacts.update(contact.id, { user: { id: userId }, linkedAt: now });
      const existing = await this.memberships.findOne({
        where: { user: { id: userId }, poi: { id: contact.poi.id } },
      });
      if (!existing) {
        await this.memberships.save(
          this.memberships.create({ user: { id: userId }, poi: { id: contact.poi.id }, role: MemberRole.MEMBER, religiousConsentAt: null }),
        );
      }
    }
    return open.length;
  }

  /**
   * Someone who joined a community by its QR code: if they are on its
   * list by email or phone, the contact is theirs.
   */
  async linkOnJoin(userId: string, poiId: string, login: { email?: string | null; phone?: string | null }): Promise<void> {
    try {
      const where: object[] = [];
      const email = login.email?.trim().toLowerCase();
      if (email) where.push({ poi: { id: poiId }, email, user: IsNull() });
      const key = phoneKey(login.phone);
      if (key) where.push({ poi: { id: poiId }, phoneKey: key, user: IsNull() });
      if (where.length === 0) return;
      const found = await this.contacts.find({ where });
      for (const contact of found) {
        await this.contacts.update(contact.id, { user: { id: userId }, linkedAt: new Date() });
      }
    } catch (error) {
      this.logger.warn(`Could not link contacts: ${(error as Error).message}`);
    }
  }
}

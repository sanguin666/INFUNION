import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { Contact } from './entities/contact.entity.js';
import { OutreachRecipient } from './entities/outreach-recipient.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { User } from '../users/entities/user.entity.js';
import { MemberRole } from '../common/enums/member-role.enum.js';
import {
  cleanRow,
  displayName,
  keysOf,
  mergeContacts,
  phoneKey,
  planFile,
  type CleanContact,
  type ContactInput,
  type RowProblem,
} from './contact-rules.js';
import { MAX_IMPORT_ROWS, type ContactDto } from './dto/contacts.dto.js';

/** At most this many people on one community's list. */
export const MAX_CONTACTS_PER_COMMUNITY = 20000;

/** A contact as the Members page lists it. */
export type ContactRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  telegram: string | null;
  language: string | null;
  groups: string[];
  status: 'notInApp' | 'invited' | 'inApp' | 'stopped';
  userId: string | null;
  invitedAt: Date | null;
  linkedAt: Date | null;
  lastWrittenAt: Date | null;
  // The invitation was opened (its button tapped).
  invitationClicked: boolean;
  createdAt: Date;
};

export type ImportCheck = {
  rows: number;
  // People not on the list yet.
  added: { name: string; rows: number[] }[];
  // Already on the list: only what was missing is filled in.
  updated: { name: string; rows: number[] }[];
  // Already in the app: they become linked contacts straight away.
  inApp: { name: string; rows: number[] }[];
  // Rows of the file that were the same person, merged.
  merged: { name: string; rows: number[] }[];
  problems: { row: number; problem: RowProblem; name: string | null }[];
};

export type ImportResult = { added: number; updated: number; inApp: number; skipped: number };

export function newToken(): string {
  return randomBytes(16).toString('hex');
}

function statusOf(contact: Contact): ContactRow['status'] {
  if (contact.user) return 'inApp';
  if (contact.unsubscribedAt) return 'stopped';
  if (contact.invitedAt) return 'invited';
  return 'notInApp';
}

/**
 * A community's own list of members (Seb, 9 Nov 2026): imported from a
 * spreadsheet, checked before anything is saved, merged with who is
 * already there, and edited or erased one by one.
 */
@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact) private readonly contacts: Repository<Contact>,
    @InjectRepository(OutreachRecipient) private readonly recipients: Repository<OutreachRecipient>,
    @InjectRepository(UserPoi) private readonly memberships: Repository<UserPoi>,
  ) {}

  async list(poiId: string): Promise<ContactRow[]> {
    const contacts = await this.contacts.find({
      where: { poi: { id: poiId } },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
    const clicked = new Set(
      (
        await this.recipients
          .createQueryBuilder('r')
          .innerJoin('r.contact', 'c')
          .innerJoin('r.outreach', 'o')
          .select('DISTINCT c.id', 'id')
          .where('c.poi_id = :poiId', { poiId })
          .andWhere("o.kind = 'invitation'")
          .andWhere('r.clicked_at IS NOT NULL')
          .getRawMany<{ id: string }>()
      ).map((r) => r.id),
    );
    return contacts.map((c) => this.rowOf(c, clicked.has(c.id)));
  }

  rowOf(contact: Contact, invitationClicked = false): ContactRow {
    return {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      whatsapp: contact.whatsapp,
      telegram: contact.telegram,
      language: contact.language,
      groups: contact.groups ?? [],
      status: statusOf(contact),
      userId: contact.user?.id ?? null,
      invitedAt: contact.invitedAt,
      linkedAt: contact.linkedAt,
      lastWrittenAt: contact.lastWrittenAt,
      invitationClicked,
      createdAt: contact.createdAt,
    };
  }

  /** What importing these rows would do, without saving anything. */
  async check(poiId: string, rows: ContactInput[]): Promise<ImportCheck> {
    const { plan, existing, members } = await this.prepare(poiId, rows);
    const result: ImportCheck = { rows: rows.length, added: [], updated: [], inApp: [], merged: [], problems: plan.problems };
    for (const person of plan.people) {
      const entry = { name: displayName(person.contact), rows: person.rows };
      if (person.rows.length > 1) result.merged.push(entry);
      const found = this.findIn(existing, person.contact);
      if (found) result.updated.push(entry);
      else if (this.findIn(members, person.contact)) result.inApp.push(entry);
      else result.added.push(entry);
    }
    return result;
  }

  async import(poiId: string, actorId: string, rows: ContactInput[], fileName?: string): Promise<ImportResult> {
    const { plan, existing, members } = await this.prepare(poiId, rows);
    const total = await this.contacts.count({ where: { poi: { id: poiId } } });
    const newOnes = plan.people.filter((p) => !this.findIn(existing, p.contact)).length;
    if (total + newOnes > MAX_CONTACTS_PER_COMMUNITY) {
      throw new BadRequestException(`A community's list holds at most ${MAX_CONTACTS_PER_COMMUNITY} people`);
    }
    const source = (fileName?.trim() || 'import').slice(0, 160);
    const result: ImportResult = { added: 0, updated: 0, inApp: 0, skipped: plan.problems.length };
    const toSave: Contact[] = [];
    for (const { contact } of plan.people) {
      const found = this.findIn(existing, contact);
      if (found) {
        const merged = mergeContacts(found as CleanContact, contact);
        // An email another contact of this community already has stays where it is.
        if (merged.email && merged.email !== found.email && existing.byKey.has(`e:${merged.email}`)) merged.email = found.email;
        Object.assign(found, merged, { phoneKey: phoneKey(merged.phone ?? merged.whatsapp) });
        toSave.push(found);
        result.updated += 1;
        continue;
      }
      const member = this.findIn(members, contact) as { userId: string } | null;
      const created = this.contacts.create({
        ...contact,
        poi: { id: poiId },
        phoneKey: phoneKey(contact.phone ?? contact.whatsapp),
        token: newToken(),
        source,
        addedBy: actorId,
        user: member ? ({ id: member.userId } as User) : null,
        linkedAt: member ? new Date() : null,
      });
      toSave.push(created);
      if (member) result.inApp += 1;
      else result.added += 1;
    }
    for (let i = 0; i < toSave.length; i += 500) await this.contacts.save(toSave.slice(i, i + 500));
    return result;
  }

  async add(poiId: string, actorId: string, dto: ContactDto): Promise<ContactRow> {
    const { contact, problem } = cleanRow(dto);
    if (problem) throw new BadRequestException(problem);
    const { existing, members } = await this.prepare(poiId, []);
    if (this.findIn(existing, contact)) throw new ConflictException('already_on_list');
    if ((await this.contacts.count({ where: { poi: { id: poiId } } })) >= MAX_CONTACTS_PER_COMMUNITY) {
      throw new BadRequestException('list_full');
    }
    const member = this.findIn(members, contact) as { userId: string } | null;
    const saved = await this.contacts.save(
      this.contacts.create({
        ...contact,
        poi: { id: poiId },
        phoneKey: phoneKey(contact.phone ?? contact.whatsapp),
        token: newToken(),
        source: 'added by hand',
        addedBy: actorId,
        user: member ? ({ id: member.userId } as User) : null,
        linkedAt: member ? new Date() : null,
      }),
    );
    return this.rowOf(await this.findOne(poiId, saved.id));
  }

  async update(poiId: string, id: string, dto: ContactDto): Promise<ContactRow> {
    const current = await this.findOne(poiId, id);
    const { contact, problem } = cleanRow({ ...current, ...dto });
    if (problem) throw new BadRequestException(problem);
    if (contact.email && contact.email !== current.email) {
      const taken = await this.contacts.findOne({ where: { poi: { id: poiId }, email: contact.email, id: Not(id) } });
      if (taken) throw new ConflictException('already_on_list');
    }
    Object.assign(current, contact, { phoneKey: phoneKey(contact.phone ?? contact.whatsapp) });
    await this.contacts.save(current);
    return this.rowOf(current);
  }

  /** Erases one person from the list, at their request or the team's. */
  async remove(poiId: string, id: string): Promise<void> {
    const contact = await this.findOne(poiId, id);
    await this.contacts.delete(contact.id);
  }

  /** Everything the list holds about one person (GDPR art. 15). */
  async export(poiId: string, id: string): Promise<Record<string, unknown>> {
    const contact = await this.findOne(poiId, id);
    const messages = await this.recipients.find({
      where: { contact: { id } },
      relations: { outreach: true },
      order: { sentAt: 'DESC' },
    });
    return {
      ...this.rowOf(contact),
      source: contact.source,
      unsubscribedAt: contact.unsubscribedAt,
      messages: messages.map((m) => ({
        subject: m.outreach.subject,
        kind: m.outreach.kind,
        channel: m.channel,
        sentAt: m.sentAt,
        clickedAt: m.clickedAt,
      })),
    };
  }

  /** A member removed from the community leaves its list too. */
  async removeForMember(poiId: string, userId: string): Promise<void> {
    await this.contacts.delete({ poi: { id: poiId }, user: { id: userId } });
  }

  async findOne(poiId: string, id: string): Promise<Contact> {
    const contact = await this.contacts.findOne({ where: { id, poi: { id: poiId } }, relations: { user: true } });
    if (!contact) throw new NotFoundException('Not on this community’s list');
    return contact;
  }

  async groups(poiId: string): Promise<string[]> {
    const rows = await this.contacts.manager.query(
      `SELECT DISTINCT jsonb_array_elements_text("groups") AS name FROM contacts WHERE poi_id = $1 ORDER BY name`,
      [poiId],
    );
    return (rows as { name: string }[]).map((r) => r.name);
  }

  // ---- The file against what the community already has ----

  private async prepare(poiId: string, rows: ContactInput[]) {
    if (rows.length > MAX_IMPORT_ROWS) throw new BadRequestException(`At most ${MAX_IMPORT_ROWS} rows at a time`);
    const plan = planFile(rows);
    const current = await this.contacts.find({ where: { poi: { id: poiId } }, relations: { user: true } });
    const existing = { byKey: new Map<string, Contact>() };
    for (const contact of current) {
      for (const key of keysOf({ email: contact.email, phone: contact.phone, whatsapp: contact.whatsapp })) existing.byKey.set(key, contact);
    }
    // Members who joined in the app, by the email or phone they sign in with.
    const memberships = await this.memberships.find({
      where: { poi: { id: poiId }, role: MemberRole.MEMBER },
      relations: { user: true },
    });
    const members = { byKey: new Map<string, { userId: string }>() };
    for (const m of memberships) {
      for (const key of keysOf({ email: m.user.email?.toLowerCase() ?? null, phone: m.user.phone ?? null, whatsapp: null })) {
        members.byKey.set(key, { userId: m.user.id });
      }
    }
    return { plan, existing, members };
  }

  private findIn<T>(index: { byKey: Map<string, T> }, contact: Pick<CleanContact, 'email' | 'phone' | 'whatsapp'>): T | null {
    for (const key of keysOf(contact)) {
      const found = index.byKey.get(key);
      if (found) return found;
    }
    return null;
  }
}

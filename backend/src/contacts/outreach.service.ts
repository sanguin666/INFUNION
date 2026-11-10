import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { Contact } from './entities/contact.entity.js';
import { Outreach, OutreachKind } from './entities/outreach.entity.js';
import { OutreachRecipient } from './entities/outreach-recipient.entity.js';
import { ContactsService } from './contacts.service.js';
import { User } from '../users/entities/user.entity.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { PlanTier } from '../common/enums/plan-tier.enum.js';
import { DonationCampaign } from '../donations/entities/donation-campaign.entity.js';
import { Donation, DonationStatus } from '../donations/entities/donation.entity.js';
import { EmailSender } from '../auth/email/email-sender.js';
import { communityLogoUrl, emailButton, emailHeading, emailLayout, emailParagraph, escapeHtml, emailText } from '../common/email/email-layout.js';
import { sendsNotifications } from '../active-modules/billing-rules.js';
import { fill, outreachText } from './outreach-texts.js';
import type { OutreachDto } from './dto/contacts.dto.js';

/**
 * Emails a community may send outside the app each calendar month, by
 * plan (Seb, 9 Nov 2026, option 1): invitations on every plan, other
 * messages from Essentials up.
 */
export const MONTHLY_EMAILS: Record<PlanTier, number> = {
  [PlanTier.BASIC]: 1000,
  [PlanTier.ESSENTIALS]: 2000,
  [PlanTier.COMPLETE]: 10000,
};

/** An invitation is sent again to the same person after this many days at the earliest. */
export const REINVITE_DAYS = 7;

export type OutreachView = {
  id: string;
  kind: OutreachKind;
  subject: string;
  audience: string;
  createdAt: Date;
  finishedAt: Date | null;
  recipients: number;
  sent: number;
  failed: number;
  clicked: number;
  joined: number;
  contributed: number;
  contributedAmount: number;
};

export type Allowance = { plan: PlanTier; limit: number; used: number; canWrite: boolean };

type Links = { api: string };

function planOf(poi: Poi): PlanTier {
  return poi.billingComped ? PlanTier.COMPLETE : poi.plan;
}

function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** "{name}" in what the team wrote becomes each member's first name. */
export function personalise(text: string, contact: Pick<Contact, 'firstName' | 'lastName'>, community: string): string {
  const name = contact.firstName?.trim() || '';
  return text
    .replace(/\s*\{name\}/g, (all) => (name ? all.replace('{name}', name) : ''))
    .replace(/\{community\}/g, community);
}

/**
 * Writing to members outside the app (Seb, 9 Nov 2026): an invitation to
 * join, a contribution request with a link to pay on the web, or a free
 * message, by email through Brevo. Every email names why it was sent and
 * carries a link to stop them; a click on its button is counted.
 */
@Injectable()
export class OutreachService {
  private readonly logger = new Logger('Outreach');

  constructor(
    @InjectRepository(Contact) private readonly contacts: Repository<Contact>,
    @InjectRepository(Outreach) private readonly outreach: Repository<Outreach>,
    @InjectRepository(OutreachRecipient) private readonly recipients: Repository<OutreachRecipient>,
    @InjectRepository(Poi) private readonly pois: Repository<Poi>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(DonationCampaign) private readonly campaigns: Repository<DonationCampaign>,
    @InjectRepository(Donation) private readonly donations: Repository<Donation>,
    private readonly emailSender: EmailSender,
    private readonly config: ConfigService,
    private readonly contactsService: ContactsService,
  ) {}

  async allowance(poiId: string): Promise<Allowance> {
    const poi = await this.findPoi(poiId);
    const plan = planOf(poi);
    const used = await this.recipients.count({
      where: { outreach: { poi: { id: poiId } }, channel: 'email', sentAt: MoreThanOrEqual(startOfMonth()) },
    });
    return { plan, limit: MONTHLY_EMAILS[plan], used, canWrite: sendsNotifications(poi) };
  }

  async history(poiId: string): Promise<OutreachView[]> {
    const list = await this.outreach.find({
      where: { poi: { id: poiId }, audience: Not('whatsapp') },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    if (list.length === 0) return [];
    const ids = list.map((o) => o.id);
    const clicks = await this.recipients
      .createQueryBuilder('r')
      .select('r.outreach_id', 'id')
      .addSelect('COUNT(*)', 'count')
      .where('r.outreach_id IN (:...ids)', { ids })
      .andWhere('r.clicked_at IS NOT NULL')
      .groupBy('r.outreach_id')
      .getRawMany<{ id: string; count: string }>();
    const joined = await this.recipients
      .createQueryBuilder('r')
      .innerJoin('r.contact', 'c')
      .innerJoin('r.outreach', 'o')
      .select('r.outreach_id', 'id')
      .addSelect('COUNT(*)', 'count')
      .where('r.outreach_id IN (:...ids)', { ids })
      .andWhere('c.linked_at >= o.created_at')
      .groupBy('r.outreach_id')
      .getRawMany<{ id: string; count: string }>();
    const gifts = await this.donations
      .createQueryBuilder('d')
      .innerJoin(OutreachRecipient, 'r', 'r.contact_id = d.contact_id')
      .innerJoin('r.outreach', 'o')
      .select('r.outreach_id', 'id')
      .addSelect('COUNT(DISTINCT d.id)', 'count')
      .addSelect('COALESCE(SUM(d.amount), 0)', 'amount')
      .where('r.outreach_id IN (:...ids)', { ids })
      .andWhere("o.kind = 'contribution'")
      .andWhere('d.created_at >= o.created_at')
      .andWhere('d.status = :completed', { completed: DonationStatus.COMPLETED })
      .groupBy('r.outreach_id')
      .getRawMany<{ id: string; count: string; amount: string }>();
    const by = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
    const [c, j, g] = [by(clicks), by(joined), by(gifts)];
    return list.map((o) => ({
      id: o.id,
      kind: o.kind,
      subject: o.subject,
      audience: o.audience,
      createdAt: o.createdAt,
      finishedAt: o.finishedAt,
      recipients: o.recipients,
      sent: o.sent,
      failed: o.failed,
      clicked: Number(c.get(o.id)?.count ?? 0),
      joined: Number(j.get(o.id)?.count ?? 0),
      contributed: Number(g.get(o.id)?.count ?? 0),
      contributedAmount: Number(g.get(o.id)?.amount ?? 0),
    }));
  }

  /** Who a message would go to: the count the Send button shows. */
  async audienceSize(poiId: string, dto: Pick<OutreachDto, 'kind' | 'audience' | 'group' | 'contactIds'>): Promise<{ withEmail: number; withoutEmail: number }> {
    const all = await this.audienceOf(poiId, dto, false);
    const withEmail = all.filter((c) => !!c.email).length;
    return { withEmail, withoutEmail: all.length - withEmail };
  }

  async send(poiId: string, actorId: string, dto: OutreachDto, links: Links): Promise<OutreachView> {
    const poi = await this.findPoi(poiId);
    this.assertKindAllowed(poi, dto.kind);
    const campaign = await this.campaignFor(poiId, dto);
    const contacts = (await this.audienceOf(poiId, dto, true)).filter((c) => !!c.email);
    if (contacts.length === 0) throw new BadRequestException('nobody_to_write_to');
    const allowance = await this.allowance(poiId);
    if (allowance.used + contacts.length > allowance.limit) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'allowance_exceeded',
        message: 'allowance_exceeded',
        left: Math.max(0, allowance.limit - allowance.used),
      });
    }
    const actor = await this.users.findOne({ where: { id: actorId } });

    const outreach = await this.outreach.save(
      this.outreach.create({
        poi,
        kind: dto.kind,
        subject: dto.subject.trim(),
        body: dto.body.trim(),
        campaignId: campaign?.id ?? null,
        audience: dto.audience === 'group' ? `group:${dto.group ?? ''}`.slice(0, 80) : dto.audience,
        sentBy: actorId,
        recipients: contacts.length,
      }),
    );
    const rows = await this.recipients.save(
      contacts.map((contact) => this.recipients.create({ outreach, contact, channel: 'email' })),
    );
    const now = new Date();
    const ids = contacts.map((c) => c.id);
    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000);
      await this.contacts.update({ id: In(chunk) }, { lastWrittenAt: now });
      if (dto.kind === OutreachKind.INVITATION) await this.contacts.update({ id: In(chunk) }, { invitedAt: now });
    }

    // The emails go out one by one after the answer; the history shows
    // them leaving.
    void this.deliver(poi, outreach, rows, campaign, actor, links);
    return (await this.history(poiId)).find((o) => o.id === outreach.id)!;
  }

  /** The same email, to the person writing it, before sending it to anyone. */
  async sendTest(poiId: string, actorId: string, dto: OutreachDto, links: Links, to?: string): Promise<{ to: string }> {
    const poi = await this.findPoi(poiId);
    this.assertKindAllowed(poi, dto.kind);
    const campaign = await this.campaignFor(poiId, dto);
    const actor = await this.users.findOne({ where: { id: actorId } });
    const address = to?.trim().toLowerCase() || actor?.email;
    if (!address) throw new BadRequestException('no_email');
    const fake = { firstName: actor?.firstName ?? null, lastName: actor?.lastName ?? null, language: poi.language, token: 'test' } as Contact;
    const draft = { kind: dto.kind, subject: dto.subject.trim(), body: dto.body.trim() } as Outreach;
    const testLink = `${links.api}/m/test/${poi.id}/${dto.kind}${campaign ? `?campaign=${campaign.id}` : ''}`;
    await this.emailSender.send(
      this.emailFor(poi, draft, fake, campaign, actor, { button: testLink, stop: `${links.api}/m/stop/test` }, true, address),
    );
    return { to: address };
  }

  /**
   * An invitation the team sends from its own WhatsApp: the text with a
   * personal link, opened in WhatsApp ready to send. Free; counted like
   * an email invitation (but not against the monthly emails).
   */
  async whatsappInvite(poiId: string, contactId: string, actorId: string, links: Links): Promise<{ url: string; text: string }> {
    const poi = await this.findPoi(poiId);
    const contact = await this.contacts.findOne({ where: { id: contactId, poi: { id: poiId } }, relations: { user: true } });
    if (!contact) throw new NotFoundException('Not on this community’s list');
    const number = (contact.whatsapp ?? contact.phone ?? '').replace(/\D/g, '');
    if (!number) throw new BadRequestException('no_phone');
    const outreach = await this.outreach.save(
      this.outreach.create({
        poi,
        kind: OutreachKind.INVITATION,
        subject: 'WhatsApp',
        body: '',
        audience: 'whatsapp',
        sentBy: actorId,
        recipients: 1,
        sent: 1,
        finishedAt: new Date(),
      }),
    );
    const recipient = await this.recipients.save(
      this.recipients.create({ outreach, contact, channel: 'whatsapp', sentAt: new Date() }),
    );
    await this.contacts.update(contact.id, { invitedAt: new Date(), lastWrittenAt: new Date() });
    const words = outreachText(contact.language ?? poi.language);
    const text = fill(words.whatsappInvite, {
      name: contact.firstName ?? '',
      community: poi.name,
      link: `${links.api}/m/${recipient.id}`,
    }).replace(/ ,/, ',');
    return { url: `https://wa.me/${number}?text=${encodeURIComponent(text)}`, text };
  }

  // ---- What the member reaches from an email ----

  /** A click on an email's button: counted, then where the button leads. */
  async click(recipientId: string): Promise<{ recipient: OutreachRecipient; poi: Poi } | null> {
    if (!/^[0-9a-f-]{36}$/i.test(recipientId)) return null;
    const recipient = await this.recipients.findOne({
      where: { id: recipientId },
      relations: { outreach: { poi: true }, contact: true },
    });
    if (!recipient) return null;
    if (!recipient.clickedAt) await this.recipients.update(recipient.id, { clickedAt: new Date() });
    return { recipient, poi: recipient.outreach.poi };
  }

  async findRecipient(recipientId: string): Promise<OutreachRecipient | null> {
    if (!/^[0-9a-f-]{36}$/i.test(recipientId)) return null;
    return this.recipients.findOne({ where: { id: recipientId }, relations: { outreach: { poi: true }, contact: true } });
  }

  async findCampaign(poiId: string, id: string | null | undefined): Promise<DonationCampaign | null> {
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    return this.campaigns.findOne({ where: { id, poi: { id: poiId }, active: true } });
  }

  async findPoiPublic(poiId: string): Promise<Poi | null> {
    if (!/^[0-9a-f-]{36}$/i.test(poiId)) return null;
    return this.pois.findOne({ where: { id: poiId } });
  }

  async findByToken(token: string): Promise<Contact | null> {
    if (!/^[0-9a-f]{32}$/.test(token)) return null;
    return this.contacts.findOne({ where: { token }, relations: { poi: true } });
  }

  async stop(token: string): Promise<Contact | null> {
    const contact = await this.findByToken(token);
    if (!contact) return null;
    if (!contact.unsubscribedAt) await this.contacts.update(contact.id, { unsubscribedAt: new Date() });
    return contact;
  }

  landingJoinUrl(poi: Poi): string {
    const landing = this.config.get<string>('LANDING_URL')?.trim().replace(/\/$/, '') || 'https://infunion.app';
    return `${landing}/?token=${encodeURIComponent(poi.qrCodeToken)}#join`;
  }

  // ---- Inside ----

  private async deliver(
    poi: Poi,
    outreach: Outreach,
    rows: OutreachRecipient[],
    campaign: DonationCampaign | null,
    actor: User | null,
    links: Links,
  ): Promise<void> {
    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await this.emailSender.send(
          this.emailFor(poi, outreach, row.contact, campaign, actor, {
            button: `${links.api}/m/${row.id}`,
            stop: `${links.api}/m/stop/${row.contact.token}`,
          }),
        );
        await this.recipients.update(row.id, { sentAt: new Date() });
        sent += 1;
      } catch (error) {
        failed += 1;
        await this.recipients.update(row.id, { error: (error as Error).message.slice(0, 200) });
      }
      if ((sent + failed) % 20 === 0) await this.outreach.update(outreach.id, { sent, failed });
    }
    await this.outreach.update(outreach.id, { sent, failed, finishedAt: new Date() });
    if (failed > 0) this.logger.warn(`${failed} of ${rows.length} emails failed for ${poi.id}`);
  }

  emailFor(
    poi: Poi,
    outreach: Pick<Outreach, 'kind' | 'subject' | 'body'>,
    contact: Pick<Contact, 'firstName' | 'lastName' | 'language' | 'email'>,
    campaign: DonationCampaign | null,
    actor: User | null,
    urls: { button: string; stop: string },
    test = false,
    to?: string,
  ) {
    const language = contact.language ?? poi.language;
    const words = outreachText(language);
    const subject = personalise(outreach.subject, contact, poi.name);
    const body = personalise(outreach.body, contact, poi.name);
    const button =
      outreach.kind === OutreachKind.INVITATION
        ? words.join
        : outreach.kind === OutreachKind.CONTRIBUTION
          ? words.contribute
          : null;
    const why = fill(words.why, { community: poi.name });
    const html = emailLayout(
      [
        emailHeading(subject),
        ...body.split(/\n{2,}/).map((part) => emailParagraph(part)),
        campaign ? emailParagraph(fill(words.giveProject, { project: campaign.title }), { muted: true }) : '',
        button ? emailButton(button, urls.button) : '',
        `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#6b6880">${escapeHtml(why)} <a href="${escapeHtml(urls.stop)}" style="color:#6b6880">${escapeHtml(words.stop)}</a></p>`,
      ].join(''),
      language,
      // The community's own header (Seb, 10 Nov 2026); infunion stays in the footer.
      { name: poi.name, logoUrl: communityLogoUrl(poi.logoUrl, this.config.get<string>('API_PUBLIC_URL')) },
    );
    const text = emailText([subject, '', body, '', button ? `${button}: ${urls.button}` : '', '', `${why} ${words.stop}: ${urls.stop}`].join('\n'), language);
    return {
      to: to ?? (test ? actor?.email ?? '' : contact.email ?? ''),
      subject: test ? `[Test] ${subject}` : subject,
      text,
      html,
      fromName: `${poi.name} · infunion`.slice(0, 70),
      ...(actor?.email ? { replyTo: actor.email } : {}),
      headers: {
        'List-Unsubscribe': `<${urls.stop}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    };
  }

  private assertKindAllowed(poi: Poi, kind: OutreachKind): void {
    if (kind !== OutreachKind.INVITATION && !sendsNotifications(poi)) {
      throw new ForbiddenException({ statusCode: 403, code: 'not_in_plan', message: 'not_in_plan' });
    }
    if (poi.closingRequestedAt || poi.closedAt) throw new ForbiddenException('This community is closing');
  }

  private async campaignFor(poiId: string, dto: Pick<OutreachDto, 'kind' | 'campaignId'>): Promise<DonationCampaign | null> {
    if (dto.kind !== OutreachKind.CONTRIBUTION || !dto.campaignId) return null;
    const campaign = await this.findCampaign(poiId, dto.campaignId);
    if (!campaign) throw new BadRequestException('This project is not open for contributions');
    return campaign;
  }

  /**
   * The people a message goes to. Never someone who asked to stop.
   * An invitation only goes to people not in the app yet, and not again
   * within REINVITE_DAYS.
   */
  private async audienceOf(
    poiId: string,
    dto: Pick<OutreachDto, 'kind' | 'audience' | 'group' | 'contactIds'>,
    strict: boolean,
  ): Promise<Contact[]> {
    // Members who joined in the app are on the list too (Seb, 10 Nov 2026).
    await this.contactsService.syncMemberContacts(poiId);
    const all = await this.contacts.find({
      where: { poi: { id: poiId }, unsubscribedAt: IsNull() },
      relations: { user: true },
    });
    const invitation = dto.kind === OutreachKind.INVITATION;
    const recently = new Date(Date.now() - REINVITE_DAYS * 24 * 3600 * 1000);
    const wanted = new Set(dto.contactIds ?? []);
    const group = dto.group?.trim().toLowerCase();
    if (strict && dto.audience === 'contacts' && wanted.size === 0) throw new BadRequestException('nobody_to_write_to');
    return all.filter((c) => {
      if (invitation && (c.user || (c.invitedAt && c.invitedAt > recently))) return false;
      switch (dto.audience) {
        case 'notInApp':
          return !c.user;
        case 'notInvited':
          return !c.user && !c.invitedAt;
        case 'group':
          return !!group && (c.groups ?? []).some((g) => g.toLowerCase() === group);
        case 'contacts':
          return wanted.has(c.id);
        default:
          return true;
      }
    });
  }

  private async findPoi(poiId: string): Promise<Poi> {
    const poi = await this.pois.findOne({ where: { id: poiId } });
    if (!poi) throw new NotFoundException('No such community');
    return poi;
  }
}

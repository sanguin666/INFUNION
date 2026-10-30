import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThan, Not, Repository } from 'typeorm';
import { PhoneAuthService, normalizeEmail } from '../auth/phone-auth.service.js';
import { EmailSender, type EmailMessage } from '../auth/email/email-sender.js';
import { SignedUrlService } from '../common/signed-url/signed-url.service.js';
import { fileStore } from '../common/storage/file-store.js';
import { Language } from '../common/enums/language.enum.js';
import { PlanTier } from '../common/enums/plan-tier.enum.js';
import { PoiType } from '../common/enums/poi-type.enum.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { User } from '../users/entities/user.entity.js';
import { signedPrivateFileUrl } from '../private-files/private-files.controller.js';
import { PlaceRegistration } from './entities/place-registration.entity.js';
import { RegistrationBlock } from './entities/registration-block.entity.js';
import type { CreateRegistrationDto } from './dto/registration.dto.js';
import {
  BlockKind,
  MAX_REQUESTS_PER_IP_PER_DAY,
  OPEN_STATUSES,
  PLACE_DPA_VERSION,
  PLACE_TERMS_VERSION,
  REGISTRATION_RETENTION_DAYS,
  RegistrationStatus,
  isDisposableEmail,
  isPlausibleTaxId,
  namesLookAlike,
  normalizeTaxId,
  taxIdFitsKind,
} from './registration-rules.js';
import { declinedEmail, newRequestEmail, questionEmail, readyEmail, receivedEmail } from './registration-emails.js';

const EMAIL_TOKEN_AUDIENCE = 'infunion-registration';
const WORSHIP = [PoiType.CHURCH, PoiType.MOSQUE, PoiType.SYNAGOGUE, PoiType.OTHER_WORSHIP];
const DAY_MS = 24 * 60 * 60 * 1000;

export type UploadedDocument = { filename: string; originalname: string };

export type RegistrationCheck = {
  key:
    | 'emailConfirmed'
    | 'taxIdValid'
    | 'taxIdKind'
    | 'taxIdUnused'
    | 'nameUnused'
    | 'website'
    | 'firstFromEmail'
    | 'firstFromIp'
    | 'firstFromPhone'
    | 'documentChecked'
    | 'account';
  level: 'ok' | 'warn' | 'info';
  // For the wording: the place that looks the same, how many other requests…
  detail?: string;
  n?: number;
};

/**
 * Place registration from the landing (Seb, 30 Oct 2026): the public form,
 * the email check, and what the superadmin sees of each request. Turning
 * a request into a place is SuperadminService's, since it is the one that
 * creates places.
 */
@Injectable()
export class RegistrationsService {
  private readonly logger = new Logger('Registrations');

  constructor(
    @InjectRepository(PlaceRegistration) private readonly registrations: Repository<PlaceRegistration>,
    @InjectRepository(RegistrationBlock) private readonly blocks: Repository<RegistrationBlock>,
    @InjectRepository(Poi) private readonly pois: Repository<Poi>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly phoneAuth: PhoneAuthService,
    private readonly emailSender: EmailSender,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly signedUrls: SignedUrlService,
  ) {}

  // ------------------------------------------------------------------ public

  async requestEmailCode(rawEmail: string, language?: Language) {
    const email = normalizeEmail(rawEmail);
    await this.assertEmailAllowed(email);
    return this.phoneAuth.requestEmailCode(email, language);
  }

  /** The code was right: a token proving it, for the form's last step. */
  async verifyEmailCode(rawEmail: string, code: string) {
    const email = await this.phoneAuth.confirmEmailCode(rawEmail, code);
    const existing = await this.users.createQueryBuilder('u').where('lower(u.email) = :email', { email }).getOne();
    const emailToken = await this.jwt.signAsync({ email }, { audience: EMAIL_TOKEN_AUDIENCE, expiresIn: '2h' });
    return { emailToken, hasAccount: !!existing && !existing.isSuperadmin };
  }

  async create(dto: CreateRegistrationDto, document: UploadedDocument | undefined, ip: string | null, userAgent: string | null) {
    // A bot filled the hidden field: say yes and keep nothing.
    if (dto.homepage) {
      await this.discard(document);
      return { ok: true };
    }
    try {
      return await this.createChecked(dto, document, ip, userAgent);
    } catch (error) {
      await this.discard(document);
      throw error;
    }
  }

  private async createChecked(dto: CreateRegistrationDto, document: UploadedDocument | undefined, ip: string | null, userAgent: string | null) {
    const email = await this.emailFromToken(dto.emailToken);
    await this.assertEmailAllowed(email);
    if (!document) throw new BadRequestException('document_required');

    const taxId = normalizeTaxId(dto.taxId);
    if (!isPlausibleTaxId(taxId, dto.country)) throw new BadRequestException('tax_id_invalid');
    if (await this.blocks.exists({ where: { kind: BlockKind.TAX_ID, value: taxId } })) throw new ForbiddenException('blocked');

    const worship = WORSHIP.includes(dto.type);
    if (worship && !dto.acceptReligiousData) throw new BadRequestException('religious_data_required');

    if (dto.existingPoiId && !(await this.pois.exists({ where: { id: dto.existingPoiId } }))) {
      throw new BadRequestException('place_not_found');
    }

    if (ip) {
      const today = await this.registrations.count({ where: { ip, createdAt: MoreThan(new Date(Date.now() - DAY_MS)) } });
      if (today >= MAX_REQUESTS_PER_IP_PER_DAY) {
        throw new HttpException('too_many_requests', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const now = new Date();
    const saved = await this.registrations.save(
      this.registrations.create({
        status: RegistrationStatus.PENDING,
        placeName: dto.placeName,
        type: dto.type,
        address: dto.address,
        postalCode: dto.postalCode,
        city: dto.city,
        country: dto.country,
        language: dto.language,
        website: dto.website ?? null,
        legalName: dto.legalName,
        taxId,
        documentPath: `registrations/${document.filename}`,
        documentName: document.originalname.slice(0, 200),
        existingPoiId: dto.existingPoiId ?? null,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        email,
        phone: dto.phone ?? null,
        plan: dto.plan,
        billingInterval: dto.billingInterval,
        termsVersion: PLACE_TERMS_VERSION,
        dpaVersion: PLACE_DPA_VERSION,
        religiousDataAgreed: worship && !!dto.acceptReligiousData,
        signedName: dto.signedName,
        signedAt: now,
        ip,
        userAgent: userAgent?.slice(0, 300) ?? null,
      }),
    );

    await this.send(
      receivedEmail({
        email,
        firstName: saved.firstName,
        placeName: saved.placeName,
        language: saved.language,
        signedName: saved.signedName,
        date: now.toISOString().slice(0, 10),
        terms: PLACE_TERMS_VERSION,
        dpa: PLACE_DPA_VERSION,
      }),
    );
    const superadmin = this.config.get<string>('SUPERADMIN_EMAIL')?.trim();
    if (superadmin) {
      await this.send(
        newRequestEmail(superadmin, {
          placeName: saved.placeName,
          city: saved.city,
          plan: saved.plan,
          email,
          reviewUrl: `${this.dashboardUrl()}/superadmin/registrations/${saved.id}`,
        }),
      );
    }
    return { ok: true, id: saved.id };
  }

  private async emailFromToken(token: string): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<{ email: string }>(token, { audience: EMAIL_TOKEN_AUDIENCE });
      return payload.email;
    } catch {
      throw new UnauthorizedException('email_not_confirmed');
    }
  }

  /** Throwaway inboxes, blocked addresses and a second open request are refused. */
  private async assertEmailAllowed(email: string): Promise<void> {
    if (isDisposableEmail(email)) throw new BadRequestException('email_disposable');
    if (await this.blocks.exists({ where: { kind: BlockKind.EMAIL, value: email } })) throw new ForbiddenException('blocked');
    if (await this.registrations.exists({ where: { email, status: In(OPEN_STATUSES) } })) {
      throw new ConflictException('already_pending');
    }
  }

  private async discard(document: UploadedDocument | undefined): Promise<void> {
    if (!document) return;
    await fileStore().remove('private', `registrations/${document.filename}`).catch(() => undefined);
  }

  // ------------------------------------------------------------------ superadmin

  async list(status: 'open' | 'approved' | 'declined' | 'all' = 'open') {
    await this.sweep();
    const where =
      status === 'open'
        ? { status: In(OPEN_STATUSES) }
        : status === 'approved'
          ? { status: RegistrationStatus.APPROVED }
          : status === 'declined'
            ? { status: RegistrationStatus.DECLINED }
            : {};
    const rows = await this.registrations.find({ where, order: { createdAt: status === 'open' ? 'ASC' : 'DESC' }, take: 200 });
    return Promise.all(
      rows.map(async (r) => {
        const checks = await this.checks(r);
        return {
          ...this.summary(r),
          warnings: checks.filter((c) => c.level === 'warn' && c.key !== 'documentChecked').length,
        };
      }),
    );
  }

  async openCount(): Promise<number> {
    return this.registrations.count({ where: { status: In(OPEN_STATUSES) } });
  }

  async detail(id: string) {
    const r = await this.find(id);
    const existingPoi = r.existingPoiId ? await this.pois.findOne({ where: { id: r.existingPoiId } }) : null;
    return {
      ...this.summary(r),
      address: r.address,
      postalCode: r.postalCode,
      country: r.country,
      language: r.language,
      website: r.website ?? null,
      legalName: r.legalName,
      taxId: r.taxId,
      documentName: r.documentName ?? null,
      documentUrl: r.documentPath ? signedPrivateFileUrl(this.signedUrls, r.documentPath, r.documentName) : null,
      documentCheckedAt: r.documentCheckedAt?.toISOString() ?? null,
      existingPoi: existingPoi ? { id: existingPoi.id, name: existingPoi.name, city: existingPoi.city ?? null } : null,
      role: r.role,
      phone: r.phone ?? null,
      billingInterval: r.billingInterval,
      termsVersion: r.termsVersion,
      dpaVersion: r.dpaVersion,
      religiousDataAgreed: r.religiousDataAgreed,
      signedName: r.signedName,
      signedAt: r.signedAt.toISOString(),
      ip: r.ip ?? null,
      question: r.question ?? null,
      questionedAt: r.questionedAt?.toISOString() ?? null,
      declineReason: r.declineReason ?? null,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      decidedBy: r.decidedBy ?? null,
      checks: await this.checks(r),
    };
  }

  private summary(r: PlaceRegistration) {
    return {
      id: r.id,
      status: r.status,
      placeName: r.placeName,
      type: r.type,
      city: r.city,
      plan: r.plan,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      claim: !!r.existingPoiId,
      poiId: r.poiId ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  /** What the superadmin is told about a request before deciding. */
  async checks(r: PlaceRegistration): Promise<RegistrationCheck[]> {
    const checks: RegistrationCheck[] = [{ key: 'emailConfirmed', level: 'ok' }];

    const valid = isPlausibleTaxId(r.taxId, r.country);
    checks.push({ key: 'taxIdValid', level: valid ? 'ok' : 'warn' });
    if (valid && r.country === 'ES') checks.push({ key: 'taxIdKind', level: taxIdFitsKind(r.taxId, r.type) ? 'ok' : 'warn', detail: r.taxId[0] });

    // Once approved, the place the request created is not a duplicate of itself.
    const own = r.poiId ?? r.existingPoiId ?? null;
    const sameTaxId = await this.pois.findOne({
      where: own ? { legalTaxId: r.taxId, id: Not(own) } : { legalTaxId: r.taxId },
      select: { id: true, name: true },
    });
    checks.push(sameTaxId ? { key: 'taxIdUnused', level: 'warn', detail: sameTaxId.name } : { key: 'taxIdUnused', level: 'ok' });

    if (!r.existingPoiId) {
      const sameTown = await this.pois
        .createQueryBuilder('p')
        .select(['p.id', 'p.name'])
        .where('(lower(p.city) = lower(:city) OR p.postal_code = :postal)', { city: r.city, postal: r.postalCode })
        .andWhere(own ? 'p.id <> :own' : 'TRUE', { own })
        .getMany();
      const lookAlike = sameTown.find((p) => namesLookAlike(p.name, r.placeName));
      checks.push(lookAlike ? { key: 'nameUnused', level: 'warn', detail: lookAlike.name } : { key: 'nameUnused', level: 'ok' });
    }

    checks.push({ key: 'website', level: r.website ? 'ok' : 'warn', detail: r.website ?? undefined });

    const others = { id: Not(r.id) };
    const byEmail = await this.registrations.count({ where: { ...others, email: r.email } });
    checks.push({ key: 'firstFromEmail', level: byEmail ? 'warn' : 'ok', n: byEmail });
    if (r.ip) {
      const byIp = await this.registrations.count({ where: { ...others, ip: r.ip } });
      checks.push({ key: 'firstFromIp', level: byIp ? 'warn' : 'ok', n: byIp });
    }
    if (r.phone) {
      const byPhone = await this.registrations.count({ where: { ...others, phone: r.phone } });
      checks.push({ key: 'firstFromPhone', level: byPhone ? 'warn' : 'ok', n: byPhone });
    }

    checks.push({ key: 'documentChecked', level: r.documentCheckedAt ? 'ok' : 'warn' });

    const account = await this.users.createQueryBuilder('u').where('lower(u.email) = :email', { email: r.email }).getOne();
    checks.push({ key: 'account', level: 'info', detail: account ? 'existing' : 'new' });
    return checks;
  }

  async find(id: string): Promise<PlaceRegistration> {
    const r = await this.registrations.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    return r;
  }

  async findOpen(id: string): Promise<PlaceRegistration> {
    const r = await this.find(id);
    if (!OPEN_STATUSES.includes(r.status)) throw new ConflictException('already_decided');
    return r;
  }

  async markDocumentChecked(id: string, checked: boolean) {
    const r = await this.findOpen(id);
    r.documentCheckedAt = checked ? new Date() : null;
    await this.registrations.save(r);
    return r;
  }

  async askQuestion(id: string, message: string) {
    const r = await this.findOpen(id);
    r.status = RegistrationStatus.QUESTION;
    r.question = message;
    r.questionedAt = new Date();
    await this.registrations.save(r);
    await this.send(questionEmail({ ...this.mailFields(r), message }));
    return r;
  }

  async decline(id: string, reason: string, block: boolean, decidedBy: string) {
    const r = await this.findOpen(id);
    r.status = RegistrationStatus.DECLINED;
    r.declineReason = reason;
    r.decidedAt = new Date();
    r.decidedBy = decidedBy;
    await this.registrations.save(r);
    if (block) {
      for (const [kind, value] of [
        [BlockKind.EMAIL, r.email],
        [BlockKind.TAX_ID, r.taxId],
      ] as const) {
        if (!(await this.blocks.exists({ where: { kind, value } }))) {
          await this.blocks.save(this.blocks.create({ kind, value, registrationId: r.id }));
        }
      }
    }
    await this.send(declinedEmail({ ...this.mailFields(r), reason }));
    return r;
  }

  /** Called by SuperadminService once the place exists and its admin is linked. */
  async markApproved(r: PlaceRegistration, poiId: string, decidedBy: string, temporaryPassword: string | null) {
    r.status = RegistrationStatus.APPROVED;
    r.poiId = poiId;
    r.decidedAt = new Date();
    r.decidedBy = decidedBy;
    await this.registrations.save(r);
    await this.send(readyEmail({ ...this.mailFields(r), dashboardUrl: this.dashboardUrl(), temporaryPassword }));
  }

  private mailFields(r: PlaceRegistration) {
    return { email: r.email, firstName: r.firstName, placeName: r.placeName, language: r.language };
  }

  /** Whether emails really leave: if not, the superadmin passes the password on. */
  get emailsDelivered(): boolean {
    return this.emailSender.delivers;
  }

  private async send(message: EmailMessage): Promise<void> {
    try {
      await this.emailSender.send(message);
    } catch (error) {
      // A request is never lost because an email didn't go: the superadmin sees it anyway.
      this.logger.warn(`Email to ${message.to} failed: ${(error as Error).message}`);
    }
  }

  /**
   * The admin dashboard's address, for links in emails: ADMIN_URL, else
   * the admin origin listed in CORS_ORIGINS, else production's.
   */
  dashboardUrl(): string {
    const configured = this.config.get<string>('ADMIN_URL')?.trim();
    if (configured) return configured.replace(/\/$/, '');
    const fromCors = (this.config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((o) => o.trim())
      .find((o) => o.includes('admin'));
    return fromCors ?? 'https://infunion-admin.up.railway.app';
  }

  /**
   * Retention (REGISTRATION_RETENTION_DAYS): declined requests go, with
   * their documents; approved ones keep their record (it is the signed
   * agreement) but lose the document.
   */
  async sweep(now = new Date()): Promise<void> {
    const before = new Date(now.getTime() - REGISTRATION_RETENTION_DAYS * DAY_MS);
    const old = await this.registrations.find({
      where: { status: In([RegistrationStatus.APPROVED, RegistrationStatus.DECLINED]), decidedAt: LessThan(before) },
    });
    for (const r of old) {
      if (r.documentPath) await fileStore().remove('private', r.documentPath).catch(() => undefined);
      if (r.status === RegistrationStatus.DECLINED) {
        await this.registrations.remove(r);
      } else if (r.documentPath) {
        r.documentPath = null;
        await this.registrations.save(r);
      }
    }
  }

  /** The plan the request asked for, as Approve applies it. */
  static paidPlan(r: PlaceRegistration): PlanTier | null {
    return r.plan === PlanTier.BASIC ? null : r.plan;
  }
}

import { DataSource } from 'typeorm';
import { User } from './users/entities/user.entity.js';
import { Poi } from './pois/entities/poi.entity.js';
import { UserPoi } from './user-pois/entities/user-poi.entity.js';
import { ActiveModule } from './active-modules/entities/active-module.entity.js';
import { Announcement } from './announcements/entities/announcement.entity.js';
import { Event } from './events/entities/event.entity.js';
import { CommunityPost } from './community/entities/community-post.entity.js';
import { CommunityComment } from './community/entities/community-comment.entity.js';
import { Donation, DonationPurpose } from './donations/entities/donation.entity.js';
import { DonationCampaign } from './donations/entities/donation-campaign.entity.js';
import { PoiPageBlock } from './poi-page/entities/poi-page-block.entity.js';
import { PoiBadge } from './poi-badges/entities/poi-badge.entity.js';
import {
  ServiceRequest,
  ServiceRequestStatus,
  ServiceRequestType,
} from './service-requests/entities/service-request.entity.js';
import { ServiceRequestMessage } from './service-requests/entities/service-request-message.entity.js';
import { ServiceRequestDocument } from './service-requests/entities/service-request-document.entity.js';
import { MemberConversation } from './member-messages/entities/member-conversation.entity.js';
import { MemberMessage } from './member-messages/entities/member-message.entity.js';
import { ModuleType } from './common/enums/module-type.enum.js';
import { ModuleStatus } from './common/enums/module-status.enum.js';
import { PoiType } from './common/enums/poi-type.enum.js';
import { MemberRole } from './common/enums/member-role.enum.js';
import { Language } from './common/enums/language.enum.js';
import { PageBlockType } from './common/enums/page-block-type.enum.js';
import { BadgeKind } from './common/enums/badge-kind.enum.js';
import { EventCategory, EventRecurrence } from './events/entities/event-kinds.js';
import { DEMO_MEMBER_PHONE } from './common/demo/demo-account.js';
import * as bcrypt from 'bcryptjs';
import { CARMEN_TIME_ZONE } from './seed-carmen.js';

export const ASSOCIATION_QR_TOKEN = 'DEMO-CRECER-JUNTOS';
export const ASSOCIATION_ADMIN_EMAIL = 'admin@crecerjuntos.example';
export const ASSOCIATION_ADMIN_PASSWORD = 'demo1234';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * The demo association (Seb, 26 Oct 2026): a L'Eliana association that
 * supports children facing learning and developmental difficulties, and
 * their families. It shows ANSAE to associations, with no church words:
 * activities instead of Masses, sign-ups instead of sacraments. María
 * García (the demo member) belongs to it; its team signs in to the admin
 * as Elena Navarro (ASSOCIATION_ADMIN_EMAIL). Only created when missing, so
 * edits made in the admin survive a re-run.
 */
export async function seedAssociation(dataSource: DataSource): Promise<Poi | null> {
  const previousZone = process.env.TZ;
  // Node reads TZ again when it changes, so the Dates below are Madrid's.
  process.env.TZ = CARMEN_TIME_ZONE;
  try {
    return await seedAssociationInMadrid(dataSource);
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
}

async function seedAssociationInMadrid(dataSource: DataSource): Promise<Poi | null> {
  const pois = dataSource.getRepository(Poi);
  const users = dataSource.getRepository(User);
  const memberships = dataSource.getRepository(UserPoi);
  const modules = dataSource.getRepository(ActiveModule);
  const announcements = dataSource.getRepository(Announcement);
  const events = dataSource.getRepository(Event);
  const posts = dataSource.getRepository(CommunityPost);
  const comments = dataSource.getRepository(CommunityComment);
  const donations = dataSource.getRepository(Donation);
  const campaigns = dataSource.getRepository(DonationCampaign);
  const blocks = dataSource.getRepository(PoiPageBlock);
  const badges = dataSource.getRepository(PoiBadge);
  const requests = dataSource.getRepository(ServiceRequest);
  const messages = dataSource.getRepository(ServiceRequestMessage);
  const documents = dataSource.getRepository(ServiceRequestDocument);
  const conversations = dataSource.getRepository(MemberConversation);
  const memberMessages = dataSource.getRepository(MemberMessage);

  // The demo member comes from the Carmen seed, which runs first.
  const member = await users.findOne({ where: { phone: DEMO_MEMBER_PHONE } });
  if (!member) return null;
  let admin = await users.findOne({ where: { email: ASSOCIATION_ADMIN_EMAIL } });
  if (!admin) {
    admin = await users.save(
      users.create({
        email: ASSOCIATION_ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(ASSOCIATION_ADMIN_PASSWORD, 10),
        firstName: 'Elena',
        lastName: 'Navarro',
        language: Language.ES,
      }),
    );
  }

  let poi = await pois.findOne({ where: { qrCodeToken: ASSOCIATION_QR_TOKEN } });
  if (!poi) {
    poi = await pois.save(
      pois.create({
        name: 'Crecer Juntos',
        type: PoiType.ASSOCIATION,
        language: Language.ES,
        address: 'Carrer de Rafael Alberti, 8',
        city: 'L’Eliana',
        postalCode: '46183',
        latitude: 39.5641,
        longitude: -0.5306,
        description:
          'Acompañamos a niños y niñas con dificultades de aprendizaje y del desarrollo, y a sus familias: logopedia, deporte adaptado, talleres y un grupo de familias.',
        qrCodeToken: ASSOCIATION_QR_TOKEN,
        billingComped: true,
        legalName: 'Asociación Crecer Juntos',
        legalTaxId: 'G46000000',
        legalAddress: 'Carrer de Rafael Alberti, 8\n46183 L’Eliana (Valencia)',
        receiptSignatory: 'Elena Navarro, presidenta',
      }),
    );
    console.log(`Created demo association ${poi.name} (${poi.id})`);
  }
  const place = poi;
  const where = { poi: { id: place.id } };

  for (const moduleType of [
    ModuleType.EVENTS,
    ModuleType.ANNOUNCEMENTS,
    ModuleType.DONATIONS,
    ModuleType.REQUESTS,
    ModuleType.COMMUNITY,
    ModuleType.MESSAGES,
  ]) {
    if (!(await modules.count({ where: { ...where, moduleType } }))) {
      await modules.save(modules.create({ poi: place, moduleType, status: ModuleStatus.ACTIVE }));
    }
  }

  for (const [user, role] of [
    [admin, MemberRole.ADMIN],
    [member, MemberRole.MEMBER],
  ] as const) {
    if (!(await memberships.count({ where: { user: { id: user.id }, poi: { id: place.id } } }))) {
      await memberships.save(memberships.create({ user, poi: place, role }));
    }
  }

  // A few other families, so the requests and the Membres page are not
  // all María's. Made-up numbers, outside the demo member's.
  const families: User[] = [];
  for (const [phone, firstName, lastName] of [
    ['+34600000101', 'Nuria', 'Ferrer'],
    ['+34600000102', 'Javier', 'Ruiz'],
    ['+34600000103', 'Pablo', 'Soler'],
  ]) {
    let family = await users.findOne({ where: { phone } });
    if (!family) family = await users.save(users.create({ phone, firstName, lastName, language: Language.ES }));
    if (!(await memberships.count({ where: { user: { id: family.id }, poi: { id: place.id } } }))) {
      await memberships.save(memberships.create({ user: family, poi: place, role: MemberRole.MEMBER }));
    }
    families.push(family);
  }
  const [nuria, javier, pablo] = families;

  // ---- The week ----

  function at(weekday: number, hours: number, minutes = 0): Date {
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    date.setDate(date.getDate() + ((weekday - date.getDay() + 7) % 7));
    return date;
  }
  function inDays(days: number, hours: number, minutes = 0): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }
  const span = (start: Date, minutes: number) => new Date(start.getTime() + minutes * 60 * 1000);

  if (!(await events.count({ where }))) {
    const weekly = (title: string, startsAt: Date, minutes: number, location: string, extra: Partial<Event> = {}) => {
      // A repeat only starts on its first date, so that date goes a week
      // back: otherwise today's session would begin next week.
      const back = (date: Date) => {
        // By the calendar, not by 7 × 24 hours, so the wall-clock time
        // survives a change to or from summer time in between.
        const earlier = new Date(date);
        earlier.setDate(earlier.getDate() - 7);
        return earlier;
      };
      return events.create({
        poi: place,
        title,
        category: EventCategory.OTHER,
        location,
        recurrence: EventRecurrence.WEEKLY,
        ...extra,
        startsAt: back(startsAt),
        endsAt: back(span(startsAt, minutes)),
      });
    };
    await events.save([
      weekly('Logopedia en grupo', at(1, 17, 30), 60, 'Sede, sala 1', {
        repeatDays: [1, 3],
        description: 'Grupos de 4 niños por edades, con nuestra logopeda Sara.',
      }),
      weekly('Taller de juego y emociones', at(2, 17, 30), 75, 'Sede, sala 2', {
        description: 'Juego guiado para aprender a reconocer y expresar lo que sentimos. De 6 a 10 años.',
      }),
      weekly('Deporte adaptado', at(6, 10, 30), 90, 'Polideportivo municipal', {
        description: 'Psicomotricidad, juegos de equipo y natación. Traed ropa cómoda y una botella de agua.',
      }),
      weekly('Atención a familias', at(2, 10), 180, 'Sede', {
        category: EventCategory.OFFICE_HOURS,
        repeatDays: [2, 4],
      }),
      events.create({
        poi: place,
        title: 'Grupo de familias',
        startsAt: inDays(-40, 19),
        endsAt: inDays(-40, 20, 30),
        category: EventCategory.OTHER,
        location: 'Sede',
        description: 'Un rato para compartir experiencias entre madres y padres, con café. Hay canguro para los peques.',
        recurrence: EventRecurrence.MONTHLY,
        monthlyWeek: 1,
        monthlyWeekday: 4,
      }),
      events.create({
        poi: place,
        title: 'Charla: el colegio y las dificultades de aprendizaje',
        startsAt: inDays(6, 18, 30),
        endsAt: inDays(6, 20),
        location: 'Casa de la Cultura',
        description: 'Con una orientadora escolar: adaptaciones, informes y cómo hablar con el tutor. Abierta a todas las familias.',
      }),
      events.create({
        poi: place,
        title: 'Excursión a la Albufera',
        startsAt: inDays(12, 9),
        endsAt: inDays(12, 17),
        location: 'Salida desde la sede',
        description: 'Paseo en barca y comida en El Palmar. Inscripción desde Solicitudes, plazas limitadas.',
      }),
      events.create({
        poi: place,
        title: 'Mercadillo solidario',
        startsAt: inDays(20, 10),
        endsAt: inDays(20, 14),
        location: 'Plaza del Ayuntamiento',
        description: 'Manualidades hechas por los niños y dulces de las familias. Todo lo recaudado va a la sala sensorial.',
      }),
    ]);
    console.log('Seeded the Crecer Juntos activities');
  }

  // ---- News and group life ----

  if (!(await announcements.count({ where }))) {
    const note = (title: string, body: string, daysAgo: number) =>
      announcements.create({ poi: place, title, body, createdAt: new Date(Date.now() - daysAgo * DAY) });
    await announcements.save([
      note(
        'Nuevo grupo de deporte adaptado',
        'Desde este mes hay un segundo grupo los sábados, de 12:00 a 13:30, para los niños de 10 a 14 años.',
        8,
      ),
      note(
        'Inscripciones del trimestre abiertas',
        'Ya podéis inscribir a los niños en logopedia, el taller de emociones y deporte adaptado. Se hace desde Solicitudes en la app.',
        3,
      ),
      note(
        '¡Ya llevamos la mitad de la sala sensorial!',
        'Gracias a vuestros donativos hemos superado la mitad del objetivo. Las obras podrían empezar en primavera.',
        1,
      ),
    ]);
  }

  if (!(await posts.count({ where }))) {
    const [carpool, books] = await posts.save([
      posts.create({ poi: place, authorName: 'Raquel', message: '¿Alguien de La Pobla va a la logopedia del miércoles? Podríamos compartir coche.' }),
      posts.create({ poi: place, authorName: 'David', message: 'Tenemos cuentos con pictogramas que ya no usamos. Si a alguien le vienen bien, los dejo en la sede el jueves.' }),
    ]);
    await comments.save([
      comments.create({ post: carpool, authorName: 'Marta', message: '¡Yo! Vivo cerca del mercado, te escribo.' }),
      comments.create({ post: books, author: member, authorName: 'María', message: 'A Lucas le encantan, ¡muchas gracias David!' }),
    ]);
  }

  // ---- Giving ----

  let sensoryRoom = await campaigns.findOne({ where: { ...where, title: 'Una sala sensorial para la sede' } });
  if (!(await campaigns.count({ where }))) {
    const [room, camp] = await campaigns.save([
      campaigns.create({
        poi: place,
        title: 'Una sala sensorial para la sede',
        description:
          'Luces, sonidos y texturas para que los niños se relajen y trabajen la atención. Queremos equipar la sala 3 de la sede.',
        goalAmount: 12000,
        active: true,
      }),
      campaigns.create({
        poi: place,
        title: 'Becas para el campamento de verano',
        description: 'Una semana de campamento inclusivo para 25 niños. Ayúdanos a que ninguna familia se quede fuera.',
        goalAmount: 5000,
        active: true,
      }),
    ]);
    sensoryRoom = room;
    const gifts: Donation[] = [];
    for (let i = 0; i < 45; i++) {
      gifts.push(
        donations.create({
          poi: place,
          amount: [20, 30, 50, 100, 300][i % 5],
          purpose: DonationPurpose.CAMPAIGN,
          campaign: room,
          createdAt: new Date(Date.now() - i * 1.4 * DAY - 4 * HOUR),
        }),
      );
    }
    for (let i = 0; i < 16; i++) {
      gifts.push(
        donations.create({
          poi: place,
          amount: [10, 20, 25, 50, 100][i % 5],
          purpose: DonationPurpose.CAMPAIGN,
          campaign: camp,
          createdAt: new Date(Date.now() - i * 3 * DAY - 2 * HOUR),
        }),
      );
    }
    await donations.save(gifts);
  }

  // Nine weeks of everyday giving, for the dashboard.
  if (!(await donations.count({ where: { ...where, purpose: DonationPurpose.GENERAL } }))) {
    const names = ['Lucía', 'Pablo', 'Inés', 'Jordi', 'Ana', 'Toni', 'Rocío'];
    const amounts = [5, 10, 10, 15, 20, 25, 50];
    const gifts: Donation[] = [];
    for (let i = 63; i >= 1; i--) {
      const day = new Date(Date.now() - i * DAY);
      const count = Math.random() < 0.7 ? 1 + Math.floor(Math.random() * 3) : 0;
      for (let j = 0; j < count; j++) {
        const createdAt = new Date(day);
        createdAt.setHours(8 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60));
        gifts.push(
          donations.create({
            poi: place,
            amount: amounts[Math.floor(Math.random() * amounts.length)],
            purpose: DonationPurpose.GENERAL,
            donorName: Math.random() < 0.4 ? names[Math.floor(Math.random() * names.length)] : undefined,
            createdAt,
          }),
        );
      }
    }
    await donations.save(gifts);
  }

  // María gives 15 € a month, with a receipt.
  if (!(await donations.count({ where: { ...where, donor: { id: member.id } } }))) {
    const receipt = {
      wantsReceipt: true,
      donorName: 'María García López',
      donorAddress: 'Carrer Major, 12',
      donorPostalCode: '46183',
      donorCity: 'L’Eliana',
      donorTaxId: '12345678Z',
    };
    const monthly = await donations.save(
      donations.create({ poi: place, donor: member, amount: 15, recurring: true, createdAt: new Date(Date.now() - 50 * DAY), ...receipt }),
    );
    await donations.save(
      [20, 5].map((daysAgo) =>
        donations.create({
          poi: place,
          donor: member,
          amount: 15,
          recurring: true,
          recurringParentId: monthly.id,
          createdAt: new Date(Date.now() - daysAgo * DAY),
          ...receipt,
        }),
      ),
    );
  }

  // ---- Messages: the team writing to María ----

  if (!(await conversations.count({ where }))) {
    const now = Date.now();
    const conversation = await conversations.save(
      conversations.create({
        poi: place,
        member,
        lastMessageAt: new Date(now - 30 * 60 * 1000),
        staffSeenAt: new Date(now - 3 * HOUR),
        memberSeenAt: new Date(now - 30 * 60 * 1000),
      }),
    );
    await memberMessages.save([
      memberMessages.create({
        conversation,
        author: admin,
        fromStaff: true,
        body: 'Hola María, este sábado el deporte adaptado empieza a las 11:00 en lugar de las 10:30, por un partido en el polideportivo. ¡Nos vemos allí!',
        createdAt: new Date(now - 3 * HOUR),
      }),
      memberMessages.create({
        conversation,
        author: member,
        fromStaff: false,
        body: 'Perfecto, gracias por avisar. Allí estaremos con Lucas.',
        createdAt: new Date(now - 30 * 60 * 1000),
      }),
    ]);
  }

  // ---- Requests ----

  if (!(await requests.count({ where }))) {
    const now = Date.now();
    const signUp = await requests.save(
      requests.create({
        poi: place,
        requester: member,
        type: ServiceRequestType.REGISTRATION,
        status: ServiceRequestStatus.IN_PROGRESS,
        contactName: 'María García',
        contactPhone: '+34 600 000 001',
        details: 'Me gustaría inscribir a mi hijo Lucas, de 8 años, en el taller de juego y emociones de los martes.',
        preferredDate: 'Martes por la tarde',
        lastMemberActivityAt: new Date(now - 2 * HOUR),
        lastStaffActivityAt: new Date(now - 6 * HOUR),
        memberSeenAt: new Date(now - 2 * HOUR),
        createdAt: new Date(now - 2 * DAY),
      }),
    );
    await messages.save([
      messages.create({
        request: signUp,
        author: admin,
        fromStaff: true,
        body: '¡Hola María! Queda una plaza en el grupo de los martes. ¿Nos envías la ficha de inscripción firmada? Así Lucas puede empezar la semana que viene.',
        createdAt: new Date(now - 6 * HOUR),
      }),
      messages.create({
        request: signUp,
        author: member,
        fromStaff: false,
        body: '¡Qué bien! Esta tarde la firmo y os la mando.',
        createdAt: new Date(now - 2 * HOUR),
      }),
    ]);
    await documents.save(
      documents.create({ request: signUp, label: 'Ficha de inscripción firmada', note: 'Basta con una foto clara.' }),
    );
    await requests.save([
      requests.create({
        poi: place,
        requester: javier,
        type: ServiceRequestType.MEETING,
        status: ServiceRequestStatus.APPOINTMENT_SET,
        contactName: 'Javier y Laura',
        details: 'Acabamos de llegar a L’Eliana y queremos conocer la asociación y las actividades para nuestra hija de 6 años.',
        appointmentAt: at(4, 11),
        appointmentPlace: 'Sede',
        lastMemberActivityAt: new Date(now - 3 * DAY),
        lastStaffActivityAt: new Date(now - 2 * DAY),
        staffSeenAt: new Date(now - 2 * DAY),
        memberSeenAt: new Date(now - 40 * HOUR),
        createdAt: new Date(now - 3 * DAY),
      }),
      requests.create({
        poi: place,
        requester: nuria,
        type: ServiceRequestType.REGISTRATION,
        status: ServiceRequestStatus.RECEIVED,
        contactName: 'Nuria Ferrer',
        contactPhone: '+34 611 223 344',
        details: 'Querríamos apuntar a nuestros mellizos a la excursión a la Albufera. Somos dos adultos y dos niños.',
        lastMemberActivityAt: new Date(now - 5 * HOUR),
        memberSeenAt: new Date(now - 5 * HOUR),
        createdAt: new Date(now - 5 * HOUR),
      }),
      requests.create({
        poi: place,
        requester: pablo,
        type: ServiceRequestType.CERTIFICATE,
        status: ServiceRequestStatus.RECEIVED,
        contactName: 'Pablo Soler',
        details: 'Necesito un certificado de asistencia a logopedia de este curso para la beca del colegio.',
        lastMemberActivityAt: new Date(now - 26 * HOUR),
        memberSeenAt: new Date(now - 26 * HOUR),
        createdAt: new Date(now - 26 * HOUR),
      }),
    ]);
  }

  // ---- The home page ----

  if (!(await blocks.count({ where }))) {
    const rows: Partial<PoiPageBlock>[] = [
      {
        type: PageBlockType.TEXT,
        title: 'Bienvenidas, familias',
        body: 'Aquí encontraréis las actividades de la semana, las novedades de la asociación y todo lo que necesitáis para inscribir a vuestros hijos. Si tenéis cualquier duda, escribidnos desde Solicitudes.',
      },
      {
        type: PageBlockType.TEXT,
        title: 'Dónde estamos',
        body: 'Nuestra sede está en el Carrer de Rafael Alberti, 8, a cinco minutos del metro (línea 2, parada L’Eliana). Acceso sin escalones.',
      },
      {
        type: PageBlockType.DONATE,
        title: 'Apoya a Crecer Juntos',
        body: 'Cada donativo financia sesiones de logopedia, material adaptado y becas para las familias que más lo necesitan.',
      },
    ];
    await blocks.save(rows.map((row, position) => blocks.create({ ...row, poi: place, position })));
  }

  if (!(await badges.count({ where }))) {
    const rows: Partial<PoiBadge>[] = [
      { kind: BadgeKind.MESSAGE, text: 'Inscripciones del trimestre abiertas', important: true, linkModule: ModuleType.REQUESTS },
      { kind: BadgeKind.OFFICE_HOURS },
      { kind: BadgeKind.CAMPAIGN, campaignId: sensoryRoom?.id ?? null },
      { kind: BadgeKind.MESSAGE, text: 'Excursión a la Albufera: ¡apúntate!' },
    ];
    await badges.save(rows.map((row, position) => badges.create({ ...row, poi: place, position })));
  }

  return place;
}

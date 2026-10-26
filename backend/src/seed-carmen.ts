import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource, In, type Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './users/entities/user.entity.js';
import { Poi } from './pois/entities/poi.entity.js';
import { UserPoi } from './user-pois/entities/user-poi.entity.js';
import { ActiveModule } from './active-modules/entities/active-module.entity.js';
import { Announcement } from './announcements/entities/announcement.entity.js';
import { Event } from './events/entities/event.entity.js';
import { PrayerRequest } from './prayer-requests/entities/prayer-request.entity.js';
import { Livestream } from './livestreams/entities/livestream.entity.js';
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
import { MassIntention, MassIntentionStatus } from './mass-intentions/entities/mass-intention.entity.js';
import { DailyReading } from './daily-readings/entities/daily-reading.entity.js';
import { MemberConversation } from './member-messages/entities/member-conversation.entity.js';
import { MemberMessage } from './member-messages/entities/member-message.entity.js';
import { ModuleType } from './common/enums/module-type.enum.js';
import { ModuleStatus } from './common/enums/module-status.enum.js';
import { LivestreamStatus } from './common/enums/livestream-status.enum.js';
import { PoiType } from './common/enums/poi-type.enum.js';
import { MemberRole } from './common/enums/member-role.enum.js';
import { Language } from './common/enums/language.enum.js';
import { PageBlockType } from './common/enums/page-block-type.enum.js';
import { BadgeKind } from './common/enums/badge-kind.enum.js';
import { EventCategory, EventRecurrence } from './events/entities/event-kinds.js';
import { DEMO_MEMBER_PHONE } from './common/demo/demo-account.js';
import { UPLOADS_ROOT, publicUrlFor } from './common/upload/multer-storage.js';
import { atWallClock, localTime } from './events/occurrences.js';

export const CARMEN_QR_TOKEN = 'DEMO-CARMEN';
export const CARMEN_ADMIN_EMAIL = 'admin@carmen.example';
export const CARMEN_ADMIN_PASSWORD = 'demo1234';

// Seb's photo of the church, from Wikimedia Commons (credited under the
// picture on the home page). The seed downloads it once into uploads/
// and the app loads it from the backend like any other upload: phones
// loading it straight from Wikimedia got nothing back (a black picture),
// since Wikimedia turns away image requests without a descriptive
// User-Agent. 1280px wide: a phone does not need more.
const CARMEN_PICTURE_SOURCE =
  'https://commons.wikimedia.org/wiki/Special:FilePath/L%27Eliana._Esgl%C3%A9sia_de_la_Mare_de_D%C3%A9u_del_Carme_2.jpg?width=1280';
const CARMEN_PICTURE_FILE = 'carmen-church.jpg';
// Where earlier seeds pointed the place, its home page and its news at.
const OLD_CARMEN_PICTURE =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/L%27Eliana._Esgl%C3%A9sia_de_la_Mare_de_D%C3%A9u_del_Carme_2.jpg/1280px-L%27Eliana._Esgl%C3%A9sia_de_la_Mare_de_D%C3%A9u_del_Carme_2.jpg';

/**
 * The church photo as an /uploads/ path, downloading it the first time.
 * Without internet the seed carries on, and the demo has no photo.
 */
async function carmenPicture(): Promise<string | null> {
  const dir = join(UPLOADS_ROOT, 'demo');
  const path = publicUrlFor('demo', CARMEN_PICTURE_FILE);
  if (existsSync(join(dir, CARMEN_PICTURE_FILE))) return path;
  try {
    const response = await fetch(CARMEN_PICTURE_SOURCE, {
      headers: { 'User-Agent': 'infunion-demo-seed/1.0 (https://github.com/sanguin666/INFUNION)' },
    });
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || !type.startsWith('image/')) {
      throw new Error(`HTTP ${response.status} ${type}`);
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, CARMEN_PICTURE_FILE), Buffer.from(await response.arrayBuffer()));
    console.log('Downloaded the church photo from Wikimedia Commons');
    return path;
  } catch (error) {
    console.warn(`Could not download the church photo (${(error as Error).message}); the demo has no photo.`);
    return null;
  }
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * The default demo since 24 Sep 2026: a Spanish community with a full
 * week of Masses, office hours, giving, requests and a member account
 * that "sign in" opens straight into (see DEMO_MEMBER_PHONE). Everything
 * here is only created when missing, so edits made in the admin survive
 * a re-run.
 */
// The demo is a community in Spain, so its times are Spanish times,
// whatever clock the server runs on (Railway's is UTC).
export const CARMEN_TIME_ZONE = 'Europe/Madrid';

export async function seedCarmen(dataSource: DataSource): Promise<Poi> {
  const previousZone = process.env.TZ;
  // Node reads TZ again when it changes, so the Dates below are Madrid's.
  process.env.TZ = CARMEN_TIME_ZONE;
  try {
    return await seedCarmenInMadrid(dataSource);
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
}

/**
 * Seeds before 27 Sep 2026 wrote the timetable in the server's time zone:
 * on Railway, UTC, so Sunday Mass at 10:00 showed as 12:00 on a phone in
 * Spain. Moves the seeded events to the same wall-clock time in Madrid,
 * once: after that Sunday Mass reads 10:00 in Madrid and nothing moves.
 * Events the office added itself are left alone.
 */
async function moveUtcTimetableToMadrid(events: Repository<Event>, place: Poi): Promise<void> {
  const seeded = await events.find({ where: { poi: { id: place.id }, title: In(SEEDED_EVENT_TITLES) } });
  const sundayMass = seeded.find((event) => event.title === 'Misa dominical');
  if (!sundayMass) return;
  const inUtc = localTime(sundayMass.startsAt, 'UTC');
  if (inUtc.hour !== 10 || localTime(sundayMass.startsAt, CARMEN_TIME_ZONE).hour === 10) return;
  const move = (date: Date) => {
    const wall = localTime(date, 'UTC');
    return atWallClock(wall, wall.hour, wall.minute, CARMEN_TIME_ZONE);
  };
  for (const event of seeded) {
    event.startsAt = move(event.startsAt);
    if (event.endsAt) event.endsAt = move(event.endsAt);
  }
  await events.save(seeded);
  console.log('Moved the Carmen timetable from UTC to Madrid time');
}

const SEEDED_EVENT_TITLES = [
  'Misa',
  'Misa vespertina del sábado',
  'Misa dominical',
  'Misa dominical con niños',
  'Misa dominical de la tarde',
  'Confesiones',
  'Adoración eucarística',
  'Rosario',
  'Despacho abierto',
  'Despacho abierto (sábado)',
  'Misa del primer viernes',
  'Reunión de padres de catequesis',
  'Cursillo prematrimonial',
  'Concierto del coro',
  'Fiesta de la comunidad',
];

async function seedCarmenInMadrid(dataSource: DataSource): Promise<Poi> {
  const pois = dataSource.getRepository(Poi);
  const users = dataSource.getRepository(User);
  const memberships = dataSource.getRepository(UserPoi);
  const modules = dataSource.getRepository(ActiveModule);
  const announcements = dataSource.getRepository(Announcement);
  const events = dataSource.getRepository(Event);
  const prayers = dataSource.getRepository(PrayerRequest);
  const livestreams = dataSource.getRepository(Livestream);
  const posts = dataSource.getRepository(CommunityPost);
  const comments = dataSource.getRepository(CommunityComment);
  const donations = dataSource.getRepository(Donation);
  const campaigns = dataSource.getRepository(DonationCampaign);
  const blocks = dataSource.getRepository(PoiPageBlock);
  const badges = dataSource.getRepository(PoiBadge);
  const requests = dataSource.getRepository(ServiceRequest);
  const messages = dataSource.getRepository(ServiceRequestMessage);
  const documents = dataSource.getRepository(ServiceRequestDocument);
  const intentions = dataSource.getRepository(MassIntention);
  const readings = dataSource.getRepository(DailyReading);

  const picture = await carmenPicture();
  let poi = await pois.findOne({ where: { qrCodeToken: CARMEN_QR_TOKEN } });
  if (!poi) {
    poi = await pois.save(
      pois.create({
        name: 'Nuestra Señora del Carmen',
        type: PoiType.CHURCH,
        language: Language.ES,
        address: 'Plaça de l’Església, 1',
        city: 'L’Eliana',
        postalCode: '46183',
        description:
          'Una comunidad viva y acogedora en el centro de L’Eliana. Familias, jóvenes y mayores celebramos juntos la fe cada semana.',
        pictureUrl: picture ?? undefined,
        qrCodeToken: CARMEN_QR_TOKEN,
        massIntentionOffering: 10,
        legalName: 'Comunidad Nuestra Señora del Carmen',
        legalTaxId: 'R4600000J',
        legalAddress: 'Plaça de l’Església, 1\n46183 L’Eliana (Valencia)',
        receiptSignatory: 'P. Vicente Martí, sacerdote responsable',
      }),
    );
    console.log(`Created demo POI ${poi.name} (${poi.id})`);
  }
  const place = poi;
  const where = { poi: { id: place.id } };

  for (const moduleType of [
    ModuleType.EVENTS,
    ModuleType.ANNOUNCEMENTS,
    ModuleType.DONATIONS,
    ModuleType.REQUESTS,
    ModuleType.MASS_INTENTIONS,
    ModuleType.PRAYER_REQUESTS,
    ModuleType.COMMUNITY,
    ModuleType.LIVESTREAMS,
    ModuleType.DAILY_READINGS,
    ModuleType.MESSAGES,
  ]) {
    if (!(await modules.count({ where: { ...where, moduleType } }))) {
      await modules.save(modules.create({ poi: place, moduleType, status: ModuleStatus.ACTIVE }));
    }
  }

  // ---- People ----

  let admin = await users.findOne({ where: { email: CARMEN_ADMIN_EMAIL } });
  if (!admin) {
    admin = await users.save(
      users.create({
        email: CARMEN_ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(CARMEN_ADMIN_PASSWORD, 10),
        firstName: 'Carmen',
        lastName: 'Despacho',
        language: Language.ES,
      }),
    );
  }
  let member = await users.findOne({ where: { phone: DEMO_MEMBER_PHONE } });
  if (!member) {
    member = await users.save(
      users.create({ phone: DEMO_MEMBER_PHONE, firstName: 'María', lastName: 'García', language: Language.ES }),
    );
  }
  for (const [user, role] of [
    [admin, MemberRole.ADMIN],
    [member, MemberRole.MEMBER],
  ] as const) {
    if (!(await memberships.count({ where: { user: { id: user.id }, poi: { id: place.id } } }))) {
      await memberships.save(memberships.create({ user, poi: place, role }));
    }
  }
  // The member opens on Carmen, whatever else they have joined since.
  await users.update(member.id, { lastActivePoiId: place.id });

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
  function dayKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  // 12 October, the Pilar holiday: no evening Mass that day.
  const pilar = new Date(new Date().getFullYear(), 9, 12);
  if (pilar.getTime() < Date.now()) pilar.setFullYear(pilar.getFullYear() + 1);

  if (!(await events.count({ where }))) {
    const weekly = (
      title: string,
      startsAt: Date,
      category: EventCategory,
      location: string,
      extra: Partial<Event> = {},
    ) => {
      // A repeat only starts on its first date, so that date goes a week
      // back: otherwise today's evening Mass would begin next Monday.
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
        category,
        location,
        recurrence: EventRecurrence.WEEKLY,
        ...extra,
        startsAt: back(startsAt),
        endsAt: extra.endsAt ? back(extra.endsAt) : null,
      });
    };
    const span = (start: Date, minutes: number) => new Date(start.getTime() + minutes * 60 * 1000);

    const confession = at(6, 18, 30);
    const adoration = at(4, 20, 15);
    const officeTue = at(2, 18);
    const officeSat = at(6, 11);
    await events.save([
      weekly('Misa', at(1, 19, 30), EventCategory.MASS, 'Iglesia', {
        repeatDays: [1, 2, 3, 4, 5],
        exceptions: [{ date: dayKey(pilar), reason: 'Fiesta del Pilar: solo Misa a las 12:00' }],
      }),
      weekly('Misa vespertina del sábado', at(6, 19, 30), EventCategory.MASS, 'Iglesia'),
      weekly('Misa dominical', at(0, 10), EventCategory.MASS, 'Iglesia'),
      weekly('Misa dominical con niños', at(0, 12), EventCategory.MASS, 'Iglesia', {
        description: 'La Misa de las familias, con los niños de catequesis.',
      }),
      weekly('Misa dominical de la tarde', at(0, 19, 30), EventCategory.MASS, 'Iglesia'),
      weekly('Confesiones', confession, EventCategory.CONFESSION, 'Capilla del Santísimo', {
        endsAt: span(confession, 45),
      }),
      weekly('Adoración eucarística', adoration, EventCategory.ADORATION, 'Capilla del Santísimo', {
        endsAt: span(adoration, 45),
      }),
      weekly('Rosario', at(1, 19), EventCategory.PRAYER, 'Iglesia', { repeatDays: [1, 2, 3, 4, 5, 6] }),
      weekly('Despacho abierto', officeTue, EventCategory.OFFICE_HOURS, 'Despacho', {
        repeatDays: [2, 4],
        endsAt: span(officeTue, 120),
      }),
      weekly('Despacho abierto (sábado)', officeSat, EventCategory.OFFICE_HOURS, 'Despacho', {
        endsAt: span(officeSat, 120),
      }),
      events.create({
        poi: place,
        title: 'Misa del primer viernes',
        startsAt: inDays(-40, 20, 30),
        category: EventCategory.MASS,
        location: 'Iglesia',
        description: 'Con adoración y confesiones después de la Misa.',
        recurrence: EventRecurrence.MONTHLY,
        monthlyWeek: 1,
        monthlyWeekday: 5,
      }),
      events.create({
        poi: place,
        title: 'Reunión de padres de catequesis',
        startsAt: inDays(5, 20),
        location: 'Salón de la comunidad',
        description: 'Presentación del curso, calendario y horarios de los grupos. Se ruega asistencia de un padre o madre por niño.',
      }),
      events.create({
        poi: place,
        title: 'Cursillo prematrimonial',
        startsAt: inDays(9, 18),
        endsAt: inDays(9, 20),
        location: 'Salón de la comunidad',
        description: 'Primera de cuatro sesiones para las parejas que se casan este año. Inscripción en el despacho.',
      }),
      events.create({
        poi: place,
        title: 'Concierto del coro',
        startsAt: inDays(16, 20, 30),
        location: 'Iglesia',
        description: 'Música sacra con el coro de la comunidad y la escolanía. Entrada libre, la colecta irá al campanario.',
      }),
      events.create({
        poi: place,
        title: 'Fiesta de la comunidad',
        startsAt: inDays(23, 13),
        endsAt: inDays(23, 18),
        location: 'Plaza de la iglesia',
        description: 'Misa a las 12:00 y después paella para todos. Trae tu mesa y tus ganas.',
      }),
    ]);
    console.log('Seeded the Carmen timetable and events');
  } else {
    await moveUtcTimetableToMadrid(events, place);
  }

  // ---- News and community life ----

  if (!(await announcements.count({ where }))) {
    const note = (title: string, body: string, daysAgo: number) =>
      announcements.create({ poi: place, title, body, createdAt: new Date(Date.now() - daysAgo * DAY) });
    await announcements.save([
      note(
        'Horarios de otoño',
        'A partir del 1 de octubre la Misa de diario vuelve a las 19:30. El despacho abre martes y jueves de 18:00 a 20:00 y los sábados de 11:00 a 13:00.',
        6,
      ),
      note(
        'Inscripciones de catequesis abiertas',
        'Ya podéis inscribir a los niños en catequesis de primera comunión y a los jóvenes en confirmación. Se hace desde el apartado Solicitudes de la app o en el despacho.',
        3,
      ),
      note(
        'Gracias por la campaña del campanario',
        'Llevamos ya más de la mitad del objetivo para restaurar el campanario. ¡Muchas gracias a todos! Las obras empezarán en enero.',
        1,
      ),
    ]);
  }

  // Databases seeded earlier: point the place, its home page picture and
  // the bell tower news post at the downloaded photo instead of
  // Wikimedia, and give that post the photo if it had none (posts had no
  // photos before 24 Sep 2026).
  if (picture) {
    if (place.pictureUrl === OLD_CARMEN_PICTURE) {
      place.pictureUrl = picture;
      await pois.save(place);
    }
    await blocks.update({ poi: { id: place.id }, imageUrl: OLD_CARMEN_PICTURE }, { imageUrl: picture });
    const bellTowerNote = await announcements.findOne({
      where: { ...where, title: 'Gracias por la campaña del campanario' },
    });
    if (bellTowerNote && (!bellTowerNote.imageUrl || bellTowerNote.imageUrl === OLD_CARMEN_PICTURE)) {
      bellTowerNote.imageUrl = picture;
      await announcements.save(bellTowerNote);
    }
  }

  if (!(await prayers.count({ where }))) {
    await prayers.save([
      prayers.create({ poi: place, authorName: 'Pilar', message: 'Por mi madre, que está ingresada en La Fe. Que se recupere pronto.', prayerCount: 23 }),
      prayers.create({ poi: place, message: 'Por los que buscan trabajo en nuestro pueblo.', prayerCount: 11 }),
      prayers.create({ poi: place, authorName: 'Javier y Lucía', message: 'En acción de gracias por el nacimiento de nuestro hijo Pablo.', prayerCount: 31 }),
    ]);
  }

  if (!(await livestreams.count({ where }))) {
    const label = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    const past = at(0, 12);
    past.setDate(past.getDate() - 7);
    const next = at(0, 12);
    await livestreams.save([
      livestreams.create({ poi: place, title: `Misa dominical, ${label(past)}`, url: 'https://example.com/live/carmen-anterior', scheduledAt: past, status: LivestreamStatus.ENDED }),
      livestreams.create({ poi: place, title: `Misa dominical, ${label(next)}`, url: 'https://example.com/live/carmen-domingo', scheduledAt: next, status: LivestreamStatus.UPCOMING }),
    ]);
  }

  if (!(await posts.count({ where }))) {
    const [ride, choir] = await posts.save([
      posts.create({ poi: place, authorName: 'Rosa', message: '¿Alguien va a la peregrinación a Valencia el sábado y tiene sitio en el coche? Salgo desde la plaza.' }),
      posts.create({ poi: place, authorName: 'Andrés', message: 'El coro busca voces nuevas, sobre todo tenores. Ensayamos los jueves a las 21:00 en el salón.' }),
    ]);
    await comments.save([
      comments.create({ post: ride, authorName: 'Vicenta', message: 'Yo tengo dos plazas libres, te aviso por aquí.' }),
      comments.create({ post: choir, authorName: 'Toni', message: '¡Me apunto! Canté de joven en la escolanía.' }),
      comments.create({ post: choir, author: member, authorName: 'María', message: 'Qué buena noticia, el coro suena cada vez mejor.' }),
    ]);
  }

  // ---- Giving ----

  let belfry = await campaigns.findOne({ where: { ...where, title: 'Restauración del campanario' } });
  if (!(await campaigns.count({ where }))) {
    [belfry] = await campaigns.save([
      campaigns.create({
        poi: place,
        title: 'Restauración del campanario',
        description:
          'El campanario tiene grietas desde las lluvias del invierno pasado y las campanas llevan meses sin tocar. Queremos repararlo y volver a oírlas en las fiestas.',
        goalAmount: 18000,
        active: true,
      }),
      campaigns.create({
        poi: place,
        title: 'Campamento de verano de los jóvenes',
        description: 'Una semana en el Pirineo para 40 jóvenes de la comunidad. Ayúdanos a que nadie se quede en casa por no poder pagarlo.',
        goalAmount: 4000,
        active: true,
      }),
    ]);
    const [, camp] = await campaigns.find({ where, order: { createdAt: 'ASC' } });
    const gifts: Donation[] = [];
    for (let i = 0; i < 40; i++) {
      gifts.push(
        donations.create({
          poi: place,
          amount: [20, 50, 100, 250, 500][i % 5] * 1.2,
          purpose: DonationPurpose.CAMPAIGN,
          campaign: belfry,
          createdAt: new Date(Date.now() - i * 1.5 * DAY - 5 * HOUR),
        }),
      );
    }
    for (let i = 0; i < 18; i++) {
      gifts.push(
        donations.create({
          poi: place,
          amount: [10, 20, 30, 50, 100][i % 5],
          purpose: DonationPurpose.CAMPAIGN,
          campaign: camp,
          createdAt: new Date(Date.now() - i * 3 * DAY - 3 * HOUR),
        }),
      );
    }
    await donations.save(gifts);
  }

  // Nine weeks of everyday giving, heavier on Sundays, for the dashboard.
  if (!(await donations.count({ where: { ...where, purpose: DonationPurpose.GENERAL } }))) {
    const names = ['Vicente', 'Amparo', 'José', 'Carmen', 'Salvador', 'Lola', 'Pepe', 'Inma', 'Joaquín'];
    const amounts = [5, 10, 10, 20, 20, 30, 50, 100];
    const gifts: Donation[] = [];
    for (let i = 63; i >= 1; i--) {
      const day = new Date(Date.now() - i * DAY);
      const sunday = day.getDay() === 0;
      const count = sunday ? 8 + Math.floor(Math.random() * 10) : Math.random() < 0.6 ? 1 + Math.floor(Math.random() * 3) : 0;
      for (let j = 0; j < count; j++) {
        const createdAt = new Date(day);
        createdAt.setHours(sunday ? 9 + Math.floor(Math.random() * 4) : 8 + Math.floor(Math.random() * 13), Math.floor(Math.random() * 60));
        gifts.push(
          donations.create({
            poi: place,
            amount: amounts[Math.floor(Math.random() * amounts.length)] * (1 + (63 - i) * 0.004),
            purpose: sunday && Math.random() < 0.6 ? DonationPurpose.COLLECTION : DonationPurpose.GENERAL,
            donorName: Math.random() < 0.4 ? names[Math.floor(Math.random() * names.length)] : undefined,
            createdAt,
          }),
        );
      }
    }
    for (const gift of gifts) gift.amount = Math.round(gift.amount * 100) / 100;
    await donations.save(gifts);
  }

  // María's own gifts: a monthly one still running, some with a receipt,
  // one without, so "Mis donativos" shows both kinds.
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
      donations.create({
        poi: place,
        donor: member,
        amount: 20,
        recurring: true,
        createdAt: new Date(Date.now() - 62 * DAY),
        ...receipt,
      }),
    );
    await donations.save([
      ...[31, 1].map((daysAgo) =>
        donations.create({
          poi: place,
          donor: member,
          amount: 20,
          recurring: true,
          recurringParentId: monthly.id,
          createdAt: new Date(Date.now() - daysAgo * DAY),
          ...receipt,
        }),
      ),
      donations.create({
        poi: place,
        donor: member,
        amount: 50,
        purpose: DonationPurpose.CAMPAIGN,
        campaign: belfry,
        createdAt: new Date(Date.now() - 12 * DAY),
        ...receipt,
      }),
      donations.create({
        poi: place,
        donor: member,
        amount: 10,
        purpose: DonationPurpose.COLLECTION,
        donorName: 'María',
        createdAt: new Date(Date.now() - 4 * DAY),
      }),
    ]);
  }

  // ---- Messages: the office writing to María in particular ----

  const conversations = dataSource.getRepository(MemberConversation);
  const memberMessages = dataSource.getRepository(MemberMessage);
  if (!(await conversations.count({ where }))) {
    const now = Date.now();
    const conversation = await conversations.save(
      conversations.create({
        poi: place,
        member,
        lastMessageAt: new Date(now - 20 * 60 * 1000),
        staffSeenAt: new Date(now - DAY),
        memberSeenAt: new Date(now - 20 * 60 * 1000),
      }),
    );
    await memberMessages.save([
      memberMessages.create({
        conversation,
        author: admin,
        fromStaff: true,
        body: 'Hola María, ¿podrías ayudarnos a preparar las flores para la Misa del sábado? Empezamos a las 10:00.',
        createdAt: new Date(now - DAY),
      }),
      memberMessages.create({
        conversation,
        author: member,
        fromStaff: false,
        body: '¡Claro! Allí estaré el sábado a las 10:00.',
        createdAt: new Date(now - 20 * 60 * 1000),
      }),
    ]);
  }

  // ---- The office ----

  if (!(await requests.count({ where }))) {
    const now = Date.now();
    const baptism = await requests.save(
      requests.create({
        poi: place,
        requester: member,
        type: ServiceRequestType.BAPTISM,
        status: ServiceRequestStatus.IN_PROGRESS,
        contactName: 'María García',
        contactPhone: '+34 600 000 001',
        details: 'Queremos bautizar a nuestra hija Lucía, nacida en julio. Nos gustaría un domingo de noviembre, en la Misa de las 12:00.',
        preferredDate: 'Un domingo de noviembre',
        lastMemberActivityAt: new Date(now - 2 * HOUR),
        lastStaffActivityAt: new Date(now - 5 * HOUR),
        memberSeenAt: new Date(now - 2 * HOUR),
        createdAt: new Date(now - 3 * DAY),
      }),
    );
    await messages.save([
      messages.create({
        request: baptism,
        author: admin,
        fromStaff: true,
        body: '¡Enhorabuena, María! Los bautizos son el segundo domingo de cada mes. ¿Podéis enviarnos el libro de familia? Después fijamos una charla con el P. Vicente.',
        createdAt: new Date(now - 5 * HOUR),
      }),
      messages.create({
        request: baptism,
        author: member,
        fromStaff: false,
        body: 'Perfecto, esta tarde os mando una foto. Los padrinos son mi hermano Jorge y su mujer.',
        createdAt: new Date(now - 2 * HOUR),
      }),
    ]);
    await documents.save(
      documents.create({ request: baptism, label: 'Libro de familia (página de la niña)', note: 'Basta con una foto clara.' }),
    );
    const [wedding, sick] = [ServiceRequestType.WEDDING, ServiceRequestType.SICK_VISIT];
    await requests.save([
      requests.create({
        poi: place,
        requester: member,
        type: wedding,
        status: ServiceRequestStatus.APPOINTMENT_SET,
        contactName: 'Laura y Sergio',
        details: 'Queremos casarnos en junio del año que viene, a ser posible un sábado por la tarde.',
        appointmentAt: at(4, 18, 30),
        appointmentPlace: 'Despacho',
        lastMemberActivityAt: new Date(now - 2 * DAY),
        lastStaffActivityAt: new Date(now - DAY),
        staffSeenAt: new Date(now - DAY),
        memberSeenAt: new Date(now - 20 * HOUR),
        createdAt: new Date(now - 6 * DAY),
      }),
      requests.create({
        poi: place,
        requester: member,
        type: sick,
        status: ServiceRequestStatus.RECEIVED,
        contactName: 'Enrique Sanchis',
        contactPhone: '+34 611 223 344',
        details: 'Mi padre, de 91 años, ya no puede salir de casa. Le haría mucha ilusión recibir la comunión.',
        preferredDate: 'Cualquier mañana',
        lastMemberActivityAt: new Date(now - 4 * HOUR),
        memberSeenAt: new Date(now - 4 * HOUR),
        createdAt: new Date(now - 4 * HOUR),
      }),
      requests.create({
        poi: place,
        requester: member,
        type: ServiceRequestType.CERTIFICATE,
        status: ServiceRequestStatus.RECEIVED,
        contactName: 'Nuria Ferrer',
        details: 'Necesito una partida de bautismo para ser madrina en Castellón. Me bauticé aquí en 1994.',
        lastMemberActivityAt: new Date(now - 26 * HOUR),
        memberSeenAt: new Date(now - 26 * HOUR),
        createdAt: new Date(now - 26 * HOUR),
      }),
    ]);
  }

  if (!(await intentions.count({ where }))) {
    const sunday = at(0, 12);
    const lastSunday = new Date(sunday.getTime() - 7 * DAY);
    await intentions.save([
      intentions.create({ poi: place, intention: 'Por el eterno descanso de Vicente Llopis', requesterName: 'Familia Llopis', celebrationAt: sunday, celebrationTitle: 'Misa dominical con niños', offeringAmount: 10, status: MassIntentionStatus.CONFIRMED }),
      intentions.create({ poi: place, intention: 'En acción de gracias por nuestras bodas de oro', requesterName: 'Amparo y Salvador', celebrationAt: sunday, celebrationTitle: 'Misa dominical con niños', offeringAmount: 10, status: MassIntentionStatus.CONFIRMED }),
      intentions.create({ poi: place, intention: 'Por la salud de mi madre', requesterName: 'María García', requester: member, celebrationAt: at(3, 19, 30), celebrationTitle: 'Misa', offeringAmount: 10, status: MassIntentionStatus.CONFIRMED }),
      intentions.create({ poi: place, intention: 'Por las almas del purgatorio', requesterName: 'Rosa', offeringAmount: 10, status: MassIntentionStatus.CONFIRMED, fromOffice: true }),
      // Said last Sunday, still to be ticked off in the admin.
      intentions.create({ poi: place, intention: 'Por Josefa Martínez, en su aniversario', requesterName: 'Sus hijos', celebrationAt: lastSunday, celebrationTitle: 'Misa dominical con niños', offeringAmount: 10, status: MassIntentionStatus.CONFIRMED }),
    ]);
  }

  // ---- The home page ----

  if (!(await blocks.count({ where }))) {
    const rows: Partial<PoiPageBlock>[] = [
      ...(picture ? [{ type: PageBlockType.IMAGE, imageUrl: picture, body: 'Foto: Wikimedia Commons' }] : []),
      {
        type: PageBlockType.TEXT,
        title: 'Bienvenidos',
        body: 'Seas de toda la vida o acabes de llegar a L’Eliana, aquí tienes tu casa. Consulta los horarios, pide un sacramento o un certificado, y ayúdanos a cuidar nuestra iglesia desde el móvil.',
      },
      {
        type: PageBlockType.TEXT,
        title: 'Cómo llegar',
        body: 'Estamos en la plaza de la iglesia, a cinco minutos del metro (línea 2, parada L’Eliana). Entrada sin escalones por la puerta lateral y bucle magnético en las primeras filas.',
      },
      {
        type: PageBlockType.DONATE,
        title: 'Colabora con la comunidad',
        body: 'Cada donativo mantiene abiertas las puertas, la acción social y las actividades con los jóvenes.',
      },
    ];
    await blocks.save(rows.map((row, position) => blocks.create({ ...row, poi: place, position })));
  }

  if (!(await badges.count({ where }))) {
    const rows: Partial<PoiBadge>[] = [
      { kind: BadgeKind.MESSAGE, text: 'Catequesis: inscripciones abiertas', important: true, linkModule: ModuleType.REQUESTS },
      { kind: BadgeKind.NEXT_MASS },
      { kind: BadgeKind.OFFICE_HOURS },
      { kind: BadgeKind.NEXT_CONFESSION },
      { kind: BadgeKind.CAMPAIGN, campaignId: belfry?.id ?? null },
    ];
    await badges.save(rows.map((row, position) => badges.create({ ...row, poi: place, position })));
  }

  // ---- Lectures du jour ----
  // A fortnight around the day the seed runs, each with a word from the
  // priest, a line of a psalm and one Gospel verse: the office pastes the
  // full texts in real life. The link opens today's Gospel on Vatican News.

  if (!place.readingsLinkUrl) {
    place.readingsLinkUrl = 'https://www.vaticannews.va/es/evangelio-de-hoy.html';
    await pois.save(place);
  }
  if (!(await readings.count({ where }))) {
    const verses: [string, string, string][] = [
      ['Jn 3, 16', 'Porque tanto amó Dios al mundo, que entregó a su Hijo único, para que todo el que cree en él no perezca, sino que tenga vida eterna.', 'Dios no se cansa de amarnos. Hoy, antes de dormir, da gracias por una persona que te ha mostrado ese amor.'],
      ['Mt 11, 28', 'Venid a mí todos los que estáis cansados y agobiados, y yo os aliviaré.', 'Si llegas cansado a esta semana, no estás solo. La iglesia está abierta por la mañana para rezar en silencio.'],
      ['Jn 15, 12', 'Este es mi mandamiento: que os améis unos a otros como yo os he amado.', 'Un gesto concreto hoy: llama a alguien de la comunidad que hace tiempo que no ves.'],
      ['Lc 6, 36', 'Sed misericordiosos como vuestro Padre es misericordioso.', 'El sábado a las 18:00 hay confesiones. Es un buen momento para dejar lo que pesa.'],
      ['Mt 5, 9', 'Bienaventurados los que trabajan por la paz, porque ellos serán llamados hijos de Dios.', 'Rezamos hoy por la paz, en el mundo y en nuestras casas.'],
      ['Jn 14, 27', 'La paz os dejo, mi paz os doy.', 'Lee despacio este versículo dos veces. ¿Qué palabra se te queda?'],
      ['Mt 28, 20', 'Yo estoy con vosotros todos los días, hasta el final de los tiempos.', 'Terminamos la semana con esta promesa. ¡Os espero el domingo!'],
    ];
    const day = (offset: number) => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return date.toLocaleDateString('en-CA', { timeZone: CARMEN_TIME_ZONE });
    };
    const rows: Partial<DailyReading>[] = [];
    for (let offset = -3; offset <= 14; offset += 1) {
      const [reference, text, word] = verses[(offset + 21) % verses.length];
      rows.push({
        date: day(offset),
        word: `${word}\n\nP. Vicente`,
        sections: [
          { kind: 'psalm', reference: 'Sal 22', text: 'El Señor es mi pastor, nada me falta.' },
          { kind: 'gospel', reference, text },
        ],
        published: true,
        notifyAt: '07:30',
        // Days gone by count as sent: seeding never notifies.
        notifiedAt: offset <= 0 ? new Date() : null,
      });
    }
    await readings.save(rows.map((row) => readings.create({ ...row, poi: place })));
  }

  return place;
}

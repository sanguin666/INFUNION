import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
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
import { Donation } from './donations/entities/donation.entity.js';
import { PoiPageBlock } from './poi-page/entities/poi-page-block.entity.js';
import { ModuleType } from './common/enums/module-type.enum.js';
import { ModuleStatus } from './common/enums/module-status.enum.js';
import { LivestreamStatus } from './common/enums/livestream-status.enum.js';
import { PoiType } from './common/enums/poi-type.enum.js';
import { MemberRole } from './common/enums/member-role.enum.js';
import { Language } from './common/enums/language.enum.js';
import { PageBlockType } from './common/enums/page-block-type.enum.js';
import { ENTITIES } from './config/typeorm.config.js';
import { EventCategory, EventRecurrence } from './events/entities/event-kinds.js';
import { DonationCampaign } from './donations/entities/donation-campaign.entity.js';
import { PoiBadge } from './poi-badges/entities/poi-badge.entity.js';
import { BadgeKind } from './common/enums/badge-kind.enum.js';
import { DonationPurpose } from './donations/entities/donation.entity.js';
import {
  ServiceRequest,
  ServiceRequestStatus,
  ServiceRequestType,
} from './service-requests/entities/service-request.entity.js';
import { ServiceRequestMessage } from './service-requests/entities/service-request-message.entity.js';
import { ServiceRequestDocument } from './service-requests/entities/service-request-document.entity.js';
import { MassIntention, MassIntentionStatus } from './mass-intentions/entities/mass-intention.entity.js';
import { CARMEN_ADMIN_EMAIL, CARMEN_ADMIN_PASSWORD, seedCarmen } from './seed-carmen.js';
import { seedMap } from './seed-map.js';
import { ASSOCIATION_ADMIN_EMAIL, ASSOCIATION_ADMIN_PASSWORD, seedAssociation } from './seed-association.js';

/**
 * Seeds two demo POIs with fixed QR tokens, so the app has something real
 * to fetch without needing a working camera scanner yet, and a demo admin
 * account (email/password) managing both — showing what the admin
 * dashboard looks like for someone responsible for several churches.
 * Safe to re-run: it only creates what's missing.
 */
const DEMO_QR_TOKEN = 'DEMO-STMARYS';
const DEMO_QR_TOKEN_2 = 'DEMO-HOLYTRINITY';
const DEMO_ADMIN_EMAIL = 'admin@stmarys.example';
const DEMO_ADMIN_PASSWORD = 'demo1234';

// The seed runs outside Nest, so nothing has read .env for us here:
// without this it tried the default password, not the one in .env.
loadEnv();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'ansae',
  password: process.env.DB_PASSWORD ?? 'ansae',
  database: process.env.DB_NAME ?? 'ansae',
  // The app's own list, so a new table can never be missing here.
  entities: ENTITIES,
  synchronize: true,
});

async function seed() {
  await dataSource.initialize();

  const userRepository = dataSource.getRepository(User);
  const poiRepository = dataSource.getRepository(Poi);
  const userPoiRepository = dataSource.getRepository(UserPoi);
  const activeModuleRepository = dataSource.getRepository(ActiveModule);
  const announcementRepository = dataSource.getRepository(Announcement);
  const eventRepository = dataSource.getRepository(Event);
  const prayerRequestRepository = dataSource.getRepository(PrayerRequest);
  const livestreamRepository = dataSource.getRepository(Livestream);
  const communityPostRepository = dataSource.getRepository(CommunityPost);
  const communityCommentRepository = dataSource.getRepository(CommunityComment);
  const donationRepository = dataSource.getRepository(Donation);
  const pageBlockRepository = dataSource.getRepository(PoiPageBlock);

  const DONOR_NAMES = ['Margaret', 'Robert', 'Linda', 'Tom', 'Susan', 'James', 'Patricia', 'David', 'Carol'];
  const GIFT_AMOUNTS = [10, 15, 20, 25, 30, 50, 75, 100];

  // ~9 weeks of donation history, so the admin dashboard has real
  // week-over-week and month-over-month comparisons and a full 30-day
  // chart. Sunday (the main service day) gets a clear bump over the rest
  // of the week, with a gentle upward trend and random noise so it reads
  // as real data rather than a straight line.
  async function seedDonations(target: Poi, scale: number) {
    const existingCount = await donationRepository.count({ where: { poi: { id: target.id } } });
    if (existingCount > 0) return;

    const daysBack = 63;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const donations: Donation[] = [];

    for (let i = daysBack; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      const isSunday = day.getDay() === 0;
      const weekIndex = Math.floor((daysBack - i) / 7);
      const growth = 1 + weekIndex * 0.015;

      const giftsToday = isSunday
        ? Math.round((6 + Math.random() * 9) * scale)
        : Math.random() < 0.55
          ? Math.round((Math.random() * 3) * scale)
          : 0;

      for (let j = 0; j < giftsToday; j++) {
        const base = GIFT_AMOUNTS[Math.floor(Math.random() * GIFT_AMOUNTS.length)];
        const amount = Math.round(base * growth * (0.85 + Math.random() * 0.3) * 100) / 100;
        const createdAt = new Date(day);
        const hour = isSunday ? 8 + Math.floor(Math.random() * 4) : 7 + Math.floor(Math.random() * 14);
        createdAt.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
        donations.push(
          donationRepository.create({
            poi: target,
            amount,
            donorName: Math.random() < 0.4 ? DONOR_NAMES[Math.floor(Math.random() * DONOR_NAMES.length)] : undefined,
            createdAt,
          }),
        );
      }
    }

    await donationRepository.save(donations);
    console.log(`Seeded ${donations.length} demo donations for ${target.name}`);
  }

  // The two older demos show the Modules page a paying community sees
  // (Seb, 1 Oct 2026): only the free Événements is on, the rest is the
  // office's to try. Carmen keeps everything ("Offert").
  async function activateFreeModules(target: Poi) {
    if (!(await activeModuleRepository.count({ where: { poi: { id: target.id }, moduleType: ModuleType.EVENTS } }))) {
      await activeModuleRepository.save(
        activeModuleRepository.create({ poi: target, moduleType: ModuleType.EVENTS, status: ModuleStatus.ACTIVE }),
      );
    }
  }

  let poi = await poiRepository.findOne({
    where: { qrCodeToken: DEMO_QR_TOKEN },
  });
  if (!poi) {
    poi = await poiRepository.save(
      poiRepository.create({
        name: "St. Mary's Community",
        type: PoiType.CHURCH,
        city: 'Springfield',
        description: 'A welcoming community in the heart of Springfield, serving families for over 80 years.',
        qrCodeToken: DEMO_QR_TOKEN,
      }),
    );
    console.log(`Created demo POI ${poi.id}`);
  } else {
    console.log(`Demo POI already exists: ${poi.id}`);
  }
  await activateFreeModules(poi);

  // A second POI under the same admin's responsibility, to demo the
  // admin dashboard's POI switcher for someone managing several churches.
  let poi2 = await poiRepository.findOne({
    where: { qrCodeToken: DEMO_QR_TOKEN_2 },
  });
  if (!poi2) {
    poi2 = await poiRepository.save(
      poiRepository.create({
        name: 'Holy Trinity Chapel',
        type: PoiType.CHURCH,
        city: 'Springfield',
        description: 'Una comunidad acogedora de habla hispana en el centro de Springfield.',
        qrCodeToken: DEMO_QR_TOKEN_2,
      }),
    );
    console.log(`Created demo POI ${poi2.id}`);
  } else {
    console.log(`Demo POI already exists: ${poi2.id}`);
  }
  await activateFreeModules(poi2);

  // Demonstrate the language feature: give the two demo POIs different
  // content languages. Unconditional (not gated by "just created") so it
  // also takes effect on a database seeded before this column existed.
  if (poi.language !== Language.EN) {
    poi.language = Language.EN;
    await poiRepository.save(poi);
  }
  if (poi2.language !== Language.ES) {
    poi2.language = Language.ES;
    await poiRepository.save(poi2);
  }

  const poi2AnnouncementCount = await announcementRepository.count({
    where: { poi: { id: poi2.id } },
  });
  if (poi2AnnouncementCount === 0) {
    // Written in Spanish, matching this POI's content language (see
    // above) — POI content isn't translated for readers, only the app's
    // own menus are, so this is exactly what a Spanish-speaking parish's
    // announcement should look like.
    await announcementRepository.save(
      announcementRepository.create({
        poi: poi2,
        title: 'Bienvenidos a Holy Trinity Chapel',
        body: 'Este es un anuncio de muestra para nuestra segunda comunidad, usado para mostrar el panel de administración.',
      }),
    );
    console.log('Seeded demo announcement for Holy Trinity Chapel');
  }

  let adminUser = await userRepository.findOne({
    where: { email: DEMO_ADMIN_EMAIL },
  });
  if (!adminUser) {
    adminUser = await userRepository.save(
      userRepository.create({
        email: DEMO_ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10),
        firstName: 'Demo',
        lastName: 'Admin',
      }),
    );
    console.log(`Created demo admin user ${adminUser.id}`);
  }

  for (const target of [poi, poi2]) {
    const existingMembership = await userPoiRepository.findOne({
      where: { user: { id: adminUser.id }, poi: { id: target.id } },
    });
    if (!existingMembership) {
      await userPoiRepository.save(
        userPoiRepository.create({
          user: adminUser,
          poi: target,
          role: MemberRole.ADMIN,
        }),
      );
      console.log(`Made demo admin an ADMIN of ${target.name}`);
    }
  }

  const announcementCount = await announcementRepository.count({
    where: { poi: { id: poi.id } },
  });
  if (announcementCount === 0) {
    await announcementRepository.save([
      announcementRepository.create({
        poi,
        title: 'This week’s bulletin',
        body: "This week's readings, choir practice moves to Thursday evenings starting this month, and a reminder that the community office will be closed on Monday for the holiday.",
      }),
      announcementRepository.create({
        poi,
        title: 'Food pantry donations needed',
        body: 'Our food pantry is running low on canned goods and pasta. Donations can be dropped off at the community hall any weekday between 9am and 4pm.',
      }),
    ]);
    console.log('Seeded demo announcements');
  }

  const eventCount = await eventRepository.count({
    where: { poi: { id: poi.id } },
  });
  if (eventCount === 0) {
    const now = new Date();
    const upcomingSunday = new Date(now);
    upcomingSunday.setDate(upcomingSunday.getDate() + ((7 - upcomingSunday.getDay()) % 7 || 7));
    upcomingSunday.setHours(10, 0, 0, 0);
    const baptism = new Date(upcomingSunday);
    baptism.setDate(baptism.getDate() + 7);
    baptism.setHours(14, 0, 0, 0);
    const potluck = new Date(upcomingSunday);
    potluck.setDate(potluck.getDate() + 13);
    potluck.setHours(18, 0, 0, 0);
    await eventRepository.save([
      eventRepository.create({
        poi,
        title: 'Baptism Ceremony',
        startsAt: baptism,
        location: 'Chapel',
      }),
      eventRepository.create({
        poi,
        title: 'Community Potluck',
        startsAt: potluck,
        location: 'Community Hall',
        description: 'Bring a dish to share — all are welcome!',
      }),
    ]);
    console.log('Seeded demo events');
  }

  const prayerRequestCount = await prayerRequestRepository.count({
    where: { poi: { id: poi.id } },
  });
  if (prayerRequestCount === 0) {
    await prayerRequestRepository.save([
      prayerRequestRepository.create({
        poi,
        authorName: 'Margaret',
        message: 'Please pray for my husband as he recovers from surgery this week.',
        prayerCount: 14,
      }),
      prayerRequestRepository.create({
        poi,
        message: 'For peace and strength for all families going through hard times right now.',
        prayerCount: 8,
      }),
      prayerRequestRepository.create({
        poi,
        authorName: 'Robert',
        message: 'In thanksgiving for a safe delivery of our new grandchild.',
        prayerCount: 21,
      }),
    ]);
    console.log('Seeded demo prayer requests');
  }

  const livestreamCount = await livestreamRepository.count({
    where: { poi: { id: poi.id } },
  });
  if (livestreamCount === 0) {
    const now = Date.now();
    const pastSunday = new Date(now - 5 * 24 * 60 * 60 * 1000);
    const nextSunday = new Date(now + 2 * 24 * 60 * 60 * 1000);
    const label = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    await livestreamRepository.save([
      livestreamRepository.create({
        poi,
        title: `Sunday Mass — ${label(pastSunday)}`,
        url: 'https://example.com/live/sunday-mass-past',
        scheduledAt: pastSunday,
        status: LivestreamStatus.ENDED,
      }),
      livestreamRepository.create({
        poi,
        title: `Sunday Mass — ${label(nextSunday)}`,
        url: 'https://example.com/live/sunday-mass-next',
        scheduledAt: nextSunday,
        status: LivestreamStatus.UPCOMING,
      }),
    ]);
    console.log('Seeded demo livestreams');
  }

  const communityPostCount = await communityPostRepository.count({
    where: { poi: { id: poi.id } },
  });
  if (communityPostCount === 0) {
    const [carpoolPost, potluckPost] = await communityPostRepository.save([
      communityPostRepository.create({
        poi,
        authorName: 'Linda',
        message: 'Does anyone have room for a carpool to the Saturday retreat? I can help with gas money!',
      }),
      communityPostRepository.create({
        poi,
        authorName: 'Tom',
        message: "Thank you all for the meals and cards during my recovery — this community means so much to us.",
      }),
    ]);

    await communityCommentRepository.save([
      communityCommentRepository.create({
        post: carpoolPost,
        authorName: 'Robert',
        message: 'I have two seats free, happy to pick you up on the way!',
      }),
      communityCommentRepository.create({
        post: carpoolPost,
        authorName: 'Margaret',
        message: 'Same here, I leave from the community hall around 8am.',
      }),
      communityCommentRepository.create({
        post: potluckPost,
        authorName: 'Margaret',
        message: 'So glad to hear you are doing better, Tom!',
      }),
    ]);
    console.log('Seeded demo community posts');
  }

  // A worked example of a home page, so the demo shows what a POI can
  // build for itself rather than the bare fallback. Only St. Mary's gets
  // one — Holy Trinity is left empty on purpose, so both paths are
  // visible side by side.
  const pageBlockCount = await pageBlockRepository.count({
    where: { poi: { id: poi.id } },
  });
  if (pageBlockCount === 0) {
    await pageBlockRepository.save([
      pageBlockRepository.create({
        poi,
        position: 0,
        type: PageBlockType.TEXT,
        title: 'Welcome to St. Mary’s',
        body: 'A welcoming community in the heart of Springfield. Whether you have been coming for fifty years or are walking in for the first time, there is a seat for you. Sunday Mass is at 10:00, and the doors open half an hour before.',
      }),
      pageBlockRepository.create({
        poi,
        position: 1,
        type: PageBlockType.NEXT_EVENTS,
        itemCount: 3,
      }),
      pageBlockRepository.create({
        poi,
        position: 2,
        type: PageBlockType.LATEST_ANNOUNCEMENTS,
        itemCount: 2,
      }),
      pageBlockRepository.create({
        poi,
        position: 3,
        type: PageBlockType.TEXT,
        title: 'Visiting us',
        body: 'The community office is open weekdays from 9am to 4pm. There is step-free access on the side entrance from the car park, and a hearing loop in the first four rows.',
      }),
      pageBlockRepository.create({
        poi,
        position: 4,
        type: PageBlockType.DONATE,
        title: 'Support the community',
        body: 'Every gift keeps the lights on, the food pantry stocked and the doors open.',
      }),
    ]);
    console.log('Seeded a demo home page for St. Mary’s');
  }

  await seedDonations(poi, 1);
  await seedDonations(poi2, 0.4);

  await seedChurchModules({
    dataSource,
    stMarys: poi,
    holyTrinity: poi2,
  });

  // The default demo since 24 Sep 2026.
  const carmen = await seedCarmen(dataSource);
  // Carmen's pin and a few neighbours of every kind for the map.
  await seedMap(dataSource);
  // The demo association (Seb, 26 Oct 2026), joined by María.
  const association = await seedAssociation(dataSource);

  // Module billing (30 Sep 2026): Carmen keeps every module on at no
  // charge ("Offert"). St. Mary's and Holy Trinity pay like real
  // communities (Seb, 1 Oct 2026); a database seeded before that loses
  // their paid modules once, as the DemoCommunitiesPay migration does.
  await poiRepository.update(carmen.id, { billingComped: true });
  for (const target of [poi, poi2]) {
    if (target.billingComped) {
      await poiRepository.update(target.id, { billingComped: false });
      await dataSource.query(
        `DELETE FROM active_modules WHERE poi_id = $1 AND module_type <> 'events'`,
        [target.id],
      );
    }
  }

  console.log('\nDemo POI ready:');
  console.log(`  id:       ${poi.id}`);
  console.log(`  QR token: ${poi.qrCodeToken}`);
  console.log(`\nSecond demo POI: ${poi2.name} (QR token: ${poi2.qrCodeToken})`);
  console.log('\nDemo admin dashboard login:');
  console.log(`  email:    ${DEMO_ADMIN_EMAIL}`);
  console.log(`  password: ${DEMO_ADMIN_PASSWORD}`);
  console.log(`\nDefault demo: ${carmen.name} (QR token: ${carmen.qrCodeToken})`);
  console.log(`  admin:    ${CARMEN_ADMIN_EMAIL} / ${CARMEN_ADMIN_PASSWORD}`);
  console.log('  app:      "Iniciar sesión" opens the demo member directly');
  if (association) console.log(`\nDemo association: ${association.name} (QR token: ${association.qrCodeToken})`);
  if (association) console.log(`  admin:    ${ASSOCIATION_ADMIN_EMAIL} / ${ASSOCIATION_ADMIN_PASSWORD}`);

  // Seb, 23 Sep 2026: nothing shown anywhere should say "parish" — the
  // word is "community". The rows above are only created when missing,
  // so a database seeded before that keeps the old wording; this puts
  // the demo's own text right, and touches nothing anyone has edited.
  const rewordings: [{ update: (where: object, set: object) => Promise<unknown> }, string, string, string][] = [
    [poiRepository, 'name', "St. Mary's Parish", "St. Mary's Community"],
    [poiRepository, 'description', 'A welcoming Catholic parish in the heart of Springfield, serving families for over 80 years.', 'A welcoming community in the heart of Springfield, serving families for over 80 years.'],
    [announcementRepository, 'body', 'Este es un anuncio de muestra para nuestra segunda parroquia, usado para mostrar el panel de administración.', 'Este es un anuncio de muestra para nuestra segunda comunidad, usado para mostrar el panel de administración.'],
    [announcementRepository, 'body', "This week's readings, choir practice moves to Thursday evenings starting this month, and a reminder that the parish office will be closed on Monday for the holiday.", "This week's readings, choir practice moves to Thursday evenings starting this month, and a reminder that the community office will be closed on Monday for the holiday."],
    [announcementRepository, 'body', 'Our food pantry is running low on canned goods and pasta. Donations can be dropped off at the parish hall any weekday between 9am and 4pm.', 'Our food pantry is running low on canned goods and pasta. Donations can be dropped off at the community hall any weekday between 9am and 4pm.'],
    [eventRepository, 'location', 'Parish Hall', 'Community Hall'],
    [communityCommentRepository, 'message', 'Same here, I leave from the parish hall around 8am.', 'Same here, I leave from the community hall around 8am.'],
    [pageBlockRepository, 'body', 'A welcoming parish in the heart of Springfield. Whether you have been coming for fifty years or are walking in for the first time, there is a seat for you. Sunday Mass is at 10:00, and the doors open half an hour before.', 'A welcoming community in the heart of Springfield. Whether you have been coming for fifty years or are walking in for the first time, there is a seat for you. Sunday Mass is at 10:00, and the doors open half an hour before.'],
    [pageBlockRepository, 'body', 'The parish office is open weekdays from 9am to 4pm. There is step-free access on the side entrance from the car park, and a hearing loop in the first four rows.', 'The community office is open weekdays from 9am to 4pm. There is step-free access on the side entrance from the car park, and a hearing loop in the first four rows.'],
    [pageBlockRepository, 'title', 'Support the parish', 'Support the community'],
  ];
  for (const [repository, column, from, to] of rewordings) {
    await repository.update({ [column]: from }, { [column]: to });
  }

  await dataSource.destroy();
}

/**
 * The modules built for churches on 23 Sep 2026: a real weekly timetable,
 * requests and appointments, Mass intentions, and richer giving. Each
 * piece checks for itself, so this also fills in a database seeded before
 * these modules existed.
 */
async function seedChurchModules({
  dataSource,
  stMarys,
  holyTrinity,
}: {
  dataSource: DataSource;
  stMarys: Poi;
  holyTrinity: Poi;
}) {
  const events = dataSource.getRepository(Event);
  const pois = dataSource.getRepository(Poi);
  const blocks = dataSource.getRepository(PoiPageBlock);
  const campaigns = dataSource.getRepository(DonationCampaign);
  const donations = dataSource.getRepository(Donation);
  const users = dataSource.getRepository(User);
  const memberships = dataSource.getRepository(UserPoi);
  const requests = dataSource.getRepository(ServiceRequest);
  const messages = dataSource.getRepository(ServiceRequestMessage);
  const documents = dataSource.getRepository(ServiceRequestDocument);
  const intentions = dataSource.getRepository(MassIntention);

  // The next date falling on `weekday` (0 = Sunday) at hh:mm, from today.
  function nextWeekday(weekday: number, hours: number, minutes = 0): Date {
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    const ahead = (weekday - date.getDay() + 7) % 7;
    date.setDate(date.getDate() + ahead);
    return date;
  }

  // The old demo had a one-off "Sunday Mass"; it is the weekly one now.
  await events.update(
    { title: 'Sunday Mass', recurrence: EventRecurrence.NONE },
    { recurrence: EventRecurrence.WEEKLY, category: EventCategory.MASS },
  );

  const timetables: [Poi, { title: string; weekday: number; at: [number, number]; category: EventCategory; location: string }[]][] = [
    [
      stMarys,
      [
        { title: 'Sunday Mass', weekday: 0, at: [10, 0], category: EventCategory.MASS, location: 'Main church' },
        { title: 'Saturday evening Mass', weekday: 6, at: [18, 30], category: EventCategory.MASS, location: 'Main church' },
        { title: 'Weekday Mass', weekday: 3, at: [9, 0], category: EventCategory.MASS, location: 'Chapel' },
        { title: 'Confessions', weekday: 5, at: [17, 0], category: EventCategory.CONFESSION, location: 'Chapel' },
        { title: 'Adoration', weekday: 4, at: [20, 0], category: EventCategory.ADORATION, location: 'Chapel' },
        { title: 'Office open', weekday: 2, at: [10, 0], category: EventCategory.OFFICE_HOURS, location: 'Community office' },
      ],
    ],
    [
      holyTrinity,
      [
        { title: 'Misa dominical', weekday: 0, at: [12, 0], category: EventCategory.MASS, location: 'Iglesia' },
        { title: 'Misa', weekday: 4, at: [19, 0], category: EventCategory.MASS, location: 'Capilla' },
        { title: 'Confesiones', weekday: 6, at: [18, 0], category: EventCategory.CONFESSION, location: 'Capilla' },
        { title: 'Despacho abierto', weekday: 1, at: [18, 0], category: EventCategory.OFFICE_HOURS, location: 'Despacho' },
      ],
    ],
  ];
  for (const [place, rows] of timetables) {
    for (const row of rows) {
      const existing = await events.findOne({ where: { poi: { id: place.id }, title: row.title } });
      if (existing) {
        if (existing.startsAt.getHours() === row.at[0] && existing.startsAt.getMinutes() === row.at[1]) {
          // Keep it, but make sure an old one-off row reads as weekly.
          if (existing.recurrence !== EventRecurrence.WEEKLY || existing.category !== row.category) {
            await events.update(existing.id, { recurrence: EventRecurrence.WEEKLY, category: row.category });
          }
        }
        continue;
      }
      const startsAt = nextWeekday(row.weekday, ...row.at);
      await events.save(
        events.create({
          poi: place,
          title: row.title,
          startsAt,
          // The office is open for a span; everything else is a start time.
          endsAt:
            row.category === EventCategory.OFFICE_HOURS
              ? new Date(startsAt.getTime() + 2 * 60 * 60 * 1000)
              : null,
          location: row.location,
          category: row.category,
          recurrence: EventRecurrence.WEEKLY,
        }),
      );
    }
  }
  console.log('Seeded weekly timetables');

  // Repeat rules: the weekday Mass runs Monday to Friday with one day off
  // coming up, and a Mass on the first Friday of each month.
  const weekdayMass = await events.findOne({ where: { poi: { id: stMarys.id }, title: 'Weekday Mass' } });
  if (weekdayMass && weekdayMass.repeatDays.length === 0) {
    const dayOff = new Date();
    dayOff.setDate(dayOff.getDate() + 10);
    while (dayOff.getDay() === 0 || dayOff.getDay() === 6) dayOff.setDate(dayOff.getDate() + 1);
    const key = `${dayOff.getFullYear()}-${String(dayOff.getMonth() + 1).padStart(2, '0')}-${String(dayOff.getDate()).padStart(2, '0')}`;
    await events.update(weekdayMass.id, {
      repeatDays: [1, 2, 3, 4, 5],
      exceptions: [{ date: key, reason: 'No Mass: Father Tom is on retreat' }],
    });
  }
  const firstFriday = await events.findOne({ where: { poi: { id: stMarys.id }, title: 'First Friday Mass' } });
  if (!firstFriday) {
    const startsAt = new Date();
    startsAt.setDate(1);
    startsAt.setHours(19, 0, 0, 0);
    await events.save(
      events.create({
        poi: stMarys,
        title: 'First Friday Mass',
        startsAt,
        location: 'Main church',
        category: EventCategory.MASS,
        recurrence: EventRecurrence.MONTHLY,
        monthlyWeek: 1,
        monthlyWeekday: 5,
      }),
    );
  }
  console.log('Seeded repeat rules');

  // The timetable at the top of St. Mary's home page, just under its welcome.
  const hasTimes = await blocks.count({
    where: { poi: { id: stMarys.id }, type: PageBlockType.CELEBRATION_TIMES },
  });
  if (!hasTimes) {
    const page = await blocks.find({ where: { poi: { id: stMarys.id } }, order: { position: 'ASC' } });
    const insertAt = page.length > 0 && page[0].type === PageBlockType.TEXT ? 1 : 0;
    for (const block of page.slice(insertAt)) block.position += 1;
    await blocks.save(page);
    await blocks.save(
      blocks.create({ poi: stMarys, type: PageBlockType.CELEBRATION_TIMES, position: insertAt, itemCount: 3 }),
    );
    console.log('Added the timetable to St. Mary’s home page');
  }

  // Offerings as a diocese might set them, and who issues the receipts.
  for (const [place, offering, legal] of [
    [stMarys, 20, { legalName: 'St. Mary’s Community Association', legalTaxId: 'W123456789', legalAddress: '1 Church Street\nSpringfield', receiptSignatory: 'Fr. John Miller, priest in charge' }],
    [holyTrinity, 10, { legalName: 'Comunidad Santísima Trinidad', legalTaxId: 'R2800000A', legalAddress: 'Calle Mayor 1\n28001 Madrid', receiptSignatory: 'P. Luis García, sacerdote responsable' }],
  ] as const) {
    if (place.massIntentionOffering == null) {
      await pois.update(place.id, { massIntentionOffering: offering, ...legal });
    }
  }

  // A project with a goal, and gifts towards it.
  for (const [place, title, description, goal] of [
    [stMarys, 'New roof', 'The church roof lets the rain in over the north aisle. Help us fix it before winter.', 25000],
    [holyTrinity, 'Restauración del órgano', 'Nuestro órgano necesita una restauración completa.', 12000],
  ] as const) {
    const exists = await campaigns.count({ where: { poi: { id: place.id } } });
    if (exists) continue;
    const campaign = await campaigns.save(
      campaigns.create({ poi: place, title, description, goalAmount: goal, active: true }),
    );
    const gifts = Array.from({ length: 24 }, (_, i) => {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - i * 2);
      return donations.create({
        poi: place,
        amount: [20, 50, 100, 250, 500][i % 5] * (place === stMarys ? 1.6 : 0.8),
        purpose: DonationPurpose.CAMPAIGN,
        campaign,
        createdAt,
      });
    });
    await donations.save(gifts);
    console.log(`Seeded the campaign "${title}"`);
  }

  // A member with a request in progress, so the office has one to open.
  let member = await users.findOne({ where: { phone: '+15550100200' } });
  if (!member) {
    member = await users.save(users.create({ phone: '+15550100200', firstName: 'Anna', lastName: 'Kowalski' }));
    await memberships.save(memberships.create({ user: member, poi: stMarys, role: MemberRole.MEMBER }));
  }
  const hasRequest = await requests.count({ where: { poi: { id: stMarys.id } } });
  if (!hasRequest) {
    const now = Date.now();
    const request = await requests.save(
      requests.create({
        poi: stMarys,
        requester: member,
        type: ServiceRequestType.BAPTISM,
        status: ServiceRequestStatus.IN_PROGRESS,
        contactName: 'Anna Kowalski',
        contactPhone: '+1 555 010 0200',
        details: 'We would like to have our daughter Sophie (born in June) baptised, ideally on a Sunday in November. Her godmother lives abroad.',
        preferredDate: 'A Sunday in November',
        lastMemberActivityAt: new Date(now - 60 * 60 * 1000),
        lastStaffActivityAt: new Date(now - 2 * 60 * 60 * 1000),
        memberSeenAt: new Date(now - 60 * 60 * 1000),
      }),
    );
    const admin = await users.findOne({ where: { email: 'admin@stmarys.example' } });
    await messages.save([
      messages.create({
        request,
        author: admin,
        fromStaff: true,
        body: 'Thank you, Anna! Baptisms are on the second Sunday of the month. Could you send Sophie’s birth certificate? We will then set a meeting with Fr. John.',
        createdAt: new Date(now - 2 * 60 * 60 * 1000),
      }),
      messages.create({
        request,
        author: member,
        fromStaff: false,
        body: 'Of course. Is a photo of it fine?',
        createdAt: new Date(now - 60 * 60 * 1000),
      }),
    ]);
    await documents.save(
      documents.create({ request, label: 'Birth certificate of the child', note: 'A photo of the page is fine.' }),
    );
    console.log('Seeded a demo baptism request');
  }

  // Two more requests, so the dashboard's first page has something in
  // each list: one nobody has opened yet, one with an appointment.
  const hour = 60 * 60 * 1000;
  if (!(await requests.count({ where: { poi: { id: stMarys.id }, contactName: 'Peter Novak' } }))) {
    await requests.save(
      requests.create({
        poi: stMarys,
        requester: member,
        type: ServiceRequestType.SICK_VISIT,
        status: ServiceRequestStatus.RECEIVED,
        contactName: 'Peter Novak',
        details: 'My father is at home after a fall and would love a visit and communion.',
        preferredDate: 'Any afternoon this week',
        lastMemberActivityAt: new Date(Date.now() - 3 * hour),
        memberSeenAt: new Date(Date.now() - 3 * hour),
        createdAt: new Date(Date.now() - 3 * hour),
      }),
    );
    console.log('Seeded a new sick visit request');
  }
  if (!(await requests.count({ where: { poi: { id: stMarys.id }, contactName: 'Julia & Mark' } }))) {
    const appointmentAt = nextWeekday(2, 17);
    await requests.save(
      requests.create({
        poi: stMarys,
        requester: member,
        type: ServiceRequestType.WEDDING,
        status: ServiceRequestStatus.APPOINTMENT_SET,
        contactName: 'Julia & Mark',
        details: 'We would like to marry next June.',
        appointmentAt,
        appointmentPlace: 'Welcome desk',
        lastMemberActivityAt: new Date(Date.now() - 48 * hour),
        lastStaffActivityAt: new Date(Date.now() - 24 * hour),
        staffSeenAt: new Date(Date.now() - 24 * hour),
        memberSeenAt: new Date(Date.now() - 20 * hour),
      }),
    );
    console.log('Seeded a wedding request with an appointment');
  }
  if (!(await intentions.count({ where: { poi: { id: stMarys.id }, requesterName: 'The Doyle family' } }))) {
    const lastSunday = nextWeekday(0, 10);
    lastSunday.setDate(lastSunday.getDate() - 7);
    await intentions.save(
      intentions.create({ poi: stMarys, intention: 'For Mary Doyle, on her anniversary', requesterName: 'The Doyle family', celebrationAt: lastSunday, celebrationTitle: 'Sunday Mass', offeringAmount: 20, status: MassIntentionStatus.CONFIRMED }),
    );
    console.log('Seeded a Mass intention still to tick off');
  }

  const hasIntentions = await intentions.count({ where: { poi: { id: stMarys.id } } });
  if (!hasIntentions) {
    const sunday = nextWeekday(0, 10);
    await intentions.save([
      intentions.create({ poi: stMarys, intention: 'For John Carter, who died last month', requesterName: 'Margaret Carter', celebrationAt: sunday, celebrationTitle: 'Sunday Mass', offeringAmount: 20, status: MassIntentionStatus.CONFIRMED }),
      intentions.create({ poi: stMarys, intention: 'In thanksgiving for 50 years of marriage', requesterName: 'Robert and Linda', celebrationAt: sunday, celebrationTitle: 'Sunday Mass', offeringAmount: 20, status: MassIntentionStatus.CONFIRMED }),
      intentions.create({ poi: stMarys, intention: 'For the souls in purgatory', requesterName: 'Susan', offeringAmount: 20, status: MassIntentionStatus.CONFIRMED, fromOffice: true }),
    ]);
    console.log('Seeded demo Mass intentions');
  }

  // The tiles at the top of each home page: a message from the office,
  // then what the timetable and the giving say on their own.
  const badges = dataSource.getRepository(PoiBadge);
  for (const [place, rows] of [
    [
      stMarys,
      [
        { kind: BadgeKind.MESSAGE, text: 'Harvest Mass this Sunday, all welcome', important: true, linkModule: ModuleType.EVENTS },
        { kind: BadgeKind.NEXT_MASS },
        { kind: BadgeKind.OFFICE_HOURS },
        { kind: BadgeKind.CAMPAIGN },
        { kind: BadgeKind.NEXT_CONFESSION, enabled: false },
      ],
    ],
    [
      holyTrinity,
      [
        { kind: BadgeKind.MESSAGE, text: 'Inscripciones de catequesis abiertas', linkModule: ModuleType.REQUESTS },
        { kind: BadgeKind.NEXT_MASS },
        { kind: BadgeKind.NEXT_CONFESSION },
        { kind: BadgeKind.OFFICE_HOURS },
        { kind: BadgeKind.CAMPAIGN, enabled: false },
      ],
    ],
  ] as const) {
    if (await badges.count({ where: { poi: { id: place.id } } })) continue;
    await badges.save(rows.map((row, position) => badges.create({ ...row, poi: place, position })));
    console.log(`Seeded home badges for ${place.name}`);
  }
}

await seed();

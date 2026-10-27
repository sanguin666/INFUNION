import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { ActiveModule } from '../active-modules/entities/active-module.entity.js';
import { BillingInvoice } from '../active-modules/entities/billing-invoice.entity.js';
import { Announcement } from '../announcements/entities/announcement.entity.js';
import { Event } from '../events/entities/event.entity.js';
import { PrayerRequest } from '../prayer-requests/entities/prayer-request.entity.js';
import { Livestream } from '../livestreams/entities/livestream.entity.js';
import { CommunityPost } from '../community/entities/community-post.entity.js';
import { CommunityComment } from '../community/entities/community-comment.entity.js';
import { Donation } from '../donations/entities/donation.entity.js';
import { PhoneVerificationCode } from '../auth/entities/phone-verification-code.entity.js';
import { PoiPageBlock } from '../poi-page/entities/poi-page-block.entity.js';
import { DonationCampaign } from '../donations/entities/donation-campaign.entity.js';
import { ServiceRequest } from '../service-requests/entities/service-request.entity.js';
import { ServiceRequestMessage } from '../service-requests/entities/service-request-message.entity.js';
import { ServiceRequestDocument } from '../service-requests/entities/service-request-document.entity.js';
import { MassIntention } from '../mass-intentions/entities/mass-intention.entity.js';
import { DailyReading } from '../daily-readings/entities/daily-reading.entity.js';
import { PoiBadge } from '../poi-badges/entities/poi-badge.entity.js';
import { PushToken } from '../notifications/entities/push-token.entity.js';
import { EventReminder } from '../notifications/entities/event-reminder.entity.js';
import { AuditLog } from '../superadmin/entities/audit-log.entity.js';
import { MemberConversation } from '../member-messages/entities/member-conversation.entity.js';
import { MemberMessage } from '../member-messages/entities/member-message.entity.js';
import { RateLimit } from '../common/rate-limit/rate-limit.entity.js';

// Every entity the app maps. Exported so the metadata check in
// typeorm.config.spec.ts, and data-source.ts (which the TypeORM CLI loads
// to generate and run migrations), both see exactly the same list the app
// runs with — a CLI missing an entity would generate a migration dropping
// the table it can't see.
export const ENTITIES = [
  User,
  Poi,
  UserPoi,
  ActiveModule,
  BillingInvoice,
  Announcement,
  Event,
  PrayerRequest,
  Livestream,
  CommunityPost,
  CommunityComment,
  Donation,
  DonationCampaign,
  PoiPageBlock,
  PhoneVerificationCode,
  ServiceRequest,
  ServiceRequestMessage,
  ServiceRequestDocument,
  MassIntention,
  DailyReading,
  PoiBadge,
  PushToken,
  EventReminder,
  AuditLog,
  MemberConversation,
  MemberMessage,
  RateLimit,
];

export function buildTypeOrmConfig(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const isProduction =
    configService.get<string>('NODE_ENV', 'development') === 'production';
  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME', 'ansae'),
    password: configService.get<string>('DB_PASSWORD', 'ansae'),
    database: configService.get<string>('DB_NAME', 'ansae'),
    entities: ENTITIES,
    migrations: ['dist/migrations/*.js'],
    // Development keeps building the schema straight from the entities, so
    // the demo starts with no migration step and an entity edit shows up on
    // the next save.
    //
    // Production does the opposite: it applies the checked-in migrations on
    // boot and never lets TypeORM reshape the schema on its own. `synchronize`
    // against real data is how a renamed column silently becomes a dropped
    // one. See `npm run migration:generate` in package.json.
    synchronize: !isProduction,
    migrationsRun: isProduction,
  };
}

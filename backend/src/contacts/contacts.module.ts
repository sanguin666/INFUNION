import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './entities/contact.entity.js';
import { Outreach } from './entities/outreach.entity.js';
import { OutreachRecipient } from './entities/outreach-recipient.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { DonationCampaign } from '../donations/entities/donation-campaign.entity.js';
import { Donation } from '../donations/entities/donation.entity.js';
import { AuthGuardsModule } from '../auth/auth-guards.module.js';
import { DonationsModule } from '../donations/donations.module.js';
import { emailSenderProvider } from '../auth/email/email-sender.js';
import { ContactsService } from './contacts.service.js';
import { OutreachService } from './outreach.service.js';
import { ContactsController, OutreachController } from './contacts.controller.js';
import { PublicLinksController } from './public-links.controller.js';

/**
 * Members imported from a community's own list, and writing to them
 * outside the app (Seb, 9 Nov 2026). Linking them when they sign in is
 * ContactLinkModule's job, which sign-in uses without this module.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, Outreach, OutreachRecipient, UserPoi, User, Poi, DonationCampaign, Donation]),
    AuthGuardsModule,
    DonationsModule,
  ],
  controllers: [ContactsController, OutreachController, PublicLinksController],
  providers: [ContactsService, OutreachService, emailSenderProvider],
  exports: [ContactsService],
})
export class ContactsModule {}

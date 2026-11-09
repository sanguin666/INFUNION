import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Donation } from './entities/donation.entity.js';
import { DonationCampaign } from './entities/donation-campaign.entity.js';
import { DonationsService } from './donations.service.js';
import {
  CampaignsController,
  DonationReturnController,
  DonationsController,
  ReceiptsController,
} from './donations.controller.js';
import { StripeWebhookController } from './stripe-webhook.controller.js';
import { StripeService } from './stripe.service.js';
import { PayoutsAccountController } from './payouts-account.controller.js';
import { PayoutsAccountService } from './payouts-account.service.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { User } from '../users/entities/user.entity.js';
import { PoisModule } from '../pois/pois.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Donation, DonationCampaign, Poi, User]), PoisModule, AuthModule, NotificationsModule],
  controllers: [
    DonationsController,
    CampaignsController,
    ReceiptsController,
    DonationReturnController,
    StripeWebhookController,
    PayoutsAccountController,
  ],
  providers: [DonationsService, StripeService, PayoutsAccountService],
  exports: [DonationsService, StripeService, PayoutsAccountService],
})
export class DonationsModule {}

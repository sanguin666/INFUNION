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
import { PoisModule } from '../pois/pois.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Donation, DonationCampaign]), PoisModule, AuthModule, NotificationsModule],
  controllers: [
    DonationsController,
    CampaignsController,
    ReceiptsController,
    DonationReturnController,
    StripeWebhookController,
  ],
  providers: [DonationsService, StripeService],
  exports: [DonationsService, StripeService],
})
export class DonationsModule {}

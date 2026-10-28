import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { DonationsService } from './donations.service.js';
import { CreateDonationDto } from './dto/create-donation.dto.js';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto.js';
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
  type AuthenticatedRequest,
  type MaybeAuthenticatedRequest,
} from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';
import { StripeService } from './stripe.service.js';
import { SignedUrlService } from '../common/signed-url/signed-url.service.js';
import { PoisService } from '../pois/pois.service.js';
import { decodeDonorKey, donorsCsv, encodeDonorKey, groupDonors, receiptHtml } from './receipts.js';
import { RequestReceiptDto } from './dto/request-receipt.dto.js';
import type { MyGift } from './donations.service.js';
import { localDiskStorage, publicUrlFor } from '../common/upload/multer-storage.js';

const CAMPAIGN_IMAGES = 'campaigns';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function parseYear(value: string | undefined): number {
  const year = Number(value ?? new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new BadRequestException('Not a year');
  }
  return year;
}

/** Where Stripe sends the payer back to — see startCheckout below. */
export function returnUrlBase(configService: ConfigService, request: Request): string {
  return configService.get<string>('PUBLIC_BASE_URL') ?? `${request.protocol}://${request.get('host')}`;
}

function receiptPath(poiId: string, year: number, encodedKey: string): string {
  return `/receipts/${poiId}/${year}/${encodedKey}`;
}

function giftReceiptPath(donationId: string): string {
  return `/receipts/gift/${donationId}`;
}

function exportPath(poiId: string, year: number): string {
  return `/receipts/${poiId}/${year}/export`;
}

function giftsPath(poiId: string, year: number): string {
  return `/receipts/${poiId}/${year}/gifts`;
}

function modelo182Path(poiId: string, year: number): string {
  return `/receipts/${poiId}/${year}/modelo182`;
}

@Controller('pois/:poiId/donations')
export class DonationsController {
  constructor(
    private readonly donationsService: DonationsService,
    private readonly configService: ConfigService,
    private readonly signedUrls: SignedUrlService,
  ) {}

  // Public: mirrors the app's demo donate flow (no payment taken).
  @Post()
  create(@Param('poiId') poiId: string, @Body() dto: CreateDonationDto) {
    return this.donationsService.create(poiId, dto);
  }

  /**
   * Public: starts a gift. Returns either a Stripe checkout URL for the app
   * to open, or `mode: 'demo'` when no Stripe key is configured.
   *
   * Stripe sends the payer back to a page on this same backend, so the URL it
   * redirects to has to be one the payer's phone can reach — the request's own
   * host is right in every setup we have (localhost, LAN IP, or the ngrok
   * domain), with PUBLIC_BASE_URL to override it behind a proxy.
   */
  @Post('checkout')
  @UseGuards(OptionalJwtAuthGuard)
  startCheckout(
    @Param('poiId') poiId: string,
    @Body() dto: CreateDonationDto,
    @Req() request: MaybeAuthenticatedRequest,
  ) {
    return this.donationsService.startCheckout(poiId, dto, returnUrlBase(this.configService, request), {
      donorUserId: request.userId,
    });
  }

  // ---- The signed-in giver's own ----

  @Get('mine/monthly')
  @UseGuards(JwtAuthGuard)
  myMonthly(@Param('poiId') poiId: string, @Req() request: AuthenticatedRequest) {
    return this.donationsService.listMyMonthly(poiId, request.userId);
  }

  @Post('mine/monthly/:donationId/stop')
  @UseGuards(JwtAuthGuard)
  async stopMonthly(
    @Param('poiId') poiId: string,
    @Param('donationId') donationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.donationsService.stopMonthly(poiId, donationId, request.userId);
  }

  // A Stripe page to replace the card a monthly gift is charged on.
  @Post('mine/monthly/:donationId/card')
  @UseGuards(JwtAuthGuard)
  updateCard(
    @Param('poiId') poiId: string,
    @Param('donationId') donationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const returnUrl = `${returnUrlBase(this.configService, request)}/donations/return?status=card`;
    return this.donationsService.updateCardUrl(poiId, donationId, request.userId, returnUrl);
  }

  // What the gift form's "what it really costs you" line needs to know
  // about the signed-in giver.
  @Get('mine/tax')
  @UseGuards(JwtAuthGuard)
  myTax(@Param('poiId') poiId: string, @Req() request: AuthenticatedRequest) {
    return this.donationsService.myTaxContext(poiId, request.userId);
  }

  // Every gift the signed-in giver made here, each with a link to its own
  // receipt when they asked for one.
  @Get('mine/gifts')
  @UseGuards(JwtAuthGuard)
  async myGifts(@Param('poiId') poiId: string, @Req() request: AuthenticatedRequest) {
    const gifts = await this.donationsService.listMyGifts(poiId, request.userId);
    return gifts.map((gift) => this.withReceiptUrl(gift));
  }

  // A receipt for a gift made without one: the details it needs, then the link.
  @Post('mine/gifts/:donationId/receipt')
  @UseGuards(JwtAuthGuard)
  async requestReceipt(
    @Param('poiId') poiId: string,
    @Param('donationId') donationId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: RequestReceiptDto,
  ) {
    return this.withReceiptUrl(await this.donationsService.requestReceipt(poiId, donationId, request.userId, dto));
  }

  private withReceiptUrl(gift: MyGift) {
    return { ...gift, receiptUrl: gift.wantsReceipt ? this.signedUrls.sign(giftReceiptPath(gift.id)) : null };
  }

  // One entry per year with receipt-worthy gifts, each with a link to
  // that year's receipt that opens in the phone's browser.
  @Get('mine/receipts')
  @UseGuards(JwtAuthGuard)
  async myReceipts(@Param('poiId') poiId: string, @Req() request: AuthenticatedRequest) {
    const years = await this.donationsService.myReceiptYears(poiId, request.userId);
    const key = encodeDonorKey(`u:${request.userId}`);
    return years.map(({ year, total }) => ({
      year,
      total,
      url: this.signedUrls.sign(receiptPath(poiId, year, key)),
    }));
  }

  // ---- The office's tax receipts ----

  @Get('receipts')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  async receipts(@Param('poiId') poiId: string, @Query('year') yearParam?: string) {
    const year = parseYear(yearParam);
    const donors = await this.donationsService.receiptDonors(poiId, year);
    return {
      year,
      exportUrl: this.signedUrls.sign(exportPath(poiId, year)),
      giftsUrl: this.signedUrls.sign(giftsPath(poiId, year)),
      modelo182Url: this.signedUrls.sign(modelo182Path(poiId, year)),
      donors: donors.map((donor) => {
        const key = encodeDonorKey(donor.key);
        return { ...donor, key, url: this.signedUrls.sign(receiptPath(poiId, year, key)) };
      }),
    };
  }

  // What the year's modelo 182 file would hold, and who it leaves out
  // and why, so the office can fix those before downloading it.
  @Get('receipts/modelo182')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  async modelo182Check(@Param('poiId') poiId: string, @Query('year') yearParam?: string) {
    const { included, total, skipped } = await this.donationsService.modelo182(poiId, parseYear(yearParam));
    return { included, total, skipped };
  }

  // Public: the app polls this while the payer is on Stripe's page.
  @Get(':donationId/status')
  getStatus(@Param('poiId') poiId: string, @Param('donationId') donationId: string) {
    return this.donationsService.getStatus(poiId, donationId);
  }

  // Individual gift amounts are financial data — admin-only, unlike the
  // other modules' public read endpoints.
  @Get()
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  findForPoi(
    @Param('poiId') poiId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.donationsService.findForPoi(poiId, limit);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  getStats(@Param('poiId') poiId: string) {
    return this.donationsService.getStats(poiId);
  }
}

/**
 * Projects a community raises money for. Reading the open ones is public,
 * like the rest of a place's content; everything else is the office's.
 */
@Controller('pois/:poiId/campaigns')
export class CampaignsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Get()
  listOpen(@Param('poiId') poiId: string) {
    return this.donationsService.listCampaigns(poiId, false);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  listAll(@Param('poiId') poiId: string) {
    return this.donationsService.listCampaigns(poiId, true);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  create(@Param('poiId') poiId: string, @Body() dto: CreateCampaignDto) {
    return this.donationsService.createCampaign(poiId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  update(@Param('poiId') poiId: string, @Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.donationsService.updateCampaign(poiId, id, dto);
  }

  // The project's picture, uploaded on its own like every other image.
  @Post(':id/image')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: localDiskStorage(CAMPAIGN_IMAGES),
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new UnsupportedMediaTypeException('File must be an image'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadImage(@Param('poiId') poiId: string, @Param('id') id: string, @UploadedFile() image?: Express.Multer.File) {
    if (!image) throw new BadRequestException('No image uploaded');
    return this.donationsService.setCampaignImage(poiId, id, publicUrlFor(CAMPAIGN_IMAGES, image.filename));
  }

  @Delete(':id/image')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  removeImage(@Param('poiId') poiId: string, @Param('id') id: string) {
    return this.donationsService.setCampaignImage(poiId, id, null);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  remove(@Param('poiId') poiId: string, @Param('id') id: string) {
    return this.donationsService.removeCampaign(poiId, id);
  }
}

/**
 * A receipt, or the year's list of givers, opened from a signed link (see
 * SignedUrlService): the dashboard and the app hand these out only after
 * checking who is asking, and the browser tab they open in can't carry a
 * login of its own.
 */
@Controller('receipts')
export class ReceiptsController {
  constructor(
    private readonly donationsService: DonationsService,
    private readonly poisService: PoisService,
    private readonly stripeService: StripeService,
    private readonly signedUrls: SignedUrlService,
  ) {}

  // One gift's receipt, from the giver's list of gifts in the app.
  @Get('gift/:donationId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'private, no-store')
  async giftReceipt(
    @Param('donationId') donationId: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
  ): Promise<string> {
    if (!this.signedUrls.verify(giftReceiptPath(donationId), exp, sig)) {
      throw new ForbiddenException('This link has expired');
    }
    const gift = await this.donationsService.findReceiptGift(donationId);
    if (!gift) throw new NotFoundException('No gift to receipt');
    const [donor] = groupDonors([gift]);
    const poi = await this.poisService.findOne(gift.poi.id);
    return receiptHtml(poi, donor, gift.createdAt.getFullYear(), this.stripeService.currency, {
      id: gift.id,
      at: gift.createdAt,
    });
  }

  @Get(':poiId/:year/export')
  async export(
    @Param('poiId') poiId: string,
    @Param('year') yearParam: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const year = parseYear(yearParam);
    if (!this.signedUrls.verify(exportPath(poiId, year), exp, sig)) {
      throw new ForbiddenException('This link has expired');
    }
    const donors = await this.donationsService.receiptDonors(poiId, year);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="donors-${year}.csv"`);
    response.send(donorsCsv(donors));
  }

  // Every gift of the year, for the accountant.
  @Get(':poiId/:year/gifts')
  async gifts(
    @Param('poiId') poiId: string,
    @Param('year') yearParam: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const year = parseYear(yearParam);
    if (!this.signedUrls.verify(giftsPath(poiId, year), exp, sig)) {
      throw new ForbiddenException('This link has expired');
    }
    const csv = await this.donationsService.giftsCsv(poiId, year);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="gifts-${year}.csv"`);
    response.send(csv);
  }

  // The modelo 182 file, in the AEAT's own encoding (ISO-8859-1).
  @Get(':poiId/:year/modelo182')
  async modelo182(
    @Param('poiId') poiId: string,
    @Param('year') yearParam: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const year = parseYear(yearParam);
    if (!this.signedUrls.verify(modelo182Path(poiId, year), exp, sig)) {
      throw new ForbiddenException('This link has expired');
    }
    const { content } = await this.donationsService.modelo182(poiId, year);
    response.setHeader('Content-Type', 'text/plain; charset=iso-8859-1');
    response.setHeader('Content-Disposition', `attachment; filename="modelo182-${year}.txt"`);
    response.send(Buffer.from(content, 'latin1'));
  }

  @Get(':poiId/:year/:key')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'private, no-store')
  async receipt(
    @Param('poiId') poiId: string,
    @Param('year') yearParam: string,
    @Param('key') encodedKey: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
  ): Promise<string> {
    const year = parseYear(yearParam);
    if (!this.signedUrls.verify(receiptPath(poiId, year, encodedKey), exp, sig)) {
      throw new ForbiddenException('This link has expired');
    }
    const donor = await this.donationsService.receiptDonor(poiId, year, decodeDonorKey(encodedKey));
    if (!donor) throw new NotFoundException('No gifts to receipt');
    const poi = await this.poisService.findOne(poiId);
    return receiptHtml(poi, donor, year, this.stripeService.currency);
  }
}

/**
 * Where Stripe sends the payer once they're done. The app can't be the
 * redirect target itself (Stripe only accepts http/https URLs, not an app's
 * own scheme), so this page just tells them to come back — the app notices
 * the payment on its own by polling.
 */
@Controller('donations')
export class DonationReturnController {
  constructor(private readonly stripeService: StripeService) {}

  /**
   * Public: lets the app say "secure payment" or "demo, no money moves"
   * truthfully, and show amounts in whatever currency the backend charges in.
   */
  @Get('config')
  config(): { paymentsEnabled: boolean; currency: string } {
    return {
      paymentsEnabled: this.stripeService.isConfigured,
      currency: this.stripeService.currency,
    };
  }

  @Get('return')
  @Header('Content-Type', 'text/html; charset=utf-8')
  returnPage(@Query('status') status?: string): string {
    const cancelled = status === 'cancelled';
    const card = status === 'card';
    const title = cancelled ? 'Payment cancelled' : card ? 'Card updated' : 'Thank you!';
    const message = cancelled
      ? 'No payment was taken. You can close this page and go back to the app.'
      : card
        ? 'Your monthly gift will use this card from now on. You can close this page and go back to the app.'
        : 'Your donation went through. You can close this page and go back to the app.';
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
             background: #FBF7F2; color: #2B2724; font-family: system-ui, -apple-system, sans-serif; padding: 24px; }
      main { max-width: 22rem; text-align: center; }
      h1 { font-size: 1.75rem; margin: 0 0 0.75rem; }
      p { font-size: 1.125rem; line-height: 1.5; margin: 0; color: #6B625B; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
    </main>
  </body>
</html>`;
  }
}

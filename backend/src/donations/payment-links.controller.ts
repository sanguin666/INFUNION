import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';
import { PaymentLinksService } from './payment-links.service.js';
import { CreatePaymentLinkDto, UpdatePaymentLinkDto } from './dto/payment-link.dto.js';

/** A community's payment links, for its admins (the public page is /m/pay/:code). */
@Controller('pois/:poiId/payment-links')
@UseGuards(JwtAuthGuard, PoiAdminGuard)
export class PaymentLinksController {
  constructor(private readonly paymentLinks: PaymentLinksService) {}

  @Get()
  list(@Param('poiId') poiId: string) {
    return this.paymentLinks.list(poiId);
  }

  @Post()
  create(@Param('poiId') poiId: string, @Body() dto: CreatePaymentLinkDto) {
    return this.paymentLinks.create(poiId, dto);
  }

  @Patch(':id')
  update(@Param('poiId') poiId: string, @Param('id') id: string, @Body() dto: UpdatePaymentLinkDto) {
    return this.paymentLinks.update(poiId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('poiId') poiId: string, @Param('id') id: string): Promise<void> {
    await this.paymentLinks.archive(poiId, id);
  }
}

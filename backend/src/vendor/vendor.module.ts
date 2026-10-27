import { Module } from '@nestjs/common';
import { VendorController } from './vendor.controller.js';

@Module({ controllers: [VendorController] })
export class VendorModule {}

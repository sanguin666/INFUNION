import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './entities/contact.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { ContactLinkService } from './contact-link.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Contact, UserPoi])],
  providers: [ContactLinkService],
  exports: [ContactLinkService],
})
export class ContactLinkModule {}

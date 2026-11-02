import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AnnouncementsService } from './announcements.service.js';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto.js';
import { localDiskStorage, publicUrlFor } from '../common/upload/multer-storage.js';
import { LARGE_PICTURE_SIDE, MAX_PICTURE_UPLOAD_BYTES, pictureStorage } from '../common/upload/image-storage.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';

const MAX_AUDIO_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB — a few minutes of voice audio.
const ANNOUNCEMENT_IMAGES = 'announcements';

@Controller('pois/:poiId/announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  // Accepts multipart/form-data: `title`, optional `body`, optional `audio`
  // file field (a recorded voice message — see the app's ComposeAnnouncementScreen).
  //
  // Staff only: an announcement is the parish speaking to its members, so
  // posting one is an admin action like editing or deleting it. Congregants
  // write in the community module instead.
  @Post()
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: localDiskStorage('announcements'),
      limits: { fileSize: MAX_AUDIO_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('audio/')) {
          callback(new UnsupportedMediaTypeException('File must be audio'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  create(
    @Param('poiId') poiId: string,
    @Body() dto: CreateAnnouncementDto,
    @UploadedFile() audio?: Express.Multer.File,
  ) {
    return this.announcementsService.create(poiId, dto, audio);
  }

  @Get()
  findForPoi(@Param('poiId') poiId: string) {
    return this.announcementsService.findForPoi(poiId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  update(
    @Param('poiId') poiId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcementsService.update(poiId, id, dto);
  }

  // The post's photo, uploaded on its own after the post is saved, like a
  // donation project's.
  @Post(':id/image')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: pictureStorage(ANNOUNCEMENT_IMAGES, LARGE_PICTURE_SIDE),
      limits: { fileSize: MAX_PICTURE_UPLOAD_BYTES },
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
    return this.announcementsService.setImage(poiId, id, publicUrlFor(ANNOUNCEMENT_IMAGES, image.filename));
  }

  @Delete(':id/image')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  removeImage(@Param('poiId') poiId: string, @Param('id') id: string) {
    return this.announcementsService.setImage(poiId, id, null);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  remove(@Param('poiId') poiId: string, @Param('id') id: string) {
    return this.announcementsService.remove(poiId, id);
  }
}

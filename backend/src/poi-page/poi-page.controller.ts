import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  BadRequestException,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PoiPageService } from './poi-page.service.js';
import { CreatePageBlockDto } from './dto/create-page-block.dto.js';
import { UpdatePageBlockDto } from './dto/update-page-block.dto.js';
import { ReorderPageBlocksDto } from './dto/reorder-page-blocks.dto.js';
import { publicUrlFor } from '../common/upload/multer-storage.js';
import { LARGE_PICTURE_SIDE, MAX_PICTURE_UPLOAD_BYTES, pictureStorage } from '../common/upload/image-storage.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';

const UPLOAD_SUBFOLDER = 'poi-pages';

@Controller('pois/:poiId/page-blocks')
export class PoiPageController {
  constructor(private readonly poiPageService: PoiPageService) {}

  // Open, like the other read endpoints: this is what the app renders when
  // a congregant opens the place.
  @Get()
  findForPoi(@Param('poiId') poiId: string) {
    return this.poiPageService.findForPoi(poiId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  create(@Param('poiId') poiId: string, @Body() dto: CreatePageBlockDto) {
    return this.poiPageService.create(poiId, dto);
  }

  // Upload first, then reference the returned URL from an image block.
  // Keeping it separate leaves block create/update as plain JSON.
  @Post('image')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: pictureStorage(UPLOAD_SUBFOLDER, LARGE_PICTURE_SIDE),
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
  uploadImage(@UploadedFile() image?: Express.Multer.File) {
    if (!image) {
      throw new BadRequestException('No image uploaded');
    }
    return { url: publicUrlFor(UPLOAD_SUBFOLDER, image.filename) };
  }

  @Post('reorder')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  reorder(@Param('poiId') poiId: string, @Body() dto: ReorderPageBlocksDto) {
    return this.poiPageService.reorder(poiId, dto.ids);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  update(
    @Param('poiId') poiId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePageBlockDto,
  ) {
    return this.poiPageService.update(poiId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  remove(@Param('poiId') poiId: string, @Param('id') id: string) {
    return this.poiPageService.remove(poiId, id);
  }
}

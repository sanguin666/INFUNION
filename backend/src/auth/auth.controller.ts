import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JoinPoiDto } from '../user-pois/dto/join-poi.dto.js';
import { AuthService } from './auth.service.js';
import { PhoneAuthService } from './phone-auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RequestPhoneCodeDto } from './dto/request-phone-code.dto.js';
import { VerifyPhoneCodeDto } from './dto/verify-phone-code.dto.js';
import { UpdateLanguageDto } from '../common/dto/update-language.dto.js';
import { UpdateProfileDto } from '../common/dto/update-profile.dto.js';
import { SetLastActivePoiDto } from '../common/dto/set-last-active-poi.dto.js';
import { localDiskStorage, publicUrlFor } from '../common/upload/multer-storage.js';
import { JwtAuthGuard, type AuthenticatedRequest } from './guards/jwt-auth.guard.js';

const AVATAR_SUBFOLDER = 'avatars';
// A profile picture is shown at 52pt: anything past a couple of megabytes
// is a photo straight off a camera, which we don't need and shouldn't
// keep.
const MAX_AVATAR_SIZE_BYTES = 4 * 1024 * 1024;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly phoneAuthService: PhoneAuthService,
  ) {}

  // Email + password, used by the admin dashboard only.
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, request);
  }

  // The congregant app's login: a code by SMS, no password to remember.
  // Both halves answer the same way whether or not the number has an
  // account, so neither can be used to find out who is registered.
  @Post('phone/request-code')
  requestPhoneCode(@Body() dto: RequestPhoneCodeDto) {
    return this.phoneAuthService.requestCode(dto.phone);
  }

  @Post('phone/verify')
  verifyPhoneCode(@Body() dto: VerifyPhoneCodeDto) {
    return this.phoneAuthService.verifyCode(dto.phone, dto.code, dto.firstName);
  }

  // The demo: whether "sign in" skips the code, and the sign-in itself.
  @Get('demo')
  demoAvailable() {
    return { enabled: this.phoneAuthService.demoLoginEnabled() };
  }

  @Post('demo')
  demoSignIn() {
    return this.phoneAuthService.demoSignIn();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.userId);
  }

  // The app's settings menu: the name someone chose for themselves.
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMyProfile(@Req() request: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.authService.updateMyProfile(request.userId, dto);
  }

  // The picture, uploaded on its own so the name above stays plain JSON.
  // The answer is the whole of `me`, so the app can replace its session in
  // one go rather than patching a field.
  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: localDiskStorage(AVATAR_SUBFOLDER),
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new UnsupportedMediaTypeException('File must be an image'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadMyAvatar(@Req() request: AuthenticatedRequest, @UploadedFile() image?: Express.Multer.File) {
    if (!image) {
      throw new BadRequestException('No image uploaded');
    }
    return this.authService.updateMyAvatar(
      request.userId,
      publicUrlFor(AVATAR_SUBFOLDER, image.filename),
    );
  }

  // Called as the app enters a place, so someone who belongs to several
  // reopens where they left off.
  @Patch('me/last-poi')
  @UseGuards(JwtAuthGuard)
  setLastActivePoi(@Req() request: AuthenticatedRequest, @Body() dto: SetLastActivePoiDto) {
    return this.authService.setLastActivePoi(request.userId, dto.poiId);
  }

  @Patch('me/language')
  @UseGuards(JwtAuthGuard)
  updateMyLanguage(@Req() request: AuthenticatedRequest, @Body() dto: UpdateLanguageDto) {
    return this.authService.updateMyLanguage(request.userId, dto.language);
  }

  // Joining and leaving a place, scoped to whoever the token belongs to.
  // The app never has to know its own user id, and nobody can add or remove
  // a membership for somebody else.
  @Post('me/pois')
  @UseGuards(JwtAuthGuard)
  joinPoi(@Req() request: AuthenticatedRequest, @Body() dto: JoinPoiDto) {
    return this.authService.joinPoi(request.userId, dto);
  }

  @Delete('me/pois/:poiId')
  @UseGuards(JwtAuthGuard)
  leavePoi(@Req() request: AuthenticatedRequest, @Param('poiId') poiId: string) {
    return this.authService.leavePoi(request.userId, poiId);
  }
}

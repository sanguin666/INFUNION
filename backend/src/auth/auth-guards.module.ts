import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { User } from '../users/entities/user.entity.js';
import { AuditLog } from '../superadmin/entities/audit-log.entity.js';
import { SuperadminAccess } from './superadmin-access.service.js';
import { SuperadminAccountGuard, SuperadminGuard } from './guards/superadmin.guard.js';
import { JwtAuthGuard, OptionalJwtAuthGuard } from './guards/jwt-auth.guard.js';
import { requireJwtSecret } from './jwt-secret.js';
import { SignedUrlService } from '../common/signed-url/signed-url.service.js';
import { PoiAdminGuard } from './guards/poi-admin.guard.js';
import { SelfGuard } from './guards/self.guard.js';

/**
 * The guards, and the JWT setup they need, with no dependency on the
 * modules they protect.
 *
 * That independence is the point: `users`, `user-pois` and `pois` all need
 * guards, and AuthModule needs all three of them, so having the guards live
 * in AuthModule made those imports circular. This module depends on nothing
 * but a few tables (`user_pois`, `users`, `audit_log`), so anything can
 * import it.
 */
export const jwtModule = JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    secret: requireJwtSecret(configService),
    signOptions: { expiresIn: '7d' },
  }),
});


// Exported as well as imported: a guard named in `@UseGuards(...)` is
// instantiated in the injector of the module whose controller uses it, so
// that module — not this one — has to be able to resolve UserPoiRepository.
// User and AuditLog too, for SuperadminAccess (the superadmin check, the
// Journal and last-seen times), which the guards below use.
const userPoiFeature = TypeOrmModule.forFeature([UserPoi, User, AuditLog]);

@Module({
  imports: [jwtModule, userPoiFeature],
  providers: [
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    PoiAdminGuard,
    SelfGuard,
    SignedUrlService,
    SuperadminAccess,
    SuperadminGuard,
    SuperadminAccountGuard,
  ],
  exports: [
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    PoiAdminGuard,
    SelfGuard,
    SignedUrlService,
    SuperadminAccess,
    SuperadminGuard,
    SuperadminAccountGuard,
    jwtModule,
    userPoiFeature,
  ],
})
export class AuthGuardsModule {}

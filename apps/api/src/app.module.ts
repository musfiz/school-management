import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { dataSourceOptions } from './database/data-source';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MenusModule } from './menus/menus.module';
import { SiteSettingsModule } from './site-settings/site-settings.module';
import { PagesModule } from './pages/pages.module';
import { UploadsModule } from './uploads/uploads.module';
import { GoverningBodyModule } from './governing-body/governing-body.module';
import { ExPrincipalsModule } from './ex-principals/ex-principals.module';
import { SlidersModule } from './sliders/sliders.module';
import { StaffModule } from './staff/staff.module';
import { TeachersModule } from './teachers/teachers.module';
import { PermissionsModule } from './permissions/permissions.module';
import { ModulesModule } from './modules/modules.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dataSourceOptions),
    AuthModule,
    UsersModule,
    MenusModule,
    SiteSettingsModule,
    PagesModule,
    UploadsModule,
    GoverningBodyModule,
    ExPrincipalsModule,
    SlidersModule,
    StaffModule,
    TeachersModule,
    PermissionsModule,
    ModulesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DatabaseService,
    // Global guard: every route requires a valid JWT unless it opts out
    // with @Public() (see AuthController). AuthModule exports JwtAuthGuard.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}

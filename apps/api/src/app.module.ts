import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MenusModule } from './menus/menus.module';
import { SiteSettingsModule } from './site-settings/site-settings.module';
import { PagesModule } from './pages/pages.module';
import { UploadsModule } from './uploads/uploads.module';
import { GoverningBodyModule } from './governing-body/governing-body.module';
import { ExPrincipalsModule } from './ex-principals/ex-principals.module';
import { SlidersModule } from './sliders/sliders.module';
import { GalleriesModule } from './galleries/galleries.module';
import { StaffModule } from './staff/staff.module';
import { TeachersModule } from './teachers/teachers.module';
import { PermissionsModule } from './permissions/permissions.module';
import { ModulesModule } from './modules/modules.module';
import { HeroSectionModule } from './hero-section/hero-section.module';
import { NoticesModule } from './notices/notices.module';
import { AccountingModule } from './accounting/accounting.module';
import { AdmissionsModule } from './admissions/admissions.module';
import { DocumentsModule } from './documents/documents.module';
import { AcademicResultsModule } from './academic-results/academic-results.module';
import { StorageModule } from './modules/storage/storage.module';
import { PermissionAssignmentModule } from './permission-assignment/permission-assignment.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { MenuPermissionsGuard } from './common/guards/menu-permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    MenusModule,
    SiteSettingsModule,
    PagesModule,
    UploadsModule,
    GoverningBodyModule,
    ExPrincipalsModule,
    SlidersModule,
    GalleriesModule,
    StaffModule,
    TeachersModule,
    PermissionsModule,
    ModulesModule,
    HeroSectionModule,
    NoticesModule,
    AccountingModule,
    AdmissionsModule,
    DocumentsModule,
    AcademicResultsModule,
    // Global strategy module for image storage (local ⇄ S3/R2 via env).
    StorageModule,
    PermissionAssignmentModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global guard: every route requires a valid JWT unless it opts out
    // with @Public() (see AuthController). AuthModule exports JwtAuthGuard.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Menu-level permission guard enforces @RequirePermission(menuSlug, action).
    // Superadmins bypass it entirely.
    { provide: APP_GUARD, useClass: MenuPermissionsGuard },
  ],
})
export class AppModule {}

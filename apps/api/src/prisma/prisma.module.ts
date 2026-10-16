import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global access to the Prisma Client. Being `@Global` means the 16 modules that
 * still use `TypeOrmModule.forFeature` can inject `PrismaService` as they are
 * migrated without each importing this module
 * (docs/PRISMA_MIGRATION_PLAN.md AD-P5).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

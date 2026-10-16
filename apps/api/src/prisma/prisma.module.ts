import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global access to the Prisma Client. Being `@Global` means modules can
 * inject `PrismaService` directly without each importing this module.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

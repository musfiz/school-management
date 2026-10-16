import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';
import { buildMariaDbConnectionConfig } from './database-url';
import { passwordHashingExtension } from './password-hashing.extension';
import { wireFormatExtension } from './wire.extension';

/**
 * Application-wide Prisma Client (Prisma ORM 7).
 *
 * Prisma 7 runs without a Rust query engine and connects through a driver
 * adapter; for MySQL/MariaDB that is `@prisma/adapter-mariadb` over the
 * `mariadb` driver.
 *
 * Coexists with the TypeORM DataSource while modules are migrated wave by wave.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaMariaDb(buildMariaDbConnectionConfig(), {
        database: process.env.DB_DATABASE ?? 'school',
      }),
    });

    // AD-P8 / Q4: hash `users.password` centrally. `$extends` returns a proxy
    // client; returning it here makes that proxy the injected provider, so
    // every `prisma.users.create/update/upsert` call site hashes passwords —
    // the invariant the removed TypeORM entity hook used to hold. Lifecycle
    // hooks (`onModuleInit`/`onModuleDestroy`) are forwarded through the proxy
    // to this class's prototype.
    //
    // AD-P13: `wire-format` restores the TypeORM DECIMAL-string wire format
    // (`"800.00"` rather than Prisma's `Decimal` → `"800"`) and the
    // `"YYYY-MM-DD"` form for DATE columns, for every result.
    return this.$extends(passwordHashingExtension)
      .$extends(wireFormatExtension) as unknown as PrismaService;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma Client connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

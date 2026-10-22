import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import {
  STORAGE_PROVIDER,
  IStorageProvider,
} from './interfaces/storage-provider.interface';
import { LocalStorageDriver } from './drivers/local-storage.driver';
import { S3StorageDriver } from './drivers/s3-storage.driver';

/**
 * Raw provider definition (declared outside @Module so the factory stays
 * unit-testable and DI-instantiated once per application).
 */
export const storageProvider = {
  provide: STORAGE_PROVIDER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): IStorageProvider => {
    const driver = configService.get<string>('STORAGE_DRIVER', 'local');

    if (driver === 's3') {
      const bucket = configService.get<string>('S3_BUCKET');
      if (!bucket) {
        throw new Error(
          'STORAGE_DRIVER=s3 requires S3_BUCKET to be set in the environment.',
        );
      }

      const endpoint = configService.get<string | undefined>('S3_ENDPOINT');
      const accessKeyId = configService.get<string | undefined>(
        'S3_ACCESS_KEY_ID',
      );
      const secretAccessKey = configService.get<string | undefined>(
        'S3_SECRET_ACCESS_KEY',
      );

      const client = new S3Client({
        region: configService.get<string>('S3_REGION', 'auto'),
        endpoint: endpoint || undefined,
        // R2 / MinIO use path-style addressing; AWS S3 uses virtual-host.
        forcePathStyle: Boolean(endpoint),
        credentials:
          accessKeyId && secretAccessKey
            ? { accessKeyId, secretAccessKey }
            : undefined, // falls back to the ambient AWS credential chain (IAM role etc.)
      });

      return new S3StorageDriver(
        client,
        bucket,
        configService.get<string | undefined>('S3_PUBLIC_URL') || undefined,
      );
    }

    // Local driver — zero-cost default. UPLOADS_DIR must match the static
    // mount in main.ts (which defaults to ./uploads).
    return new LocalStorageDriver({
      uploadsDir: configService.get<string>('UPLOADS_DIR', 'uploads'),
      publicBaseUrl: configService.get<string>('API_PUBLIC_URL', ''),
    });
  },
};

/**
 * Global strategy module. Every feature module can `@Inject(STORAGE_PROVIDER)`
 * and receive whichever driver the environment selected — controllers and
 * services never know or care which one is active.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [storageProvider],
  exports: [storageProvider],
})
export class StorageModule {}

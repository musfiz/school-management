import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  buildFileKey,
  IStorageProvider,
  StoredFileInfo,
  UploadFileParams,
} from '../interfaces/storage-provider.interface';

export interface S3DriverOptions {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
  /** Public origin for object URLs (R2 public bucket / CDN / custom domain). */
  publicBaseUrl?: string;
}

/**
 * Object-storage driver for AWS S3 and Cloudflare R2 (both speak the S3
 * PutObject API). AWS = omit `endpoint` (virtual-host addressing, IAM
 * ambient credentials work). R2 = endpoint + access keys, forcePathStyle.
 *
 * Same interface, same key layout, same call sites as the local driver —
 * switching drivers is one .env line (STORAGE_DRIVER), zero code changes.
 */
export class S3StorageDriver implements IStorageProvider {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly publicBaseUrl?: string,
  ) {}

  async upload(params: UploadFileParams): Promise<StoredFileInfo> {
    const key = buildFileKey(params);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.buffer,
        ContentType: params.contentType ?? 'image/webp',
        // Keys are content-addressed by UUID — media is immutable once written.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    const base = this.publicBaseUrl?.replace(/\/+$/, '');
    const url = base ? `${base}/${key}` : this.defaultObjectUrl(key);

    return { key, url };
  }

  async deleteFile(fileKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: fileKey }),
    );
    // S3 DELETE on a missing key returns 204 → naturally idempotent.
  }

  /** AWS virtual-host URL fallback when no public base URL is configured. */
  private defaultObjectUrl(key: string): string {
    const region = this.client.config.region;
    const resolvedRegion =
      typeof region === 'string' ? region : 'us-east-1';
    return `https://${this.bucket}.s3.${resolvedRegion}.amazonaws.com/${key}`;
  }
}

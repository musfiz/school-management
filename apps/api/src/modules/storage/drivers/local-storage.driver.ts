import { unlink, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import {
  buildFileKey,
  IStorageProvider,
  StoredFileInfo,
  UploadFileParams,
} from '../interfaces/storage-provider.interface';

export interface LocalDriverOptions {
  /** Root directory, resolved against process.cwd(). Default: 'uploads' (matches main.ts). */
  uploadsDir?: string;
  /**
   * External origin of the API (e.g. https://api.school.example.com) to build
   * absolute object URLs. Empty string = same-origin relative URL ("/uploads/…"),
   * which the Next.js layer resolves via resolveImageUrl().
   */
  publicBaseUrl?: string;
}

/**
 * Zero-cost driver. Files land in ./uploads and are served read-only by the
 * Express static mount (GET /uploads/**, see main.ts — it serves nested
 * directories such as schools/<tenant>/… out of the box). Writes use
 * fs/promises; keys are server-generated so nothing user-controlled ever
 * reaches a path string.
 */
export class LocalStorageDriver implements IStorageProvider {
  private readonly root: string;
  private readonly publicBaseUrl: string;

  constructor(options: LocalDriverOptions = {}) {
    this.root = resolve(process.cwd(), options.uploadsDir ?? 'uploads');
    this.publicBaseUrl = options.publicBaseUrl ?? '';
  }

  async upload(params: UploadFileParams): Promise<StoredFileInfo> {
    const key = buildFileKey(params);
    const absolutePath = this.resolveKey(key);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, params.buffer);

    const base = this.publicBaseUrl.replace(/\/+$/, '');
    return { key, url: `${base}/uploads/${key}` };
  }

  async deleteFile(fileKey: string): Promise<void> {
    try {
      await unlink(this.resolveKey(fileKey));
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'ENOENT') return; // already gone → idempotent delete
      throw error;
    }
  }

  /**
   * Hard traversal guard: a key can never escape the uploads root. Defensive
   * on both write and delete paths — deleteFile is the callers-controlled
   * one, so a legacy value like "/uploads/xyz.jpg" (absolute-ish) fails here
   * instead of touching paths outside the root.
   */
  private resolveKey(key: string): string {
    const absolutePath = resolve(this.root, key);
    if (
      absolutePath !== this.root &&
      !absolutePath.startsWith(this.root + sep)
    ) {
      throw new Error(`Invalid file key: ${key}`);
    }
    return absolutePath;
  }
}

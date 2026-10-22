import { randomUUID } from 'node:crypto';

/** Nest injection token — both drivers bind to this single key. */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface UploadFileParams {
  /** Already-optimized WebP buffer straight out of ImageOptimizationPipe. */
  buffer: Buffer;
  /** Logical folder below the tenant root, e.g. 'teachers/photos'. */
  folder: string;
  /**
   * Tenant scope from the request context. Single-school deployments omit
   * it and keys default to 'default_school'; future multi-tenant JWTs
   * pass `req.user.tenantId` through. Never accept it from the client body.
   */
  tenantId?: string;
  contentType?: string;
}

/** Returned to the controller — ONLY `key` is ever persisted in the DB. */
export interface StoredFileInfo {
  /** Relative, driver-independent DB key: schools/<tenantId>/<folder>/<uuid>.webp */
  key: string;
  /** Fully resolvable URL for the active driver (local base or S3/R2 public URL). */
  url: string;
}

/** Strategy contract — swappable local ⇄ S3/R2 with zero call-site changes. */
export interface IStorageProvider {
  upload(params: UploadFileParams): Promise<StoredFileInfo>;
  /** Orphan cleanup when an avatar/banner is replaced or an entity is deleted. */
  deleteFile(fileKey: string): Promise<void>;
}

/**
 * Canonical key format — IDENTICAL for every driver. Frontend, DB, and CDN
 * logic never need to know which driver is active.
 */
export function buildFileKey(params: {
  folder: string;
  tenantId?: string;
}): string {
  const tenant = params.tenantId?.trim() || 'default_school';
  const folder = params.folder.replace(/^\/+|\/+$/g, '');
  return `schools/${tenant}/${folder}/${randomUUID()}.webp`;
}

/**
 * True when a stored value is owned by this pipeline. Legacy rows hold
 * hand-written URLs like "/uploads/xyz.jpg" or "/logo.png" — those must
 * NEVER be treated as deletable storage keys (they may point at hand-placed
 * static assets, and passing them to a driver would throw or escape root).
 */
export function isManagedFileKey(storedValue: string | null | undefined): boolean {
  return typeof storedValue === 'string' && /^schools\//.test(storedValue);
}

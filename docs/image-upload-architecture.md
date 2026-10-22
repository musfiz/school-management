# Image Upload, Crop & Optimization Architecture

> Status: **implemented** · 2026-10 · Pipeline code in `apps/api/src/common/{constants,decorators,pipes}` + `apps/api/src/modules/storage` · Frontend in `apps/web/src/{constants,lib,components/common}`

## Overview

```
[Next.js] GlobalImageUploader  (components/common/image-uploader/global-image-uploader.tsx)
  └─ drag & drop + validation (mirror of backend presets)
  └─ CropModal (crop-modal.tsx, react-easy-crop, ratio-locked)  ← ratio-locked presets only
      └─ utils/canvas-crop.util.ts → canvas slice → dimension caps → File(image/webp)
            │  multipart via same-origin proxy (session cookie → Bearer JWT upstream)
            ▼
[NestJS] @UploadImage(field, preset, maxSizeMB)  +  @UploadedFile(new ImageOptimizationPipe(preset))
  └─ FileInterceptor(memoryStorage)      raw upload never touches disk before validation
  └─ ImageOptimizationPipe (anti-bypass security)
      ├─ XML/SVG sniff            → scriptable vectors can never reach the loader
      ├─ sharp magic bytes        → renamed .exe/.php rejected (mimetype ignored)
      ├─ limitInputPixels 64 MP   → pixel-flood / decompression-bomb rejection
      ├─ aspect ratio ±15%        → Postman bypass of the cropper fails with 400
      ├─ EXIF-orientation-aware   → orientation 5–8 axes swap is accounted for
      └─ .rotate() .resize() .webp() → EXIF & payloads stripped, exact preset geometry
            │
            ▼
StorageProvider (@Inject(STORAGE_PROVIDER)) — @Global strategy module
  ├─ LocalStorageDriver  → ./uploads/schools/<tenant>/<folder>/<uuid>.webp  (GET /uploads/**)
  └─ S3StorageDriver     → AWS S3 / Cloudflare R2, identical key layout
            │  { key, url } — ONLY `key` is persisted in the DB
            ▼
Service.update*() stores the key → controller deletes the previous managed key
```

## Presets

| Preset        | Output        | Aspect gate        | Fit     | Crop on client |
|---------------|---------------|--------------------|---------|----------------|
| `AVATAR`      | 500×500       | 1:1 ±15%           | cover   | yes            |
| `PASSPORT`    | 450×600       | 3:4 ±15%           | cover   | yes            |
| `BANNER_16_9` | 1920×1080     | 16:9 ±15%          | cover   | yes            |
| `BANNER_19_6` | 1900×600      | 19:6 ±15%          | cover   | yes            |
| `DOCUMENT`    | ≤1800×1800    | none (any ratio)   | inside  | no             |
| `LOGO`        | ≤500×500      | none (any ratio)   | inside  | no             |

Single source of truth: `apps/api/src/common/constants/image-presets.constant.ts`,
mirrored byte-for-byte by `apps/web/src/constants/image-upload-presets.ts`.

## Storage keys

`schools/<tenantId>/<folder>/<uuid>.webp` — identical for every driver;
tenant defaults to `default_school`. Only the relative **key** is stored in
the DB; URLs are resolved at read time. Legacy hand-written rows
(`/uploads/x.jpg`, `/logo.png`) are guarded by `isManagedFileKey()` so
cleanup **never** deletes files this pipeline didn't create.

Driver switch = one `.env` line (`STORAGE_DRIVER=local|s3`) — zero code changes.
R2 needs `S3_ENDPOINT` (API host) + `S3_PUBLIC_URL` (public bucket host).

## Endpoints

| Route                        | Preset   | Auth          | Notes |
|------------------------------|----------|---------------|-------|
| `POST /uploads/avatar`       | AVATAR   | ADMIN/MGMT JWT| transient CMS usage → `{ key, url }` |
| `POST /uploads/passport`     | PASSPORT | ADMIN/MGMT JWT| 3:4 crops (teachers, staff, governing body, ex-principals, admission wizard) → `{ key, url }` |
| `POST /uploads/banner-16-9`  | BANNER_16_9 | ADMIN/MGMT JWT| slider images + notice banners → `{ key, url }` |
| `POST /uploads/banner-19-6`  | BANNER_19_6 | ADMIN/MGMT JWT| ultra-wide header banners → `{ key, url }` |
| `POST /uploads/logo`         | LOGO     | ADMIN/MGMT JWT| site settings logo/signature (transparency preserved) → `{ key, url }` |
| `POST /uploads/optimized`    | DOCUMENT | ADMIN/MGMT JWT| generic content images (CMS pages, document scans) |
| `POST /teachers/:id/photo`   | PASSPORT | ADMIN/MGMT JWT| persists into `teachers.imageUrl` + deletes replaced managed file |
| `DELETE /uploads?key=…`      | —        | ADMIN/MGMT JWT| unlinks a managed `schools/…` key from storage (idempotent; legacy values rejected) |
| `POST /uploads` (legacy)     | —        | ADMIN/MGMT JWT| unchanged legacy flow (accepts SVG; do not use for new fields) |
| `POST /uploads/document` (legacy) | — | ADMIN/MGMT JWT| PDF-only happy path (image pipeline can't take PDFs); image scans now go to `/uploads/optimized` |

## Adding an image field elsewhere (checklist)

1. Backend endpoint: `@UploadImage('<field>', ImagePreset.X, <maxMB>)` on the
   route **and** `@UploadedFile(new ImageOptimizationPipe(ImagePreset.X, true))`
   on the param (parameter pipes can't read route metadata — preset is
   declared explicitly on both; the enum is the single source).
2. Store via `@Inject(STORAGE_PROVIDER) storage.upload({ buffer, folder, tenantId? })`.
3. Persist `key` after the DB update wins, then `storage.deleteFile(oldKey)`
   only when `isManagedFileKey(oldKey)` — wrap in try/catch + logger.warn.
4. Frontend: `<GlobalImageUploader preset={...} uploadEndpoint="/api/proxy/route" value={form.imageUrl} onChange={...} />`
   (URL mode) or `<GlobalImageUploader preset={...} onFileReady={(file) => …} />`
   inside a multipart form (file mode — see
   `components/examples/student-admission-form.tsx`), plus a thin proxy
   `route.ts` under `apps/web/src/app/api/...` forwarding
   FormData with the session JWT (copy `/api/uploads/passport/route.ts`;
   per-preset proxies exist under `src/app/api/uploads/<preset>/route.ts` for
   `avatar`, `passport`, `optimized`, `banner-16-9`, `banner-19-6`, `logo`).
5. Pick the fixed preset per field — every crop-capable intake surfaces the
   shared crop modal (sliders + notices = BANNER_16_9, staff-style portraits =
   PASSPORT, site logo = LOGO, CMS pages + scans = DOCUMENT).

## Legacy migration status (complete)

The generic dashboard uploader (`components/dashboard/ImageUploader.tsx`) was
deleted; all former consumers now use `GlobalImageUploader`:

| Surface | Preset | Endpoint |
|---|---|---|
| Teachers / Staff / Governing body / Ex-principals | PASSPORT | `/api/uploads/passport` |
| Admin sliders | BANNER_16_9 | `/api/uploads/banner-16-9` |
| Notices (banner/thumbnail) | BANNER_16_9 | `/api/uploads/banner-16-9` |
| Site settings logo | LOGO | `/api/uploads/logo` |
| CMS PageEditor | DOCUMENT | `/api/uploads/optimized` |
| Admission wizard Step 2 (photo) | PASSPORT | `/api/uploads/passport` + webcam frames routed through `CropModal` |
| Admissions documents (image scans) | DOCUMENT | `/api/uploads/optimized` |

Legacy backend routes `/uploads` and `/uploads/document` remain for
back-compat but have no remaining frontend upload callers (document scans
moved to `/uploads/optimized`).
5. Match the DB column length (keys≈55 chars — `VarChar(255)` headers fine).

## Security guarantees (server-enforced)

- Real binary magic-byte inspection (`sharp().metadata()`), mimetype/extension ignored.
- Pixel-flood guard: `limitInputPixels: 64_000_000` — decode memory is capped.
- SVG/XML rejection before decode (stored-XSS vector).
- Aspect-ratio gate with ±15% tolerance for strict presets (bypass = 400).
- EXIF orientation-aware dimension check.
- All metadata stripped; output normalized to WebP.
- File-size cap at the Multer layer (pre-buffer-materialization).
- Path-traversal guard in the local driver; managed-key guard on deletes.

## Verified behavior (2026-10-22 smoke run)

20/20 checks — exact-ratio pass, wrong-ratio 400, disguised `.exe` 400,
scriptable-SVG 400, EXIF-orientation acceptance, orientation-aware resize,
required/optional file contract, DOCUMENT ratio preservation, driver
key-format, tenant scoping, deletion idempotence, traversal guard, and a
live API boot with all routes mapped (`/uploads/avatar` → 401 unauthenticated,
`/teachers/:id/photo` → 401 unauthenticated).

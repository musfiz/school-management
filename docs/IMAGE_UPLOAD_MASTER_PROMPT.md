Act as a Principal Full-Stack Architect specializing in NestJS (Backend) and Next.js App Router (Frontend) for Enterprise Multi-Tenant SaaS applications.

I am building a School Management System (SMS). I need a complete, end-to-end, industry-standard Global Image Upload, Cropping, Optimization, and Storage Architecture covering both the NestJS Backend and Next.js Frontend.

### CORE ARCHITECTURAL REQUIREMENTS:

#### PART A: NestJS Backend (Storage, Presets & Anti-Bypass Security)

1. **Zero-Cost Local Now, Zero-Code Cloud Later (Strategy + Factory Pattern):**
   - Define an `IStorageProvider` interface and `STORAGE_PROVIDER` injection token.
   - Implement `LocalStorageDriver` (saves to `./uploads` using `fs/promises` and serves via `ServeStaticModule`).
   - Implement `S3StorageDriver` (compatible with AWS S3 and Cloudflare R2 using `@aws-sdk/client-s3`).
   - Create a `@Global()` `StorageModule` that dynamically switches between `local` and `s3` based on `STORAGE_DRIVER` in `.env`.
2. **Multi-Tenant Folder & Database Key Strategy:**
   - Both drivers must store files using the exact same relative key format: `schools/${tenantId}/${folder}/${uuidv4()}.webp` (defaulting `tenantId` to `'default_school'`).
   - Return `{ key: string, url: string }`. Only the relative `key` is stored in the database.
   - Implement `deleteFile(fileKey: string)` in both drivers for orphan file cleanup when updating avatars/banners.
3. **Preset-Driven Dynamic Image Pipeline (`ImagePreset` Enum):**
   - Support presets:
     - `AVATAR` (500x500, aspect: 1:1, fit: 'cover')
     - `PASSPORT` (450x600, aspect: 3:4, fit: 'cover')
     - `BANNER_16_9` (1920x1080, aspect: 16:9, fit: 'cover')
     - `BANNER_19_6` (1900x600, aspect: 19:6, fit: 'cover')
     - `DOCUMENT` (max 1800x1800, no fixed aspect, fit: 'inside' — preserves 6:19, 19:6, or any ratio without cropping a single pixel)
     - `LOGO` (max 500x500, fit: 'inside', preserves transparency)
4. **Strict API Security (Postman / Bot Bypass Protection in `ImageOptimizationPipe`):**
   - Use Multer `memoryStorage()` via a custom `@UploadImage(fieldName, maxSizeMB)` decorator.
   - Inside `ImageOptimizationPipe`, do NOT trust `file.mimetype` or file extensions alone.
   - Inspect actual binary magic bytes using `sharp(file.buffer, { limitInputPixels: 64000000 }).metadata()` to block disguised `.exe`/script files and prevent Pixel Flood / Decompression Bomb attacks.
   - Validate actual image dimensions against the preset's expected aspect ratio (with a 15% tolerance). If someone bypasses the frontend cropper via Postman and sends an uncropped/wrong-ratio image for a strict preset (`AVATAR`, `PASSPORT`, `BANNER`), throw a `BadRequestException` ("Invalid aspect ratio").
   - Auto-orient using `.rotate()`, strip all malicious EXIF/metadata, resize according to the preset, and compress to `.webp`.

#### PART B: Next.js Frontend (Interactive Cropping & Upload Pipeline)

1. **Shared Preset Configuration:**
   - Mirror the backend presets (`AVATAR`, `PASSPORT`, `BANNER_16_9`, `BANNER_19_6`, `DOCUMENT`) in Next.js.
2. **HTML5 Canvas Slicing Utility (`getCroppedImg`):**
   - Use `<canvas>` to slice the user-selected crop area, handle rotation, cap maximum dimensions, compress to `image/webp` (`File` object), and revoke `ObjectURL` to prevent memory leaks.
3. **Reusable Components (`react-easy-crop` + Tailwind CSS):**
   - `ImageCropModal`: Interactive zoom, pan, and 90-degree rotation modal locked to the preset's aspect ratio.
   - `GlobalImageUploader`: Accepts `preset`, `defaultImageUrl`, and `onFileReady(file: File)`. Automatically opens the crop modal for ratio-locked presets, or bypasses cropping for `DOCUMENT` preset.

### DELIVERABLES REQUIRED IN YOUR RESPONSE:

Provide complete, production-ready, copy-pasteable TypeScript code (no placeholders or skipped logic) for:

1. Terminal installation commands for both Backend and Frontend.
2. Backend files:
   - `src/common/constants/image-presets.constant.ts`
   - `src/common/decorators/upload-image.decorator.ts`
   - `src/common/pipes/image-optimization.pipe.ts` (with full anti-Postman security checks)
   - `src/modules/storage/interfaces/storage-provider.interface.ts`
   - `src/modules/storage/drivers/local-storage.driver.ts`
   - `src/modules/storage/drivers/s3-storage.driver.ts`
   - `src/modules/storage/storage.module.ts`
   - Usage example in `StudentController` (Avatar upload + old file cleanup).
3. Frontend files:
   - `src/constants/image-upload-presets.ts`
   - `src/utils/crop-image.util.ts`
   - `src/components/common/image-crop-modal.tsx`
   - `src/components/common/global-image-uploader.tsx`
   - Usage example inside a Next.js form sending `FormData` to the NestJS endpoint.

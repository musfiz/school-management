# Image Processing & Media Management Plan

> Status: **planning** — no implementation has started. Review and confirm
> before work begins.

## Current State

- **No upload infrastructure** — zero API endpoints for file handling.
- **4 static hero slider JPGs** in `public/hero-slider/` (local files).
- **1 static `logo.png`** in `public/`.
- **Gallery images** use `picsum.photos` placeholder URLs (external).
- **Teacher/staff types** have no photo/avatar field.
- **ContentRenderer** renders gallery images with native `<img>` tags
  instead of Next.js `<Image>` (misses optimization).
- **No favicon**, no OG image in metadata.
- `next.config.ts` already enables AVIF/WebP output formats and allows
  `images.unsplash.com` + `picsum.photos` remote patterns.

---

## Image Categories & Recommended Specifications

Every page type on the school website uses images differently. Below are
the categories, where they appear, and the recommended upload specs.

### 1. Hero Slider / Banner Images

**Used on:** Homepage hero carousel.

| Property      | Recommendation                                                                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dimensions    | 1920×720 px (16:2.4 landscape)                                                                                                                                                                |
| Format        | JPEG or WebP                                                                                                                                                                                  |
| Max file size | 500 KB (after compression)                                                                                                                                                                    |
| Quantity      | 3–6 slides                                                                                                                                                                                    |
| Notes         | Next.js `<Image>` auto-generates AVIF/WebP responsive srcsets from the upload. Upload the largest size; smaller viewports get auto-resized versions. First slide should be `priority` loaded. |

### 2. Page Banner / Section Header Images

**Used on:** About Us, Academic, Admission, Facilities, etc. — the wide
banner at the top of a content page.

| Property      | Recommendation                                                          |
| ------------- | ----------------------------------------------------------------------- |
| Dimensions    | 1200×400 px (3:1 landscape)                                             |
| Format        | JPEG or WebP                                                            |
| Max file size | 300 KB                                                                  |
| Notes         | One per page. Crops well across breakpoints if the subject is centered. |

### 3. Teacher / Staff Profile Photos

**Used on:** Teachers directory, staff list, individual profile pages.

| Property      | Recommendation                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Dimensions    | 400×400 px (1:1 square)                                                                                                                   |
| Format        | JPEG or WebP                                                                                                                              |
| Max file size | 150 KB                                                                                                                                    |
| Notes         | Square crop, head-and-shoulders framing. Displayed as circles or rounded squares in the UI. Placeholder avatar generated if not uploaded. |

### 4. Student Photos

**Used on:** Student profile (dashboard), ID card generation (future).

| Property      | Recommendation                                                  |
| ------------- | --------------------------------------------------------------- |
| Dimensions    | 300×300 px (1:1 square)                                         |
| Format        | JPEG or WebP                                                    |
| Max file size | 100 KB                                                          |
| Notes         | Passport-style photo. Same placeholder logic as teacher photos. |

### 5. Institution Logo

**Used on:** Header, footer, login page, report cards (PDF), favicon.

| Property      | Recommendation                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Dimensions    | 512×512 px (1:1)                                                                                          |
| Format        | PNG (transparency support) or SVG                                                                         |
| Max file size | 200 KB                                                                                                    |
| Notes         | Auto-generate favicon (16×16, 32×32, 180×180) from the uploaded logo. SVG preferred for infinite scaling. |

### 6. Gallery / Event Photos

**Used on:** Gallery page, event pages, news articles.

| Property      | Recommendation                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Dimensions    | 1200×900 px max (4:3)                                                                           |
| Format        | JPEG or WebP                                                                                    |
| Max file size | 400 KB                                                                                          |
| Notes         | Displayed in a responsive masonry/grid. Auto-thumbnails generated at 400×300 for the grid view. |

### 7. Content Block Images (inline)

**Used on:** Any content page via the `ContentRenderer` block system
(About Us prose, facility descriptions, etc.).

| Property      | Recommendation                                                    |
| ------------- | ----------------------------------------------------------------- |
| Dimensions    | 800×600 px max                                                    |
| Format        | JPEG, WebP, or PNG                                                |
| Max file size | 300 KB                                                            |
| Notes         | Inline within prose. Rendered at content-width with lazy loading. |

### 8. Notice / Document Attachments

**Used on:** Notice detail pages, downloads section.

| Property      | Recommendation                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| Dimensions    | N/A (not displayed as images)                                                                                 |
| Format        | PDF, JPEG, PNG                                                                                                |
| Max file size | 5 MB                                                                                                          |
| Notes         | These are downloadable files, not displayed inline. PDFs for circulars/notices, images for scanned documents. |

### 9. OG / Social Share Image

**Used on:** `<meta property="og:image">`, Twitter cards — shown when
the site URL is shared on Facebook, Messenger, WhatsApp, etc.

| Property      | Recommendation                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Dimensions    | 1200×630 px (1.91:1)                                                                                      |
| Format        | JPEG or PNG                                                                                               |
| Max file size | 300 KB                                                                                                    |
| Notes         | One default site-wide image (institution photo or branded graphic). Can be overridden per page if needed. |

---

## Quick Reference — Format Comparison

| Format   | Best for                                 | Transparency | Browser support             |
| -------- | ---------------------------------------- | ------------ | --------------------------- |
| **JPEG** | Photos (teachers, banners, gallery)      | No           | Universal                   |
| **WebP** | Same as JPEG, 25-35% smaller             | Yes          | All modern browsers         |
| **PNG**  | Logos, icons, graphics with transparency | Yes          | Universal                   |
| **SVG**  | Logos, icons (vector, infinite scale)    | Yes          | Universal                   |
| **AVIF** | Best compression, photos                 | Yes          | Chrome, Firefox, Safari 16+ |

**Recommendation:** Accept JPEG/PNG/WebP uploads from users. Let Next.js
`<Image>` auto-serve AVIF/WebP to supported browsers (already configured
in `next.config.ts`). Never ask non-technical school staff to convert
image formats — the system handles it.

---

## Storage Strategy

### Option A — Local Disk (simple, recommended to start)

```
apps/api/
  uploads/                 ← gitignored, served by NestJS static module
    hero-slider/
    profiles/
      teachers/
      students/
    gallery/
    content/
    documents/
    logos/
```

- NestJS serves files via `@nestjs/serve-static` or a dedicated
  `/uploads/*` route.
- Next.js `next.config.ts` adds `localhost:3031` (API) to
  `remotePatterns` so `<Image>` can optimize uploaded images.
- Simple, zero cost, works for a single-server deployment.
- **Limitation:** doesn't scale to multiple servers or CDN without
  syncing the disk.

### Option B — S3-Compatible Bucket (production-ready, future)

- Use any S3-compatible provider: AWS S3, DigitalOcean Spaces,
  Cloudflare R2, MinIO (self-hosted), Backblaze B2.
- Upload goes through the API (presigned URL or direct upload endpoint).
- Stored URL is a CDN-backed public URL.
- Next.js `remotePatterns` includes the bucket domain.
- **Best for:** multi-server deployments, CDN delivery, backups.

**Recommendation:** Start with Option A (local disk). Migrate to Option B
when deploying to production or when file volume exceeds a few GB. The
API's upload service interface stays the same — only the storage adapter
changes (local → S3), no frontend changes needed.

---

## Backend — API Design

### New Module: `apps/api/src/media/`

**Entity: `MediaFile`**

| Column          | Type            | Description                                                        |
| --------------- | --------------- | ------------------------------------------------------------------ |
| `id`            | int (PK)        | Auto-increment                                                     |
| `original_name` | varchar(255)    | Original filename from upload                                      |
| `filename`      | varchar(255)    | Stored filename (UUID-based, collision-free)                       |
| `mime_type`     | varchar(50)     | `image/jpeg`, `image/png`, `image/webp`, `application/pdf`         |
| `size`          | int             | File size in bytes                                                 |
| `width`         | int (nullable)  | Image width in px (null for non-images)                            |
| `height`        | int (nullable)  | Image height in px (null for non-images)                           |
| `category`      | enum            | `hero_slider`, `profile`, `gallery`, `content`, `document`, `logo` |
| `alt_text`      | varchar(255)    | Accessibility alt text                                             |
| `uploaded_by`   | int (FK → User) | Who uploaded                                                       |
| `created_at`    | timestamp       | Upload date                                                        |

**Endpoints:**

| Method   | Path            | Access                     | Description                                    |
| -------- | --------------- | -------------------------- | ---------------------------------------------- |
| `POST`   | `/media/upload` | admin, management, teacher | Upload one or more files (multipart/form-data) |
| `GET`    | `/media`        | authenticated              | List media (filterable by category, paginated) |
| `GET`    | `/media/:id`    | authenticated              | Get file metadata                              |
| `DELETE` | `/media/:id`    | admin                      | Delete file (soft-delete or hard-delete)       |
| `GET`    | `/uploads/*`    | public                     | Serve the actual file (static route)           |

**Upload Processing Pipeline:**

1. **Validate** — check MIME type whitelist (`image/jpeg`, `image/png`,
   `image/webp`, `image/svg+xml`, `application/pdf`), reject everything
   else. Check file size against category limit.
2. **Generate filename** — `{uuid}.{ext}` to prevent path traversal and
   collisions. Never use the original filename for storage.
3. **Process image** (using `sharp` library):
   - Auto-orient (fix EXIF rotation from phone cameras).
   - Strip EXIF metadata (removes GPS location, camera info — privacy).
   - Resize if exceeding category max dimensions (e.g. a 4000×3000
     gallery upload gets resized to 1200×900).
   - Generate thumbnail (e.g. 400×300 for gallery grid, 100×100 for
     profile avatars).
   - Compress to quality 80 (JPEG/WebP) — good balance of size vs
     clarity.
4. **Store** — write to `uploads/{category}/{uuid}.{ext}` and
   `uploads/{category}/thumb_{uuid}.{ext}`.
5. **Save metadata** — insert `MediaFile` row with dimensions, size, etc.
6. **Return** — respond with the `MediaFile` record including the public
   URL.

**Security:**

- File type validated by reading magic bytes (not just the extension or
  `Content-Type` header — those can be spoofed).
- Files stored outside the web root with a controlled serve route.
- UUID filenames prevent enumeration and path traversal.
- EXIF stripping removes private metadata (GPS coordinates, device info).
- Upload size limits enforced per category (see specs above).
- Rate limiting on upload endpoint.

---

## Frontend — Media Management UI

### Dashboard Media Library (`/dashboard/media`)

- **Grid view** of all uploaded images with thumbnails, filterable by
  category.
- **Upload button** — drag-and-drop zone + file picker, shows upload
  progress, validates size/format client-side before uploading.
- **Image detail modal** — preview, alt text editor, category, dimensions,
  file size, upload date, delete button.
- **Inline image picker** — reusable component used by other forms (e.g.
  teacher profile edit → "Choose photo" opens the media library picker or
  allows direct upload).

### Integration Points (other dashboard pages)

| Page                        | How images are managed                                              |
| --------------------------- | ------------------------------------------------------------------- |
| **Institution settings**    | Logo upload field (single image, replaces current)                  |
| **Hero slider management**  | Ordered list of slider images, add/remove/reorder via drag-and-drop |
| **Teacher/student profile** | Avatar upload field on the profile edit form                        |
| **Content page editor**     | Insert image block from media library into the content block system |
| **Gallery management**      | Album CRUD, bulk image upload per album                             |
| **Notice editor**           | Attach files (PDF/images) to a notice                               |

### Image Picker Component

A reusable `<ImagePicker>` component used across all forms:

- Opens a modal with two tabs: **"Upload new"** and **"Choose from library"**.
- Shows existing images filtered by category.
- Returns the selected `MediaFile` record (URL + metadata) to the parent
  form.
- Supports single-select (profile photo) and multi-select (gallery album).

---

## Frontend — Public Site Image Rendering

### Switch to Next.js `<Image>` Everywhere

Currently `ContentRenderer.tsx` uses native `<img>` tags for gallery
images. All image rendering should migrate to Next.js `<Image>` for:

- **Automatic AVIF/WebP** conversion (already configured).
- **Responsive `srcset`** generation — serves 640w, 750w, 828w, 1080w,
  1200w, etc. based on viewport.
- **Lazy loading** with blur placeholder.
- **Layout shift prevention** — width/height from the `MediaFile` record
  prevent CLS.

### Image Placeholder / Fallback

- **Profile photos**: Generate a colored circle with initials (e.g. "মা"
  for মোহাম্মদ আলী) when no photo is uploaded. Use the user's name hash
  for consistent color.
- **Missing content images**: Show a neutral gray placeholder with the
  institution logo watermark.

---

## Thumbnail & Responsive Size Generation

When an image is uploaded, `sharp` generates these variants:

| Variant     | Max dimensions                        | Quality | Used for                       |
| ----------- | ------------------------------------- | ------- | ------------------------------ |
| `original`  | Category max (e.g. 1920×720 for hero) | 85      | Full-size view, lightbox       |
| `large`     | 1200×900                              | 80      | Content blocks, gallery detail |
| `medium`    | 800×600                               | 80      | Content blocks (mobile)        |
| `thumbnail` | 400×300                               | 75      | Gallery grid, listing pages    |
| `avatar`    | 200×200 (square crop)                 | 75      | Profile photos in lists        |
| `micro`     | 50×50 (square crop)                   | 60      | Blur placeholder, tiny avatars |

Not all variants are generated for every category — hero slider doesn't
need an avatar crop, profile photos don't need a large variant. The upload
pipeline selects variants based on the `category` field.

Next.js `<Image>` then picks the best variant + format (AVIF/WebP) for the
viewer's screen via `sizes` and `srcSet`.

---

## File Organization (local storage)

```
apps/api/
  uploads/                          ← gitignored
    hero-slider/
      {uuid}.jpg
      thumb_{uuid}.jpg
    profiles/
      teachers/
        {uuid}.jpg
        avatar_{uuid}.jpg
      students/
        {uuid}.jpg
        avatar_{uuid}.jpg
    gallery/
      {album-uuid}/
        {uuid}.jpg
        thumb_{uuid}.jpg
    content/
      {uuid}.jpg
      medium_{uuid}.jpg
    documents/
      {uuid}.pdf
    logos/
      {uuid}.png
      favicon_{uuid}.png
```

---

## Implementation Order

| Step | What                                                             | Effort | Depends on |
| ---- | ---------------------------------------------------------------- | ------ | ---------- |
| 1    | Add `sharp` to `apps/api`, create `MediaFile` entity + migration | Small  | Nothing    |
| 2    | Build upload endpoint with validation, processing, storage       | Medium | Step 1     |
| 3    | Build `GET /media` list + `DELETE /media/:id` endpoints          | Small  | Step 1     |
| 4    | Add `uploads/` to `.gitignore`, configure `serve-static`         | Small  | Step 2     |
| 5    | Add API's upload URL to `next.config.ts` `remotePatterns`        | Small  | Step 2     |
| 6    | Build dashboard media library page (`/dashboard/media`)          | Medium | Steps 2–3  |
| 7    | Build reusable `<ImagePicker>` component                         | Medium | Step 6     |
| 8    | Add avatar field to Teacher/Student types + profile edit forms   | Small  | Step 7     |
| 9    | Build hero slider management page                                | Small  | Step 7     |
| 10   | Migrate `ContentRenderer` gallery to Next.js `<Image>`           | Small  | Step 5     |
| 11   | Add institution logo upload + favicon auto-generation            | Small  | Step 7     |
| 12   | Add OG image to metadata                                         | Small  | Step 5     |

Steps 1–5 (backend) can be done first. Steps 6–12 (frontend) follow.
Steps 8–12 are independent of each other and can be done in any order.

---

## Relationship to Feature Roadmap

This media plan integrates with the existing feature roadmap phases:

| Roadmap Phase                    | Media integration                                      |
| -------------------------------- | ------------------------------------------------------ |
| **Phase 1** (Academic Structure) | Institution logo upload                                |
| **Phase 2** (People)             | Teacher/student profile photo upload                   |
| **Phase 4** (Exams & Results)    | Report card with institution logo                      |
| **Phase 6** (Notices)            | Notice file attachments                                |
| **Phase 7** (Library)            | Book cover images (optional)                           |
| **Phase 8** (Public Website)     | Gallery albums, content images, hero slider management |

The media module (Steps 1–7 above) should be built **early — alongside or
just after Phase 1** — so that all subsequent phases can use the upload
infrastructure and `<ImagePicker>` component.

---

## Open Questions

1. **Storage backend** — start with local disk, or go straight to
   S3-compatible bucket? (Local is simpler for development; S3 is better
   for production backups and CDN.)
2. **Max total storage** — any disk quota concern? A school with 2,000
   students uploading 100 KB profile photos = ~200 MB. Gallery and
   content images likely add another 1–2 GB over time.
3. **Bulk upload for student photos** — should the system support CSV +
   ZIP batch import (roll number → photo mapping), or is one-by-one
   upload through the profile page sufficient?

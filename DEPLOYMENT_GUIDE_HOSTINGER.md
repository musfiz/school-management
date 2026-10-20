# School Management — Hostinger Shared Hosting Deployment Guide

## Overview

This monorepo contains:
- **`apps/web`** — Next.js 16 frontend (port 3030 locally)
- **`apps/api`** — NestJS 11 backend (port 3031 locally)
- **`packages/shared-types`** — Shared TypeScript types

Both apps are configured to work on **the same origin with different subdomains** on Hostinger shared hosting.

---

## 1. Hostinger Shared Hosting Constraints

Hostinger shared hosting has these limitations you must work around:

| Constraint | Impact & Solution |
|------------|-------------------|
| **No persistent Node.js processes** | Cannot run `next dev` or `nest dev` continuously. Use **Next.js standalone mode** or **NestJS compiled output** with a process manager that works within shared hosting limits. |
| **No custom process managers** (pm2, systemd) | Must rely on **cron jobs** or **HTTP endpoint triggers**. |
| **MySQL/MariaDB database** | This project already uses MariaDB via Prisma — compatible. |
| **Subdomain support** | Can create subdomains (e.g., `api.yourdomain.com`, `web.yourdomain.com`). |
| **Same-origin policy** | Cookies and API calls must work across subdomains. |
| **File storage** | Use public `uploads/` directory or third-party storage (S3). |
| **No edge runtime** | Avoid Edge Runtime–incompatible code (the project has a warning about this). |

---

## 2. Recommended Deployment Strategy

### Option A: Next.js Standalone + NestJS Compiled API (Recommended)

This approach uses Next.js's static/standalone output and the compiled NestJS API, both served from Hostinger.

#### 2.1 Prepare the API (`apps/api`)

```sh
# 1. Build the NestJS API
cd apps/api
pnpm build

# 2. The output will be in apps/api/dist/main.js (and dist/ directory)
# 3. Ensure .env is set up with real values
cp .env.example .env
# Edit .env with your Hostinger MySQL credentials, JWT_SECRET, etc.
```

**Important**: The NestJS app listens on the port defined in `config.ts` (default 3031, but on Hostinger you'll use a different port, typically 80 or 8080, or the port Hostinger assigns).

#### 2.2 Prepare the Web (`apps/web`)

```sh
# 1. Build Next.js in standalone mode
cd apps/web
pnpm build

# 2. Next.js creates .next/standalone/ with a self-contained Node server
# 3. This can be started with: node .next/standalone/server.js
pnpm build
```

#### 2.3 Environment Variables

Both apps need their `.env` files configured for Hostinger:

**Root `.env`** (copy from `.env.example`):
```
NODE_ENV=development
API_PORT=80          # or whatever port Hostinger assigns
API_BASE_URL=http://api.yourdomain.com
```

**`apps/api/.env`**:
```
PORT=80              # Hostinger typically uses port 80 for HTTP
NODE_ENV=development
DB_HOST=your-mysql-host.mysql.database.azure-databases.net  # or your Hostinger DB host
DB_PORT=3306
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_pass
DB_DATABASE=school
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://web.yourdomain.com
```

**`apps/web/.env`**:
```
NEXT_PUBLIC_API_BASE_URL=http://api.yourdomain.com
NEXT_PUBLIC_SITE_NAME="School Management"
NEXT_PUBLIC_SITE_URL=http://web.yourdomain.com
JWT_SECRET=your-super-secret-key  # Must match api .env exactly!
```

> **Critical**: `JWT_SECRET` must be identical in both `.env` files. The web app verifies the cookie's HMAC locally, and the API signs tokens with this secret.

---

### Option B: Pure PHP / CGI Approach

If Node.js cannot run at all on your Hostinger plan:

1. **Extract the API logic**: The NestJS API is essentially a set of HTTP routes. You could re-implement the key endpoints in PHP, or use an external API host.
2. **Use the Next.js static export**: `pnpm --filter web build` with `exportAsync` generates pure HTML/JS that runs in the browser — no Node.js required at runtime.
3. **CORS and API calls**: Configure `NEXT_PUBLIC_API_BASE_URL` to point to your API host (could be a different hosting provider, or a paid API hosting service).

*Note: This option requires significant rework. Option A is strongly preferred if Node.js is available.*

---

## 3. Subdomain & Same-Origin Configuration

### 3.1 DNS Setup

Create two subdomains in your Hostinger DNS management:
- `web.yourdomain.com` → points to your hosting account
- `api.yourdomain.com` → points to your hosting account

Both will serve content from the same hosting account.

### 3.2 Next.js Configuration (`next.config.ts`)

The project already uses `next-intl`. Ensure your `next.config.ts` allows the subdomains:

```ts
// apps/web/next.config.ts (already configured)
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default withNextIntl(nextConfig);
```

No changes needed — Next.js handles subdomains fine.

### 3.3 Cookie Domain Configuration

The session cookie is defined in `apps/web/src/lib/session-cookie.ts`:
```ts
export const SESSION_COOKIE = "school_session";
```

For cross-subdomain cookie sharing, set the cookie domain in your NestJS app. In `apps/api/src/main.ts`, configure the cookie options:

```ts
// In the authentication service or guard, when setting the cookie:
res.cookie('school_session', token, {
  httpOnly: true,
  secure: false,        // true only if using HTTPS
  sameSite: 'lax',     // 'strict' if you don't need cross-subdomain auth
  domain: '.yourdomain.com'  // Leading dot enables subdomain sharing
});
```

**Alternatively**, if you don't need the API subdomain to set cookies for the web subdomain, keep `sameSite: 'lax'` and don't set a `domain`. The browser will only send the cookie to the exact subdomain that set it.

### 3.4 API Proxy (Development Only)

During development, the `proxy.ts` in `apps/web/src/` forwards API calls to the NestJS dev server:

```ts
// Already configured — routes /api/* to http://localhost:3031
// For production on Hostinger, this proxy is NOT used.
// The web app will directly call http://api.yourdomain.com/api/...
```

For production, remove or disable the proxy — the web app will make direct fetch calls to the API subdomain.

---

## 4. Database Configuration

The project uses **Prisma ORM 7** with MariaDB/MySQL.

### 4.1 Create the Database on Hostinger

1. Go to Hostinger MySQL database creator
2. Create a new database named `school` (or whatever `DB_DATABASE` you set)
3. Note the host, port, username, and password

### 4.2 Run Prisma Migrations

```sh
# From the repo root
pnpm --filter api prisma:migrate
# Or individually:
cd apps/api
pnpm prisma:migrate
```

This will create the necessary tables based on `apps/api/prisma/schema.prisma`.

### 4.3 Seed Initial Data (Optional)

```sh
pnpm --filter api seed:results
```

---

## 5. File Uploads

The API has upload endpoints that store files in `apps/api/uploads/`. On Hostinger:

### 5.1 Local Uploads

Create the upload directories and set proper permissions:

```sh
# Create these directories (via Hostinger file manager or FTP):
apps/api/uploads/
apps/api/uploads/hero-slider/

# Set permissions to 755 (or as required by your plan)
```

### 5.2 Better: External Storage

For reliability, consider using:
- **Hostinger Storage** or **AWS S3**
- Modify the upload routes to upload to S3 instead of local disk
- Update the URL generation to use the external storage URL

---

## 6. Running the Project on Hostinger

### 6.1 Build Both Apps

```sh
# From repo root
pnpm build

# Or individually:
pnpm --filter web build
pnpm --filter api build
```

### 6.2 Start the API

The compiled NestJS app:

```sh
# From apps/api directory
node dist/main.js
# Or if using the start script:
pnpm start
```

*Note: On Hostinger, you may need to run this via a cron job or a background process that stays alive. Some Hostinger plans support always-on processes, but this varies.*

### 6.3 Start the Web App

The Next.js standalone app:

```sh
# From apps/web/.next/standalone/ directory
node server.js
# Or:
node .next/standalone/server.js
```

### 6.3 Cron Job Approach (Alternative)

If Node.js processes can't stay alive, use Hostinger's cron job feature:

1. **API cron**: Set a cron to `curl http://api.yourdomain.com/api/health` every 5 minutes (keeps the port warm, but won't keep the process running).
2. **Better**: Use a VPS or cloud hosting if you need persistent Node.js processes.

---

## 7. HTTPS & Security

### 7.1 Enable HTTPS on Hostinger

Most Hostinger plans include Let's Encrypt HTTPS. For your subdomains:

```sh
# In Hostinger panel → Domain → Let's Encrypt
# Enable for both: web.yourdomain.com and api.yourdomain.com
```

### 7.2 Update Configuration

Once HTTPS is enabled:

**`apps/api/.env`**:
```
PORT=443  # or leave as 80, but the app should handle HTTPS
DB_HOST=your-mysql-host.mysql.database.azure-databases.net  # Use SSL if required
JWT_SECRET=your-secret
CORS_ORIGIN=https://web.yourdomain.com
```

**`apps/web/.env`**:
```
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
NEXT_PUBLIC_SITE_URL=https://web.yourdomain.com
```

### 7.3 Cookie Security

Set `secure: true` in the NestJS cookie settings once HTTPS is active:

```ts
// In auth.service.ts or a custom cookie-setting utility:
res.cookie('school_session', token, {
  httpOnly: true,
  secure: true,    // ✓ Now that HTTPS is enabled
  sameSite: 'lax',
  domain: '.yourdomain.com'
});
```

---

## 8. Troubleshooting

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| **API returns 401 on all calls** | JWT_SECRET mismatch between web and api .env | Ensure `JWT_SECRET` is identical in both |
| **Cookie not sent across subdomains** | Missing `domain` attribute on cookie | Add `domain: '.yourdomain.com'` to cookie settings |
| **CORS error** | `CORS_ORIGIN` not matching | Set `CORS_ORIGIN` in api `.env` to the web subdomain URL |
| **Database connection fails** | Wrong DB_HOST or credentials | Check Hostinger MySQL control panel |
| **Next.js can't load images** | `remotePatterns` not configured | Add the hostname to `next.config.ts` `remotePatterns` |
| **Build succeeds but app crashes on start** | Missing environment variables | Verify all required env vars are set in `.env` files |
| **Uploaded images not accessible** | Wrong file permissions or wrong URL path | Check `uploads/` directory permissions and base URL config |

---

## 9. Complete Checklist Before Going Live

- [ ] Create MySQL database on Hostinger, note connection details
- [ ] Create `web.yourdomain.com` and `api.yourdomain.com` subdomains
- [ ] Enable Let's Encrypt HTTPS for both subdomains
- [ ] Copy `.env.example` → `.env` in both root, `apps/api`, and `apps/web`
- [ ] Fill in real values: `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `JWT_SECRET`
- [ ] Ensure `JWT_SECRET` is identical in `apps/api/.env` and `apps/web/.env`
- [ ] Run `pnpm --filter api prisma:migrate` to create database tables
- [ ] Run `pnpm build` for both apps
- [ ] Set `CORS_ORIGIN` in api `.env` to `https://web.yourdomain.com`
- [ ] Set cookie `domain: '.yourdomain.com'` in NestJS auth service
- [ ] Upload/compile files to Hostinger via FTP or file manager
- [ ] Test: visit `https://web.yourdomain.com` → login → API calls work
- [ ] Test: API endpoints accessible at `https://api.yourdomain.com`

---

## 10. Alternative: Use a Cheaper Node.js Hosting

If Hostinger's shared hosting doesn't support always-on Node.js, consider:

- **AwardSpace**, **000Webhost**, or **FreeHostingEU** — some support always-on Node.js on premium plans
- **Render.com** or **Railway.app** — $5/month, full Node.js support, easy deployment from GitHub
- **Fly.io** — similar price, great for small projects

These alternatives give you more control over the Node.js process and avoid shared hosting limitations.

---
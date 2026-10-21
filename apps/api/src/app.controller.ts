import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  getWelcome(@Res() res: any) {
    res.set('Content-Type', 'text/html');
    res.send(WELCOME_HTML);
  }

  @Get('health')
  @Public()
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

/* ------------------------------------------------------------------ */
/*  Welcome landing page — animated, self-contained (no external assets) */
/* ------------------------------------------------------------------ */

const WELCOME_HTML = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>School Management API</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --brand: #2563eb;
      --brand-dark: #1d4ed8;
      --ink: #0f172a;
      --ink-600: #475569;
      --bg: #f8fafc;
      --card: #ffffff;
      --border: #e2e8f0;
      --accent: #0ea5e9;
    }

    html, body {
      height: 100%;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--ink);
    }

    .page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      overflow: hidden;
    }

    /* Animated background blobs */
    .blob {
      position: fixed;
      border-radius: 50%;
      filter: blur(60px);
      opacity: 0.45;
      z-index: 0;
      animation: float 14s ease-in-out infinite;
    }
    .blob-1 {
      top: -10%; left: -10%;
      width: 600px; height: 600px;
      background: #bfdbfe;
      animation-delay: 0s;
    }
    .blob-2 {
      bottom: -10%; right: -10%;
      width: 500px; height: 500px;
      background: #cffafe;
      animation-delay: -5s;
    }
    .blob-3 {
      top: 20%; left: 45%;
      width: 350px; height: 350px;
      background: #fcd34d;
      opacity: 0.35;
      animation-delay: -2s;
    }
    @keyframes float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(20px, -30px) scale(1.05); }
      66% { transform: translate(-20px, 20px) scale(0.95); }
    }

    /* Content card */
    .card {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 720px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 48px 40px;
      text-align: center;
      box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.08);
      animation: cardIn 0.8s ease-out both;
    }
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Unique logo — pure CSS/SVG, animates on load */
    .logo {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 28px;
      animation: logoPop 0.9s cubic-bezier(0.18, 0.89, 0.32, 1.28) both;
    }
    @keyframes logoPop {
      from { opacity: 0; transform: scale(0.6) rotate(-8deg); }
      to { opacity: 1; transform: scale(1) rotate(0); }
    }
    .logo svg {
      width: 96px; height: 96px;
      display: block;
    }
    .logo .badge {
      position: absolute;
      top: 6px; right: 6px;
      width: 28px; height: 28px;
      background: #10b981;
      border-radius: 50%;
      border: 3px solid #ffffff;
      box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
      animation: pulseBadge 2.5s ease-in-out infinite;
    }
    @keyframes pulseBadge {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.15); opacity: 0.85; }
    }
    .logo-mark {
      transform-origin: 50% 50%;
      animation: spinMark 10s linear infinite;
    }
    @keyframes spinMark {
      to { transform: rotate(360deg); }
    }

    h1 {
      font-size: 34px;
      font-weight: 800;
      color: var(--ink);
      letter-spacing: -0.02em;
      margin-bottom: 10px;
      animation: fadeUp 0.9s ease-out both;
    }
    p.subtitle {
      font-size: 17px;
      color: var(--ink-600);
      margin-bottom: 34px;
      animation: fadeUp 1s ease-out both;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Stats row */
    .stats {
      display: flex;
      justify-content: center;
      gap: 28px;
      margin-bottom: 34px;
      flex-wrap: wrap;
      animation: fadeUp 1.1s ease-out both;
    }
    .stat {
      text-align: center;
    }
    .stat .value {
      font-size: 22px;
      font-weight: 700;
      color: var(--brand);
      display: block;
    }
    .stat .label {
      font-size: 13px;
      color: var(--ink-600);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-top: 4px;
    }

    /* Links / actions */
    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
      animation: fadeUp 1.2s ease-out both;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 10px;
      border: none;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    }
    .btn:hover { transform: translateY(-2px); }
    .btn:active { transform: translateY(0); }
    .btn-primary {
      background: var(--brand);
      color: #ffffff;
      box-shadow: 0 10px 20px -6px rgba(37, 99, 235, 0.35);
    }
    .btn-primary:hover { background: var(--brand-dark); }
    .btn-ghost {
      background: transparent;
      color: var(--ink-600);
      border: 1px solid var(--border);
    }
    .btn-ghost:hover { background: #f1f5f9; }

    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 30px;
      font-size: 13px;
      color: var(--ink-600);
      animation: fadeUp 1.3s ease-out both;
    }
    .dot {
      width: 8px; height: 8px;
      background: #10b981;
      border-radius: 50%;
      animation: blink 1.6s ease-in-out infinite;
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.45; }
    }

    .meta {
      margin-top: 40px;
      font-size: 12px;
      color: #94a3b8;
      animation: fadeUp 1.4s ease-out both;
    }

    @media (max-width: 600px) {
      .card { padding: 36px 24px; border-radius: 12px; }
      h1 { font-size: 26px; }
      .stats { gap: 18px; }
    }
  </style>
</head>
<body>
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>

  <div class="page">
    <div class="card">
      <div class="logo">
        <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#2563eb" />
              <stop offset="100%" stop-color="#0ea5e9" />
            </linearGradient>
          </defs>
          <circle cx="48" cy="48" r="42" fill="url(#grad)" />
          <path
            d="M30 48 L30 66 L66 66 L66 30 L42 30 L42 48 Z"
            fill="#ffffff"
          />
          <path
            d="M42 30 L48 36 L42 42"
            fill="#1d4ed8"
          />
          <circle cx="48" cy="48" r="4" fill="#ffffff" />
        </svg>
        <div class="badge"></div>
        <div class="logo-mark"></div>
      </div>

      <h1>School Management API</h1>
      <p class="subtitle">REST backend for the school management system &mdash;</p>

      <div class="stats">
        <div class="stat"><span class="value">NestJS</span><span class="label">Framework</span></div>
        <div class="stat"><span class="value">Prisma</span><span class="label">ORM</span></div>
        <div class="stat"><span class="value">MariaDB</span><span class="label">Database</span></div>
        <div class="stat"><span class="value">Swagger</span><span class="label">API Docs</span></div>
      </div>

      <div class="actions">
        <a class="btn btn-primary" href="/api/docs" target="_blank">Open API Docs</a>
        <a class="btn btn-ghost" href="/health">Health Check</a>
      </div>

      <div class="badge-status">
        <div class="dot"></div>
        Server is running
      </div>
      <div class="meta">GET / &middot; GET /health &middot; GET /api/docs</div>
    </div>
  </div>
</body>
</html>`;
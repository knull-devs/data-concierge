# Date Concierge — Landing Page + Auth Foundation (v0.6)

Independent Date Concierge project. The pH7Builder source is not included. This build contains a cinematic, mobile-first marketing homepage, a centered no-image login/signup modal, an animated mobile navigation panel, a video-ready hero with a still-image fallback, a basic signed-in dashboard placeholder, and Vercel serverless email/password authentication backed by Neon PostgreSQL.

## Pages

- `/` — homepage with responsive hero media, animated nav sections, pricing and centered login/signup modal.
- Hero video: by default the page uses `assets/img/hero-couple.webp` as a fallback. When a licensed, compressed video is selected, place it at `assets/video/hero.mp4` and set `data-video-src="/assets/video/hero.mp4"` on `#hero-background-video` in `index.html`. The video is muted/looped/inline and is not loaded when the attribute is empty or reduced-motion/data-saver settings apply.
- `/register` — opens the signup modal (redirect alias).
- `/login` — opens the login modal (redirect alias).
- `/dashboard.html` — basic signed-in landing placeholder, checks `/api/auth/me`.
- `/terms.html` and `/privacy.html` — early policy overviews, not final legal advice.
- `/api/health` — health check for the API/database configuration.

## Deploy and configure the free-tier MVP

1. Push this standalone folder to a new GitHub repository.
2. Create a Neon PostgreSQL project on the free plan: https://neon.com/ .
3. Open the Neon SQL Editor and execute the full `db/schema.sql` file once.
4. In Vercel, import the repository, use the repo root (`./`) and the `Other` framework preset. Leave Build/Install commands unset; API functions are detected from `/api` and the static HTML is served directly.
5. In Vercel → Project Settings → Environment Variables, set `DATABASE_URL` to the Neon pooled connection string (use the server-side connection string and keep it secret). Enable it for Preview and Production. Do not put the connection string in browser JavaScript or commit a real `.env` file.
6. Redeploy after setting the variable.
7. Verify `https://YOUR-DEPLOYMENT/api/health`, then register a test account and sign out/sign back in.

Neon documents a free tier; Vercel documents Node.js Functions deployed from files under `/api`. Free-tier quotas, availability and restrictions may change. Staying within free limits is not a promise of unlimited free production use.

## Environment

Only one environment variable is required for the current auth foundation:

- `DATABASE_URL` — Neon Postgres connection string; secret, server-side only.

`.env.example` is a placeholder. Replace nothing inside Git with a real secret. Locally, use `vercel dev` with a private `.env.local`, or set `DATABASE_URL` in your shell.

## Auth security details

- Passwords are hashed using Node.js `scrypt` with a random salt.
- Sessions use random opaque tokens; only SHA-256 token hashes are stored in Postgres.
- Session cookies are HttpOnly, SameSite=Lax, and Secure on Vercel/production.
- Login and registration have database-backed per-IP attempt limits; invalid login responses are generic.
- SQL is parameterized via `@neondatabase/serverless` tagged queries.
- No access token/session is stored in localStorage.

This is an MVP foundation, not a complete production security review. Email verification, password reset emails, OAuth, account deletion/export workflows, bot protection/CAPTCHA, comprehensive monitoring and final privacy/terms review are not implemented yet. Do not open public paid registration until these are completed and reviewed.

## Test locally

Requirements: Node.js 20+, Python 3 (only used by the local verification script), and a Neon test database with `db/schema.sql` installed.

```bash
npm install
npm run check
npx vercel dev
```

`npm run check` checks JavaScript syntax, project file references and key auth safeguards. `npm run test:auth` checks password hashing, origin checks, cookie parsing and validation paths without needing a live database. Neither replaces end-to-end testing against a configured database.

## Project structure

```text
.
├── index.html
├── register.html / login.html
├── dashboard.html
├── terms.html / privacy.html
├── assets/css/site.css
├── assets/js/site.js / dashboard.js
├── assets/img/hero-couple.webp
├── assets/video/README.md (optional hero video instructions)
├── api/auth/{register,login,me,logout}.js
├── api/health.js
├── api/_lib/auth.js
├── db/schema.sql
├── package.json
├── .env.example
└── vercel.json
```

# Date Concierge — Landing Page + Auth Foundation (v0.2)

Independent Date Concierge project. The pH7Builder source is not included. This build contains a mobile-first marketing homepage, login/signup popup, a basic signed-in dashboard placeholder, and Vercel serverless email/password authentication backed by Neon PostgreSQL.

## Pages

- `/` — homepage, nav sections, pricing and login/signup modal.
- `/register` — opens the signup modal (redirect alias).
- `/login` — opens the login modal (redirect alias).
- `/dashboard.html` — signed-in account home, profile progress and logout.
- `/profile.html` — self-service profile editor and relationship preferences, available only to the signed-in member.
- `/api/profile/me` — authenticated GET/PUT endpoint for the current member profile.
- `/terms.html` and `/privacy.html` — early policy overviews, not final legal advice.
- `/api/health` — health check for the API/database configuration.

## Deploy and configure the free-tier MVP

1. Push this standalone folder to a new GitHub repository.
2. Create a Neon PostgreSQL project on the free plan: https://neon.com/ .
3. Open the Neon SQL Editor and execute the full `db/schema.sql` file for a fresh database. For an existing Date Concierge database, run `db/migrations/001_member_profiles.sql` once; it adds only the new profile table and does not alter existing accounts or sessions.
4. In Vercel, import the repository, use the repo root (`./`) and the `Other` framework preset. Leave Build/Install commands unset; API functions are detected from `/api` and the static HTML is served directly.
5. In Vercel → Project Settings → Environment Variables, set `DATABASE_URL` to the Neon pooled connection string (use the server-side connection string and keep it secret). Enable it for Preview and Production. Do not put the connection string in browser JavaScript or commit a real `.env` file.
6. Redeploy after setting the variable.
7. Verify `https://YOUR-DEPLOYMENT/api/health`, then register a test account and sign out/sign back in.

Neon documents a free tier; Vercel documents Node.js Functions deployed from files under `/api`. Free-tier quotas, availability and restrictions may change. Staying within free limits is not a promise of unlimited free production use.

## Environment

Only one environment variable is required for the current auth foundation:

- `DATABASE_URL` — Neon Postgres connection string; secret, server-side only.

`.env.example` is a placeholder. Replace nothing inside Git with a real secret. Locally, use `vercel dev` with a private `.env.local`, or set `DATABASE_URL` in your shell.

## Profile foundation (v0.3)

The profile editor stores a member-owned headline, about text, city, optional gender identity, private introduction preferences, relationship goal, age range and selected interests. `/api/profile/me` only reads or updates the authenticated user’s own row. Profile visibility and public discovery are deliberately not enabled by this first module; the editor clearly states this. Profile data is not exposed through the public homepage or `/api/auth/me`.

The profile validation helpers have dependency-free smoke tests: `npm run test:profile`. The profile SQL migration must be run in Neon before the profile API can load/save data.

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
├── dashboard.html / profile.html
├── terms.html / privacy.html
├── assets/css/site.css / profile.css
├── assets/js/site.js / dashboard.js / profile.js
├── assets/img/hero-couple.webp
├── api/auth/{register,login,me,logout}.js
├── api/profile/me.js
├── api/health.js
├── api/_lib/auth.js / profile.js
├── db/schema.sql / migrations/001_member_profiles.sql
├── package.json
├── .env.example
├── docs/PH7-REUSE-MAP.md
└── vercel.json
```

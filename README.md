# Date Concierge — Auth, Profile & Discovery Foundation (v0.5)

Independent Date Concierge project. The full pH7Builder repository and its UI are not included. This build includes a mobile-first marketing homepage, login/signup, Neon-backed authentication, member-owned profile/preferences, server-side discovery ranking adapted from pH7Builder's MIT-licensed MatchmakingCore, and mutual-consent introduction requests.

## Pages

- `/` — homepage, nav sections, pricing and login/signup modal.
- `/register` — opens the signup modal (redirect alias).
- `/login` — opens the login modal (redirect alias).
- `/dashboard.html` — signed-in account home, profile progress and logout.
- `/profile.html` — self-service profile editor and private relationship preferences.
- `/discover.html` — opt-in member discovery with up to five ranked recommendations; no fake/demo profiles.
- `/introductions.html` — send/receive mutual-consent introduction requests.
- `/api/profile/me` — authenticated GET/PUT for the current member profile.
- `/api/matches/recommendations` — authenticated, mutually filtered recommendations ranked using the pH7 MatchmakingCore scoring formula.
- `/api/introductions` — authenticated GET/POST/PATCH for introduction requests and accept/decline.
- `/terms.html` and `/privacy.html` — early policy overviews, not final legal advice.
- `/api/health` — health check for API/database configuration.

## Deploy and configure the free-tier MVP

1. Push this standalone folder to a new GitHub repository.
2. Create a Neon PostgreSQL project on the free plan: https://neon.com/ .
3. **For an existing Date Concierge database:** run `db/migrations/001_member_profiles.sql` first (creates `dc_member_profiles`), then run `db/migrations/002_discovery_matching.sql` (adds discovery fields, activity timestamps and introduction-request table). Run each migration once in Neon SQL Editor against the same `production` branch/database used by `DATABASE_URL`. Do not reset/drop the database. **For a brand-new database:** execute the current full `db/schema.sql` once instead, which includes both profile and discovery tables/columns.
4. In Vercel, import the repository, use the repo root (`./`) and the `Other` framework preset. Leave Build/Install commands unset; API functions are detected from `/api` and the static HTML is served directly.
5. In Vercel → Project Settings → Environment Variables, set `DATABASE_URL` to the Neon pooled connection string (use the server-side connection string and keep it secret). Enable it for Preview and Production. Do not put the connection string in browser JavaScript or commit a real `.env` file.
6. Redeploy after setting the variable.
7. Verify `https://YOUR-DEPLOYMENT/api/health`, then register a test account and sign out/sign back in.

Neon documents a free tier; Vercel documents Node.js Functions deployed from files under `/api`. Free-tier quotas, availability and restrictions may change. Staying within free limits is not a promise of unlimited free production use.

## Environment

Only one environment variable is required for the current auth foundation:

- `DATABASE_URL` — Neon Postgres connection string; secret, server-side only.

`.env.example` is a placeholder. Replace nothing inside Git with a real secret. Locally, use `vercel dev` with a private `.env.local`, or set `DATABASE_URL` in your shell.

## Profile, discovery and introductions (v0.5)

The profile editor stores a member-owned headline, about text, city, gender identity, private introduction preferences, relationship goal, age range and interests. Discovery is explicitly opt-in and requires a complete profile; turning discovery off removes the member from subsequent recommendations. Gender identity, preferred age range and who a member wants to meet are not returned in public recommendation cards. Only approved avatars can be exposed. The profile API reads/updates only the authenticated member's own row.

`api/_lib/matchmaking.js` is an adaptation of the pH7Builder `MatchmakingCore.php` scoring formula (age 0.35, geography 0.25, activity 0.25, approved avatar 0.15) and the related-profile controller's five-result / 12x-candidate-pool pattern. We added stricter reciprocal preference, adult-only, discovery-opt-in and profile-readiness gates. The upstream MIT license and copyright notice are preserved in `THIRD_PARTY_NOTICES.md`. The UI and PHP framework are not copied.

Introduction requests require mutual eligibility and explicit consent. A recipient may accept or decline; accepted requests do not automatically reveal private contact details, and messaging/date scheduling are still future milestones. These matching scores are heuristic indicators, not predictions of chemistry or a guarantee of dates.

Before testing on an existing database, run migrations `001_member_profiles.sql` then `002_discovery_matching.sql`. Tests: `npm run test:profile` and `npm run test:matches`.

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
├── dashboard.html / profile.html / discover.html / introductions.html
├── terms.html / privacy.html
├── assets/css/site.css / profile.css / discovery.css
├── assets/js/site.js / dashboard.js / profile.js / discover.js / introductions.js
├── assets/img/hero-couple.webp
├── api/auth/{register,login,me,logout}.js
├── api/profile/me.js / api/matches/recommendations.js / api/introductions.js
├── api/health.js
├── api/_lib/auth.js / profile.js / matchmaking.js
├── db/schema.sql / migrations/001_member_profiles.sql / 002_discovery_matching.sql
├── package.json
├── .env.example
├── docs/PH7-REUSE-MAP.md / THIRD_PARTY_NOTICES.md
└── vercel.json
```

## Account settings and private messages

The Account + Messages v0.1 module adds `/account.html` and `/messages.html`, plus authenticated endpoints for account edits, password rotation, and conversations attached to mutually accepted introductions. See `docs/ACCOUNT-MESSAGES-v0.1.md` and `PATCH-APPLY-ACCOUNT-MESSAGES-v0.1.md` for endpoints, migration order, limitations and setup instructions.

Run Neon migrations `001_member_profiles.sql`, `002_discovery_matching.sql`, then `003_messages.sql` on the branch used by `DATABASE_URL`. Do not reset the database. Messaging remains disabled until an introduction is accepted by both members; it does not create fake conversations.

## Notifications, privacy settings and date planning (v0.1)

This milestone adds three member pages and database-backed routes:

- `/notifications.html` — per-member in-app updates, unread count, filters and mark-read actions.
- `/settings.html` — in-app notification preferences and discovery visibility. Discovery can only be switched on after profile readiness validation.
- `/date-plans.html` — propose a date only from a mutually accepted introduction; the other person can accept or decline, and either participant can cancel. A completed status is allowed only after the scheduled time.
- `/api/notifications` — authenticated GET/PATCH for notifications.
- `/api/settings` — authenticated GET/PUT for preferences and discovery visibility.
- `/api/date-plans` — authenticated GET/POST/PATCH for date proposals.

Notifications are stored in `dc_notifications` and respect `dc_member_settings`. They are in-app only; email, SMS and push delivery are not configured. Notification insertions are best-effort, so a notification failure does not invalidate a successful introduction or message action. The `/api/health` response now distinguishes database connectivity from schema readiness and lists any missing setup migrations.

### Database migration order

For the existing Date Concierge database where migrations 001–003 have already been run, run these two new migrations in Neon SQL Editor in order:

1. `db/migrations/004_notifications_settings.sql`
2. `db/migrations/005_date_plans.sql`

Use the same Neon `production` branch/database referenced by Vercel's server-side `DATABASE_URL`. These migrations are additive and idempotent; do not drop/reset the database. The 004 migration seeds default notification settings for existing users; 005 adds date proposals constrained to accepted introductions.

For a new database, run `db/schema.sql` first, then migrations 003, 004 and 005 in order. Confirm `/api/health` reports `schemaReady: true` after deployment and migrations.

Automated checks: `npm run check` and `npm run test:notifications-dateplans`. Live Neon CRUD, two-account consent flows and deployed Vercel behavior still require end-to-end testing against your configured deployment.

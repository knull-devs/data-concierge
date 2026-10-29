# Apply patch: Notifications, Settings and Date Planning v0.1

## Merge only the supplied changed/new files

Extract this patch into the existing `date-concierge` project root and allow replacement of existing files. Do not replace the entire repository or overwrite unrelated files.

### New pages and frontend assets

- `notifications.html`
- `settings.html`
- `date-plans.html`
- `assets/css/member-tools.css`
- `assets/js/notifications.js`
- `assets/js/settings.js`
- `assets/js/date-plans.js`

### New API and helpers

- `api/notifications.js`
- `api/settings.js`
- `api/date-plans.js`
- `api/_lib/notifications.js`
- `api/_lib/date-plans.js`

### New migrations and tests/docs

- `db/migrations/004_notifications_settings.sql`
- `db/migrations/005_date_plans.sql`
- `tools/smoke-notifications-dateplans.mjs`
- `docs/NOTIFICATIONS-DATE-PLANNING-v0.1.md`
- `PATCH-APPLY-NOTIFICATIONS-DATE-PLANNING-v0.1.md`

### Replaced files

- `dashboard.html`
- `assets/js/dashboard.js`
- `api/introductions.js`
- `api/messages.js`
- `api/health.js`
- `package.json`
- `tools/verify_project.py`
- `README.md`

## Neon migrations — run 004 and then 005

You have already reported that migrations 001, 002 and 003 completed. Do not run them again unless your database is missing those tables. Open the corresponding files in GitHub.dev, copy the entire SQL file, and execute each in Neon SQL Editor in this order:

1. `db/migrations/004_notifications_settings.sql`
2. `db/migrations/005_date_plans.sql`

Ensure the Neon branch is `production` and the database is the same one referenced by Vercel's `DATABASE_URL`. Both scripts use `IF NOT EXISTS`; do not drop tables or reset the database.

## Push and deploy

1. Commit and push the merged patch to GitHub.
2. Wait for the matching Vercel deployment to show `Ready`.
3. Open `/api/health`. `database` should be `connected`; after all expected tables are present, `schemaReady` should be `true` and `pendingMigrations` should be empty.
4. Log in and test `/notifications.html`, `/settings.html` and `/date-plans.html`.

## Local test command

```bash
npm run check
```

This checks JS syntax, validation helpers and local project structure. It is not a substitute for live tests with two accounts against Neon/Vercel. OAuth, push/email/SMS delivery, external venue booking and full block/report moderation remain outside this increment.

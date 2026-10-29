# Date Concierge Account + Messages v0.1 — Apply patch

This is a changed/new-files-only patch for the existing standalone `date-concierge` repository. It does not include the full repository and does not change login/registration routes or the Neon connection string.

## Apply

1. Back up the current GitHub branch or create a commit before patching.
2. Extract this ZIP into the existing repository root and allow matching files to be overwritten.
3. In Neon SQL Editor, choose the same branch/database used by Vercel `DATABASE_URL`.
4. Run migrations in this exact order, **only if not already successfully run**:
   - `db/migrations/001_member_profiles.sql`
   - `db/migrations/002_discovery_matching.sql`
   - `db/migrations/003_messages.sql`
5. Push the changed files to GitHub and wait for the Vercel deployment to become `Ready`.
6. Sign in and open `/account.html`, then `/messages.html`.

Do not reset or delete the Neon database. The migrations are additive and use `IF NOT EXISTS` where appropriate.

## New pages and APIs

- `/account.html` — display-name/city settings, password change, read-only email/DOB, membership display.
- `/messages.html` — private conversation list and thread view for mutually accepted introductions.
- `GET/PUT /api/account/me` — authenticated account settings.
- `POST /api/account/password` — current-password verification, password hash update and session rotation.
- `GET/POST/PATCH /api/messages` — list conversations, read a thread/send a message/mark incoming messages read.

## Test commands

From the repository root:

```bash
npm run check
```

This runs JavaScript syntax checks, existing profile/discovery smoke tests, the account/message validation smoke test, and the repository verifier. It does not connect to the production database. Live CRUD and two-user chat still need testing on the deployed Vercel app.

## Safety/behaviour notes

- Messaging requires an `accepted` introduction and an active other member.
- Message bodies are plain text and limited to 2,000 characters.
- The page never invents sample messages.
- Password changes require the current password and revoke other sessions.
- Email changes need a separate verification flow and remain read-only.
- Paid checkout remains inactive; ₹799 and ₹1,499 are display prices only.

# Date Concierge Notifications, Settings and Date Planning v0.1

## What this increment adds

- Authenticated in-app notifications with per-user ownership, unread tracking and internal-only destinations.
- Settings stored per user: master in-app notifications, introduction updates, message updates, date updates and discovery visibility.
- Date proposal workflow bound to an accepted introduction: propose, accept, decline, cancel, mark completed after the scheduled time.
- Notifications created after introduction, message and date-plan events. Notification writes are best-effort and never replace the underlying action's result.
- Health readiness details that distinguish a working Neon connection from missing application tables/migrations.

## Endpoints

| Route | Methods | Purpose |
|---|---|---|
| `/api/notifications` | GET, PATCH | List own notices/unread count; mark one or all read |
| `/api/settings` | GET, PUT | Read/save settings and discoverability |
| `/api/date-plans` | GET, POST, PATCH | List, create and act on date proposals |
| `/api/health` | GET | Connectivity plus expected-table readiness |

Write endpoints require a same-origin request, JSON body, authenticated session and database-backed rate limit. Date planning additionally checks that the current user is one of two members in an accepted introduction. No private contact data is revealed by these pages.

## Limitations

- Notification delivery is in-app only; no email/SMS/push provider has been configured.
- There is no live chat websocket; Messages remains request/refresh based.
- Date venue details are member supplied; no venue availability or booking integration exists.
- This is not yet a full report/block/moderation, account export/deletion or production security milestone.

## Migration setup

Existing source with migrations 001–003 already applied should run 004 then 005 in the same Neon branch used by Vercel. Do not reset the database. Use `/api/health` to check `schemaReady` and `pendingMigrations`.

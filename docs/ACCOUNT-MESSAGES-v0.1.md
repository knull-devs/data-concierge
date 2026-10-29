# Date Concierge Account + Messages v0.1

## Account settings

- `account.html` loads the authenticated account record from `GET /api/account/me`.
- `PUT /api/account/me` updates only the signed-in user's display name and city. Email and date of birth are read-only in this build; changing either needs a verification/review flow.
- `POST /api/account/password` verifies the current password, stores a new scrypt hash, revokes existing sessions, and issues a fresh session for this browser.
- The account page displays Explorer Free and the configured display prices ₹799 / ₹1,499. Checkout is not activated by this module.

## Private messages

- `messages.html` displays only accepted introductions as conversations.
- `GET /api/messages` lists the signed-in member's accepted introductions, latest message and unread count.
- `GET /api/messages?introductionId=<uuid>` returns up to 100 newest messages in chronological order.
- `POST /api/messages` sends a message only when the requester is a participant in an accepted introduction.
- `PATCH /api/messages` with `{ "action": "markRead", "introductionId": "..." }` marks incoming messages as read.
- All message render paths use text nodes/textContent; body text is not interpreted as HTML.
- Message body limit is 2,000 characters. Send actions are origin-checked and rate-limited.

## Database setup

Run these migrations in order in the same Neon database/branch used by Vercel's `DATABASE_URL`:

1. `db/migrations/001_member_profiles.sql`
2. `db/migrations/002_discovery_matching.sql`
3. `db/migrations/003_messages.sql`

Migration 003 creates the `dc_messages` table and indexes. It does not delete existing accounts, sessions, profiles or introduction records. Messages are keyed to `dc_introduction_requests` and cascade-delete if an introduction is removed.

## Known limitations

- Messages unlock after an introduction is mutually accepted; there is no arbitrary user-to-user messaging.
- This first version does not implement real-time push updates, attachments, email notifications, block/report actions from inside the thread, email verification, account email change, or paid checkout.
- Current conversations can be refreshed manually. No fabricated conversation or unread counts are shown.

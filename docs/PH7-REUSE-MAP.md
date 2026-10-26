# pH7Builder reuse map — Date Concierge discovery milestone

This milestone contains an actual JavaScript port/adaptation of selected pH7Builder server-side rules. The PHP framework and its templates are not copied into or deployed with Date Concierge; the independent Node.js + Neon architecture and the Date Concierge UI remain in place.

| pH7Builder source inspected | Source behaviour used | Date Concierge adaptation |
|---|---|---|
| `_protected/app/system/core/classes/MatchmakingCore.php` | Age proximity uses a Gaussian falloff (5-year tolerance); weights are age 0.35, geography 0.25, activity recency 0.25 and approved avatar 0.15; same-city score 1.0, same-country score 0.4, activity half-life 30 days. | Ported to `api/_lib/matchmaking.js` with the same weights/formula and an explicit mutual-preference/opt-in gate. India is the current launch region, so the country fallback is `IN` until country support is added. Source attribution and MIT terms are in `THIRD_PARTY_NOTICES.md`. |
| `_protected/app/system/modules/related-profile/controllers/MainController.php` | A small visible result set is ranked from a larger, activity-ordered candidate pool (`MAX_PROFILES = 5`, pool multiplier `12`). | `/api/matches/recommendations` scans a capped recent candidate pool, enforces reciprocal age/gender preferences first, then ranks up to five eligible profiles. |
| `_protected/app/system/core/classes/SearchQueryCore.php` and `_protected/app/system/core/models/UserCoreModel.php` | Search filters include age, match-sex preference, city, activity and approved-avatar state; own, inactive, pending/visitor and non-searchable profiles are excluded. | SQL excludes self/inactive/opted-out accounts and only returns candidate fields intended for discovery. Explicit consent (`discoverable`) replaces upstream search-visibility settings. Account email and private preferences are never returned to the discovery UI. |
| `_protected/app/system/modules/friend/models/FriendModel.php` and `FriendCoreModel.php` | Prevents self-requests and duplicate relationships; records a pending request and lets the recipient approve it. | `/api/introductions` implements one relationship record per member pair, prevents self/duplicate requests, treats an opposite pending request as mutual acceptance, and allows only the recipient to accept/decline. Messaging is not activated by acceptance yet. |
| `_protected/app/system/modules/user/forms/EditForm.php` and `forms/processing/EditFormProcess.php` | Server-side field checks and controlled member profile updates. | `api/profile/me.js` validates an allowlisted payload and uses an owner-scoped upsert. Discovery requires a deliberate opt-in plus a minimum complete profile. |
| `_protected/app/system/includes/classes/ProfileBaseController.php` / `ProfileBaseController.php` | Authenticated profile access and privacy checks. | Current profile editor is private to the signed-in account. Discovery only publishes a limited card for members who opted in; preferences/email are excluded. |

## Intentional scope and limitations

- Match scoring is a ranking heuristic, not a scientific compatibility or chemistry prediction.
- There are no seeded/fake members. If no real users mutually fit, the UI shows an honest empty state.
- Avatar scoring is ready for approved photos, but a moderated photo-upload module is not part of this milestone.
- An accepted introduction does not expose private contact information or turn on messaging; those are later milestones.
- Run `001_member_profiles.sql`, then `002_discovery_matching.sql`, before deploying these discovery endpoints to the existing database.

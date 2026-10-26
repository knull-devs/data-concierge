# pH7Builder reuse map — Date Concierge profile foundation

This is a feature/behaviour mapping from the supplied pH7Builder source, not a copy of its PHP runtime or UI. Date Concierge remains the standalone Node.js + Neon app.

| pH7Builder reference | Behaviour reviewed | Date Concierge implementation |
|---|---|---|
| `_protected/app/system/modules/user/forms/EditForm.php` | Member-editable name/last-name, match preferences and dynamic profile fields; sensitive account fields have stricter update rules. | `profile.html` keeps account email/name separate, gathers optional biography and relationship preferences, and does not allow self-service DOB edits. |
| `_protected/app/system/modules/user/forms/processing/EditFormProcess.php` | Server-side update processing, field comparisons and dynamic-field updates. | `api/profile/me.js` uses server-side allowlists, length/range validation, same-origin PUT protection, per-IP/user rate limits and a single owner-scoped upsert. |
| `_protected/app/system/modules/user/controllers/ProfileController.php` and `ProfileBaseController.php` | Profile ownership, authentication and privacy checks before profile data is shown. | `/api/profile/me` requires a valid session and queries only the authenticated user's `user_id`. No public profile/search endpoint is added in this milestone. |
| `_protected/app/system/modules/user/models/UserModel.php` | Data access for member profile details and profile edits. | `dc_member_profiles` stores the Date Concierge profile extension with a foreign key to the existing account. |
| `_protected/app/system/core/classes/MatchmakingCore.php` and `SearchUserCoreForm.php` | Matching/search functionality reviewed for the next milestone. | Not enabled yet. Preference data remains private to the owner until the dedicated discovery/search API and mutual-consent rules are implemented. |

## Intentional scope boundaries

- The supplied pH7Builder PHP files are not deployed into this repository. Their framework-specific code is not directly executable in the Node/Vercel runtime.
- This milestone implements only the signed-in user's profile editing and preference storage.
- It does not publish profiles, make matches, reveal private preferences, enable chat, or claim that introductions are available.
- The pH7Builder source licence and notices remain with the upstream source; this standalone patch contains no copied pH7 PHP source files.

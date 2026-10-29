# Date Concierge Dashboard UI v1.0 — apply instructions

This is a changed-files-only patch for the existing standalone Date Concierge repository.

## Files included
- `dashboard.html` — replace at the repository root.
- `assets/css/dashboard.css` — add as a new file.
- `assets/js/dashboard.js` — replace the existing dashboard script.

No authentication routes, database tables, discovery APIs, or introduction APIs are modified.

## Apply
1. Back up/commit the current project first.
2. Extract this ZIP into the existing `date-concierge` project root, preserving folder paths and allowing `dashboard.html` and `assets/js/dashboard.js` to be overwritten.
3. Commit and push changes using GitHub.dev Source Control or your local Git client.
4. Wait for Vercel's latest deployment to become `Ready`, then open `/dashboard.html` on mobile and desktop.

## Data integrity notes
The dashboard calls the existing `/api/auth/me`, `/api/profile/me`, `/api/matches/recommendations`, and `/api/introductions` endpoints. It does not insert mock profiles, message histories, profile views, or scheduled dates. Since messaging and date scheduling are not yet implemented, the message panel explains that limitation instead of showing fabricated messages. Membership pricing shown is ₹799/month and ₹1,499/month; checkout remains inactive.

## Test
Run `npm run check` from the project root. Then test:
- signed-out redirect to login
- name and profile completion loaded from API
- real match recommendations or the honest empty state
- real introduction statuses or empty state
- logout
- mobile bottom navigation and horizontal recommendation cards

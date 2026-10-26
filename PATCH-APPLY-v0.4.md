# Date Concierge mobile auth layout fix — v0.4

This is a changed-files-only patch for the standalone `date-concierge` project. It does not contain the full application or any pH7Builder files, and it does not change API/authentication logic.

## Replace these files at the repository root

- `index.html`
- `assets/css/site.css`
- `assets/js/site.js`

The CSS and JS references now use `?v=0.4.0` so browsers request the refreshed assets instead of reusing cached v0.2/v0.3 files. The page also carries `<meta name="dc-ui-version" content="0.4.0">` for easy verification.

## Apply and deploy

1. Create a git commit/backup first.
2. Extract this ZIP into the existing repository root and overwrite the three files.
3. Run `npm run check`.
4. Commit and push to the branch connected to Vercel.
5. In Vercel, open Deployments and wait for the new commit's deployment to finish with **Ready**.
6. On the phone, close the old tab, open the latest deployment URL, then refresh. If needed, use a fresh incognito tab.

## Confirm v0.4 is actually live

- Open `https://YOUR-DOMAIN/assets/css/site.css?v=0.4.0` in the mobile browser. Find the comment `Date Concierge mobile auth fix v0.4` near the end.
- View page source for the homepage and confirm `dc-ui-version` is `0.4.0`.
- In the signup popup, scroll the form: the banner image and close button should remain visible while the fields/submit area scroll independently.

If either version marker is missing, Vercel is not serving the patch yet (wrong branch/deployment or files were not replaced at the repository root). If the marker is present but the UI still behaves the same, send screenshots of the new deployment and we will inspect the exact browser behaviour.

## Scope

Mobile layout only: dialog containment, fixed hero image/close button, independent form scroll, viewport/safe-area support and cache-busting. No database, API endpoints, auth handlers or schema changes.

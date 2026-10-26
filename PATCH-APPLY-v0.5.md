# Date Concierge mobile auth fix — v0.5

This is a changed-files-only patch for the standalone `date-concierge` project. It does not include pH7Builder or change API/authentication/database logic.

## Replace at the repository root

- `index.html`
- `assets/css/site.css`
- `assets/js/site.js`

## What this fixes

- Moves the open dialog with `visualViewport.offsetTop` and sizes it to the visible viewport height. This addresses the Android keyboard case in which the dialog sheet was pushed down and only its image banner remained visible.
- Avoids fixed-body scroll locking on Android (retained for iOS-style browsers), which can interfere with Android Chrome's visual viewport resize.
- Does not auto-focus registration/login inputs on mobile, so opening the popup does not immediately trigger the keyboard.
- Keeps focused fields visible inside the form scroller after keyboard viewport changes.
- Updates asset cache-busting and the UI version marker to `0.5.0`.

## Apply and deploy

1. Back up the current project or create a Git commit first.
2. Extract this ZIP into the existing project root and overwrite the three files.
3. Check the `index.html` references include `site.css?v=0.5.0` and `site.js?v=0.5.0`.
4. Commit and push to the branch connected to Vercel, or commit the edited files in GitHub.dev.
5. Wait for the matching Vercel deployment to show **Ready**.
6. On the phone, close the old tab and reopen the site, or use an Incognito tab.
7. Verify `https://YOUR-DOMAIN/assets/css/site.css?v=0.5.0` and find the comment `Date Concierge mobile auth fix v0.5`.

## Verification

On Android, open the signup modal, tap Email/Name/Password, and scroll the form while the keyboard is visible. The dialog should stay attached to the visible area above the keyboard; banner and close button stay visible, and the form content scrolls inside the dialog.

Automated source checks can validate syntax and packaging, but final keyboard behaviour must be verified in the actual phone browser.

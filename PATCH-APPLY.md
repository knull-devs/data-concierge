# Date Concierge mobile responsiveness patch (v0.3)

This patch updates only three existing project files:

- `index.html` — wraps authentication form content in an independent scroll region.
- `assets/css/site.css` — improves the mobile auth sheet, close-button access, safe-area padding, input sizing, narrow-screen date/city layout, and short/landscape viewport behavior.
- `assets/js/site.js` — locks the background page while auth is open, restores previous scroll/body styles on close, updates a CSS viewport-height variable for mobile keyboard changes, and resets the auth form scroll when switching tabs.

## Apply

1. Back up the current project or create a Git commit first.
2. Extract this ZIP into the existing `date-concierge` project root and allow these three files to be overwritten.
3. Run `npm run check` from the project root.
4. Commit and push the changes; let Vercel deploy the updated commit.

No backend/authentication API, database schema, or subscription logic is changed by this patch.

## Manual mobile checks

- At a narrow width (320–380 CSS px), open Sign up: the date-of-birth and city fields should stack vertically.
- Scroll the form: the hero strip and close button should remain visible while form content scrolls independently.
- Focus an input so the mobile keyboard opens: the fields and submit button should remain reachable.
- Switch Login/Sign up: the inner form scroll should reset to the top.
- Close the popup: the underlying page should return to its previous scroll position and should scroll normally again.
- Repeat on 390–430 CSS px and desktop widths.

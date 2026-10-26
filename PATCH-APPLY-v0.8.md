# Date Concierge UI v0.8 — changed files only

## Replace only these files in the existing `date-concierge` project root

- `index.html`
- `assets/css/site.css`

No backend, authentication API, database schema, environment variables, session logic, or JavaScript business logic is changed.

## Fixes

1. **Process-card label overlap:** the “A little about you”, “Compatibility first” and “Take it offline” labels are no longer absolutely positioned over the description. They now sit in normal document flow beneath each card's description with a divider and spacing.
2. **Headline spacing:** restore the intended mobile line breaks so “More than” and “just a match,” render as separate lines with a visible word boundary; restore the break before “connection.”
3. **Full mobile hero image:** on phone widths the original 16:9 hero photograph is displayed at its full width/height ratio in a cinematic banner directly below the header. Copy follows below the image instead of making the landscape photograph fill a tall portrait viewport and cropping most of the couple. The desktop layout remains unchanged.
4. **Cache busting:** CSS and JS URLs are versioned to `v0.8.0` so browsers fetch the updated assets.

## Apply

Extract this patch into the existing project root and allow overwriting `index.html` and `assets/css/site.css`. Do not remove any other files.

Run from the project root:

```bash
npm run check
```

Then commit/push the changed files to GitHub and wait for the matching Vercel deployment to show `Ready`. On mobile, confirm the full hero image appears as an uncropped wide banner, the title reads on separate lines, and the three “How it works” footer labels sit below their descriptions.

## Status

Static project checks, CSS parsing, and existing `npm run check` passed locally. A live Vercel/mobile-device test has not been performed by this patch.

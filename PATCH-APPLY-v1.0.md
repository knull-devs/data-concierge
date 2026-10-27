# Date Concierge — Five-photo scroll story v1.0

This is a changed-files-only patch for the existing standalone Date Concierge repo. It does not include the full repo and does not modify authentication/API code.

## Replace these existing files

- `index.html`
- `assets/css/site.css`
- `package.json`
- `tools/verify_project.py`

## Add these new files

- `assets/js/story-stack.js`
- `assets/img/story-stack/01-rooftop.webp`
- `assets/img/story-stack/02-cafe.webp`
- `assets/img/story-stack/03-garden.webp`
- `assets/img/story-stack/04-gallery.webp`
- `assets/img/story-stack/05-bookshop.webp`

## Apply

1. Extract this ZIP into the root of the existing `date-concierge` repository and allow the four existing files above to be overwritten.
2. Keep the existing `assets/video/hero.mp4` file in your repo. `index.html` retains its path at `/assets/video/hero.mp4`.
3. Run `npm run check` from the project root.
4. Commit/push the changed files to GitHub and wait for the Vercel deployment to show `Ready`.
5. Test on mobile and desktop. Scroll through the About section: the stage pins while the five photo cards move through the stack; once the sequence completes, normal page scrolling resumes.

## Behaviour

- Removes the former `story-frame-line` overlay.
- Adds five local WebP photo cards; four are newly generated and one reuses the existing rooftop photo as a separate story card asset.
- Scroll progress is driven by normal document scrolling (no wheel hijacking). The section remains pinned while the cards animate one-by-one.
- On `prefers-reduced-motion: reduce`, or if JavaScript is unavailable, the five images are shown in normal page flow rather than being pinned.
- Existing auth, profile, matchmaking, and database APIs are unchanged.
- Keeps the agreed visible plan prices: Date Plus ₹799/month and Private Concierge ₹1,499/month. This does not alter server-side payment/checkout configuration.

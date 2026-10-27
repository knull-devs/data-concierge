# Date Concierge — Stacking Photo Grid v1.1

## Apply to the existing project

Extract/merge this patch at the **root of the existing `date-concierge` repository** and overwrite the matching files. This patch expects the five existing WebP assets from the earlier story-stack module to already be present.

### Replaced files
- `index.html`
- `assets/css/site.css`
- `assets/js/story-stack.js`
- `tools/verify_project.py`

No images are replaced. The existing files under `assets/img/story-stack/01-rooftop.webp` through `05-bookshop.webp` are reused unchanged. The hero video source and backend/API files are untouched.

## What changed

- Replaced the old “one card moves sideways out” effect with a vertical overlapping stack, closely following the provided “Stacking Cards” reference.
- Each card uses a text panel on the left and the existing photo on the right.
- As the user scrolls, the stack glides upward inside a pinned stage; later cards overlap earlier cards. The progress indicator advances from 01/05 to 05/05.
- After the fifth card reaches the front, the pinned story section releases and normal page scrolling continues into the content below.
- Responsive card heights, layout and stack spacing adapt to mobile and laptop widths.
- Reduced-motion and no-JavaScript fallback displays all five cards in normal document flow.
- Versioned cache-busting URLs use `v=1.1.0`.

## Test
Run from project root:

```bash
npm run check
```

After pushing to GitHub, wait for Vercel's deployment to become `Ready`, then scroll through the About/story section on mobile and desktop. Live Vercel scroll behavior still needs device verification.

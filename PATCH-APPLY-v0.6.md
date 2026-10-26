# Date Concierge UI v0.6 — patch application

This is a **changed/new-files-only patch** for the standalone Date Concierge project. Do not add or copy the pH7Builder repository.

## Files to merge into the existing project root

- `index.html` — homepage/video slot and image-free login/signup dialog; cache-busted asset URLs (`v=0.6.0`).
- `assets/css/site.css` — centered compact auth modal on laptop and mobile, responsive form sizing, hero fallback/video layering, scroll/card reveal refinements, mobile header menu animation.
- `assets/js/site.js` — visible viewport centering for the dialog, optional hero video loader with still fallback, menu outside-click/Escape handling and subtle scroll parallax.
- `package.json` — version/description only; dependency list is unchanged.
- `tools/verify_project.py` — checks for the new UI markers and no-image auth modal.
- `README.md` — updated setup and optional video notes.
- `assets/video/README.md` — new instructions for the future video file.

Extract this ZIP into the root of the current `date-concierge` repository and allow overwrite. Do not delete any API, schema or other application files.

## Video note

No video was supplied, so the current hero still image remains the fallback. When a suitable licensed, compressed video is selected, put it at `assets/video/hero.mp4` and set `data-video-src="/assets/video/hero.mp4"` on `#hero-background-video` in `index.html`. The script skips video loading when `data-video-src` is empty and respects reduced-motion/data-saver settings.

## One-command check

From the project root, run:

```bash
npm run check
```

Expected result includes `PASS: 24 required files exist ...`. This checks syntax, local references, schema/auth guardrails and the new UI markers. It is not a substitute for checking the updated deployment on an actual phone.

## Intentionally unchanged

- Existing auth endpoints, Neon schema and session logic.
- Current displayed prices; updated prices have not yet been provided.
- Google/Apple/phone login remain provider-setup placeholders.

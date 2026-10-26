# Optional hero video

The homepage currently uses `/assets/img/hero-couple.webp` as its cinematic fallback. No video is bundled yet.

When a properly licensed, web-optimized MP4 is selected:
1. Add it as `assets/video/hero.mp4`.
2. In `index.html`, set `data-video-src="/assets/video/hero.mp4"` on `#hero-background-video`.
3. Keep the video muted, looping and inline for autoplay compatibility. The script respects `prefers-reduced-motion` and browser data-saver preferences. If the video fails to load, the still-image fallback remains visible.

Avoid very large uploads; create mobile-friendly encoding/dimensions and test actual network usage before enabling autoplay on production.

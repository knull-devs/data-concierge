(() => {
  'use strict';

  const section = document.querySelector('[data-story-stack-section]');
  if (!section) return;

  const track = section.querySelector('[data-story-stack-track]');
  const stage = section.querySelector('[data-story-stack-stage]');
  const cards = [...section.querySelectorAll('[data-stack-card]')];
  const counter = section.querySelector('[data-stack-counter]');
  const progress = section.querySelector('[data-stack-progress]');
  const progressFill = section.querySelector('[data-stack-progress-fill]');
  if (!track || !stage || cards.length < 2) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isStatic = () => reduceMotion.matches;
  let frame = 0;
  let lastActive = -1;

  const setAccessibleStaticState = () => {
    track.classList.remove('is-scroll-enhanced');
    cards.forEach((card) => {
      card.removeAttribute('aria-hidden');
      card.style.removeProperty('transform');
      card.style.removeProperty('opacity');
      card.style.removeProperty('filter');
      card.style.removeProperty('z-index');
    });
    if (counter) counter.innerHTML = `01 <i>/ 0${cards.length}</i>`;
    if (progress) progress.setAttribute('aria-valuenow', '1');
    if (progressFill) progressFill.style.transform = 'scaleX(0)';
  };

  if (isStatic()) {
    setAccessibleStaticState();
  } else {
    track.classList.add('is-scroll-enhanced');
  }

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const render = () => {
    frame = 0;
    if (isStatic() || !track.classList.contains('is-scroll-enhanced')) return;

    const trackRect = track.getBoundingClientRect();
    const travel = Math.max(1, track.offsetHeight - stage.offsetHeight);
    const travelled = clamp(-trackRect.top, 0, travel);
    const scrollProgress = clamp(travelled / travel, 0, 1);
    const cardProgress = scrollProgress * (cards.length - 1);
    const active = clamp(Math.round(cardProgress), 0, cards.length - 1);
    const viewportWidth = Math.max(320, stage.clientWidth);
    const exitDistance = Math.min(viewportWidth * 0.72, 520);

    cards.forEach((card, index) => {
      const relative = index - cardProgress;
      const ahead = Math.max(0, relative);
      let x;
      let y;
      let scale;
      let opacity;
      let rotation;
      let blur;

      if (relative < 0) {
        const exit = clamp(-relative, 0, 1.35);
        x = -exitDistance * exit;
        y = -76 * exit;
        scale = 1 + Math.min(exit, 1) * 0.035;
        opacity = clamp(1 - exit * 1.42, 0, 1);
        rotation = (index % 2 === 0 ? -1 : 1) * 5.5 * exit;
        blur = Math.min(exit * 1.5, 2);
      } else {
        const depth = Math.min(ahead, cards.length - 1);
        x = depth * 2.5;
        y = depth * 13;
        scale = 1 - depth * 0.048;
        opacity = clamp(1 - depth * 0.17, 0.28, 1);
        rotation = (index % 2 === 0 ? -1 : 1) * depth * 1.15;
        blur = Math.min(depth * 0.32, 1.2);
      }

      card.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)}) rotate(${rotation.toFixed(3)}deg)`;
      card.style.opacity = opacity.toFixed(3);
      card.style.filter = blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : 'none';
      card.style.zIndex = String(100 - Math.round(Math.abs(relative) * 12));
      card.setAttribute('aria-hidden', String(index !== active));
      card.classList.toggle('is-current', index === active);
    });

    if (active !== lastActive) {
      lastActive = active;
      const number = String(active + 1).padStart(2, '0');
      const total = String(cards.length).padStart(2, '0');
      if (counter) counter.innerHTML = `${number} <i>/ ${total}</i>`;
      if (progress) progress.setAttribute('aria-valuenow', String(active + 1));
    }
    if (progressFill) progressFill.style.transform = `scaleX(${cardProgress / (cards.length - 1)})`;
  };

  const requestRender = () => {
    if (!frame) frame = window.requestAnimationFrame(render);
  };

  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', requestRender, { passive: true });
  window.addEventListener('orientationchange', () => window.setTimeout(requestRender, 120), { passive: true });
  reduceMotion.addEventListener?.('change', (event) => {
    if (event.matches) {
      setAccessibleStaticState();
      lastActive = -1;
    } else {
      track.classList.add('is-scroll-enhanced');
      requestRender();
    }
  });
  requestRender();
})();

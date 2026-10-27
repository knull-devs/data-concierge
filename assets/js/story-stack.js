(() => {
  'use strict';

  const section = document.querySelector('[data-story-stack-section]');
  if (!section) return;

  const track = section.querySelector('[data-story-stack-track]');
  const stage = section.querySelector('[data-story-stack-stage]');
  const deck = section.querySelector('[data-story-stack-deck]');
  const cardsLayer = section.querySelector('[data-stack-cards]');
  const cards = [...section.querySelectorAll('[data-stack-card]')];
  const counter = section.querySelector('[data-stack-counter]');
  const progress = section.querySelector('[data-stack-progress]');
  const progressFill = section.querySelector('[data-stack-progress-fill]');
  if (!track || !stage || !deck || !cardsLayer || cards.length < 2) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileQuery = window.matchMedia('(max-width: 700px)');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let rafId = 0;
  let geometry = null;
  let lastActive = -1;

  function resetCardStyles() {
    cards.forEach((card) => {
      card.style.removeProperty('top');
      card.style.removeProperty('z-index');
      card.classList.remove('is-stack-active');
    });
    cardsLayer.style.removeProperty('height');
    cardsLayer.style.removeProperty('transform');
    track.style.removeProperty('height');
    track.style.removeProperty('--story-stack-track-height');
    track.classList.remove('is-scroll-enhanced');
    if (counter) counter.innerHTML = `01 <i>/ ${String(cards.length).padStart(2, '0')}</i>`;
    if (progress) progress.setAttribute('aria-valuenow', '1');
    if (progressFill) progressFill.style.transform = 'scaleX(0)';
    lastActive = -1;
  }

  function measureAndEnable() {
    if (reducedMotion.matches) {
      resetCardStyles();
      geometry = null;
      return;
    }

    track.classList.add('is-scroll-enhanced');
    // Card height is determined by CSS breakpoints; the same stack behaviour works on desktop and mobile.
    const cardHeight = Math.max(1, Math.round(cards[0].getBoundingClientRect().height));
    const overlapRatio = mobileQuery.matches ? 0.24 : 0.22;
    const step = Math.max(mobileQuery.matches ? 118 : 150, Math.round(cardHeight * (1 - overlapRatio)));
    const steps = cards.length - 1;
    const viewportHeight = Math.max(1, Math.round(stage.getBoundingClientRect().height));
    // Give each card more than one card-step of scroll so the overlap reads as a deliberate sequence.
    const scrollTravel = Math.round(step * steps * 1.42);

    cards.forEach((card, index) => {
      card.style.top = `${step * index}px`;
      card.style.zIndex = String(10 + index);
      card.classList.toggle('is-stack-active', index === 0);
    });
    cardsLayer.style.height = `${cardHeight + step * steps}px`;
    track.style.height = `${viewportHeight + scrollTravel}px`;
    track.style.setProperty('--story-stack-track-height', `${viewportHeight + scrollTravel}px`);
    geometry = { step, steps, scrollTravel };
    render();
  }

  function render() {
    rafId = 0;
    if (!geometry || reducedMotion.matches || !track.classList.contains('is-scroll-enhanced')) return;
    const trackRect = track.getBoundingClientRect();
    const travelled = clamp(-trackRect.top, 0, geometry.scrollTravel);
    const sequenceProgress = geometry.scrollTravel ? travelled / geometry.scrollTravel : 0;
    const cardProgress = sequenceProgress * geometry.steps;
    const stackOffset = cardProgress * geometry.step;
    const active = clamp(Math.round(cardProgress), 0, cards.length - 1);

    cardsLayer.style.transform = `translate3d(0, ${(-stackOffset).toFixed(2)}px, 0)`;
    cards.forEach((card, index) => card.classList.toggle('is-stack-active', index === active));
    if (active !== lastActive) {
      lastActive = active;
      const current = String(active + 1).padStart(2, '0');
      const total = String(cards.length).padStart(2, '0');
      if (counter) counter.innerHTML = `${current} <i>/ ${total}</i>`;
      if (progress) progress.setAttribute('aria-valuenow', String(active + 1));
    }
    if (progressFill) progressFill.style.transform = `scaleX(${sequenceProgress.toFixed(4)})`;
  }

  function scheduleRender() {
    if (!rafId) rafId = window.requestAnimationFrame(render);
  }

  function refresh() {
    // Wait one layout frame so mobile browser chrome/orientation changes have settled.
    window.requestAnimationFrame(() => {
      measureAndEnable();
      scheduleRender();
    });
  }

  if (reducedMotion.matches) resetCardStyles();
  else measureAndEnable();

  window.addEventListener('scroll', scheduleRender, { passive: true });
  window.addEventListener('resize', refresh, { passive: true });
  window.addEventListener('orientationchange', () => window.setTimeout(refresh, 140), { passive: true });
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', refresh);
  else reducedMotion.addListener?.(refresh);
})();

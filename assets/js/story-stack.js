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
  const pad = (value) => String(value).padStart(2, '0');
  let rafId = 0;
  let geometry = null;
  let lastActive = -1;
  let resizeObserver = null;

  function setCounter(active) {
    if (active === lastActive) return;
    lastActive = active;
    if (counter) counter.innerHTML = `${pad(active + 1)} <i>/ ${pad(cards.length)}</i>`;
    if (progress) progress.setAttribute('aria-valuenow', String(active + 1));
  }

  function resetEnhancement() {
    cards.forEach((card) => {
      card.style.removeProperty('top');
      card.style.removeProperty('z-index');
      card.style.removeProperty('transform');
      card.style.removeProperty('transform-origin');
      card.classList.remove('is-stack-active', 'is-stack-covered');
    });
    cardsLayer.style.removeProperty('height');
    cardsLayer.style.removeProperty('transform');
    track.style.removeProperty('height');
    track.style.removeProperty('--story-stack-track-height');
    track.classList.remove('is-scroll-enhanced');
    if (progressFill) progressFill.style.transform = 'scaleX(0)';
    setCounter(0);
    geometry = null;
  }

  function measureAndEnable() {
    if (reducedMotion.matches) {
      resetEnhancement();
      return;
    }

    // Enable the pinned layout BEFORE measuring: otherwise the page's normal-flow
    // fallback height is measured and the pinned story lasts far too long.
    track.classList.add('is-scroll-enhanced');
    const stageHeight = Math.max(1, Math.round(stage.getBoundingClientRect().height));
    const deckHeight = Math.max(1, Math.round(deck.getBoundingClientRect().height));
    const cardHeight = Math.max(1, Math.round(cards[0].getBoundingClientRect().height));
    const steps = cards.length - 1;
    // The reference effect keeps a substantial overlap between cards, not a carousel.
    const stepRatio = mobileQuery.matches ? 0.72 : 0.72;
    const step = Math.max(mobileQuery.matches ? 92 : 120, Math.round(cardHeight * stepRatio));
    const startOffset = Math.max(0, deckHeight - cardHeight);
    const buildTravel = steps * step;
    // After card five reaches the bottom slot, scroll the finished stack out of the deck.
    const exitTravel = deckHeight;
    const scrollTravel = buildTravel + exitTravel;

    cardsLayer.style.height = `${deckHeight + cardHeight * cards.length}px`;
    cards.forEach((card, index) => {
      card.style.zIndex = String(20 + index);
      card.style.transformOrigin = 'center top';
    });
    track.style.height = `${stageHeight + scrollTravel}px`;
    track.style.setProperty('--story-stack-track-height', `${stageHeight + scrollTravel}px`);
    geometry = { step, steps, startOffset, deckHeight, cardHeight, buildTravel, exitTravel, scrollTravel };
    lastActive = -1;
    render();
  }

  function render() {
    rafId = 0;
    if (!geometry || reducedMotion.matches || !track.classList.contains('is-scroll-enhanced')) return;

    const travelled = clamp(-track.getBoundingClientRect().top, 0, geometry.scrollTravel);
    const buildPosition = Math.min(travelled, geometry.buildTravel);
    const stepPosition = buildPosition / Math.max(1, geometry.step);
    const currentCard = clamp(Math.floor(stepPosition), 0, geometry.steps);
    const localProgress = currentCard >= geometry.steps ? 0 : clamp(stepPosition - currentCard, 0, 1);
    const exitProgress = clamp((travelled - geometry.buildTravel) / Math.max(1, geometry.exitTravel), 0, 1);
    const exitOffset = exitProgress * geometry.deckHeight;
    const scaleDropPerLevel = 0.045;

    const active = clamp(Math.floor(stepPosition + 0.5), 0, cards.length - 1);
    cards.forEach((card, index) => {
      let top;
      let scale;
      if (index <= currentCard) {
        // Cards already introduced shift toward the top and scale down as the next
        // card rises from below. At the end of each step the stack remains continuous.
        const depth = currentCard - index;
        top = geometry.startOffset - (depth * geometry.step) - (localProgress * geometry.step);
        scale = 1 - (scaleDropPerLevel * (depth + localProgress));
      } else {
        // The next card enters from just below the deck; later cards queue beneath it.
        top = geometry.deckHeight + (index - currentCard - 1 - localProgress) * geometry.cardHeight;
        scale = 1;
      }

      top -= exitOffset;
      card.style.top = `${top.toFixed(2)}px`;
      card.style.transform = `scale(${clamp(scale, 0.78, 1).toFixed(4)})`;
      card.classList.toggle('is-stack-active', index === active);
      card.classList.toggle('is-stack-covered', index < active);
    });

    setCounter(active);
    const buildProgress = clamp(travelled / Math.max(1, geometry.buildTravel), 0, 1);
    if (progressFill) progressFill.style.transform = `scaleX(${buildProgress.toFixed(4)})`;
  }

  function scheduleRender() {
    if (!rafId) rafId = window.requestAnimationFrame(render);
  }

  function refresh() {
    window.requestAnimationFrame(() => {
      measureAndEnable();
      scheduleRender();
    });
  }

  if (reducedMotion.matches) resetEnhancement();
  else measureAndEnable();

  window.addEventListener('scroll', scheduleRender, { passive: true });
  window.addEventListener('resize', refresh, { passive: true });
  window.addEventListener('orientationchange', () => window.setTimeout(refresh, 180), { passive: true });
  window.addEventListener('load', refresh, { once: true });
  document.fonts?.ready?.then(refresh).catch(() => {});
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => refresh());
    resizeObserver.observe(stage);
    resizeObserver.observe(deck);
  }
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', refresh);
  else reducedMotion.addListener?.(refresh);
})();

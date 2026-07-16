(() => {
  "use strict";

  const carousel = document.querySelector("[data-carousel]");
  const track = document.querySelector("[data-carousel-track]");
  const dotsHost = document.querySelector("[data-carousel-dots]");
  const originalSlides = track ? [...track.querySelectorAll(":scope > .campaign-slide")] : [];
  let current = 0;
  let timer = 0;
  let settleTimer = 0;
  let allSlides = originalSlides;
  let isProgrammaticScroll = false;

  const toast = document.querySelector("[data-home-toast]");
  let toastTimer = 0;
  const showToast = () => {
    if (!toast) return;
    toast.textContent = "遷移先ページは準備中です";
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 1800);
  };

  document.addEventListener("click", (event) => {
    const element = event.target.closest("[data-demo-message]");
    if (!element) return;
    event.preventDefault();
    showToast();
  });

  if (!carousel || !track || !dotsHost || originalSlides.length === 0) return;

  if (originalSlides.length > 1) {
    const firstClone = originalSlides[0].cloneNode(true);
    const lastClone = originalSlides.at(-1).cloneNode(true);
    firstClone.dataset.carouselClone = "first";
    lastClone.dataset.carouselClone = "last";
    firstClone.setAttribute("aria-hidden", "true");
    lastClone.setAttribute("aria-hidden", "true");
    track.prepend(lastClone);
    track.append(firstClone);
    allSlides = [...track.querySelectorAll(":scope > .campaign-slide")];
  }

  const dots = originalSlides.map((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "carousel-dot";
    dot.setAttribute("aria-label", `${index + 1}枚目を表示`);
    dot.addEventListener("click", () => goTo(index, true));
    dotsHost.append(dot);
    return dot;
  });

  const physicalIndexFor = (logicalIndex) => originalSlides.length > 1 ? logicalIndex + 1 : logicalIndex;

  const updateDots = () => {
    dots.forEach((dot, index) => {
      const active = index === current;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });
  };

  const centerPhysical = (physicalIndex, behavior = "smooth") => {
    const slide = allSlides[physicalIndex];
    if (!slide) return;
    const targetLeft = slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2;
    isProgrammaticScroll = true;
    track.scrollTo({ left: targetLeft, behavior });
    window.setTimeout(() => { isProgrammaticScroll = false; }, behavior === "smooth" ? 360 : 0);
  };

  let wrapResetTimer = 0;

  const resetAfterWrap = (physicalIndex) => {
    window.clearTimeout(wrapResetTimer);
    wrapResetTimer = window.setTimeout(() => {
      centerPhysical(physicalIndex, "auto");
    }, 460);
  };

  const goTo = (index, userInitiated = false) => {
    const count = originalSlides.length;

    // 8枚目→1枚目、1枚目→8枚目も、ほかの移動と同じ方向へ
    // 1枚分だけアニメーションさせ、複製スライド到達後に無動作で正規位置へ戻す。
    if (count > 1 && current === count - 1 && index === count) {
      current = 0;
      updateDots();
      centerPhysical(allSlides.length - 1, "smooth");
      resetAfterWrap(physicalIndexFor(0));
    } else if (count > 1 && current === 0 && index === -1) {
      current = count - 1;
      updateDots();
      centerPhysical(0, "smooth");
      resetAfterWrap(physicalIndexFor(current));
    } else {
      current = (index + count) % count;
      updateDots();
      centerPhysical(physicalIndexFor(current), "smooth");
    }

    if (userInitiated) restartAutoPlay();
  };

  const nearestPhysicalIndex = () => {
    const trackRect = track.getBoundingClientRect();
    const center = trackRect.left + trackRect.width / 2;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    allSlides.forEach((slide, index) => {
      const rect = slide.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  };

  const normalizeAfterScroll = () => {
    const physical = nearestPhysicalIndex();
    if (originalSlides.length > 1 && physical === 0) {
      current = originalSlides.length - 1;
      centerPhysical(physicalIndexFor(current), "auto");
    } else if (originalSlides.length > 1 && physical === allSlides.length - 1) {
      current = 0;
      centerPhysical(physicalIndexFor(current), "auto");
    } else {
      current = originalSlides.length > 1 ? physical - 1 : physical;
    }
    updateDots();
  };

  track.addEventListener("scroll", () => {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(normalizeAfterScroll, isProgrammaticScroll ? 220 : 110);
  }, { passive: true });

  const stopAutoPlay = () => {
    window.clearInterval(timer);
    timer = 0;
  };
  const startAutoPlay = () => {
    if (timer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer = window.setInterval(() => goTo(current + 1), 4800);
  };
  const restartAutoPlay = () => {
    stopAutoPlay();
    startAutoPlay();
  };

  document.querySelector("[data-carousel-prev]")?.addEventListener("click", () => goTo(current - 1, true));
  document.querySelector("[data-carousel-next]")?.addEventListener("click", () => goTo(current + 1, true));
  carousel.addEventListener("pointerdown", stopAutoPlay, { passive: true });
  carousel.addEventListener("pointerup", startAutoPlay, { passive: true });
  carousel.addEventListener("pointercancel", startAutoPlay, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAutoPlay();
    else startAutoPlay();
  });
  window.addEventListener("resize", () => centerPhysical(physicalIndexFor(current), "auto"), { passive: true });

  updateDots();
  requestAnimationFrame(() => requestAnimationFrame(() => centerPhysical(physicalIndexFor(0), "auto")));
  startAutoPlay();
})();

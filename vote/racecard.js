(() => {
  "use strict";

  const init = () => {
    document.querySelectorAll(".table-scroll").forEach((scroller) => {
      let startX = 0;
      let startY = 0;
      let direction = "";

      const maxScrollLeft = () => Math.max(0, scroller.scrollWidth - scroller.clientWidth);

      scroller.addEventListener("touchstart", (event) => {
        if (event.touches.length !== 1) return;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
        direction = "";
        const max = maxScrollLeft();
        if (scroller.scrollLeft < 0) scroller.scrollLeft = 0;
        if (scroller.scrollLeft > max) scroller.scrollLeft = max;
      }, { passive: true });

      scroller.addEventListener("touchmove", (event) => {
        if (event.touches.length !== 1) return;
        const dx = event.touches[0].clientX - startX;
        const dy = event.touches[0].clientY - startY;

        if (!direction && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
          direction = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        }
        if (direction !== "x") return;

        const max = maxScrollLeft();
        const atStart = scroller.scrollLeft <= 0;
        const atEnd = scroller.scrollLeft >= max - 1;

        if ((atStart && dx > 0) || (atEnd && dx < 0)) {
          event.preventDefault();
          scroller.scrollLeft = atStart ? 0 : max;
        }
      }, { passive: false });

      scroller.addEventListener("touchend", () => {
        const max = maxScrollLeft();
        scroller.scrollLeft = Math.min(max, Math.max(0, scroller.scrollLeft));
        direction = "";
      }, { passive: true });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

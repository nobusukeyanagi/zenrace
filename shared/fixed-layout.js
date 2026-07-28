(() => {
  "use strict";

  const root = document.documentElement;

  // 全ページ共通: ピンチ操作・ダブルタップ・Ctrl+ホイールによる拡大縮小を無効化する。
  if (!window.__ZENRACE_PINCH_DISABLED__) {
    window.__ZENRACE_PINCH_DISABLED__ = true;

    const stopZoom = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const stopPinch = (event) => {
      if (event.touches && event.touches.length < 2) return;
      stopZoom(event);
    };

    for (const type of ["touchstart", "touchmove"]) {
      window.addEventListener(type, stopPinch, { capture: true, passive: false });
    }
    for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
      window.addEventListener(type, stopZoom, { capture: true, passive: false });
    }

    let lastTouchEndAt = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    window.addEventListener("touchend", (event) => {
      if (!event.changedTouches || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      const now = Date.now();
      const isDoubleTap =
        now - lastTouchEndAt > 0 &&
        now - lastTouchEndAt <= 350 &&
        Math.abs(touch.clientX - lastTouchX) <= 28 &&
        Math.abs(touch.clientY - lastTouchY) <= 28;

      if (isDoubleTap) {
        stopZoom(event);
        lastTouchEndAt = 0;
        return;
      }

      lastTouchEndAt = now;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
    }, { capture: true, passive: false });

    window.addEventListener("dblclick", stopZoom, { capture: true, passive: false });
    window.addEventListener("wheel", (event) => {
      if (!event.ctrlKey) return;
      stopZoom(event);
    }, { capture: true, passive: false });

    const setTouchAction = () => {
      document.documentElement.style.touchAction = "manipulation";
      if (document.body) document.body.style.touchAction = "manipulation";
    };
    setTouchAction();
    document.addEventListener("DOMContentLoaded", setTouchAction, { once: true });
  }
  root.style.setProperty("--page-content-scale", "1");

  const normalizeViewportInset = (value) => {
    const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
    // iOS Safari can briefly report a fractional offset around 0px while
    // switching pages. Rounding that value made otherwise identical pages
    // alternate between 0px and 1px. Treat tiny offsets as zero and snap
    // larger values to a stable device-independent pixel.
    if (safeValue < 1.5) return 0;
    return Math.round(safeValue);
  };

  const syncVisualViewport = () => {
    const viewport = window.visualViewport;
    const layoutHeight = Math.max(root.clientHeight, window.innerHeight || 0);
    const rawTop = viewport ? viewport.offsetTop : 0;
    const top = normalizeViewportInset(rawTop);
    const visibleHeight = viewport ? viewport.height : (window.innerHeight || layoutHeight);
    const rawBottom = viewport ? Math.max(0, layoutHeight - visibleHeight - Math.max(0, rawTop)) : 0;
    const bottom = normalizeViewportInset(rawBottom);
    root.style.setProperty("--visual-top", `${top}px`);
    root.style.setProperty("--visual-bottom", `${bottom}px`);
  };

  syncVisualViewport();
  window.addEventListener("resize", syncVisualViewport, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(syncVisualViewport, 80), { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncVisualViewport, { passive: true });
    window.visualViewport.addEventListener("scroll", syncVisualViewport, { passive: true });
  }

  const shell = document.querySelector("[data-zenrace-pinch-shell]");
  const sizer = document.querySelector("[data-zenrace-pinch-sizer]");
  const stage = document.querySelector("[data-zenrace-pinch-stage]");
  if (!shell || !sizer || !stage) return;

  let baseWidth = 0;
  const measure = (resetWidth = false) => {
    if (resetWidth || !baseWidth) baseWidth = shell.clientWidth;
    stage.style.width = `${baseWidth}px`;
    requestAnimationFrame(() => {
      const contentWidth = Math.max(baseWidth, stage.scrollWidth);
      const contentHeight = Math.max(1, stage.scrollHeight);
      sizer.style.width = `${Math.max(shell.clientWidth, contentWidth)}px`;
      sizer.style.height = `${Math.max(shell.clientHeight, contentHeight)}px`;
      shell.scrollLeft = Math.min(shell.scrollLeft, Math.max(0, sizer.scrollWidth - shell.clientWidth));
      shell.scrollTop = Math.min(shell.scrollTop, Math.max(0, sizer.scrollHeight - shell.clientHeight));
    });
  };

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(stage);
  }
  window.addEventListener("resize", () => measure(true), { passive: true });
  window.addEventListener("load", () => measure(true), { once: true });
  measure(true);
})();

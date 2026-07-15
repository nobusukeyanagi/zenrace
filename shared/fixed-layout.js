(() => {
  "use strict";

  const root = document.documentElement;
  const shell = document.querySelector("[data-zenrace-pinch-shell]");
  const sizer = document.querySelector("[data-zenrace-pinch-sizer]");
  const stage = document.querySelector("[data-zenrace-pinch-stage]");

  const syncVisualViewport = () => {
    const viewport = window.visualViewport;
    const layoutHeight = Math.max(root.clientHeight, window.innerHeight || 0);
    const top = viewport ? Math.max(0, viewport.offsetTop) : 0;
    const visibleHeight = viewport ? viewport.height : (window.innerHeight || layoutHeight);
    const bottom = viewport ? Math.max(0, layoutHeight - visibleHeight - top) : 0;
    root.style.setProperty("--visual-top", `${Math.round(top)}px`);
    root.style.setProperty("--visual-bottom", `${Math.round(bottom)}px`);
  };

  syncVisualViewport();
  window.addEventListener("resize", syncVisualViewport, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(syncVisualViewport, 80), { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncVisualViewport, { passive: true });
    window.visualViewport.addEventListener("scroll", syncVisualViewport, { passive: true });
  }

  // Safariのページ全体ズームを止め、下の独自ズームだけを使う。
  const stopNativeGesture = (event) => event.preventDefault();
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(type, stopNativeGesture, { passive: false });
  }

  const header = document.querySelector(".topbar");
  if (header) {
    header.addEventListener("touchstart", (event) => {
      if (event.touches.length > 1) event.preventDefault();
    }, { passive: false });
    header.addEventListener("touchmove", (event) => {
      if (event.touches.length > 1) event.preventDefault();
    }, { passive: false });
  }

  if (!shell || !sizer || !stage) return;

  const zoom = {
    scale: 1,
    min: 0.72,
    max: 1.9,
    baseWidth: 0,
    startScale: 1,
    startDistance: 0,
    active: false,
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const distance = (touches) => Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY,
  );
  const center = (touches, rect) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
    y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
  });

  const measure = (resetWidth = false) => {
    if (resetWidth || !zoom.baseWidth) zoom.baseWidth = shell.clientWidth;
    stage.style.width = `${zoom.baseWidth}px`;

    requestAnimationFrame(() => {
      const contentWidth = Math.max(zoom.baseWidth, stage.scrollWidth);
      const contentHeight = Math.max(1, stage.scrollHeight);
      sizer.style.width = `${Math.max(shell.clientWidth, contentWidth * zoom.scale)}px`;
      sizer.style.height = `${Math.max(shell.clientHeight, contentHeight * zoom.scale)}px`;

      const maxLeft = Math.max(0, sizer.scrollWidth - shell.clientWidth);
      const maxTop = Math.max(0, sizer.scrollHeight - shell.clientHeight);
      shell.scrollLeft = clamp(shell.scrollLeft, 0, maxLeft);
      shell.scrollTop = clamp(shell.scrollTop, 0, maxTop);
    });
  };

  const setScale = (nextScale, pinchCenter) => {
    const oldScale = zoom.scale;
    const newScale = clamp(nextScale, zoom.min, zoom.max);
    const x = pinchCenter?.x ?? shell.clientWidth / 2;
    const y = pinchCenter?.y ?? shell.clientHeight / 2;
    const contentX = (shell.scrollLeft + x) / oldScale;
    const contentY = (shell.scrollTop + y) / oldScale;

    zoom.scale = newScale;
    root.style.setProperty("--page-content-scale", String(newScale));
    measure(false);
    shell.scrollLeft = contentX * newScale - x;
    shell.scrollTop = contentY * newScale - y;
  };

  shell.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 2) return;
    zoom.active = true;
    zoom.startDistance = distance(event.touches);
    zoom.startScale = zoom.scale;
  }, { passive: true });

  shell.addEventListener("touchmove", (event) => {
    if (!zoom.active || event.touches.length !== 2) return;
    event.preventDefault();
    const rect = shell.getBoundingClientRect();
    const ratio = distance(event.touches) / Math.max(1, zoom.startDistance);
    setScale(zoom.startScale * ratio, center(event.touches, rect));
  }, { passive: false });

  const finishPinch = (event) => {
    if (!event.touches || event.touches.length < 2) zoom.active = false;
  };
  shell.addEventListener("touchend", finishPinch, { passive: true });
  shell.addEventListener("touchcancel", finishPinch, { passive: true });

  shell.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const rect = shell.getBoundingClientRect();
    setScale(zoom.scale * Math.exp(-event.deltaY * 0.003), {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }, { passive: false });

  const observer = new ResizeObserver(() => measure(false));
  observer.observe(stage);
  window.addEventListener("resize", () => measure(true), { passive: true });
  window.addEventListener("load", () => measure(true), { once: true });
  measure(true);
})();

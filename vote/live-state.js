(() => {
  "use strict";

  const LIVE_STATE_KEY = "zenrace:vote:live-video-visible";
  let observer = null;

  const readLiveState = () => {
    try {
      return window.sessionStorage.getItem(LIVE_STATE_KEY) === "true";
    } catch (_error) {
      return false;
    }
  };

  const writeLiveState = (open) => {
    try {
      window.sessionStorage.setItem(LIVE_STATE_KEY, String(open));
    } catch (_error) {
      // Storage may be unavailable in restrictive browser modes.
    }
  };

  const getLiveElements = () => {
    const raceInfo = document.querySelector("zenrace-race-info");
    if (!raceInfo) return null;

    const button = raceInfo.querySelector(".race-live-button");
    const video = raceInfo.querySelector(".race-info-video");
    if (!button || !video) return null;

    return { button, video };
  };

  const syncLiveState = () => {
    const elements = getLiveElements();
    if (!elements) return false;

    const { button, video } = elements;
    const shouldOpen = readLiveState();
    const isOpen = !video.hidden;
    if (shouldOpen !== isOpen) button.click();
    return true;
  };

  const bindLiveState = () => {
    const elements = getLiveElements();
    if (!elements) return false;

    const { button, video } = elements;
    if (button.dataset.liveStateBound !== "true") {
      button.dataset.liveStateBound = "true";
      button.addEventListener("click", () => {
        queueMicrotask(() => writeLiveState(!video.hidden));
      });
    }

    syncLiveState();
    observer?.disconnect();
    observer = null;
    return true;
  };

  const waitForRaceInfo = () => {
    if (bindLiveState()) return;

    observer = new MutationObserver(() => {
      bindLiveState();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForRaceInfo, { once: true });
  } else {
    waitForRaceInfo();
  }

  window.addEventListener("pageshow", () => {
    bindLiveState();
  });
})();

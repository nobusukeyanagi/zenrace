(() => {
  "use strict";

  const RECEIVED_KEY = "zenrace:vote-received:v1";
  const popup = document.getElementById("vote-received-popup");
  if (!popup) return;

  const params = new URLSearchParams(window.location.search);
  let shouldShow = params.get("vote") === "accepted";
  try {
    shouldShow = shouldShow || Boolean(sessionStorage.getItem(RECEIVED_KEY));
    sessionStorage.removeItem(RECEIVED_KEY);
  } catch (error) {
    console.warn("投票受付表示を読み込めませんでした。", error);
  }

  if (params.has("vote")) {
    params.delete("vote");
    const nextQuery = params.toString();
    const cleanUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", cleanUrl);
  }

  if (!shouldShow) return;

  popup.hidden = false;
  window.requestAnimationFrame(() => popup.classList.add("is-visible"));
  window.setTimeout(() => {
    popup.classList.remove("is-visible");
    window.setTimeout(() => { popup.hidden = true; }, 180);
  }, 2000);
})();

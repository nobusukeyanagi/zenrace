(() => {
  "use strict";

  const preferences = window.ZENRACE_SPORT_PREFERENCES;
  if (!preferences) return;

  const sync = () => {
    const enabled = new Set(preferences.read());
    document.querySelectorAll("[data-sport-preference]").forEach((checkbox) => {
      checkbox.checked = enabled.has(checkbox.value);
    });
  };

  const save = () => {
    const enabled = [...document.querySelectorAll("[data-sport-preference]:checked")]
      .map((checkbox) => checkbox.value);
    preferences.write(enabled);
  };

  document.addEventListener("DOMContentLoaded", () => {
    sync();
    document.querySelectorAll("[data-sport-preference]").forEach((checkbox) => {
      checkbox.addEventListener("change", save);
    });
  });

  window.addEventListener("pageshow", sync);
  window.addEventListener("zenrace:sport-preferences-change", sync);
})();

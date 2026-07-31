(() => {
  "use strict";

  if (window.ZENRACE_SPORT_PREFERENCES) return;

  const STORAGE_KEY = "zenrace:sport-preferences:v1";
  const SPORTS = Object.freeze([
    Object.freeze({ id: "keirin", label: "競輪" }),
    Object.freeze({ id: "auto", label: "オートレース" }),
    Object.freeze({ id: "boat", label: "ボートレース" }),
    Object.freeze({ id: "nar", label: "地方競馬" }),
    Object.freeze({ id: "jra", label: "JRA" }),
  ]);
  const SPORT_IDS = Object.freeze(SPORTS.map(({ id }) => id));
  const VALID_SPORTS = new Set(SPORT_IDS);

  const normalize = (value) => {
    const source = Array.isArray(value)
      ? value
      : value && typeof value === "object"
        ? Object.entries(value).filter(([, enabled]) => Boolean(enabled)).map(([sport]) => sport)
        : [];
    const selected = new Set(source.map(String).filter((sport) => VALID_SPORTS.has(sport)));
    return SPORT_IDS.filter((sport) => selected.has(sport));
  };

  const read = () => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === null) return [...SPORT_IDS];
      return normalize(JSON.parse(stored));
    } catch (error) {
      console.warn("競技種設定を読み込めませんでした。", error);
      return [...SPORT_IDS];
    }
  };

  const notify = (enabledSports, source = "local") => {
    window.dispatchEvent(new CustomEvent("zenrace:sport-preferences-change", {
      detail: { enabledSports: [...enabledSports], source },
    }));
  };

  const write = (value) => {
    const enabledSports = normalize(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(enabledSports));
    } catch (error) {
      console.warn("競技種設定を保存できませんでした。", error);
    }
    notify(enabledSports);
    return enabledSports;
  };

  const isEnabled = (sport, enabledSports = read()) => enabledSports.includes(String(sport));
  const filter = (items, enabledSports = read()) => {
    if (!Array.isArray(items)) return [];
    const enabled = new Set(enabledSports);
    return items.filter((item) => enabled.has(String(item?.sport || "")));
  };

  window.ZENRACE_SPORT_PREFERENCES = Object.freeze({
    STORAGE_KEY,
    SPORTS,
    SPORT_IDS,
    read,
    write,
    normalize,
    isEnabled,
    filter,
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    notify(read(), "storage");
  });
})();

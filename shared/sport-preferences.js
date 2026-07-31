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

  const uniqueSports = (value) => {
    const result = [];
    const seen = new Set();
    (Array.isArray(value) ? value : []).forEach((sport) => {
      const id = String(sport);
      if (!VALID_SPORTS.has(id) || seen.has(id)) return;
      seen.add(id);
      result.push(id);
    });
    return result;
  };

  const completeOrder = (value) => {
    const order = uniqueSports(value);
    SPORT_IDS.forEach((sport) => {
      if (!order.includes(sport)) order.push(sport);
    });
    return order;
  };

  const normalizeState = (value) => {
    if (Array.isArray(value)) {
      // v1の保存形式（選択中の競技配列）から移行する場合は、
      // 既存利用者の表示順を意図せず変えないよう標準順を維持する。
      const enabledSet = new Set(uniqueSports(value));
      const order = [...SPORT_IDS];
      return {
        order,
        enabled: order.filter((sport) => enabledSet.has(sport)),
      };
    }

    if (value && typeof value === "object" && (Array.isArray(value.order) || Array.isArray(value.enabled))) {
      const order = completeOrder(value.order);
      const enabledSet = new Set(uniqueSports(value.enabled));
      return {
        order,
        enabled: order.filter((sport) => enabledSet.has(sport)),
      };
    }

    if (value && typeof value === "object") {
      const enabledSet = new Set(
        Object.entries(value)
          .filter(([, enabled]) => Boolean(enabled))
          .map(([sport]) => sport)
          .filter((sport) => VALID_SPORTS.has(sport)),
      );
      const order = [...SPORT_IDS];
      return {
        order,
        enabled: order.filter((sport) => enabledSet.has(sport)),
      };
    }

    return { order: [...SPORT_IDS], enabled: [...SPORT_IDS] };
  };

  const readState = () => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === null) return normalizeState(null);
      return normalizeState(JSON.parse(stored));
    } catch (error) {
      console.warn("競技種設定を読み込めませんでした。", error);
      return normalizeState(null);
    }
  };

  const read = () => [...readState().enabled];
  const readOrder = () => [...readState().order];

  const notify = (state, source = "local") => {
    window.dispatchEvent(new CustomEvent("zenrace:sport-preferences-change", {
      detail: {
        enabledSports: [...state.enabled],
        sportOrder: [...state.order],
        source,
      },
    }));
  };

  const persist = (state) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("競技種設定を保存できませんでした。", error);
    }
    notify(state);
    return state;
  };

  const writeState = (value) => persist(normalizeState(value));

  const write = (value) => {
    const current = readState();
    const enabledSet = new Set(uniqueSports(value));
    return writeState({
      order: current.order,
      enabled: current.order.filter((sport) => enabledSet.has(sport)),
    }).enabled;
  };

  const normalize = (value) => normalizeState(value).enabled;
  const isEnabled = (sport, enabledSports = read()) => enabledSports.includes(String(sport));

  const sortBySportOrder = (items, sportOrder = readOrder()) => {
    if (!Array.isArray(items)) return [];
    const rank = new Map(completeOrder(sportOrder).map((sport, index) => [sport, index]));
    return items
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const leftRank = rank.get(String(left.item?.sport || "")) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = rank.get(String(right.item?.sport || "")) ?? Number.MAX_SAFE_INTEGER;
        return leftRank - rightRank || left.index - right.index;
      })
      .map(({ item }) => item);
  };

  const filter = (items, enabledSports = read()) => {
    if (!Array.isArray(items)) return [];
    const enabled = uniqueSports(enabledSports);
    const enabledSet = new Set(enabled);
    return sortBySportOrder(
      items.filter((item) => enabledSet.has(String(item?.sport || ""))),
      enabled,
    );
  };

  window.ZENRACE_SPORT_PREFERENCES = Object.freeze({
    STORAGE_KEY,
    SPORTS,
    SPORT_IDS,
    read,
    readOrder,
    readState,
    write,
    writeState,
    normalize,
    normalizeState,
    isEnabled,
    order: sortBySportOrder,
    filter,
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    notify(readState(), "storage");
  });
})();

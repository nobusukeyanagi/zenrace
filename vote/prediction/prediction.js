(() => {
  "use strict";

  const ODDS_DATA = window.ZENRACE_ODDS_DATA || {};
  const CONFIRM_STORAGE_KEY = "zenrace:bet-confirmation:v1";
  const FORECASTS = {
    immediate: {
      label: "スパコン直前予想",
      confidence: "★☆☆☆☆",
      bets: [[5, 4], [4, 5], [5, 1]],
    },
    previous: {
      label: "スパコン前日予想",
      confidence: null,
      bets: [[1, 3], [1, 6], [3, 6]],
    },
  };

  const state = {
    forecast: "immediate",
    selected: new Map(),
  };

  const menuButtons = Array.from(document.querySelectorAll("[data-forecast]"));
  const panel = document.querySelector(".prediction-ticket-panel");
  const list = document.getElementById("prediction-ticket-list");
  const confidence = document.getElementById("prediction-confidence");
  const confirmButton = document.getElementById("prediction-confirm");

  function normalizedCars(cars) {
    return (cars || []).map(Number).filter((car) => Number.isInteger(car) && car >= 1 && car <= 8);
  }

  function selectionKey(cars) {
    return `2連単:${normalizedCars(cars).join("-")}`;
  }

  function findRecord(cars) {
    const key = normalizedCars(cars).join("-");
    return (ODDS_DATA["2連単"] || []).find((record) => record.cars.join("-") === key) || null;
  }

  function carBadge(car) {
    return `<span aria-label="${car}号車" class="prediction-car car-${car}">${car}</span>`;
  }

  function betHtml(cars) {
    const key = selectionKey(cars);
    const selected = state.selected.has(key);
    return `<button class="prediction-ticket${selected ? " is-selected" : ""}" type="button" data-prediction-cars="${cars.join(",")}" aria-pressed="${selected}">${carBadge(cars[0])}<span class="prediction-separator" aria-hidden="true">-</span>${carBadge(cars[1])}</button>`;
  }

  function updateConfirmButton() {
    const hasSelection = state.selected.size > 0;
    confirmButton.hidden = !hasSelection;
    document.body.classList.toggle("has-prediction-selection", hasSelection);
  }

  function render() {
    const forecast = FORECASTS[state.forecast];
    menuButtons.forEach((button) => {
      const active = button.dataset.forecast === state.forecast;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    panel.classList.toggle("is-previous", state.forecast === "previous");
    if (forecast.confidence) {
      confidence.hidden = false;
      confidence.querySelector(".prediction-confidence").setAttribute("aria-label", `自信度 ${forecast.confidence}`);
    } else {
      confidence.hidden = true;
    }
    list.innerHTML = forecast.bets.map(betHtml).join("");
    updateConfirmButton();
  }

  function toggleSelection(cars) {
    const values = normalizedCars(cars);
    if (values.length !== 2) return;
    const key = selectionKey(values);
    if (state.selected.has(key)) {
      state.selected.delete(key);
    } else {
      const record = findRecord(values);
      if (!record) return;
      state.selected.set(key, { cars: values, record });
    }
    render();
  }

  function restoreSelections() {
    try {
      const raw = sessionStorage.getItem(CONFIRM_STORAGE_KEY);
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (!payload || payload.source !== "prediction" || !Array.isArray(payload.groups)) return;
      const group = payload.groups.find((item) => item?.type === "2連単");
      (group?.entries || []).forEach((entry) => {
        if (entry?.removed || Number(entry?.units) <= 0) return;
        const cars = normalizedCars(entry?.cars);
        const record = findRecord(cars);
        if (!record) return;
        state.selected.set(selectionKey(cars), { cars, record });
      });
    } catch (error) {
      console.warn("予想買い目を復元できませんでした。", error);
    }
  }

  function confirmationPayload() {
    const entries = [...state.selected.values()]
      .sort((a, b) => a.cars[0] - b.cars[0] || a.cars[1] - b.cars[1])
      .map((item) => ({
        cars: item.cars.slice(),
        rank: item.record?.rank ?? null,
        odds: item.record?.odds ?? null,
        units: 1,
        removed: false,
      }));
    const first = [...new Set(entries.map((entry) => entry.cars[0]))].sort((a, b) => a - b);
    const second = [...new Set(entries.map((entry) => entry.cars[1]))].sort((a, b) => a - b);
    return {
      version: 1,
      source: "prediction",
      createdAt: new Date().toISOString(),
      selections: { first, second, third: [], box: [] },
      multiReverse: false,
      groups: [{
        type: "2連単",
        generatedCount: entries.length,
        removedCount: 0,
        unit: 1,
        expanded: false,
        directSelection: true,
        selections: { first, second, third: [], box: [] },
        entries,
      }],
    };
  }

  menuButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.forecast;
      if (!FORECASTS[key]) return;
      state.forecast = key;
      render();
    });
  });

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-prediction-cars]");
    if (!button) return;
    toggleSelection(button.dataset.predictionCars.split(","));
  });

  confirmButton.addEventListener("click", () => {
    if (!state.selected.size) return;
    try {
      sessionStorage.setItem(CONFIRM_STORAGE_KEY, JSON.stringify(confirmationPayload()));
    } catch (error) {
      console.warn("予想買い目を投票確認へ保存できませんでした。", error);
    }
    window.location.href = "../bet/confirm/";
  });

  restoreSelections();
  render();
})();

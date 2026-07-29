(() => {
  "use strict";

  const STORAGE_KEY = "zenrace:bet-confirmation:v1";
  const ODDS_DATA = window.ZENRACE_ODDS_DATA || {};
  const groupsRoot = document.getElementById("wager-groups");
  const emptyState = document.getElementById("confirm-empty");
  const submitButton = document.getElementById("vote-submit");
  const toast = document.getElementById("confirm-toast");
  const grandTotal = document.getElementById("grand-total");
  const grandReturn = document.getElementById("grand-return");
  const grandProfit = document.getElementById("grand-profit");

  const BET_ORDER = ["3連単", "3連複", "2連単", "2連複", "ワイド", "単勝"];
  const state = { groups: [] };

  function permutations(values, length) {
    const result = [];
    const walk = (path, rest) => {
      if (path.length === length) {
        result.push(path.slice());
        return;
      }
      rest.forEach((value, index) => walk(path.concat(value), rest.slice(0, index).concat(rest.slice(index + 1))));
    };
    walk([], values.slice());
    return result;
  }

  function oddsKey(type, cars) {
    const values = cars.slice();
    if (["3連複", "2連複", "ワイド"].includes(type)) values.sort((a, b) => a - b);
    return values.join("-");
  }

  const oddsLookup = Object.fromEntries(
    Object.entries(ODDS_DATA).map(([type, records]) => [
      type,
      new Map((records || []).map((record) => [oddsKey(type, record.cars), record])),
    ]),
  );

  function defaultPayload() {
    const cars = [1, 2, 3, 4];
    const entries = permutations(cars, 3).map((combo) => {
      const record = oddsLookup["3連単"]?.get(oddsKey("3連単", combo));
      return { cars: combo, rank: record?.rank ?? null, odds: record?.odds ?? null };
    });
    return {
      selections: { first: cars, second: cars, third: cars, box: cars },
      groups: [{ type: "3連単", generatedCount: entries.length, removedCount: 0, entries }],
    };
  }

  function readPayload() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultPayload();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.groups) || !parsed.groups.length) return defaultPayload();
      return parsed;
    } catch (error) {
      console.warn("投票確認データを読み込めませんでした。", error);
      return defaultPayload();
    }
  }

  function numericCars(values) {
    return [...new Set((values || []).map(Number).filter((value) => Number.isInteger(value) && value >= 1 && value <= 8))].sort((a, b) => a - b);
  }

  function normalizeEntry(type, entry) {
    const cars = [...new Set((entry?.cars || []).map(Number).filter((value) => Number.isInteger(value) && value >= 1 && value <= 8))];
    const record = oddsLookup[type]?.get(oddsKey(type, cars));
    return {
      cars,
      rank: Number(entry?.rank ?? record?.rank) || null,
      odds: entry?.odds ?? record?.odds ?? null,
      units: Math.max(1, Number(entry?.units) || 1),
    };
  }

  function normalizePayload(payload) {
    const selections = {
      first: numericCars(payload?.selections?.first),
      second: numericCars(payload?.selections?.second),
      third: numericCars(payload?.selections?.third),
      box: numericCars(payload?.selections?.box),
    };
    const groups = (payload.groups || [])
      .filter((group) => BET_ORDER.includes(group?.type))
      .map((group) => ({
        type: group.type,
        selections,
        generatedCount: Math.max(0, Number(group.generatedCount) || 0),
        removedCount: Math.max(0, Number(group.removedCount) || 0),
        unit: 1,
        expanded: false,
        entries: (group.entries || []).map((entry) => normalizeEntry(group.type, entry)).filter((entry) => entry.cars.length),
      }))
      .filter((group) => group.entries.length)
      .sort((a, b) => BET_ORDER.indexOf(a.type) - BET_ORDER.indexOf(b.type));
    return groups;
  }

  function carBadge(car) {
    return `<span class="confirm-car car-${car}">${car}</span>`;
  }

  function positionRows(group) {
    const { type, selections } = group;
    const entryCars = numericCars(group.entries.flatMap((entry) => entry.cars));
    const box = selections.box.length ? selections.box : entryCars;
    let rows;
    if (type === "単勝") {
      rows = [["1着", numericCars([...selections.first, ...selections.second, ...selections.third, ...selections.box, ...entryCars])]];
    } else if (["2連複", "ワイド"].includes(type)) {
      const source = box.length >= 2 ? box : entryCars;
      rows = [["1着", source], ["2着", source]];
    } else if (type === "3連複") {
      const source = box.length >= 3 ? box : entryCars;
      rows = [["1着", source], ["2着", source], ["3着", source]];
    } else if (type === "2連単") {
      rows = [["1着", selections.first.length ? selections.first : entryCars], ["2着", selections.second.length ? selections.second : entryCars]];
    } else {
      rows = [
        ["1着", selections.first.length ? selections.first : entryCars],
        ["2着", selections.second.length ? selections.second : entryCars],
        ["3着", selections.third.length ? selections.third : entryCars],
      ];
    }
    return rows.map(([label, cars]) => `
      <div class="position-row">
        <span class="position-label">${label}</span>
        <span class="position-cars">${numericCars(cars).map(carBadge).join("")}</span>
      </div>`).join("");
  }

  function formatNumber(value) {
    return Math.round(Number(value) || 0).toLocaleString("ja-JP");
  }

  function formatOddsValue(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "－";
    return number >= 1000 ? String(Math.round(number)) : number.toFixed(1);
  }

  function oddsRange(entry, type) {
    if (type === "ワイド") {
      const values = Array.isArray(entry.odds) ? entry.odds : [entry.odds, entry.odds];
      const min = Number(values[0]);
      const max = Number(values[1] ?? values[0]);
      return [Number.isFinite(min) ? min : 0, Number.isFinite(max) ? max : 0];
    }
    const value = Number(entry.odds);
    return [Number.isFinite(value) ? value : 0, Number.isFinite(value) ? value : 0];
  }

  function displayOdds(entry, type) {
    const [min] = oddsRange(entry, type);
    return formatOddsValue(min);
  }

  function signedMoney(value) {
    const number = Math.round(Number(value) || 0);
    if (number > 0) return `+${formatNumber(number)}`;
    if (number < 0) return `−${formatNumber(Math.abs(number))}`;
    return "0";
  }

  function rangeText(min, max, suffix = "円") {
    const roundedMin = Math.round(min);
    const roundedMax = Math.round(max);
    if (roundedMin === roundedMax) return `${formatNumber(roundedMin)}${suffix}`;
    return `${formatNumber(roundedMin)}～${formatNumber(roundedMax)}${suffix}`;
  }

  function signedRangeText(min, max) {
    const roundedMin = Math.round(min);
    const roundedMax = Math.round(max);
    if (roundedMin === roundedMax) return signedMoney(roundedMin);
    return `${signedMoney(roundedMin)}～${signedMoney(roundedMax)}`;
  }

  function groupMetrics(group) {
    const stake = group.entries.reduce((sum, entry) => sum + entry.units * 100, 0);
    const payouts = group.entries
      .filter((entry) => entry.units > 0)
      .map((entry) => {
        const [minOdds, maxOdds] = oddsRange(entry, group.type);
        return [minOdds * entry.units * 100, maxOdds * entry.units * 100];
      });
    const minReturn = payouts.length ? Math.min(...payouts.map(([min]) => min)) : 0;
    const maxReturn = payouts.length ? Math.max(...payouts.map(([, max]) => max)) : 0;
    return { stake, minReturn, maxReturn };
  }

  function profitClass(min, max) {
    if (max < 0) return "is-negative";
    if (min > 0) return "is-positive";
    return "";
  }

  function detailRows(group, groupIndex) {
    return group.entries.map((entry, entryIndex) => {
      const [minOdds, maxOdds] = oddsRange(entry, group.type);
      const minReturn = minOdds * entry.units * 100;
      const maxReturn = maxOdds * entry.units * 100;
      const totalStake = state.groups.reduce((sum, current) => sum + groupMetrics(current).stake, 0);
      const minProfit = minReturn - totalStake;
      const maxProfit = maxReturn - totalStake;
      return `
        <div class="detail-row" data-entry-index="${entryIndex}">
          <div>
            <div class="detail-combo">${entry.cars.map(carBadge).join("")}</div>
            <div class="detail-odds">${displayOdds(entry, group.type)}</div>
          </div>
          <div class="detail-value">
            <div class="detail-return">${rangeText(minReturn, maxReturn)}</div>
            <div class="detail-profit ${profitClass(minProfit, maxProfit)}">${signedRangeText(minProfit, maxProfit)}</div>
          </div>
          <div class="point-stepper" aria-label="点数選択">
            <button type="button" data-step="-1" data-group-index="${groupIndex}" data-entry-index="${entryIndex}" aria-label="点数を減らす">−</button>
            <input type="number" min="1" max="99" value="${entry.units}" data-entry-units data-group-index="${groupIndex}" data-entry-index="${entryIndex}" aria-label="点数">
            <button type="button" data-step="1" data-group-index="${groupIndex}" data-entry-index="${entryIndex}" aria-label="点数を増やす">＋</button>
          </div>
        </div>`;
    }).join("");
  }

  function cardHtml(group, index) {
    const metrics = groupMetrics(group);
    const totalStake = state.groups.reduce((sum, current) => sum + groupMetrics(current).stake, 0);
    const minProfit = metrics.minReturn - totalStake;
    const maxProfit = metrics.maxReturn - totalStake;
    const excluded = group.removedCount > 0
      ? `<div class="excluded-note">このうち${group.removedCount}点を除く</div>`
      : "";
    return `
      <section class="wager-card" data-group-index="${index}" aria-label="${group.type}の投票内容">
        <div class="wager-head">
          <strong class="wager-title">${group.type}</strong>
          <strong class="wager-count">${group.entries.length}組</strong>
          <label class="wager-unit">各 <input type="number" min="1" max="99" value="${group.unit}" data-group-unit data-group-index="${index}" aria-label="各使用ポイント"> 00pt</label>
          <button class="wager-delete" type="button" data-delete-group="${index}" aria-label="${group.type}を消す">消</button>
        </div>
        <div class="position-table">${positionRows(group)}</div>
        ${excluded}
        <div class="wager-summary">
          <div class="summary-line"><span>合計</span><strong data-group-total>${formatNumber(metrics.stake)}pt</strong></div>
          <div class="summary-line"><span>想定払戻</span><strong data-group-return>${rangeText(metrics.minReturn, metrics.maxReturn)}</strong></div>
          <div class="summary-line"><span>想定収支</span><strong class="${profitClass(minProfit, maxProfit)}" data-group-profit>${signedRangeText(minProfit, maxProfit)}</strong></div>
        </div>
        <button class="expand-button" type="button" data-toggle-details="${index}" aria-expanded="${group.expanded}">${group.expanded ? "閉じる" : "展開する"}</button>
        <div class="wager-details" data-details="${index}" ${group.expanded ? "" : "hidden"}>${detailRows(group, index)}</div>
      </section>`;
  }

  function render() {
    if (!state.groups.length) {
      groupsRoot.innerHTML = "";
      emptyState.hidden = false;
      submitButton.hidden = true;
      updateGrandSummary();
      return;
    }
    emptyState.hidden = true;
    submitButton.hidden = false;
    groupsRoot.innerHTML = state.groups.map(cardHtml).join("");
    bindControls();
    updateGrandSummary();
  }

  function updateGrandSummary() {
    const metrics = state.groups.map(groupMetrics);
    const totalStake = metrics.reduce((sum, item) => sum + item.stake, 0);
    const minReturn = metrics.reduce((sum, item) => sum + item.minReturn, 0);
    const maxReturn = metrics.reduce((sum, item) => sum + item.maxReturn, 0);
    const minProfit = minReturn - totalStake;
    const maxProfit = maxReturn - totalStake;
    grandTotal.textContent = `${formatNumber(totalStake)}pt`;
    grandReturn.textContent = rangeText(minReturn, maxReturn);
    grandProfit.textContent = signedRangeText(minProfit, maxProfit);
    grandProfit.className = profitClass(minProfit, maxProfit);
  }

  function setEntryUnits(groupIndex, entryIndex, nextValue) {
    const group = state.groups[groupIndex];
    const entry = group?.entries[entryIndex];
    if (!entry) return;
    entry.units = Math.min(99, Math.max(1, Number(nextValue) || 1));
    render();
  }

  function bindControls() {
    groupsRoot.querySelectorAll("[data-group-unit]").forEach((input) => {
      input.addEventListener("change", () => {
        const groupIndex = Number(input.dataset.groupIndex);
        const value = Math.min(99, Math.max(1, Number(input.value) || 1));
        const group = state.groups[groupIndex];
        if (!group) return;
        group.unit = value;
        group.entries.forEach((entry) => { entry.units = value; });
        render();
      });
    });

    groupsRoot.querySelectorAll("[data-delete-group]").forEach((button) => {
      button.addEventListener("click", () => {
        state.groups.splice(Number(button.dataset.deleteGroup), 1);
        render();
      });
    });

    groupsRoot.querySelectorAll("[data-toggle-details]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.toggleDetails);
        if (!state.groups[index]) return;
        state.groups[index].expanded = !state.groups[index].expanded;
        render();
      });
    });

    groupsRoot.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () => {
        const groupIndex = Number(button.dataset.groupIndex);
        const entryIndex = Number(button.dataset.entryIndex);
        const entry = state.groups[groupIndex]?.entries[entryIndex];
        if (!entry) return;
        setEntryUnits(groupIndex, entryIndex, entry.units + Number(button.dataset.step));
      });
    });

    groupsRoot.querySelectorAll("[data-entry-units]").forEach((input) => {
      input.addEventListener("change", () => setEntryUnits(Number(input.dataset.groupIndex), Number(input.dataset.entryIndex), input.value));
    });
  }

  submitButton.addEventListener("click", () => {
    toast.hidden = false;
    clearTimeout(window.__zenraceConfirmToastTimer);
    window.__zenraceConfirmToastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
  });

  state.groups = normalizePayload(readPayload());
  render();
})();

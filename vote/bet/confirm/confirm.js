(() => {
  "use strict";

  const STORAGE_KEY = "zenrace:bet-confirmation:v1";
  const RECEIVED_KEY = "zenrace:vote-received:v1";
  const ODDS_DATA = window.ZENRACE_ODDS_DATA || {};
  const groupsRoot = document.getElementById("wager-groups");
  const submitButton = document.getElementById("vote-submit");
  const grandTotal = document.getElementById("grand-total");
  const grandReturn = document.getElementById("grand-return");
  const grandProfit = document.getElementById("grand-profit");

  const BET_ORDER = ["3連単", "3連複", "2連単", "2連複", "ワイド", "単勝"];
  const state = { groups: [], selections: { first: [], second: [], third: [], box: [] }, multiReverse: false };

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
    const rawUnits = Number(entry?.units);
    const units = Number.isFinite(rawUnits)
      ? Math.min(99, Math.max(0, rawUnits))
      : entry?.removed ? 0 : 1;
    return {
      cars,
      rank: Number(entry?.rank ?? record?.rank) || null,
      odds: entry?.odds ?? record?.odds ?? null,
      units,
      removed: Boolean(entry?.removed) || units === 0,
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
      .map((group) => {
        const groupSelections = {
          first: numericCars(group?.selections?.first ?? selections.first),
          second: numericCars(group?.selections?.second ?? selections.second),
          third: numericCars(group?.selections?.third ?? selections.third),
          box: numericCars(group?.selections?.box ?? selections.box),
        };
        const entries = (group.entries || []).map((entry) => normalizeEntry(group.type, entry)).filter((entry) => entry.cars.length);
        const generatedCount = Math.max(entries.length, Number(group.generatedCount) || 0);
        const removedCount = Math.max(
          entries.filter((entry) => entry.units === 0).length,
          Number(group.removedCount) || 0,
          generatedCount - entries.length,
        );
        return {
          type: group.type,
          selections: groupSelections,
          generatedCount,
          removedCount,
          unit: Math.min(99, Math.max(1, Number(group.unit) || 1)),
          expanded: Boolean(group.expanded),
          entries,
        };
      })
      .filter((group) => group.entries.length)
      .sort((a, b) => BET_ORDER.indexOf(a.type) - BET_ORDER.indexOf(b.type));
    return groups;
  }

  function carBadge(car) {
    return `<span class="confirm-car car-${car}">${car}</span>`;
  }

  function combinationSeparator(type) {
    if (["3連単", "2連単"].includes(type)) return "-";
    if (["3連複", "2連複", "ワイド"].includes(type)) return "=";
    return "";
  }

  function detailCombinationHtml(type, cars) {
    const separator = combinationSeparator(type);
    return cars.map((car, index) => `${index && separator ? `<span class="detail-combination-separator" aria-hidden="true">${separator}</span>` : ""}${carBadge(car)}`).join("");
  }

  function positionRows(group) {
    const { type, selections } = group;
    const entryCars = numericCars(group.entries.flatMap((entry) => entry.cars));
    const carsAt = (position) => numericCars(group.entries.map((entry) => entry.cars[position]));
    const selectedAt = (key, position) => selections[key].length ? selections[key] : carsAt(position);
    let rows;
    if (type === "単勝") {
      rows = [["1着", selections.first.length ? selections.first : entryCars]];
    } else if (type === "2連単") {
      rows = [["1着", selectedAt("first", 0)], ["2着", selectedAt("second", 1)]];
    } else if (["2連複", "ワイド"].includes(type)) {
      rows = [["1車目", selectedAt("first", 0)], ["2車目", selectedAt("second", 1)]];
    } else if (type === "3連複") {
      rows = [
        ["1車目", selectedAt("first", 0)],
        ["2車目", selectedAt("second", 1)],
        ["3車目", selectedAt("third", 2)],
      ];
    } else {
      rows = [
        ["1着", selectedAt("first", 0)],
        ["2着", selectedAt("second", 1)],
        ["3着", selectedAt("third", 2)],
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

  function oddsToneClass(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    if (number < 10) return " confirm-odds-low";
    if (number >= 1000) return " confirm-odds-high";
    return "";
  }

  function oddsValueHtml(value) {
    return `<span class="${oddsToneClass(value).trim()}">${formatOddsValue(value)}</span>`;
  }

  function displayOdds(entry, type) {
    const [min, max] = oddsRange(entry, type);
    if (type === "ワイド" && min !== max) return `${oddsValueHtml(min)}<span class="detail-odds-range">～</span>${oddsValueHtml(max)}`;
    return oddsValueHtml(min);
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
    return `${formatNumber(roundedMin)} ～ ${formatNumber(roundedMax)}${suffix}`;
  }

  function signedValueHtml(value) {
    const number = Math.round(Number(value) || 0);
    const className = number > 0 ? "is-positive" : number < 0 ? "is-negative" : "";
    return `<span class="${className}">${signedMoney(number)}</span>`;
  }

  function signedRangeHtml(min, max) {
    const roundedMin = Math.round(min);
    const roundedMax = Math.round(max);
    if (roundedMin === roundedMax) return signedValueHtml(roundedMin);
    return `${signedValueHtml(roundedMin)} ～ ${signedValueHtml(roundedMax)}`;
  }

  function profitHtml(min, max) {
    return `<span class="profit-amount">${signedRangeHtml(min, max)}</span><span class="profit-unit">pt</span>`;
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
      const maxReturn = group.type === "ワイド" ? minReturn : maxOdds * entry.units * 100;
      const totalStake = state.groups.reduce((sum, current) => sum + groupMetrics(current).stake, 0);
      const minProfit = minReturn - totalStake;
      const maxProfit = group.type === "ワイド" ? minProfit : maxReturn - totalStake;
      const profitValueHtml = entry.units > 0 ? profitHtml(minProfit, maxProfit) : "";
      return `
        <div class="detail-row${entry.units === 0 ? " is-zero" : ""}" data-entry-index="${entryIndex}">
          <div>
            <div class="detail-combo">${detailCombinationHtml(group.type, entry.cars)}</div>
            <div class="detail-odds">${displayOdds(entry, group.type)}</div>
          </div>
          <div class="detail-value">
            <div class="detail-return">${rangeText(minReturn, maxReturn)}</div>
            <div class="detail-profit"${entry.units > 0 ? "" : " hidden"}>${profitValueHtml}</div>
          </div>
          <div class="point-stepper" aria-label="点数選択">
            <button type="button" data-step="-1" data-group-index="${groupIndex}" data-entry-index="${entryIndex}" aria-label="点数を減らす"${entry.units === 0 ? " disabled" : ""}>－</button>
            <label class="detail-unit"><input type="number" min="0" max="99" value="${entry.units}" data-entry-units data-group-index="${groupIndex}" data-entry-index="${entryIndex}" aria-label="点数"><span>00pt</span></label>
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
    const activeCount = group.entries.filter((entry) => entry.units > 0).length;
    const excludedCount = group.entries.filter((entry) => entry.units === 0).length;
    const excluded = excludedCount > 0
      ? `<div class="excluded-note">このうち${excludedCount}点を除く</div>`
      : "";
    const groupProfit = metrics.stake > 0 ? profitHtml(minProfit, maxProfit) : "";
    return `
      <section class="wager-card" data-group-index="${index}" aria-label="${group.type}の投票内容">
        <div class="wager-head">
          <strong class="wager-title">${group.type}</strong>
          <strong class="wager-count">${activeCount}点</strong>
          <div class="wager-unit">
            <div class="point-stepper group-point-stepper" aria-label="各使用ポイント">
              ${group.unit === 1
                ? `<button class="group-remove-button" type="button" data-remove-group="${index}" aria-label="${group.type}を削除">消</button>`
                : `<button type="button" data-group-step="-1" data-group-index="${index}" aria-label="各使用ポイントを減らす">－</button>`}
              <span class="point-stepper-each">各</span>
              <label class="detail-unit"><input type="number" min="1" max="99" value="${group.unit}" data-group-unit data-group-index="${index}" aria-label="各使用ポイント"><span>00pt</span></label>
              <button type="button" data-group-step="1" data-group-index="${index}" aria-label="各使用ポイントを増やす">＋</button>
            </div>
          </div>
        </div>
        <div class="position-table">${positionRows(group)}</div>
        ${excluded}
        <div class="wager-summary">
          <div class="summary-line"><span>小計</span><strong data-group-total>${formatNumber(metrics.stake)}pt</strong></div>
          <div class="summary-line"><span>想定払戻金</span><strong data-group-return>${rangeText(metrics.minReturn, metrics.maxReturn)}</strong></div>
          <div class="summary-line"><span>合計に対する収支</span><strong data-group-profit>${groupProfit}</strong></div>
        </div>
        <button class="expand-button" type="button" data-toggle-details="${index}" aria-expanded="${group.expanded}">${group.expanded ? "閉じる" : "買い目詳細"}</button>
        <div class="wager-details" data-details="${index}" ${group.expanded ? "" : "hidden"}>${detailRows(group, index)}</div>
      </section>`;
  }

  function storedSelections(payload) {
    const fallback = payload?.groups?.find((group) => group?.selections)?.selections || {};
    const source = payload?.selections || fallback;
    return {
      first: numericCars(source?.first),
      second: numericCars(source?.second),
      third: numericCars(source?.third),
      box: numericCars(source?.box),
    };
  }

  function persistState() {
    const payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      selections: state.selections,
      multiReverse: state.multiReverse,
      groups: state.groups.map((group) => ({
        type: group.type,
        selections: group.selections,
        generatedCount: group.generatedCount,
        removedCount: group.entries.filter((entry) => entry.units === 0).length,
        unit: group.unit,
        expanded: group.expanded,
        entries: group.entries.map((entry) => ({
          cars: entry.cars.slice(),
          rank: entry.rank,
          odds: entry.odds,
          units: entry.units,
          removed: entry.units === 0,
        })),
      })),
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("投票確認データを保存できませんでした。", error);
    }
  }

  function render() {
    persistState();
    if (!state.groups.length) {
      groupsRoot.innerHTML = "";
      submitButton.hidden = true;
      updateGrandSummary();
      return;
    }
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
    grandProfit.innerHTML = totalStake > 0 ? profitHtml(minProfit, maxProfit) : "";
    grandProfit.className = "";
  }

  function setEntryUnits(groupIndex, entryIndex, nextValue) {
    const group = state.groups[groupIndex];
    const entry = group?.entries[entryIndex];
    if (!entry) return;
    const parsed = Number(nextValue);
    entry.units = Math.min(99, Math.max(0, Number.isFinite(parsed) ? parsed : 0));
    entry.removed = entry.units === 0;
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

    groupsRoot.querySelectorAll("[data-group-step]").forEach((button) => {
      button.addEventListener("click", () => {
        const groupIndex = Number(button.dataset.groupIndex);
        const group = state.groups[groupIndex];
        if (!group) return;
        const value = Math.min(99, Math.max(1, group.unit + Number(button.dataset.groupStep)));
        group.unit = value;
        group.entries.forEach((entry) => {
          entry.units = value;
          entry.removed = false;
        });
        render();
      });
    });

    groupsRoot.querySelectorAll("[data-remove-group]").forEach((button) => {
      button.addEventListener("click", () => {
        const groupIndex = Number(button.dataset.removeGroup);
        if (!state.groups[groupIndex]) return;
        state.groups.splice(groupIndex, 1);
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
    if (submitButton.disabled) return;
    submitButton.disabled = true;
    submitButton.classList.add("is-submitting");
    try {
      sessionStorage.setItem(RECEIVED_KEY, JSON.stringify({ acceptedAt: new Date().toISOString() }));
    } catch (error) {
      console.warn("投票受付表示を保存できませんでした。", error);
    }
    window.setTimeout(() => {
      window.location.href = "../../introduction/?vote=accepted";
    }, 120);
  });

  const initialPayload = readPayload();
  state.selections = storedSelections(initialPayload);
  state.multiReverse = Boolean(initialPayload?.multiReverse);
  state.groups = normalizePayload(initialPayload);
  render();
})();

(() => {
  "use strict";

  const RACE_RESULTS = [
    { finish: 1, car: 3, rider: "青山 周平", handicap: "H0", trial: "3.28", raceTime: "3.343", start: "ST10", incident: "" },
    { finish: 2, car: 1, rider: "黒川 京介", handicap: "H0", trial: "3.28", raceTime: "3.345", start: "ST10", incident: "" },
    { finish: 3, car: 5, rider: "長田 稚也", handicap: "H0", trial: "3.27", raceTime: "3.361", start: "ST08", incident: "" },
    { finish: 4, car: 4, rider: "金子 大輔", handicap: "H0", trial: "3.27", raceTime: "3.363", start: "ST06", incident: "" },
    { finish: 5, car: 7, rider: "鈴木 宏和", handicap: "H0", trial: "3.29", raceTime: "3.371", start: "ST04", incident: "" },
    { finish: 6, car: 2, rider: "鈴木 圭一郎", handicap: "H0", trial: "3.31", raceTime: "3.373", start: "ST11", incident: "" },
    { finish: 7, car: 8, rider: "佐藤 摩弥", handicap: "H0", trial: "3.31", raceTime: "3.380", start: "ST16", incident: "" },
    { finish: 8, car: 6, rider: "佐藤 励", handicap: "H0", trial: "3.28", raceTime: "3.384", start: "ST07", incident: "" },
  ];

  const PAYOUTS = [
    { type: "3連単", cars: [3, 1, 5], separator: "－", payout: "3,450円", popularity: "13人気" },
    { type: "3連複", cars: [1, 3, 5], separator: "＝", payout: "690円", popularity: "3人気" },
    { type: "2連単", cars: [3, 1], separator: "－", payout: "750円", popularity: "3人気" },
    { type: "2連複", cars: [1, 3], separator: "＝", payout: "200円", popularity: "1人気" },
    { type: "ワイド", cars: [1, 3], separator: "＝", payout: "120円", popularity: "1人気" },
    { type: "", cars: [3, 5], separator: "＝", payout: "410円", popularity: "7人気", continuation: true },
    { type: "", cars: [1, 5], separator: "＝", payout: "290円", popularity: "4人気", continuation: true },
    { type: "単勝", cars: [3], separator: "", payout: "370円", popularity: "2人気" },
    { type: "複勝", unavailable: true },
  ];

  const GRAND_NOTE = [
    { label: "ゴール", order: [3, 1, 5, 4, 7, 2, 8, 6] },
    { label: "10周目", order: [3, 1, 5, 4, 7, 2, 8, 6] },
    { label: "9周目", order: [3, 1, 5, 4, 7, 2, 8, 6] },
    { label: "8周目", order: [3, 1, 5, 4, 7, 2, 8, 6] },
    { label: "7周目", order: [3, 1, 5, 4, 7, 2, 8, 6] },
    { label: "6周目", order: [3, 1, 5, 4, 7, 2, 8, 6] },
    { label: "5周目", order: [3, 1, 5, 4, 7, 2, 8, 6] },
    { label: "4周目", order: [3, 1, 5, 4, 7, 2, 8, 6] },
    { label: "3周目", order: [3, 1, 5, 7, 4, 2, 8, 6] },
    { label: "2周目", order: [1, 3, 7, 5, 2, 4, 6, 8] },
    { label: "1周目", order: [7, 3, 1, 5, 6, 8, 2, 4] },
  ];

  const carIcon = (number, extraClass = "") => `<span class="result-entry result-entry-${number}${extraClass ? ` ${extraClass}` : ""}">${number}</span>`;

  const rankIndexes = (valueGetter) => {
    const values = RACE_RESULTS
      .map((row) => valueGetter(row))
      .filter((value) => Number.isFinite(value));
    const rankedValues = [...new Set(values)].sort((a, b) => a - b).slice(0, 3);
    return new Map(
      RACE_RESULTS
        .map((row, index) => ({ index, rank: rankedValues.indexOf(valueGetter(row)) + 1 }))
        .filter((item) => item.rank >= 1),
    );
  };

  const METRIC_RANKS = {
    trial: rankIndexes((row) => Number.parseFloat(row.trial)),
    raceTime: rankIndexes((row) => Number.parseFloat(row.raceTime)),
    start: rankIndexes((row) => Number.parseInt(row.start.replace(/\D/g, ""), 10)),
  };

  const metricValue = (value, rank) => `<span class="result-metric${rank ? ` result-metric-rank-${rank}` : ""}">${value}</span>`;

  const renderRaceResults = () => {
    const body = document.getElementById("race-result-body");
    if (!body) return;
    body.innerHTML = RACE_RESULTS.map((row, index) => {
      return `<tr>
        <td class="finish-cell${row.finish <= 3 ? ` finish-rank-${row.finish}` : ""}">${row.finish}</td>
        <td>${carIcon(row.car)}</td>
        <td class="rider-cell">${row.rider}</td>
        <td>${row.handicap}</td>
        <td>${metricValue(row.trial, METRIC_RANKS.trial.get(index))}</td>
        <td>${metricValue(row.raceTime, METRIC_RANKS.raceTime.get(index))}</td>
        <td>${metricValue(row.start, METRIC_RANKS.start.get(index))}</td>
        <td>${row.incident || ""}</td>
      </tr>`;
    }).join("");
  };

  const renderCombination = (cars, separator) => cars.map((car, index) => `${index ? `<span class="combination-separator">${separator}</span>` : ""}${carIcon(car)}`).join("");

  const renderPayouts = () => {
    const body = document.getElementById("payout-body");
    if (!body) return;
    body.innerHTML = PAYOUTS.map((row) => {
      if (row.unavailable) {
        return `<tr><th scope="row" class="payout-type">${row.type}</th><td class="unavailable" colspan="3">未発売</td></tr>`;
      }
      const typeCell = row.type === "ワイド"
        ? `<th scope="row" class="payout-type payout-type-wide" rowspan="3">ワイド</th>`
        : row.continuation
          ? ""
          : `<th scope="row" class="payout-type">${row.type}</th>`;
      return `<tr class="${row.continuation ? "payout-continuation" : ""}">
        ${typeCell}
        <td class="payout-combination">${renderCombination(row.cars, row.separator)}</td>
        <td class="payout-value">${row.payout}</td>
        <td class="payout-popularity">${row.popularity}</td>
      </tr>`;
    }).join("");
  };

  const renderGrandNote = () => {
    const head = document.getElementById("grand-note-head");
    const body = document.getElementById("grand-note-body");
    if (!head || !body) return;
    head.innerHTML = `<tr><th class="lap-heading">周回</th>${Array.from({ length: 8 }, (_, index) => `<th>${index + 1}位</th>`).join("")}</tr>`;
    body.innerHTML = GRAND_NOTE.map((row, index) => `<tr class="${index === 0 ? "goal-row" : ""}">
      <th scope="row">${row.label}</th>
      ${row.order.map((car) => `<td>${carIcon(car)}</td>`).join("")}
    </tr>`).join("");
  };

  const initializeReplay = () => {
    const panel = document.getElementById("result-replay-panel");
    const frame = document.getElementById("result-replay-frame");
    const tabs = [...document.querySelectorAll("[data-replay-url]")];
    if (!panel || !frame || !tabs.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const isActive = tab.getAttribute("aria-pressed") === "true";
        if (isActive) {
          tab.classList.remove("active");
          tab.setAttribute("aria-pressed", "false");
          frame.setAttribute("src", "about:blank");
          frame.title = "リプレイ";
          panel.hidden = true;
          return;
        }

        const url = tab.dataset.replayUrl;
        if (!url) return;
        frame.title = tab.dataset.replayTitle || "リプレイ";
        if (frame.getAttribute("src") !== url) frame.setAttribute("src", url);
        panel.hidden = false;
        tabs.forEach((item) => {
          const active = item === tab;
          item.classList.toggle("active", active);
          item.setAttribute("aria-pressed", String(active));
        });
      });
    });
  };

  const initialize = () => {
    renderRaceResults();
    renderPayouts();
    renderGrandNote();
    initializeReplay();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();

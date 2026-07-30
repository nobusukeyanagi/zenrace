(() => {
  "use strict";

  const RECEIVED_KEY = "zenrace:vote-received:v1";
  const ODDS_DATA = window.ZENRACE_ODDS_DATA || {};
  const wagersRoot = document.getElementById("inquiry-wagers");
  const totalElement = document.getElementById("inquiry-total");
  const returnElement = document.getElementById("inquiry-return");
  const profitElement = document.getElementById("inquiry-profit");

  const DEFINITIONS = [
    {
      type: "3連単",
      combinations: [[3,1,4],[3,1,7],[3,4,1],[3,4,7],[3,7,1],[3,7,4]],
      formation: [["1着",[3]],["2着",[1,4,7]],["3着",[1,4,7]]],
    },
    {
      type: "3連複",
      combinations: [[1,3,4],[1,3,7],[3,4,7]],
      formation: [["1車目",[3]],["2車目",[1,4,7]],["3車目",[1,4,7]]],
    },
    {
      type: "2連単",
      combinations: [[3,1],[3,4],[3,7]],
      formation: [["1着",[3]],["2着",[1,4,7]]],
    },
    {
      type: "2連複",
      combinations: [[1,3],[3,4],[3,7]],
      formation: [["1車目",[3]],["2車目",[1,4,7]]],
    },
    {
      type: "ワイド",
      combinations: [[1,3],[3,4],[3,7]],
      formation: [["1車目",[3]],["2車目",[1,4,7]]],
    },
    {
      type: "単勝",
      combinations: [[3]],
      formation: [["1着",[3]]],
    },
  ];

  function formatNumber(value) {
    return Math.round(Number(value) || 0).toLocaleString("ja-JP");
  }

  function formatOdds(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    return number.toFixed(1);
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

  function separatorFor(type) {
    if (["3連単", "2連単"].includes(type)) return "-";
    if (["3連複", "2連複", "ワイド"].includes(type)) return "=";
    return "";
  }

  function carBadge(car) {
    return `<span class="inquiry-car car-${car}">${car}</span>`;
  }

  function combinationHtml(type, cars) {
    const separator = separatorFor(type);
    return cars.map((car, index) => `${index && separator ? `<span class="inquiry-separator" aria-hidden="true">${separator}</span>` : ""}${carBadge(car)}`).join("");
  }

  function formationHtml(rows) {
    return rows.map(([label, cars]) => `
      <div class="inquiry-position-row">
        <span class="inquiry-position-label">${label}</span>
        <span class="inquiry-position-cars">${cars.map(carBadge).join("")}</span>
      </div>`).join("");
  }

  function oddsRange(record, type) {
    if (!record) return [0, 0];
    if (type === "ワイド") {
      const values = Array.isArray(record.odds) ? record.odds : [record.odds, record.odds];
      const min = Number(values[0]);
      const max = Number(values[1] ?? values[0]);
      return [Number.isFinite(min) ? min : 0, Number.isFinite(max) ? max : 0];
    }
    const value = Number(record.odds);
    return [Number.isFinite(value) ? value : 0, Number.isFinite(value) ? value : 0];
  }

  function displayOdds(record, type) {
    const [min, max] = oddsRange(record, type);
    if (type === "ワイド" && min !== max) return `${formatOdds(min)}～${formatOdds(max)}`;
    return formatOdds(min);
  }

  function rangeText(min, max, suffix) {
    const roundedMin = Math.round(min);
    const roundedMax = Math.round(max);
    if (roundedMin === roundedMax) return `${formatNumber(roundedMin)}${suffix}`;
    return `${formatNumber(roundedMin)} ～ ${formatNumber(roundedMax)}${suffix}`;
  }

  function signedValueHtml(value) {
    const number = Math.round(Number(value) || 0);
    const className = number > 0 ? "is-positive" : number < 0 ? "is-negative" : "";
    const sign = number > 0 ? "+" : number < 0 ? "−" : "";
    return `<span class="${className}">${sign}${formatNumber(Math.abs(number))}</span>`;
  }

  function signedRangeHtml(min, max) {
    const roundedMin = Math.round(min);
    const roundedMax = Math.round(max);
    if (roundedMin === roundedMax) return signedValueHtml(roundedMin);
    return `${signedValueHtml(roundedMin)} ～ ${signedValueHtml(roundedMax)}`;
  }

  const groups = DEFINITIONS.map((definition) => {
    const records = definition.combinations.map((cars) => {
      const record = oddsLookup[definition.type]?.get(oddsKey(definition.type, cars));
      return { cars, record };
    });
    const returns = records.map(({ record }) => {
      const [minOdds, maxOdds] = oddsRange(record, definition.type);
      return [minOdds * 100, maxOdds * 100];
    });
    return {
      type: definition.type,
      formation: definition.formation,
      entries: records,
      pointCount: records.length,
      subtotal: records.length * 100,
      minReturn: Math.min(...returns.map(([min]) => min)),
      maxReturn: Math.max(...returns.map(([, max]) => max)),
      expanded: false,
    };
  });

  function isHitWager(type) {
    return ["2連単", "2連複", "ワイド", "単勝"].includes(type);
  }

  function isHitEntry(type, cars) {
    const key = cars.join("-");
    if (type === "2連単") return key === "3-1";
    if (type === "2連複" || type === "ワイド") return key === "1-3";
    if (type === "単勝") return key === "3";
    return false;
  }

  function detailRows(group) {
    return group.entries.map(({ cars, record }) => {
      const hitClass = isHitEntry(group.type, cars) ? " is-hit" : "";
      return `
      <div class="inquiry-detail-row${hitClass}">
        <div class="inquiry-combination">${combinationHtml(group.type, cars)}</div>
        <div class="inquiry-odds">${displayOdds(record, group.type)}</div>
        <div class="inquiry-points">100pt</div>
      </div>`;
    }).join("");
  }

  function cardHtml(group, index) {
    const statusHtml = isHitWager(group.type) ? '<div class="inquiry-wager-hit">的中</div>' : "";
    return `
      <section class="inquiry-wager-card" aria-label="${group.type}の投票照会">
        <div class="inquiry-wager-head">
          <div class="inquiry-wager-title"><strong>${group.type}</strong><span>${group.pointCount}点</span></div>
          ${statusHtml}
        </div>
        <div class="inquiry-position-table">${formationHtml(group.formation)}</div>
        <button class="inquiry-expand-button" type="button" data-toggle-details="${index}" aria-expanded="${group.expanded}">${group.expanded ? "閉じる" : "買い目詳細"}</button>
        <div class="inquiry-details" data-details="${index}" ${group.expanded ? "" : "hidden"}>${detailRows(group)}</div>
      </section>`;
  }

  function render() {
    if (!wagersRoot) return;
    wagersRoot.innerHTML = groups.map(cardHtml).join("");
    wagersRoot.querySelectorAll("[data-toggle-details]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.toggleDetails);
        if (!groups[index]) return;
        groups[index].expanded = !groups[index].expanded;
        render();
      });
    });
  }

  function renderSummary() {
    const total = groups.reduce((sum, group) => sum + group.subtotal, 0);
    totalElement.textContent = `${formatNumber(total)}pt`;
    returnElement.textContent = "1,440円";
    profitElement.innerHTML = '<span class="is-negative">−560</span>円';
  }

  function showReceiptPopup() {
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
  }

  renderSummary();
  render();
  showReceiptPopup();
})();

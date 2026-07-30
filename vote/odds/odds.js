(() => {
  "use strict";

  const ODDS_DATA = window.ZENRACE_ODDS_DATA || {};
  const CARS = [1,2,3,4,5,6,7,8];
  const RIDERS = {
    1:"黒川 京介",2:"鈴木 圭一郎",3:"青山 周平",4:"金子 大輔",
    5:"長田 稚也",6:"佐藤 励",7:"鈴木 宏和",8:"佐藤 摩弥"
  };
  const SHORT_RIDERS = {1:"黒川",2:"鈴木圭",3:"青山",4:"金子",5:"長田",6:"佐藤励",7:"鈴木宏",8:"佐藤摩"};
  const RIDER_ABBR3 = {1:"黒川京",2:"鈴木圭",3:"青山周",4:"金子大",5:"長田稚",6:"佐藤励",7:"鈴木宏",8:"佐藤摩"};
  const TYPE_STORAGE_KEY = "zenrace.odds.type";
  const CONFIRM_STORAGE_KEY = "zenrace:bet-confirmation:v1";
  const VALID_TYPES = ["3連単","3連複","2連単","2連複","ワイド","単勝"];
  const selectedBets = new Map();
  const state = {
    type:"3連単",
    popularPage:0,
    trifectaPosition:1,
    trifectaCar:1,
    anchors:{"3連複":1}
  };

  const tabs = Array.from(document.querySelectorAll(".odds-type-tab"));
  const popularList = document.getElementById("popular-list");
  const popularViewport = document.getElementById("popular-viewport");
  const popularPrev = document.getElementById("popular-prev");
  const popularNext = document.getElementById("popular-next");
  const popularSection = popularViewport.closest(".odds-popular-section");
  const board = document.getElementById("odds-board");
  const boardSection = board.closest(".odds-board-section");
  const anchor = document.getElementById("odds-anchor");
  const confirmButton = document.getElementById("odds-confirm");

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
  }

  function carBadge(car) {
    return `<span class="entry-no entry-${car} odds-car-badge" aria-label="${car}号車">${car}</span>`;
  }

  function normalizedCars(type, cars) {
    const values = [...new Set((cars || []).map(Number).filter(car => Number.isInteger(car) && car >= 1 && car <= 8))];
    if (["3連複", "2連複", "ワイド"].includes(type)) values.sort((a, b) => a - b);
    return values;
  }

  function selectionKey(type, cars) {
    return `${type}:${normalizedCars(type, cars).join("-")}`;
  }

  function selectionAttributes(type, cars) {
    const values = normalizedCars(type, cars);
    const key = selectionKey(type, values);
    const selected = selectedBets.has(key);
    return ` data-odds-selectable="true" data-odds-type="${type}" data-odds-cars="${values.join(",")}" role="button" tabindex="0" aria-pressed="${selected}"`;
  }

  function findRecord(type, cars) {
    const key = normalizedCars(type, cars).join("-");
    return (ODDS_DATA[type] || []).find(item => normalizedCars(type, item.cars).join("-") === key) || null;
  }

  function syncSelectionVisuals() {
    document.querySelectorAll("[data-odds-selectable]").forEach(element => {
      const type = element.dataset.oddsType;
      const cars = (element.dataset.oddsCars || "").split(",").map(Number).filter(Number.isFinite);
      const selected = selectedBets.has(selectionKey(type, cars));
      element.classList.toggle("is-selected", selected);
      element.setAttribute("aria-pressed", String(selected));
    });
    if (confirmButton) confirmButton.hidden = selectedBets.size === 0;
    document.body.classList.toggle("has-odds-selection", selectedBets.size > 0);
  }

  function toggleSelection(type, cars) {
    if (!VALID_TYPES.includes(type)) return;
    const values = normalizedCars(type, cars);
    const expected = type === "単勝" ? 1 : (type.startsWith("3") ? 3 : 2);
    if (values.length !== expected) return;
    const key = selectionKey(type, values);
    if (selectedBets.has(key)) {
      selectedBets.delete(key);
    } else {
      const record = findRecord(type, values);
      if (!record) return;
      selectedBets.set(key, { type, cars: values, record });
    }
    syncSelectionVisuals();
  }

  function groupSelections(type, entries) {
    const at = position => [...new Set(entries.map(entry => entry.cars[position]).filter(Number.isFinite))].sort((a, b) => a - b);
    return {
      first: at(0),
      second: type === "単勝" ? [] : at(1),
      third: type.startsWith("3") ? at(2) : [],
      box: [],
    };
  }

  function confirmationPayload() {
    const groups = VALID_TYPES.map(type => {
      const entries = [...selectedBets.values()].filter(item => item.type === type);
      if (!entries.length) return null;
      const selections = groupSelections(type, entries);
      return {
        type,
        generatedCount: entries.length,
        removedCount: 0,
        unit: 1,
        expanded: false,
        directSelection: true,
        selections,
        entries: entries.map(item => ({
          cars: item.cars.slice(),
          rank: item.record?.rank ?? null,
          odds: item.record?.odds ?? null,
          units: 1,
          removed: false,
        })),
      };
    }).filter(Boolean);
    const allEntries = [...selectedBets.values()];
    const selections = {
      first: [...new Set(allEntries.map(item => item.cars[0]).filter(Number.isFinite))].sort((a, b) => a - b),
      second: [...new Set(allEntries.map(item => item.cars[1]).filter(Number.isFinite))].sort((a, b) => a - b),
      third: [...new Set(allEntries.map(item => item.cars[2]).filter(Number.isFinite))].sort((a, b) => a - b),
      box: [],
    };
    return {
      version: 1,
      source: "odds",
      createdAt: new Date().toISOString(),
      selections,
      multiReverse: false,
      groups,
    };
  }

  function restoreSelections() {
    try {
      const raw = sessionStorage.getItem(CONFIRM_STORAGE_KEY);
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (!payload || payload.source !== "odds" || !Array.isArray(payload.groups)) return;
      payload.groups.forEach(group => {
        if (!VALID_TYPES.includes(group?.type)) return;
        (group.entries || []).forEach(entry => {
          if (Number(entry?.units) <= 0 || entry?.removed) return;
          const cars = normalizedCars(group.type, entry?.cars);
          const record = findRecord(group.type, cars);
          if (!record) return;
          selectedBets.set(selectionKey(group.type, cars), { type: group.type, cars, record });
        });
      });
    } catch (error) {
      console.warn("オッズ選択を復元できませんでした。", error);
    }
  }

  function columnHeader(car) {
    return `<span class="odds-column-label"><strong>${car}</strong><small>${SHORT_RIDERS[car]}</small></span>`;
  }

  function formatOdds(value) {
    if (value === null || value === undefined || value === "") return "－";
    const number = Number(value);
    if (!Number.isFinite(number)) return "－";
    if (number >= 1000) return String(Math.round(number));
    return number.toFixed(1);
  }

  function combinationSeparator(type) {
    if (["3連単", "2連単"].includes(type)) return "-";
    if (["3連複", "2連複", "ワイド"].includes(type)) return "=";
    return "";
  }

  function combinationHtml(type, cars) {
    const separator = combinationSeparator(type);
    return cars.map((car, index) => `${index && separator ? `<span class="odds-combination-separator" aria-hidden="true">${separator}</span>` : ""}${carBadge(car)}`).join("");
  }

  function oddsValueClass(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    if (number < 10) return " odds-under-ten";
    if (number >= 1000) return " odds-over-thousand";
    return "";
  }

  function oddsText(type, item) {
    if (type === "ワイド") {
      const values = Array.isArray(item.odds) ? item.odds : [item.odds, item.odds];
      return `<span class="odds-wide-popular"><span class="odds-wide-popular-lower${oddsValueClass(values[0])}">${formatOdds(values[0])}</span><small class="odds-wide-popular-upper"><span class="odds-wide-separator">〜</span><span class="${oddsValueClass(values[1]).trim()}">${formatOdds(values[1])}</span></small></span>`;
    }
    return formatOdds(item.odds);
  }

  function popularPageCount(records) {
    return Math.max(1, Math.ceil(records.length / 10));
  }

  function normalizePopularPage(records) {
    const count = popularPageCount(records);
    state.popularPage = ((state.popularPage % count) + count) % count;
    return count;
  }

  function renderPopular() {
    const records = ODDS_DATA[state.type] || [];
    const hasRecords = records.length > 0;
    const hasMultiplePages = records.length > 10;
    const navUnavailable = !hasRecords || !hasMultiplePages;
    popularPrev.disabled = navUnavailable;
    popularNext.disabled = navUnavailable;
    popularPrev.classList.toggle("is-hidden", !hasMultiplePages);
    popularNext.classList.toggle("is-hidden", !hasMultiplePages);
    popularPrev.setAttribute("aria-disabled", String(navUnavailable));
    popularNext.setAttribute("aria-disabled", String(navUnavailable));
    popularPrev.setAttribute("aria-hidden", String(!hasMultiplePages));
    popularNext.setAttribute("aria-hidden", String(!hasMultiplePages));
    popularPrev.tabIndex = hasMultiplePages ? 0 : -1;
    popularNext.tabIndex = hasMultiplePages ? 0 : -1;
    if (popularSection) popularSection.classList.toggle("is-single-page", !hasMultiplePages);

    if (!hasRecords) {
      state.popularPage = 0;
      popularList.innerHTML = '<div class="odds-empty-message">添付データに単勝オッズが収録されていないため、表示できません。</div>';
      return;
    }

    const pageCount = normalizePopularPage(records);
    const start = state.popularPage * 10;
    const pageRecords = records.slice(start, start + 10);
    const pageSlots = Array.from({length:10}, (_, index) => pageRecords[index] || null);
    popularList.innerHTML = pageSlots.map(item => item ? `
      <div class="odds-popular-row odds-selectable${selectedBets.has(selectionKey(state.type,item.cars)) ? " is-selected" : ""}"${selectionAttributes(state.type,item.cars)}>
        <span class="odds-popular-rank${popularRankClass(state.type,item.rank)}">${item.rank}</span>
        <span class="odds-popular-combination">${combinationHtml(state.type,item.cars)}</span>
        <strong class="odds-popular-value${state.type === "ワイド" ? " odds-wide-cell" : oddsClass(item.odds)}">${oddsText(state.type,item)}</strong>
      </div>` : `
      <div class="odds-popular-row odds-popular-row-empty" aria-hidden="true">
        <span class="odds-popular-rank"></span>
        <span class="odds-popular-combination"></span>
        <strong class="odds-popular-value"></strong>
      </div>`).join("");
    popularList.setAttribute("aria-label", `${start + 1}位から${Math.min(start + 10, records.length)}位、全${records.length}件中`);
    popularPrev.setAttribute("aria-label", `前の人気順を表示（${state.popularPage + 1}/${pageCount}）`);
    popularNext.setAttribute("aria-label", `次の人気順を表示（${state.popularPage + 1}/${pageCount}）`);
    syncSelectionVisuals();
  }

  function movePopularPage(delta) {
    const records = ODDS_DATA[state.type] || [];
    if (!records.length) return;
    state.popularPage += delta;
    normalizePopularPage(records);
    renderPopular();
  }

  function createLookup(type) {
    const map = new Map();
    const records = ODDS_DATA[type] || [];
    records.forEach(item => {
      let cars = item.cars.slice();
      if (type === "3連複" || type === "2連複" || type === "ワイド") cars.sort((a,b)=>a-b);
      map.set(cars.join("-"), item.odds);
    });
    return map;
  }

  function createRankLookup(type) {
    const map = new Map();
    const records = ODDS_DATA[type] || [];
    records.forEach(item => {
      let cars = item.cars.slice();
      if (type === "3連複" || type === "2連複" || type === "ワイド") cars.sort((a,b)=>a-b);
      map.set(cars.join("-"), Number(item.rank));
    });
    return map;
  }

  function rankClass(rank) {
    const value = Number(rank);
    if (!Number.isFinite(value)) return "";
    if (value <= 5) return " odds-rank-gold";
    if (value <= 10) return " odds-rank-silver";
    if (value <= 15) return " odds-rank-bronze";
    return "";
  }

  function popularRankClass(type, rank) {
    const value = Number(rank);
    if (!Number.isFinite(value)) return "";
    if (type === "単勝") {
      if (value === 1) return " odds-rank-gold";
      if (value === 2) return " odds-rank-silver";
      if (value === 3) return " odds-rank-bronze";
      return "";
    }
    return rankClass(value);
  }

  function oddsClass(value) {
    const base = Array.isArray(value) ? value[0] : value;
    return oddsValueClass(base);
  }

  function matrixCell(content, className="") {
    return `<div class="odds-matrix-cell${className}">${content}</div>`;
  }

  function renderAnchor() {
    anchor.hidden = true;
    anchor.innerHTML = "";
  }

  function trifectaOrder() {
    const fixed = state.trifectaPosition;
    if (fixed === 1) return {column:2,row:3};
    if (fixed === 2) return {column:1,row:3};
    return {column:1,row:2};
  }

  function trifectaKey(columnCar,rowCar) {
    const order = trifectaOrder();
    const cars = [];
    cars[state.trifectaPosition - 1] = state.trifectaCar;
    cars[order.column - 1] = columnCar;
    cars[order.row - 1] = rowCar;
    return cars.join("-");
  }

  function trifectaCell(content,className="") {
    return `<div class="odds-trifecta-cell${className}">${content}</div>`;
  }

  function axisCarControls(label, selectedCar, selectId) {
    return `
      <div class="odds-axis-controls">
        <div class="odds-axis-static">${escapeHtml(label)}</div>
        <label class="odds-axis-select-wrap odds-axis-car-select-wrap">
          <span class="entry-no entry-${selectedCar} odds-axis-selected-car" aria-hidden="true">${selectedCar}</span>
          <select class="odds-axis-select odds-axis-car-select" id="${selectId}" aria-label="${escapeHtml(label)}にする選手">
            ${CARS.map(car => `<option value="${car}"${car===selectedCar?" selected":""}>${escapeHtml(RIDERS[car])}</option>`).join("")}
          </select>
        </label>
      </div>`;
  }

  function compactHeaderCell(car, column, row=1) {
    return `<div class="odds-trifecta-cell odds-trifecta-car-cell entry-${car}" style="grid-column:${column};grid-row:${row};" aria-label="${car}号車 ${escapeHtml(RIDERS[car])}"><span class="odds-trifecta-header-label"><strong>${car}</strong><small>${RIDER_ABBR3[car]}</small></span></div>`;
  }

  function compactRowCar(car, row) {
    return `<div class="odds-trifecta-cell odds-trifecta-car-cell odds-trifecta-row-car entry-${car}" style="grid-column:1;grid-row:${row};">${car}</div>`;
  }

  function renderTrifecta() {
    const lookup = createLookup("3連単");
    const rankLookup = createRankLookup("3連単");
    const fixedCar = state.trifectaCar;
    const order = trifectaOrder();
    const candidates = CARS.filter(car => car !== fixedCar);

    let html = `
      <div class="odds-axis-controls">
        <label class="odds-axis-select-wrap">
          <select class="odds-axis-select odds-axis-position-select" id="trifecta-position" aria-label="固定する着順">
            ${[1,2,3].map(position => `<option value="${position}"${position===state.trifectaPosition?" selected":""}>${position}着</option>`).join("")}
          </select>
        </label>
        <label class="odds-axis-select-wrap odds-axis-car-select-wrap">
          <span class="entry-no entry-${fixedCar} odds-axis-selected-car" aria-hidden="true">${fixedCar}</span>
          <select class="odds-axis-select odds-axis-car-select" id="trifecta-car" aria-label="固定する選手">
            ${CARS.map(car => `<option value="${car}"${car===fixedCar?" selected":""}>${escapeHtml(RIDERS[car])}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="odds-trifecta-grid">
        <div class="odds-trifecta-cell odds-trifecta-column-axis" style="grid-column:1;grid-row:1;"><span>${order.column}着</span><span aria-hidden="true">→</span></div>
    `;

    candidates.forEach((car, index) => {
      html += compactHeaderCell(car, index + 2);
    });

    candidates.forEach((rowCar, rowIndex) => {
      const gridRow = rowIndex + 2;
      html += compactRowCar(rowCar, gridRow);
      candidates.forEach((columnCar, colIndex) => {
        const key = trifectaKey(columnCar,rowCar);
        const value = rowCar === columnCar ? null : lookup.get(key);
        const unavailable = rowCar === columnCar || value === null || value === undefined;
        const className = unavailable ? " is-invalid" : `${rankClass(rankLookup.get(key))}${oddsClass(value)}`;
        const cars = key.split("-").map(Number);
        html += `<div class="odds-trifecta-cell odds-trifecta-value${className}${!unavailable && selectedBets.has(selectionKey("3連単",cars)) ? " is-selected" : ""}" style="grid-column:${colIndex + 2};grid-row:${gridRow};"${unavailable ? "" : selectionAttributes("3連単",cars)}>${unavailable ? "" : formatOdds(value)}</div>`;
      });
    });

    html += "</div>";
    board.innerHTML = html;

    document.getElementById("trifecta-position").addEventListener("change", event => {
      state.trifectaPosition = Number(event.target.value);
      renderTrifecta();
    });
    document.getElementById("trifecta-car").addEventListener("change", event => {
      state.trifectaCar = Number(event.target.value);
      renderTrifecta();
    });
  }

  function renderTrio() {
    const lookup = createLookup("3連複");
    const rankLookup = createRankLookup("3連複");
    const fixed = state.anchors["3連複"];
    const candidates = CARS.filter(car => car !== fixed);
    let html = axisCarControls("軸", fixed, "trio-car");
    html += '<div class="odds-trifecta-grid">';
    html += '<div class="odds-trifecta-cell odds-trifecta-column-axis odds-trifecta-corner-label" style="grid-column:1;grid-row:1;"><span>相手</span></div>';
    candidates.forEach((car,index) => { html += compactHeaderCell(car,index + 2); });
    candidates.forEach((rowCar,rowIndex) => {
      const gridRow = rowIndex + 2;
      html += compactRowCar(rowCar,gridRow);
      candidates.forEach((colCar,colIndex) => {
        const key = [fixed,rowCar,colCar].sort((a,b)=>a-b).join("-");
        const value = lookup.get(key);
        const rankTone = rankClass(rankLookup.get(key));
        const redTone = oddsClass(value);
        const unavailable = colCar === rowCar || value === null || value === undefined;
        const duplicateTone = colIndex > rowIndex ? " odds-upper-duplicate" : "";
        const className = unavailable ? " is-invalid" : `${rankTone}${redTone}${duplicateTone}`;
        const cars = key.split("-").map(Number);
        html += `<div class="odds-trifecta-cell odds-trifecta-value${className}${!unavailable && selectedBets.has(selectionKey("3連複",cars)) ? " is-selected" : ""}" style="grid-column:${colIndex + 2};grid-row:${gridRow};"${unavailable ? "" : selectionAttributes("3連複",cars)}>${unavailable ? "" : formatOdds(value)}</div>`;
      });
    });
    html += "</div>";
    board.innerHTML = html;
    document.getElementById("trio-car").addEventListener("change", event => {
      state.anchors["3連複"] = Number(event.target.value);
      renderTrio();
    });
  }

  function renderExacta() {
    const lookup = createLookup("2連単");
    const rankLookup = createRankLookup("2連単");
    let html = '<div class="odds-trifecta-grid odds-compact-grid-8">';
    html += '<div class="odds-trifecta-cell odds-trifecta-column-axis" style="grid-column:1;grid-row:1;"><span>1着</span><span aria-hidden="true">→</span></div>';
    CARS.forEach((car,index) => { html += compactHeaderCell(car,index + 2); });
    CARS.forEach((second,rowIndex) => {
      const gridRow = rowIndex + 2;
      html += compactRowCar(second,gridRow);
      CARS.forEach((first,colIndex) => {
        const key = `${first}-${second}`;
        const value = lookup.get(key);
        const unavailable = first === second || value === null || value === undefined;
        const className = unavailable ? " is-invalid" : `${rankClass(rankLookup.get(key))}${oddsClass(value)}`;
        const cars = [first,second];
        html += `<div class="odds-trifecta-cell odds-trifecta-value${className}${!unavailable && selectedBets.has(selectionKey("2連単",cars)) ? " is-selected" : ""}" style="grid-column:${colIndex + 2};grid-row:${gridRow};"${unavailable ? "" : selectionAttributes("2連単",cars)}>${unavailable ? "" : formatOdds(value)}</div>`;
      });
    });
    html += "</div>";
    board.innerHTML = html;
  }

  function renderPair(type) {
    const lookup = createLookup(type);
    const rankLookup = createRankLookup(type);
    let html = '<div class="odds-trifecta-grid odds-compact-grid-8">';
    html += '<div class="odds-trifecta-cell odds-trifecta-column-axis odds-trifecta-corner-blank" style="grid-column:1;grid-row:1;"></div>';
    CARS.forEach((car,index) => { html += compactHeaderCell(car,index + 2); });
    CARS.forEach((rowCar,rowIndex) => {
      const gridRow = rowIndex + 2;
      html += compactRowCar(rowCar,gridRow);
      CARS.forEach((colCar,colIndex) => {
        const key = [rowCar,colCar].sort((a,b)=>a-b).join("-");
        const value = lookup.get(key);
        const rankTone = rankClass(rankLookup.get(key));
        const redTone = type === "ワイド" ? "" : oddsClass(value);
        const unavailable = colCar === rowCar || value === null || value === undefined;
        const duplicateTone = colIndex > rowIndex ? " odds-upper-duplicate" : "";
        const className = unavailable
          ? " is-invalid"
          : `${rankTone}${type === "ワイド" ? " odds-wide-cell" : redTone}${duplicateTone}`;
        let content = "";
        if (!unavailable && type === "ワイド" && Array.isArray(value)) {
          content = `<span class="odds-wide-value"><span class="${oddsValueClass(value[0]).trim()}">${formatOdds(value[0])}</span><small><span class="odds-wide-separator">〜</span><span class="odds-wide-upper${oddsValueClass(value[1])}">${formatOdds(value[1])}</span></small></span>`;
        } else if (!unavailable) {
          content = formatOdds(value);
        }
        const cars = [rowCar,colCar].sort((a,b)=>a-b);
        html += `<div class="odds-trifecta-cell odds-trifecta-value${className}${!unavailable && selectedBets.has(selectionKey(type,cars)) ? " is-selected" : ""}" style="grid-column:${colIndex + 2};grid-row:${gridRow};"${unavailable ? "" : selectionAttributes(type,cars)}>${content}</div>`;
      });
    });
    html += "</div>";
    board.innerHTML = html;
  }

  function renderSingle() {
    board.innerHTML = "";
  }

  function renderBoard() {
    renderAnchor();
    const single = state.type === "単勝";
    if (boardSection) boardSection.hidden = single;
    if (single) {
      renderSingle();
      syncSelectionVisuals();
      return;
    }
    if (state.type === "3連単") renderTrifecta();
    else if (state.type === "3連複") renderTrio();
    else if (state.type === "2連単") renderExacta();
    else renderPair(state.type);
    syncSelectionVisuals();
  }

  function setType(type, persist=true) {
    if (!VALID_TYPES.includes(type)) type = "3連単";
    const typeChanged = state.type !== type;
    state.type = type;
    if (typeChanged) state.popularPage = 0;
    tabs.forEach(tab => {
      const active = tab.dataset.oddsType === type;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    if (persist) {
      try { sessionStorage.setItem(TYPE_STORAGE_KEY,type); } catch (_) {}
    }
    renderPopular();
    renderBoard();
  }

  function activateSelection(element) {
    if (!element) return;
    const type = element.dataset.oddsType;
    const cars = (element.dataset.oddsCars || "").split(",").map(Number).filter(Number.isFinite);
    toggleSelection(type, cars);
  }

  let suppressPopularClickUntil = 0;
  popularList.addEventListener("click", event => {
    if (Date.now() < suppressPopularClickUntil) return;
    activateSelection(event.target.closest("[data-odds-selectable]"));
  });
  board.addEventListener("click", event => activateSelection(event.target.closest("[data-odds-selectable]")));
  [popularList, board].forEach(root => root.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const element = event.target.closest("[data-odds-selectable]");
    if (!element) return;
    event.preventDefault();
    activateSelection(element);
  }));

  if (confirmButton) {
    confirmButton.addEventListener("click", () => {
      if (!selectedBets.size) return;
      try {
        sessionStorage.setItem(CONFIRM_STORAGE_KEY, JSON.stringify(confirmationPayload()));
      } catch (error) {
        console.warn("オッズ選択を投票確認へ保存できませんでした。", error);
      }
      window.location.href = "../bet/confirm/";
    });
  }

  popularPrev.addEventListener("click", () => movePopularPage(-1));
  popularNext.addEventListener("click", () => movePopularPage(1));

  let swipeStartX = null;
  let swipeStartY = null;
  popularViewport.addEventListener("touchstart", event => {
    const touch = event.changedTouches[0];
    swipeStartX = touch.clientX;
    swipeStartY = touch.clientY;
  }, {passive:true});
  popularViewport.addEventListener("touchend", event => {
    if (swipeStartX === null || swipeStartY === null) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeStartX;
    const deltaY = touch.clientY - swipeStartY;
    swipeStartX = null;
    swipeStartY = null;
    if (Math.abs(deltaX) < 35 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    suppressPopularClickUntil = Date.now() + 350;
    movePopularPage(deltaX < 0 ? 1 : -1);
  }, {passive:true});

  tabs.forEach(tab => tab.addEventListener("click", () => setType(tab.dataset.oddsType)));
  restoreSelections();
  let initial = "3連単";
  try { initial = sessionStorage.getItem(TYPE_STORAGE_KEY) || initial; } catch (_) {}
  setType(initial,false);
  syncSelectionVisuals();
})();

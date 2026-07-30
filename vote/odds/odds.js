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
  const VALID_TYPES = ["3連単","3連複","2連単","2連複","ワイド","単勝"];
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

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
  }

  function carBadge(car) {
    return `<span class="entry-no entry-${car} odds-car-badge" aria-label="${car}号車">${car}</span>`;
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

  function oddsText(type, item) {
    if (type === "ワイド") {
      return `<span class="odds-wide-popular"><span class="odds-wide-popular-lower">${formatOdds(item.odds[0])}</span><small class="odds-wide-popular-upper"><span class="odds-wide-separator">〜</span><span>${formatOdds(item.odds[1])}</span></small></span>`;
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
      <div class="odds-popular-row">
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
    const base = Array.isArray(value) ? Number(value[0]) : Number(value);
    return Number.isFinite(base) && base < 10 ? " odds-under-ten" : "";
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
        html += `<div class="odds-trifecta-cell odds-trifecta-value${className}" style="grid-column:${colIndex + 2};grid-row:${gridRow};">${unavailable ? "" : formatOdds(value)}</div>`;
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
        html += `<div class="odds-trifecta-cell odds-trifecta-value${className}" style="grid-column:${colIndex + 2};grid-row:${gridRow};">${unavailable ? "" : formatOdds(value)}</div>`;
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
        html += `<div class="odds-trifecta-cell odds-trifecta-value${className}" style="grid-column:${colIndex + 2};grid-row:${gridRow};">${unavailable ? "" : formatOdds(value)}</div>`;
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
          content = `<span class="odds-wide-value"><span>${formatOdds(value[0])}</span><small><span class="odds-wide-separator">〜</span><span class="odds-wide-upper">${formatOdds(value[1])}</span></small></span>`;
        } else if (!unavailable) {
          content = formatOdds(value);
        }
        html += `<div class="odds-trifecta-cell odds-trifecta-value${className}" style="grid-column:${colIndex + 2};grid-row:${gridRow};">${content}</div>`;
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
      return;
    }
    if (state.type === "3連単") renderTrifecta();
    else if (state.type === "3連複") renderTrio();
    else if (state.type === "2連単") renderExacta();
    else renderPair(state.type);
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
    movePopularPage(deltaX < 0 ? 1 : -1);
  }, {passive:true});

  tabs.forEach(tab => tab.addEventListener("click", () => setType(tab.dataset.oddsType)));
  let initial = "3連単";
  try { initial = sessionStorage.getItem(TYPE_STORAGE_KEY) || initial; } catch (_) {}
  setType(initial,false);
})();

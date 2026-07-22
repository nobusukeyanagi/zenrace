(() => {
  "use strict";

  const SUPPORTED_DATE = "2026-02-23";
  const SESSION_ICON = {
    morning: "../schedule/icons/morning.png",
    night: "../schedule/icons/night.png",
    midnight: "../schedule/icons/midnight.png",
  };

  const VENUES = [
    { venue: "京王閣", sport: "keirin", grade: { label: "FⅡ", accent: false }, day: "初日", session: "midnight", girls: false },
    { venue: "松戸", sport: "keirin", grade: { label: "FⅡ", accent: false }, day: "2日目", session: "morning", girls: false },
    { venue: "平塚", sport: "keirin", grade: { label: "FⅡ", accent: false }, day: "初日", session: "midnight", girls: false },
    { venue: "豊橋", sport: "keirin", grade: { label: "FⅠ", accent: false }, day: "初日", session: "night", girls: false },
    { venue: "玉野", sport: "keirin", grade: { label: "FⅡ", accent: false }, day: "初日", session: "midnight", girls: false },
    { venue: "防府", sport: "keirin", grade: { label: "FⅠ", accent: false }, day: "最終日", session: "", girls: false },
    { venue: "高知", sport: "keirin", grade: { label: "FⅡ", accent: false }, day: "2日目", session: "night", girls: true },
    { venue: "熊本", sport: "keirin", grade: { label: "GⅠ", accent: true }, day: "最終日", session: "", girls: false },
  ];

  // 2026年2月23日（月）の確定結果。
  // 表示項目：R、1〜3着車番、三連単払戻、人気。
  const RESULTS = {
    "京王閣": [
      ["1R", "3", "2", "6", "32,520円", "40人気"],
      ["2R", "5", "2", "1", "30,370円", "55人気"],
      ["3R", "1", "4", "5", "370円", "1人気"],
      ["4R", "6", "1", "3", "49,020円", "76人気"],
      ["5R", "1", "3", "4", "540円", "2人気"],
      ["6R", "1", "3", "2", "610円", "2人気"],
      ["7R", "1", "2", "6", "160円", "1人気"],
    ],
    "松戸": [
      ["1R", "1", "5", "7", "810円", "1人気"],
      ["2R", "2", "7", "4", "19,360円", "65人気"],
      ["3R", "4", "3", "7", "12,730円", "41人気"],
      ["4R", "7", "4", "1", "23,880円", "68人気"],
      ["5R", "3", "4", "2", "8,940円", "35人気"],
      ["6R", "1", "7", "4", "550円", "1人気"],
      ["7R", "1", "5", "4", "300円", "1人気"],
    ],
    "平塚": [
      ["1R", "2", "3", "5", "2,050円", "6人気"],
      ["2R", "1", "2", "3", "740円", "1人気"],
      ["3R", "2", "3", "5", "1,560円", "2人気"],
      ["4R", "3", "4", "1", "1,130円", "1人気"],
      ["5R", "1", "2", "6", "220円", "1人気"],
      ["6R", "1", "2", "5", "230円", "1人気"],
      ["7R", "5", "1", "3", "19,090円", "48人気"],
    ],
    "豊橋": [
      ["1R", "7", "2", "5", "1,740円", "5人気"],
      ["2R", "2", "3", "5", "23,710円", "47人気"],
      ["3R", "2", "5", "3", "23,990円", "57人気"],
      ["4R", "1", "3", "5", "470円", "2人気"],
      ["5R", "2", "5", "3", "1,030円", "1人気"],
      ["6R", "2", "7", "5", "3,170円", "13人気"],
      ["7R", "3", "7", "4", "6,130円", "19人気"],
      ["8R", "1", "4", "7", "650円", "2人気"],
      ["9R", "1", "4", "2", "830円", "3人気"],
      ["10R", "2", "4", "6", "2,940円", "11人気"],
      ["11R", "4", "7", "3", "8,580円", "20人気"],
      ["12R", "3", "1", "2", "9,430円", "32人気"],
    ],
    "玉野": [
      ["1R", "2", "1", "5", "900円", "1人気"],
      ["2R", "5", "6", "3", "11,220円", "35人気"],
      ["3R", "2", "1", "6", "25,420円", "46人気"],
      ["4R", "3", "2", "1", "3,550円", "10人気"],
      ["5R", "1", "2", "4", "13,260円", "25人気"],
      ["6R", "2", "1", "3", "560円", "2人気"],
      ["7R", "1", "2", "7", "190円", "1人気"],
    ],
    "防府": [
      ["1R", "1", "4", "7", "6,920円", "18人気"],
      ["2R", "2", "3", "7", "6,550円", "24人気"],
      ["3R", "4", "7", "3", "1,180円", "3人気"],
      ["4R", "5", "1", "4", "1,520円", "3人気"],
      ["5R", "4", "2", "3", "3,480円", "11人気"],
      ["6R", "1", "3", "5", "2,230円", "7人気"],
      ["7R", "7", "1", "4", "750円", "2人気"],
      ["8R", "7", "4", "3", "2,000円", "5人気"],
      ["9R", "1", "5", "6", "47,670円", "114人気"],
      ["10R", "1", "5", "7", "28,890円", "92人気"],
      ["11R", "7", "1", "5", "2,150円", "7人気"],
      ["12R", "5", "1", "4", "4,490円", "11人気"],
    ],
    "高知": [
      ["1R", "3", "1", "6", "11,390円", "43人気"],
      ["2R", "6", "1", "3", "3,600円", "10人気"],
      ["3R", "3", "7", "2", "1,670円", "4人気"],
      ["4R", "5", "7", "1", "290円", "1人気"],
      ["5R", "5", "1", "4", "6,550円", "22人気"],
      ["6R", "5", "4", "6", "4,360円", "14人気"],
      ["7R", "2", "1", "6", "3,290円", "10人気"],
      ["8R", "5", "2", "1", "6,740円", "26人気"],
      ["9R", "7", "1", "5", "36,580円", "90人気"],
      ["10R", "7", "1", "3", "3,630円", "13人気"],
      ["11R", "3", "7", "1", "3,160円", "7人気"],
    ],
    "熊本": [
      ["1R", "7", "2", "8", "6,210円", "15人気"],
      ["2R", "3", "7", "4", "17,640円", "65人気"],
      ["3R", "7", "9", "3", "35,260円", "139人気"],
      ["4R", "8", "4", "9", "102,650円", "329人気"],
      ["5R", "2", "4", "3", "119,120円", "271人気"],
      ["6R", "8", "1", "4", "327,530円", "433人気"],
      ["7R", "9", "5", "7", "74,350円", "299人気"],
      ["8R", "9", "6", "8", "85,530円", "240人気"],
      ["9R", "3", "6", "4", "10,200円", "22人気"],
      ["10R", "3", "4", "9", "5,240円", "7人気"],
      ["11R", "7", "2", "5", "35,210円", "104人気"],
      ["12R", "3", "9", "7", "1,940円", "3人気"],
    ],
  };

  const FEATURED = new Set(["熊本:12R"]);
  const board = document.getElementById("resultsBoard");
  if (!board) return;

  const renderVenueMeta = (entry) => {
    const gradeHtml = entry.grade
      ? `<span class="venue-grade-icon ${entry.grade.accent ? "accent" : "muted"}">${entry.grade.label}</span>`
      : "";
    const sessionHtml = entry.session
      ? `<img class="venue-status-icon" src="${SESSION_ICON[entry.session]}" alt="" aria-hidden="true">`
      : "";
    const girlsHtml = entry.girls
      ? `<img class="venue-status-icon girls" src="../schedule/icons/girls.png" alt="" aria-hidden="true">`
      : "";
    const dayHtml = entry.day ? `<span class="venue-day-label">${entry.day}</span>` : "";

    return `
      <div class="venue-card sport-${entry.sport}">
        <div class="venue-title-line">
          <div class="venue-name">${entry.venue}</div>
          <span class="venue-sport-icon ${entry.sport}" aria-hidden="true"></span>
        </div>
        <div class="venue-meta-row">${gradeHtml}${sessionHtml}${girlsHtml}${dayHtml}</div>
      </div>`;
  };

  const renderVenueTable = (entry, results) => {
    const rows = results.map(([race, first, second, third, payout, popularity]) => {
      const featured = FEATURED.has(`${entry.venue}:${race}`) ? " featured" : "";
      return `<tr class="${featured}">
        <td class="race-col">${race}</td>
        <td class="finish-cell">
          <span class="bike-no bike-${first}">${first}</span>
          <span class="bike-no bike-${second}">${second}</span>
          <span class="bike-no bike-${third}">${third}</span>
        </td>
        <td class="payout-cell">${payout}</td>
        <td class="pop-cell">${popularity}</td>
      </tr>`;
    }).join("");

    return `
      <div class="result-table-wrap">
        <table class="result-table" aria-label="${entry.venue} 結果一覧">
          <colgroup>
            <col class="r-col"><col class="finish-col"><col class="payout-col"><col class="pop-col">
          </colgroup>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  };

  const renderUnsupported = (dateKey) => {
    board.innerHTML = `<section class="results-placeholder"><h2>結果早見</h2><p>${dateKey.replace(/-/g, "/")} は準備中です。<br>ひとまず 2/23 の競輪のみ掲載しています。</p></section>`;
  };

  const render = (dateKey) => {
    if (dateKey !== SUPPORTED_DATE) {
      renderUnsupported(dateKey);
      return;
    }

    board.innerHTML = VENUES.map((entry) => `
      <article class="results-group">
        ${renderVenueMeta(entry)}
        ${renderVenueTable(entry, RESULTS[entry.venue] || [])}
      </article>`).join("");
  };

  const initialRender = () => {
    const selected = document.querySelector("[data-zenrace-date-selector]")?.dataset.selectedDate || SUPPORTED_DATE;
    render(selected);
  };

  window.addEventListener("zenrace-date-refresh", (event) => {
    render(event.detail?.date || SUPPORTED_DATE);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialRender, { once: true });
  } else {
    initialRender();
  }
})();

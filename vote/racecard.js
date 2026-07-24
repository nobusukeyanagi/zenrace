(() => {
  "use strict";


  const applyPerformanceRanks = () => {
    const table = document.querySelector(".race-table");
    if (!table) return;

    const rankClasses = ["rank-first", "rank-second", "rank-third"];
    table.querySelectorAll(".is-best, .rank-first, .rank-second, .rank-third").forEach((node) => {
      node.classList.remove("is-best", ...rankClasses);
    });

    const applyDenseRanks = (nodes, valueGetter, direction = "desc") => {
      const entries = nodes.map((node) => ({ node, value: valueGetter(node) }))
        .filter(({ value }) => Number.isFinite(value));
      const distinct = [...new Set(entries.map(({ value }) => value))]
        .sort((a, b) => direction === "asc" ? a - b : b - a)
        .slice(0, 3);
      entries.forEach(({ node, value }) => {
        const rankIndex = distinct.indexOf(value);
        if (rankIndex >= 0) node.classList.add(rankClasses[rankIndex]);
      });
    };

    const rows = [...table.querySelectorAll("tbody tr")];

    // 勝率・2連対率・3連対率は、列ごと・良湿ごとに高い順で評価する。
    [5, 6, 7].forEach((columnNumber) => {
      [1, 2].forEach((surfaceNumber) => {
        const lines = rows.map((row) =>
          row.querySelector(`td:nth-child(${columnNumber}) .stat-line:nth-child(${surfaceNumber})`)
        ).filter(Boolean);
        applyDenseRanks(lines, (line) => {
          const text = line.querySelector(".surface-value")?.textContent || "";
          return Number.parseFloat(text);
        }, "desc");
      });
    });

    // STは小さい値ほど上位。ハンデ値には着色しない。
    const stLines = rows.map((row) => row.querySelector("td:nth-child(3) > span:nth-child(2)"))
      .filter(Boolean);
    applyDenseRanks(stLines, (line) => {
      const match = line.textContent.match(/ST\s*([0-9.]+)/i);
      return match ? Number.parseFloat(match[1]) : Number.NaN;
    }, "asc");

    // 試走Tは上段のみを、小さい値から3順位まで着色する。
    const trialLines = rows.map((row) => row.querySelector("td:nth-child(4) > span:first-child"))
      .filter(Boolean);
    applyDenseRanks(trialLines, (line) => Number.parseFloat(line.textContent), "asc");
  };

  const init = () => {
    applyPerformanceRanks();

    document.querySelectorAll(".table-scroll").forEach((scroller) => {
      const pageShell = scroller.closest(".zenrace-content-shell");
      const keepPageShellAtLeft = () => {
        if (pageShell && pageShell.scrollLeft !== 0) pageShell.scrollLeft = 0;
      };
      if (pageShell) {
        pageShell.scrollLeft = 0;
        pageShell.addEventListener("scroll", keepPageShellAtLeft, { passive: true });
      }

      let startX = 0;
      let startY = 0;
      let direction = "";
      let riderStateFrame = 0;

      const rows = [...scroller.querySelectorAll("tbody tr")];
      rows.forEach((row) => {
        const carCell = row.querySelector("td.car-number");
        const riderCell = row.querySelector("td.rider-name");
        if (!carCell || !riderCell) return;
        const nameSource = riderCell.querySelector(".rider-name-main")?.textContent || riderCell.textContent || "";
        const shortName = String(nameSource).replace(/[\s　]+/g, "").slice(0, 3);
        carCell.dataset.riderShort = shortName;
        if (!carCell.querySelector(".car-number-value")) {
          const value = document.createElement("span");
          value.className = "car-number-value";
          value.textContent = String(carCell.textContent || "").trim();
          carCell.replaceChildren(value);
        }
      });

      const updateRiderNameState = () => {
        riderStateFrame = 0;
        scroller.classList.toggle('rider-name-hidden', scroller.scrollLeft > 0);
      };

      const queueRiderNameState = () => {
        keepPageShellAtLeft();
        if (riderStateFrame) return;
        riderStateFrame = window.requestAnimationFrame(updateRiderNameState);
      };

      const maxScrollLeft = () => Math.max(0, scroller.scrollWidth - scroller.clientWidth);

      scroller.addEventListener("scroll", queueRiderNameState, { passive: true });
      window.addEventListener("resize", queueRiderNameState, { passive: true });
      queueRiderNameState();

      scroller.addEventListener("touchstart", (event) => {
        if (event.touches.length !== 1) return;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
        direction = "";
        const max = maxScrollLeft();
        if (scroller.scrollLeft < 0) scroller.scrollLeft = 0;
        if (scroller.scrollLeft > max) scroller.scrollLeft = max;
      }, { passive: true });

      scroller.addEventListener("touchmove", (event) => {
        if (event.touches.length !== 1) return;
        const dx = event.touches[0].clientX - startX;
        const dy = event.touches[0].clientY - startY;

        if (!direction && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
          direction = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        }
        if (direction !== "x") return;

        const max = maxScrollLeft();
        const atStart = scroller.scrollLeft <= 0;
        const atEnd = scroller.scrollLeft >= max - 1;

        if ((atStart && dx > 0) || (atEnd && dx < 0)) {
          event.preventDefault();
          scroller.scrollLeft = atStart ? 0 : max;
        }
      }, { passive: false });

      scroller.addEventListener("touchend", () => {
        const max = maxScrollLeft();
        scroller.scrollLeft = Math.min(max, Math.max(0, scroller.scrollLeft));
        direction = "";
        queueRiderNameState();
      }, { passive: true });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

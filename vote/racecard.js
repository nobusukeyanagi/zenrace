(() => {
  "use strict";

  const RANK_COLORS = {
    1: "#f6de8d",
    2: "#d9e6ee",
    3: "#e3c6a3",
  };

  const RANK_CLASSES = ["rank-highlight", "rank-first", "rank-second", "rank-third"];

  const parseNumber = (text) => {
    const match = String(text || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : Number.NaN;
  };

  const clearRankStyle = (element) => {
    if (!element) return;
    element.classList.remove(...RANK_CLASSES);
    delete element.dataset.rank;
    delete element.dataset.rankColor;

    [element, ...element.children].forEach((node) => {
      [
        "display",
        "width",
        "min-width",
        "background",
        "background-color",
        "background-image",
        "border-radius",
        "box-shadow",
      ].forEach((property) => node.style.removeProperty(property));
    });
  };

  const applyRankStyle = (element, rank) => {
    const color = RANK_COLORS[rank];
    if (!element || !color) return;

    const rankClass = rank === 1 ? "rank-first" : rank === 2 ? "rank-second" : "rank-third";
    element.classList.add("rank-highlight", rankClass);
    element.dataset.rank = String(rank);
    element.dataset.rankColor = color;

    const gridLine = element.classList.contains("stat-line") || element.classList.contains("good-ten-line");
    element.style.setProperty("display", gridLine ? "grid" : "block", "important");
    element.style.setProperty("width", "100%", "important");
    element.style.setProperty("background-color", color, "important");
    element.style.setProperty("background-image", `linear-gradient(${color}, ${color})`, "important");
    element.style.setProperty("border-radius", "0", "important");
    element.style.setProperty("box-shadow", "none", "important");

    [...element.children].forEach((child) => {
      child.style.setProperty("background-color", color, "important");
    });
  };

  const applyDenseRanks = (entries, { higherIsBetter = false } = {}) => {
    const validEntries = entries.filter(({ element, value }) => element && Number.isFinite(value));
    validEntries.forEach(({ element }) => clearRankStyle(element));

    const distinctValues = [...new Set(validEntries.map(({ value }) => value))]
      .sort((a, b) => (higherIsBetter ? b - a : a - b))
      .slice(0, 3);
    const rankByValue = new Map(distinctValues.map((value, index) => [value, index + 1]));

    validEntries.forEach(({ element, value }) => {
      const rank = rankByValue.get(value);
      if (rank) applyRankStyle(element, rank);
    });
  };

  const directChildren = (element, selector = "span") =>
    [...(element?.children || [])].filter((child) => child.matches(selector));

  const applyAllRaceRanks = () => {
    const supportCell = document.querySelector(".race-table .support-rate-cell");
    const basicTable = supportCell?.closest(".race-table");
    if (!basicTable) return;

    const rows = [...basicTable.querySelectorAll("tbody tr")];
    if (!rows.length) return;

    const cells = rows.map((row) => [...row.children].filter((child) => child.matches("td")));

    // Support rate: rank by the numeric rate, but highlight the popularity line.
    applyDenseRanks(cells.map((tds) => {
      const cell = tds[3];
      const element = cell?.querySelector(".support-rate-popularity");
      const valueElement = cell?.querySelector(".support-rate-main");
      return { element, value: parseNumber(valueElement?.textContent) };
    }), { higherIsBetter: true });

    // ST: smaller is better.
    applyDenseRanks(cells.map((tds) => {
      const element = directChildren(tds[5])[0];
      return { element, value: parseNumber(element?.textContent) };
    }));

    // Trial time: smaller is better.
    applyDenseRanks(cells.map((tds) => {
      const element = directChildren(tds[5])[0];
      return { element, value: parseNumber(element?.textContent) };
    }));

    // Good-track last-10 average and best times: smaller is better, ranked separately.
    [0, 1].forEach((lineIndex) => {
      applyDenseRanks(cells.map((tds) => {
        const element = tds[6]?.querySelectorAll(".good-ten-line")[lineIndex];
        const valueElement = element?.querySelector(".good-ten-value");
        return { element, value: parseNumber(valueElement?.textContent) };
      }));
    });

    // Win, exacta-place and trifecta-place rates: good/wet ranked separately; larger is better.
    [8, 9, 10].forEach((cellIndex) => {
      [0, 1].forEach((lineIndex) => {
        applyDenseRanks(cells.map((tds) => {
          const element = tds[cellIndex]?.querySelectorAll(".stat-line")[lineIndex];
          const valueElement = element?.querySelector(".surface-value");
          return { element, value: parseNumber(valueElement?.textContent) };
        }), { higherIsBetter: true });
      });
    });
  };

  const init = () => {
    applyAllRaceRanks();

    const detailToast = document.querySelector(".racecard-detail-toast");
    let detailToastTimer = 0;
    document.querySelectorAll(".racecard-detail-tab:not(.active)").forEach((button) => {
      if (button.matches("a[href]")) return;
      button.addEventListener("click", () => {
        if (!detailToast) return;
        window.clearTimeout(detailToastTimer);
        detailToast.classList.add("is-visible");
        detailToastTimer = window.setTimeout(() => detailToast.classList.remove("is-visible"), 1800);
      });
    });

    document.querySelectorAll(".table-scroll").forEach((scroller) => {
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
        scroller.classList.toggle("rider-name-hidden", scroller.scrollLeft > 0);
      };

      const queueRiderNameState = () => {
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

(() => {
  "use strict";

  const TERM_HELP = {
    car: {
      title: "車番",
      description: "出走する競走車の番号です。1～8号車は、白・黒・赤・青・黄・緑・橙・桃の車番色で表示します。",
    },
    rider: {
      title: "選手",
      description: "選手名と、所属するレース場、期別、年齢を表示します。年齢の後ろにある「♥」は女子選手を示します。",
    },
    photo: {
      title: "写真",
      description: "出走選手の顔写真です。選手名や所属情報と合わせて、出走する選手を確認できます。",
    },
    support: {
      title: "支持率",
      description: "3連単の全投票のうち、その車番を含む買い目が占める割合です。人気順位も併記します。1票に3車が含まれるため、全選手の合計は100％になりません。",
    },
    "st-h": {
      title: "ST・H",
      description: "STはスタートタイミングで、ST10は0.10秒を表します。一般に数値が小さいほど発走合図に近いスタートです。Hはスタート位置のハンデ距離（m）です。",
    },
    trial: {
      title: "試走T",
      description: "試走で500mを全力走行したタイムを5で割った、100m当たりの平均秒数です。小さいほど速いタイムです。偏差は、良走路10走の平均競走Tと平均試走Tの差です。",
    },
    good10: {
      title: "良10走T",
      description: "直近90日以内の良走路における正常競走の近10走を対象に、平均競走タイムと最高競走タイムを表示します。小さいほど速いタイムです。",
    },
    recent10: {
      title: "近10走着順",
      description: "走路状況を問わず、直近90日以内に走った最大10走の着順を新しい順に表示します。1～3着は金・銀・銅系の背景で強調します。",
    },
    win: {
      title: "勝率",
      description: "近180日の競走成立回数に対する1着回数の割合です。良走路と湿走路に分けて表示します。",
    },
    quinella: {
      title: "2連対率",
      description: "近180日の競走成立回数に対する、1着または2着になった回数の割合です。良走路と湿走路に分けて表示します。",
    },
    place: {
      title: "3連対率",
      description: "近180日の競走成立回数に対する、1着・2着・3着になった回数の割合です。良走路と湿走路に分けて表示します。",
    },
    recent180: {
      title: "近180日成績",
      description: "直近180日の着回数を、良走路・湿走路別に「1着－2着－3着－着外／出走数」の順で表示します。",
    },
    year: {
      title: "今年",
      description: "今年の優勝回数と、優勝戦へ進出した回数（優出）を表示します。",
    },
    career: {
      title: "通算",
      description: "選手デビュー後から現在までの通算優勝回数を表示します。",
    },
    rank: {
      title: "ランク",
      description: "競走成績に基づく全国ランクです。S級・A級・B級と級内順位を表示し、2行目には前期ランクを併記します。",
    },
    points: {
      title: "審査P",
      description: "適用ランクを決める審査ポイントです。審査期間内の着順位やタイム順位などを得点化した競走成績を基に算出されます。",
    },
    machine: {
      title: "車名",
      description: "選手が所有する競走車の呼名と、競走車の級・排気量を表示します。例の「1級 600cc」は1級車の600ccエンジンを示します。",
    },
  };

  const initRacecardTermHelp = () => {
    const overlay = document.querySelector("[data-racecard-term-overlay]");
    const title = overlay?.querySelector("[data-racecard-term-title]");
    const description = overlay?.querySelector("[data-racecard-term-description]");
    const closeButton = overlay?.querySelector("[data-racecard-term-close]");
    const raceInfo = document.querySelector("zenrace-race-info .shared-race-info");
    const stage = document.querySelector(".zenrace-content-stage");
    const triggers = [...document.querySelectorAll("[data-racecard-term]")];
    if (!overlay || !title || !description || !closeButton || !raceInfo || !stage || !triggers.length) return;

    let activeTrigger = null;
    let geometryFrame = 0;

    const syncGeometry = () => {
      geometryFrame = 0;
      const infoRect = raceInfo.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      overlay.style.left = `${infoRect.left - stageRect.left}px`;
      overlay.style.top = `${infoRect.top - stageRect.top}px`;
      overlay.style.width = `${infoRect.width}px`;
      overlay.style.height = `${infoRect.height}px`;
    };

    const queueGeometry = () => {
      if (geometryFrame) return;
      geometryFrame = window.requestAnimationFrame(syncGeometry);
    };

    const close = ({ restoreFocus = false } = {}) => {
      if (overlay.hidden) return;
      overlay.hidden = true;
      triggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
      const previousTrigger = activeTrigger;
      activeTrigger = null;
      if (restoreFocus) previousTrigger?.focus({ preventScroll: true });
    };

    const open = (trigger) => {
      const help = TERM_HELP[trigger.dataset.racecardTerm];
      if (!help) return;
      activeTrigger = trigger;
      title.textContent = help.title;
      description.textContent = help.description;
      triggers.forEach((button) => button.setAttribute("aria-expanded", String(button === trigger)));
      overlay.hidden = false;
      syncGeometry();
      closeButton.focus({ preventScroll: true });
    };

    triggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        if (!overlay.hidden && activeTrigger === trigger) {
          close();
          return;
        }
        open(trigger);
      });
    });

    closeButton.addEventListener("click", () => close({ restoreFocus: true }));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.hidden) close({ restoreFocus: true });
    });

    window.addEventListener("resize", queueGeometry, { passive: true });
    window.addEventListener("pageshow", queueGeometry);
    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(queueGeometry) : null;
    resizeObserver?.observe(raceInfo);
    resizeObserver?.observe(stage);
    queueGeometry();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRacecardTermHelp, { once: true });
  } else {
    initRacecardTermHelp();
  }
})();

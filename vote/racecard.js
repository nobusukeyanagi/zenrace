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
      description: "出走選手の番号です。1番から順に、白・黒・赤・青・黄・緑・橙・桃の色が決まっており、選手は自分の車番と同じ色の勝負服を着用します。",
    },
    rider: {
      title: "選手",
      descriptionHtml: '出走選手の名前と、所属するレース場、期別、年齢を表示します。年齢の後ろにある「<span class="racecard-term-heart" aria-label="女子選手">♥</span>」は女子選手を示します。',
    },
    photo: {
      title: "写真",
      description: "出走選手の顔写真です。選手名や所属情報と合わせて、出走する選手を確認できます。",
    },
    support: {
      title: "支持率",
      description: "ZEN RACE独自指標です。3連単の全投票のうち、その車番を含む買い目が占める割合（％）と人気順位を表示します。1票に3車が含まれるため、全選手の支持率の合計は基本的に300％となります。表示値の四捨五入により、わずかに前後する場合があります。",
    },
    "st-h": {
      title: "ST・H",
      description: "ST（スタートタイミング）は、大時計の針が0を指してから、選手がスタート線（ハンデ線）を離れるまでの時間です。ST10は0.10秒を表し、出走表では直近90日間の平均を表示します。一般に値が小さいほどスタートが速い傾向があります。H（ハンデ）はスタート位置の距離（m）で、実力差を調整するため、強い選手ほど10m単位で後方から発走します。",
    },
    trial: {
      title: "試走T",
      description: "試走T（試走タイム）は、試走で500mを走ったタイムを5で割り、100m当たりの平均秒数で表したものです。値が小さいほど速い試走です。2行目の偏差は、良走路における直近10走の平均競走Tと平均試走Tの差で、試走から本走へのタイム変化を見る目安です。",
    },
    good10: {
      title: "良10走T",
      description: "直近90日以内の良走路における正常競走から、新しい順に最大10走を対象として、平均競走Tと最高競走Tを表示します。いずれも100m当たりの平均秒数で、値が小さいほど速いタイムです。",
    },
    recent10: {
      title: "近10走着順",
      description: "走路状況を問わず、直近90日以内に走った最大10走の着順を、新しいレースから順に表示します。1着・2着・3着は、それぞれ金・銀・銅の背景で強調します。",
    },
    win: {
      title: "勝率",
      description: "直近180日の競走成立回数に対する、1着回数の割合です。良走路と湿走路に分けて表示し、数値が高いほど1着になった割合が高いことを示します。",
    },
    quinella: {
      title: "2連対率",
      description: "直近180日の競走成立回数に対する、1着または2着になった回数の割合です。良走路と湿走路に分けて表示し、数値が高いほど2着以内に入った割合が高いことを示します。",
    },
    place: {
      title: "3連対率",
      description: "直近180日の競走成立回数に対する、1着・2着・3着になった回数の割合です。良走路と湿走路に分けて表示し、数値が高いほど3着以内に入った割合が高いことを示します。",
    },
    recent180: {
      title: "近180日成績",
      description: "直近180日の正常競走について、良走路・湿走路別に「1着－2着－3着－着外／全」の順で回数を表示します。「全」は、それぞれの走路で競走が成立した出走回数です。",
    },
    year: {
      title: "今年",
      description: "今年に入ってからの優勝回数と、優勝戦に進出した回数（優出）を表示します。優出は、優勝戦の着順にかかわらず進出した回数として数えます。",
    },
    career: {
      title: "通算",
      description: "選手がデビューしてから現在までに優勝した通算回数を表示します。普通開催とグレードレースを含む、これまでの優勝実績を確認できます。",
    },
    rank: {
      title: "ランク",
      description: "現在適用されている全国ランクです。S級・A級・B級の順に区分され、数字は同じ級の中での順位を示します。2行目の「前」は、前期に適用されていたランクです。",
    },
    points: {
      title: "審査P",
      description: "ランク審査に用いられる審査ポイントです。審査期間中の着順位や競走タイム順位などを点数化して算出し、次期ランクを決める基準となります。",
    },
    machine: {
      title: "車名",
      description: "選手が使用する競走車の車名を表示します。2行目は車級と排気量で、「1級 600cc」は1級車の600ccエンジンを搭載した競走車であることを示します。",
    },
    "recent-run": {
      title: "前走～10走前",
      description: "各選手の直近10走を、新しいレースから順に表示します。上段は月日、レース場とR、グレード、レース種別、走路状況、出走車数、当時の車番で、左の大きな数字は着順です。下段は競走T、試走T、ST、Hを表示します。",
    },
    "matchup-sp": {
      title: "SP",
      description: "ZEN RACE独自指標です。SP（ストロングポイント）は、今回の出走選手同士の過去の直接対戦結果を基に、対戦優位度を数値化したものです。数値が高いほど、掲載している相手関係で優位な実績が多いことを示します。",
    },
    "matchup-opponent": {
      title: "対戦相手（1～8）",
      description: "行の選手と、列の車番の選手が同じレースに出走したときの直接対戦成績です。上段は行の選手が相手より先着した割合、下段は「先着回数－後着回数」を表示します。50％は互角で、50％を超えるほど行の選手が優位です。同一選手の欄は対象外です。",
    },
    comment: {
      title: "コメント",
      description: "レース前に発表された選手コメントです。競走車の状態、整備内容、タイヤ、試走やスタートの感触、当日の作業予定などを掲載します。発表後の整備や気象・走路状況の変化により、実際の状態と異なる場合があります。",
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
    const preparedTriggers = [...document.querySelectorAll("[data-racecard-prepared]")];
    const detailToast = document.querySelector(".racecard-detail-toast");
    if (!overlay || !title || !description || !closeButton || !raceInfo || !stage || !triggers.length) return;

    let activeTrigger = null;
    let geometryFrame = 0;
    let detailToastTimer = 0;

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
      if (help.descriptionHtml) {
        description.innerHTML = help.descriptionHtml;
      } else {
        description.textContent = help.description;
      }
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

    preparedTriggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        close();
        if (!detailToast) return;
        window.clearTimeout(detailToastTimer);
        detailToast.classList.add("is-visible");
        detailToastTimer = window.setTimeout(() => detailToast.classList.remove("is-visible"), 1800);
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

(() => {
  "use strict";

  // 添付データセットの基準日・表示基準時刻。
  const todayBase = new Date(2026, 1, 23);
  const selectedDate = new Date(todayBase);
  const REFERENCE_MINUTES = 16 * 60 + 40;
  const FOCUS_SLOT_INDEX = 1;
  const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];
  const JAPAN_HOLIDAYS_2026 = new Set([
    "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23",
    "2026-03-20", "2026-04-29", "2026-05-03", "2026-05-04",
    "2026-05-05", "2026-05-06", "2026-07-20", "2026-08-11",
    "2026-09-21", "2026-09-22", "2026-09-23", "2026-10-12",
    "2026-11-03", "2026-11-23",
  ]);

  const races = Array.isArray(window.ZENRACE_RACES) ? window.ZENRACE_RACES : [];
  const venueOrder = Array.isArray(window.ZENRACE_VENUE_ORDER) ? window.ZENRACE_VENUE_ORDER : [];

  const showPreparingToast = () => {
    let toast = document.querySelector(".today-race-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "today-race-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.append(toast);
    }
    toast.textContent = "遷移先ページは準備中です";
    toast.classList.add("is-visible");
    window.clearTimeout(Number(toast.dataset.timer || 0));
    const timer = window.setTimeout(() => toast.classList.remove("is-visible"), 1800);
    toast.dataset.timer = String(timer);
  };

  const pad = (value) => String(value).padStart(2, "0");
  const dateKey = (value) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const startOfDay = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const diffDays = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
  const isHoliday = (value) => JAPAN_HOLIDAYS_2026.has(dateKey(value));
  const formatDateTitle = (value) => {
    const holidayClass = isHoliday(value) ? " holiday" : "";
    return `${value.getFullYear()}年 ${value.getMonth() + 1}月 ${value.getDate()}日 <span class="date-weekday${holidayClass}">(${WEEKDAY[value.getDay()]})</span>`;
  };
  const timeToMinutes = (time) => {
    const [hour, minute] = String(time).split(":").map(Number);
    return (hour * 60) + minute;
  };
  const groupKey = (sport, venue) => `${sport}:${venue}`;



  const groupRacesByVenue = () => {
    const grouped = new Map();
    for (const race of races) {
      const key = groupKey(race.sport, race.venue);
      if (!grouped.has(key)) {
        grouped.set(key, { venue: race.venue, sport: race.sport, races: [] });
      }
      grouped.get(key).races.push({ ...race, minutes: timeToMinutes(race.time) });
    }

    const venueRank = new Map(venueOrder.map((item, index) => [groupKey(item.sport, item.venue), index]));
    return [...grouped.entries()]
      .map(([key, row]) => ({ ...row, key, races: row.races.sort((a, b) => a.minutes - b.minutes) }))
      .sort((a, b) => (venueRank.get(a.key) ?? 999) - (venueRank.get(b.key) ?? 999));
  };

  const createCard = (race, className = "") => {
    if (!race) {
      return `<span class="race-card placeholder ${className}" aria-hidden="true"><span class="race-no">--</span><span class="race-time">--:--</span></span>`;
    }
    const label = `${race.venue} ${race.race} 締切${race.time}`;
    return `<a href="#" class="race-card ${className}" aria-label="${label}"><span class="race-no">${race.race}</span><span class="race-time">${race.time}</span></a>`;
  };

  const buildCurrentTrack = (row) => {
    const nextIndex = row.races.findIndex((race) => race.minutes > REFERENCE_MINUTES);
    if (nextIndex < 0) {
      return {
        mode: "ended",
        cards: [
          ...row.races.map((race, index) => createCard(
            race,
            index === row.races.length - 1 ? "finished final" : "finished",
          )),
          '<span class="race-end-tail" aria-hidden="true"></span>',
        ].join(""),
      };
    }

    const cards = [];
    if (nextIndex === 0) cards.push(createCard(null, "spacer"));
    row.races.forEach((race, index) => {
      let className = "upcoming";
      if (index < nextIndex) className = "finished";
      if (index === nextIndex) className = "current";
      cards.push(createCard(race, className));
    });
    cards.push('<span class="race-active-tail" aria-hidden="true"></span>');
    return { mode: "active", cards: cards.join("") };
  };

  const buildPastTrack = (row) => ({
    mode: "ended",
    cards: [
      ...row.races.map((race, index) => createCard(
        race,
        index === row.races.length - 1 ? "finished final" : "finished",
      )),
      '<span class="race-end-tail" aria-hidden="true"></span>',
    ].join(""),
  });

  const buildFutureTrack = (row) => ({
    mode: "future",
    cards: [
      createCard(null, "spacer"),
      ...row.races.map((race, index) => createCard(race, index === 0 ? "current" : "upcoming")),
      '<span class="race-active-tail" aria-hidden="true"></span>',
    ].join(""),
  });

  const renderRow = (row, dayDiff) => {
    let track = buildCurrentTrack(row);
    if (dayDiff < 0) track = buildPastTrack(row);
    if (dayDiff > 0) track = buildFutureTrack(row);

    return `
      <article class="venue-row" data-mode="${track.mode}">
        <div class="venue-card sport-${row.sport}">
          <div class="venue-name">${row.venue}</div>
          <span class="venue-sport-icon ${row.sport}" aria-hidden="true"></span>
        </div>
        <div class="venue-track-shell">
          <div class="venue-track" data-mode="${track.mode}">${track.cards}</div>
        </div>
      </article>`;
  };

  const alignTrack = (track) => {
    if (!track) return;
    if (track.dataset.mode === "ended") {
      const finalCard = track.querySelector(".race-card.final");
      if (!finalCard) {
        track.scrollLeft = 0;
        return;
      }
      const styles = getComputedStyle(document.documentElement);
      const trackPad = parseFloat(styles.getPropertyValue("--track-pad-x")) || 8;
      const bandShift = parseFloat(styles.getPropertyValue("--focus-band-shift")) || 0;
      track.scrollLeft = Math.max(0, finalCard.offsetLeft - trackPad - bandShift);
      return;
    }
    const focusCard = track.querySelector(".race-card.current");
    if (!focusCard) {
      track.scrollLeft = 0;
      return;
    }
    const styles = getComputedStyle(document.documentElement);
    const slotWidth = parseFloat(styles.getPropertyValue("--race-card-w")) || focusCard.offsetWidth || 76;
    const slotGap = parseFloat(styles.getPropertyValue("--track-gap")) || 7;
    const trackPad = parseFloat(styles.getPropertyValue("--track-pad-x")) || 8;
    const bandShift = parseFloat(styles.getPropertyValue("--focus-band-shift")) || 0;
    const target = focusCard.offsetLeft - trackPad - (FOCUS_SLOT_INDEX * (slotWidth + slotGap)) - bandShift;
    track.scrollLeft = Math.max(0, target);
  };

  const render = () => {
    const board = document.getElementById("todayBoard");
    const dateTitle = document.getElementById("dateTitle");
    const todayBtn = document.getElementById("todayBtn");
    const isCurrentDay = dateKey(selectedDate) === dateKey(todayBase);
    const dayDiff = diffDays(selectedDate, todayBase);

    dateTitle.innerHTML = formatDateTitle(selectedDate);
    todayBtn.classList.toggle("is-current", isCurrentDay);
    todayBtn.disabled = isCurrentDay;

    const rows = groupRacesByVenue();
    board.innerHTML = rows.map((row) => renderRow(row, dayDiff)).join("");

    board.querySelectorAll(".race-card[href='#']").forEach((card) => {
      card.addEventListener("click", (event) => {
        event.preventDefault();
        showPreparingToast();
      });
    });

    requestAnimationFrame(() => board.querySelectorAll(".venue-track").forEach(alignTrack));
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("prevDate")?.addEventListener("click", () => {
      selectedDate.setDate(selectedDate.getDate() - 1);
      render();
    });
    document.getElementById("nextDate")?.addEventListener("click", () => {
      selectedDate.setDate(selectedDate.getDate() + 1);
      render();
    });
    document.getElementById("todayBtn")?.addEventListener("click", () => {
      selectedDate.setTime(todayBase.getTime());
      render();
    });

    render();
    window.addEventListener("resize", () => document.querySelectorAll(".venue-track").forEach(alignTrack));
  });
})();

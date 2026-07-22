(() => {
  "use strict";

  const toolbar = document.querySelector("[data-zenrace-date-selector]");
  if (!toolbar) return;

  const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];
  const HOLIDAYS_2026 = new Set([
    "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23",
    "2026-03-20", "2026-04-29", "2026-05-03", "2026-05-04",
    "2026-05-05", "2026-05-06", "2026-07-20", "2026-08-11",
    "2026-09-21", "2026-09-22", "2026-09-23", "2026-10-12",
    "2026-11-03", "2026-11-23",
  ]);

  const pad = (value) => String(value).padStart(2, "0");
  const dateKey = (value) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const parseDate = (value, fallback = new Date()) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    return match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(fallback);
  };
  const startOfDay = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

  const baseDate = parseDate(toolbar.dataset.baseDate || "");
  const minDate = parseDate(toolbar.dataset.minDate || "", baseDate);
  const maxDate = parseDate(toolbar.dataset.maxDate || "", baseDate);
  const selectedDate = new Date(baseDate);
  const title = toolbar.querySelector("[data-date-title]");
  const previous = toolbar.querySelector("[data-date-prev]");
  const next = toolbar.querySelector("[data-date-next]");
  const today = toolbar.querySelector("[data-date-today]");
  const refresh = toolbar.querySelector("[data-date-refresh]");

  const showPreparingToast = () => {
    let toast = document.querySelector(".date-selector-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "date-selector-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.append(toast);
    }
    toast.textContent = "遷移先ページは準備中";
    toast.classList.add("is-visible");
    window.clearTimeout(Number(toast.dataset.timer || 0));
    const timer = window.setTimeout(() => toast.classList.remove("is-visible"), 1800);
    toast.dataset.timer = String(timer);
  };

  const formatTitle = (value) => {
    const weekday = value.getDay();
    const classes = ["date-weekday"];
    if (HOLIDAYS_2026.has(dateKey(value))) classes.push("holiday");
    else if (weekday === 0) classes.push("sunday");
    else if (weekday === 6) classes.push("saturday");
    return `${value.getFullYear()}年 ${value.getMonth() + 1}月 ${value.getDate()}日 <span class="${classes.join(" ")}">(${WEEKDAY[weekday]})</span>`;
  };

  const render = () => {
    if (title) title.innerHTML = formatTitle(selectedDate);
    const current = dateKey(selectedDate) === dateKey(baseDate);
    today?.classList.toggle("is-current", current);
    if (today) today.disabled = current;
    toolbar.dataset.selectedDate = dateKey(selectedDate);
  };

  const notifyRefresh = () => {
    render();
    window.dispatchEvent(new CustomEvent("zenrace-date-refresh", {
      detail: { date: dateKey(selectedDate) },
    }));
  };

  previous?.addEventListener("click", () => {
    if (startOfDay(selectedDate) <= startOfDay(minDate)) {
      showPreparingToast();
      return;
    }
    selectedDate.setDate(selectedDate.getDate() - 1);
    notifyRefresh();
  });
  next?.addEventListener("click", () => {
    if (startOfDay(selectedDate) >= startOfDay(maxDate)) {
      showPreparingToast();
      return;
    }
    selectedDate.setDate(selectedDate.getDate() + 1);
    notifyRefresh();
  });
  today?.addEventListener("click", () => {
    selectedDate.setTime(baseDate.getTime());
    notifyRefresh();
  });
  refresh?.addEventListener("click", notifyRefresh);

  render();
})();

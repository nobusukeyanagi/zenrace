(() => {
  "use strict";

  const preferences = window.ZENRACE_SPORT_PREFERENCES;
  const list = document.querySelector("[data-sport-setting-list]");
  if (!preferences || !list) return;

  const status = document.querySelector("[data-sport-order-status]");
  const shell = document.querySelector(".zenrace-content-shell");
  const sportLabel = new Map(preferences.SPORTS.map(({ id, label }) => [id, label]));
  let drag = null;
  let autoScrollFrame = 0;
  let autoScrollSpeed = 0;

  const rows = () => [...list.querySelectorAll("[data-sport-row]")];

  const currentState = () => ({
    order: rows().map((row) => row.dataset.sportId),
    enabled: rows()
      .filter((row) => row.querySelector("[data-sport-preference]")?.checked)
      .map((row) => row.dataset.sportId),
  });

  const save = () => preferences.writeState(currentState());

  const announcePosition = (row) => {
    if (!status || !row) return;
    const orderedRows = rows();
    const position = orderedRows.indexOf(row) + 1;
    const label = sportLabel.get(row.dataset.sportId) || row.dataset.sportId;
    status.textContent = `${label}を${position}番目に移動しました。`;
  };

  const sync = () => {
    if (drag) return;
    const state = preferences.readState();
    const byId = new Map(rows().map((row) => [row.dataset.sportId, row]));
    state.order.forEach((sport) => {
      const row = byId.get(sport);
      if (row) list.append(row);
    });
    const enabled = new Set(state.enabled);
    rows().forEach((row) => {
      const checkbox = row.querySelector("[data-sport-preference]");
      if (checkbox) checkbox.checked = enabled.has(row.dataset.sportId);
    });
  };

  const moveRowByKeyboard = (row, direction) => {
    const orderedRows = rows();
    const index = orderedRows.indexOf(row);
    const targetIndex = Math.max(0, Math.min(orderedRows.length - 1, index + direction));
    if (index === targetIndex) return;

    if (targetIndex < index) list.insertBefore(row, orderedRows[targetIndex]);
    else list.insertBefore(row, orderedRows[targetIndex].nextSibling);

    save();
    announcePosition(row);
    row.querySelector("[data-sport-drag-handle]")?.focus();
  };

  const stopAutoScroll = () => {
    autoScrollSpeed = 0;
    if (autoScrollFrame) cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = 0;
  };

  const placePlaceholder = (clientY) => {
    if (!drag) return;
    const otherRows = rows();
    const next = otherRows.find((row) => {
      const rect = row.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    if (next) list.insertBefore(drag.placeholder, next);
    else list.append(drag.placeholder);
  };

  const autoScrollTick = () => {
    if (!drag || !shell || !autoScrollSpeed) {
      autoScrollFrame = 0;
      return;
    }
    shell.scrollTop += autoScrollSpeed;
    placePlaceholder(drag.lastCenterY);
    autoScrollFrame = requestAnimationFrame(autoScrollTick);
  };

  const updateAutoScroll = (clientY) => {
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    const edge = Math.min(70, rect.height * .18);
    if (clientY < rect.top + edge) {
      autoScrollSpeed = -Math.max(3, Math.min(13, (rect.top + edge - clientY) * .18));
    } else if (clientY > rect.bottom - edge) {
      autoScrollSpeed = Math.max(3, Math.min(13, (clientY - (rect.bottom - edge)) * .18));
    } else {
      autoScrollSpeed = 0;
    }
    if (autoScrollSpeed && !autoScrollFrame) autoScrollFrame = requestAnimationFrame(autoScrollTick);
    if (!autoScrollSpeed) stopAutoScroll();
  };

  const moveDrag = (clientY) => {
    if (!drag) return;
    const top = clientY - drag.pointerOffsetY;
    drag.row.style.top = `${top}px`;
    drag.lastCenterY = top + drag.height / 2;
    placePlaceholder(drag.lastCenterY);
    updateAutoScroll(clientY);
  };

  const finishDrag = (announce = true) => {
    if (!drag) return;
    stopAutoScroll();
    const { row, placeholder, handle, pointerId } = drag;
    drag = null;

    try {
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    } catch (_) {
      // pointercaptureが既に解除されている場合は何もしない。
    }

    placeholder.replaceWith(row);
    row.classList.remove("is-dragging");
    row.style.removeProperty("left");
    row.style.removeProperty("top");
    row.style.removeProperty("width");
    row.style.removeProperty("height");
    save();
    if (announce) announcePosition(row);
    handle.focus({ preventScroll: true });
  };

  const startDrag = (event, handle) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const row = handle.closest("[data-sport-row]");
    if (!row || drag) return;

    event.preventDefault();
    const rect = row.getBoundingClientRect();
    const placeholder = document.createElement("div");
    placeholder.className = "sport-setting-placeholder";
    placeholder.style.height = `${rect.height}px`;
    list.insertBefore(placeholder, row);
    document.body.append(row);

    row.classList.add("is-dragging");
    row.style.left = `${rect.left}px`;
    row.style.top = `${rect.top}px`;
    row.style.width = `${rect.width}px`;
    row.style.height = `${rect.height}px`;

    drag = {
      row,
      placeholder,
      handle,
      pointerId: event.pointerId,
      pointerOffsetY: event.clientY - rect.top,
      height: rect.height,
      lastCenterY: rect.top + rect.height / 2,
    };
    handle.setPointerCapture(event.pointerId);
  };

  list.addEventListener("change", (event) => {
    if (!event.target.matches("[data-sport-preference]")) return;
    save();
  });

  list.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-sport-drag-handle]");
    if (handle) startDrag(event, handle);
  });

  list.addEventListener("keydown", (event) => {
    const handle = event.target.closest("[data-sport-drag-handle]");
    if (!handle || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const row = handle.closest("[data-sport-row]");
    moveRowByKeyboard(row, event.key === "ArrowUp" ? -1 : 1);
  });

  document.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    moveDrag(event.clientY);
  }, { passive: false });

  document.addEventListener("pointerup", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    finishDrag(true);
  });

  document.addEventListener("pointercancel", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    finishDrag(false);
  });

  window.addEventListener("blur", () => finishDrag(false));
  window.addEventListener("pageshow", sync);
  window.addEventListener("zenrace:sport-preferences-change", sync);

  sync();
})();

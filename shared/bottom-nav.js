(() => {
  "use strict";

  const scriptUrl = document.currentScript?.src || window.location.href;
  const appRoot = new URL("../", scriptUrl);

  const routes = [
    {
      id: "home",
      label: "ホーム",
      path: "",
      icon: `
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <path d="M10 47.5L48 14l38 33.5" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20 45v36h20V58h16v23h20V45L48 20 20 45z" fill="currentColor"/>
        </svg>`,
    },
    {
      id: "schedule",
      label: "開催情報",
      path: "gradedraces/",
      icon: `
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <rect x="15" y="17" width="66" height="64" rx="8" fill="none" stroke="currentColor" stroke-width="8"/>
          <path d="M15 33h66" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
          <path d="M31 12v16M65 12v16" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
          <rect x="28" y="44" width="10" height="10" rx="2" fill="currentColor"/>
          <rect x="43" y="44" width="10" height="10" rx="2" fill="currentColor"/>
          <rect x="58" y="44" width="10" height="10" rx="2" fill="currentColor"/>
          <rect x="28" y="59" width="10" height="10" rx="2" fill="currentColor"/>
          <rect x="43" y="59" width="10" height="10" rx="2" fill="currentColor"/>
          <rect x="58" y="59" width="10" height="10" rx="2" fill="currentColor"/>
        </svg>`,
    },
    {
      id: "vote",
      label: "投票",
      path: "vote/",
      featured: true,
      icon: `
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <rect x="15" y="18" width="66" height="60" rx="7" fill="none" stroke="currentColor" stroke-width="8"/>
          <path d="M28 33h40M28 49h18M28 64h18" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
          <rect x="55" y="47" width="16" height="20" rx="3" fill="currentColor"/>
        </svg>`,
    },
    {
      id: "onair",
      label: "ONAIR",
      path: "onair/",
      icon: `
        <svg viewBox="0 0 112 96" aria-hidden="true">
          <rect x="15" y="17" width="82" height="55" rx="5" fill="none" stroke="currentColor" stroke-width="8"/>
          <path d="M27 29h28L27 57V29z" fill="currentColor"/>
          <path d="M56 72v10M39 84h34" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
        </svg>`,
    },
    {
      id: "mypage",
      label: "マイページ",
      path: "mypage/",
      icon: `
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="27" r="18" fill="currentColor"/>
          <path d="M17 83c2.5-20 15-33 31-33s28.5 13 31 33H17z" fill="currentColor"/>
        </svg>`,
    },
  ];

  class ZenraceBottomNav extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;

      const active = this.getAttribute("active") || "home";
      const available = new Set(
        (this.getAttribute("available") || "home schedule")
          .split(/[\s,]+/)
          .filter(Boolean),
      );
      available.add(active);

      const shadow = this.attachShadow({ mode: "open" });
      const items = routes.map((route) => {
        const isActive = route.id === active;
        const isAvailable = available.has(route.id);
        const href = new URL(route.path, appRoot).href;
        const classes = [
          "item",
          isActive ? "active" : "",
          route.featured ? "featured" : "",
          !isAvailable ? "disabled" : "",
        ].filter(Boolean).join(" ");

        return `
          <a
            class="${classes}"
            href="${isAvailable ? href : "#"}"
            data-route="${route.id}"
            ${isActive ? 'aria-current="page"' : ""}
            ${!isAvailable ? 'aria-disabled="true" tabindex="-1"' : ""}
          >
            <span class="icon">${route.icon}</span>
            <span class="label">${route.label}</span>
          </a>`;
      }).join("");

      shadow.innerHTML = `
        <style>
          :host {
            --nav-yellow: #ffd76a;
            --nav-white: #ffffff;
            --nav-bg: rgba(4, 7, 12, 0.88);
            display: block;
            height: calc(clamp(84px, 22vw, 94px) + env(safe-area-inset-bottom, 0px));
          }

          * { box-sizing: border-box; }

          .nav {
            position: fixed;
            z-index: 1000;
            right: 0;
            bottom: 0;
            left: 0;
            height: calc(clamp(84px, 22vw, 94px) + env(safe-area-inset-bottom, 0px));
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            padding: 4px 0 env(safe-area-inset-bottom, 0px);
            background:
              linear-gradient(180deg, rgba(255,255,255,.035), transparent 18%),
              var(--nav-bg);
            border-top: 1px solid rgba(255,255,255,.09);
            box-shadow: 0 -8px 24px rgba(0,0,0,.35);
            backdrop-filter: blur(16px) saturate(125%);
            -webkit-backdrop-filter: blur(16px) saturate(125%);
          }

          .item {
            position: relative;
            isolation: isolate;
            min-width: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            padding: 4px 1px 5px;
            color: var(--nav-white);
            text-decoration: none;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
          }

          .item::after {
            content: "";
            position: absolute;
            right: 24%;
            bottom: 3px;
            left: 24%;
            height: 3px;
            border-radius: 999px;
            opacity: 0;
            background: linear-gradient(90deg, transparent, var(--nav-yellow), transparent);
            box-shadow: 0 0 12px rgba(255,215,106,.55);
          }

          .item.active {
            color: var(--nav-yellow);
          }

          .item.active::after {
            opacity: 1;
          }

          .item.featured::before {
            content: "";
            position: absolute;
            z-index: -1;
            inset: 5px 8px 4px;
            border: 1px solid rgba(255,215,106,.24);
            border-radius: 17px;
            background:
              radial-gradient(circle at 50% 20%, rgba(255,215,106,.18), transparent 50%),
              linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02));
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.12),
              0 0 16px rgba(255,215,106,.10);
          }

          .item.disabled {
            cursor: default;
          }

          .icon {
            width: clamp(29px, 8.3vw, 38px);
            height: clamp(29px, 8.3vw, 38px);
            display: grid;
            place-items: center;
            transform: translateY(-4px);
            filter: drop-shadow(0 2px 4px rgba(0,0,0,.38));
          }

          .icon svg {
            width: 100%;
            height: 100%;
            display: block;
          }

          .label {
            max-width: 100%;
            overflow: hidden;
            color: currentColor;
            font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif;
            font-size: clamp(9px, 2.65vw, 12px);
            font-weight: 900;
            line-height: 1.15;
            letter-spacing: .01em;
            text-overflow: clip;
            text-shadow: 0 2px 4px rgba(0,0,0,.5);
            white-space: nowrap;
          }

          .item[data-route="onair"] .label {
            letter-spacing: .04em;
          }

          @media (hover: hover) {
            .item:not(.disabled):hover {
              background: rgba(255,255,255,.045);
            }
          }

          @media (max-width: 340px) {
            .item.featured::before {
              inset-inline: 5px;
            }
            .label {
              font-size: 9px;
            }
          }

          @media print {
            :host,
            .nav {
              display: none !important;
            }
          }
        </style>
        <nav class="nav" aria-label="メインナビゲーション">
          ${items}
        </nav>`;

      shadow.querySelectorAll(".disabled").forEach((item) => {
        item.addEventListener("click", (event) => event.preventDefault());
      });
    }
  }

  if (!customElements.get("zenrace-bottom-nav")) {
    customElements.define("zenrace-bottom-nav", ZenraceBottomNav);
  }
})();

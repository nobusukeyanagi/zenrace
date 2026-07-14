(() => {
  if (customElements.get("zenrace-bottom-nav")) return;

  const scriptUrl = document.currentScript?.src || window.location.href;
  const appRoot = new URL("../", scriptUrl);
  const ROUTES = [
    {
      id: "home",
      label: "ホーム",
      path: "",
      icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.2 12 4l9 7.2"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></svg>`,
    },
    {
      id: "schedule",
      label: "開催情報",
      path: "gradedraces/",
      icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M7.5 3.5v4M16.5 3.5v4M3.5 9.5h17"/><path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/></svg>`,
    },
    {
      id: "vote",
      label: "投票",
      path: "vote/",
      featured: true,
      icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5h11l3 3V20.5H5z"/><path d="M16 3.5v4h4M8 11h8M8 14.5h8M8 18h5"/><path d="m8 7 1.3 1.3L12 5.7"/></svg>`,
    },
    {
      id: "onair",
      label: "ONAIR",
      path: "onair/",
      icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="13" rx="2"/><path d="m10 8 5 3-5 3zM8 21h8M12 17.5V21"/></svg>`,
    },
    {
      id: "mypage",
      label: "マイページ",
      path: "mypage/",
      icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"/></svg>`,
    },
  ];

  class ZenraceBottomNav extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      const active = this.getAttribute("active") || "home";
      const available = new Set((this.getAttribute("available") || "home schedule").split(/[\s,]+/).filter(Boolean));
      available.add(active);
      const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

      const shadow = this.attachShadow({ mode: "open" });
      const items = ROUTES.map((route) => {
        const isActive = route.id === active;
        const isAvailable = available.has(route.id);
        const href = new URL(route.path, appRoot).href;
        const classes = [
          'item',
          isActive ? 'active' : '',
          route.featured ? 'featured' : '',
          !isAvailable ? 'disabled' : '',
        ].filter(Boolean).join(' ');
        const ariaCurrent = isActive ? 'aria-current="page"' : '';
        const ariaDisabled = !isAvailable ? 'aria-disabled="true" tabindex="-1"' : '';
        return `<a class="${classes}" href="${href}" ${ariaCurrent} ${ariaDisabled}><span class="icon">${route.icon}</span><span class="label">${route.label}</span></a>`;
      }).join('');

      shadow.innerHTML = `
        <style>
          :host{
            --safe:max(env(safe-area-inset-bottom),0px);
            position:fixed;left:0;right:0;bottom:0;z-index:2000;display:block;
            height:calc(${standalone ? '58px' : '62px'} + var(--safe));
            font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Yu Gothic UI","Hiragino Kaku Gothic ProN",Meiryo,sans-serif;
            -webkit-text-size-adjust:100%;text-size-adjust:100%;
          }
          *{box-sizing:border-box}
          nav{
            width:100%;height:100%;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:start;
            padding:4px 4px var(--safe);
            color:#d7dce3;
            background:
              linear-gradient(110deg,rgba(213,171,67,.08),transparent 27%,transparent 72%,rgba(213,171,67,.07)),
              linear-gradient(180deg,#151515,#070707);
            border-top:1px solid rgba(213,171,67,.4);
            box-shadow:0 -5px 18px rgba(0,0,0,.25);
          }
          .item{
            min-width:0;height:${standalone ? '53px' : '57px'};display:flex;flex-direction:column;align-items:center;justify-content:center;
            gap:4px;color:inherit;text-decoration:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;
            position:relative;border-radius:12px;
          }
          .item.featured{
            color:#f3e1ae;
          }
          .item.featured::before{
            content:"";position:absolute;left:50%;top:4px;transform:translateX(-50%);
            width:44px;height:44px;border-radius:14px;
            background:linear-gradient(180deg,rgba(213,171,67,.28),rgba(213,171,67,.12));
            box-shadow:inset 0 0 0 1px rgba(213,171,67,.22);
            z-index:0;
          }
          .item > *{position:relative;z-index:1}
          .icon{width:${standalone ? '25px' : '27px'};height:${standalone ? '25px' : '27px'};display:grid;place-items:center;flex:none}
          svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
          .label{font-size:${standalone ? '9.5px' : '10px'};line-height:1;font-weight:750;white-space:nowrap;letter-spacing:-.02em}
          .active{color:#f0cc70}
          .active .icon{filter:drop-shadow(0 0 5px rgba(213,171,67,.28))}
          .active .label{font-weight:900}
          .disabled{opacity:.38;pointer-events:none}
          @media(max-width:380px){
            .icon{width:25px;height:25px}
            .label{font-size:9px}
            .item{gap:3px}
            .item.featured::before{width:42px;height:42px}
          }
        </style>
        <nav aria-label="メインナビゲーション">${items}</nav>
      `;
    }
  }

  customElements.define("zenrace-bottom-nav", ZenraceBottomNav);
})();

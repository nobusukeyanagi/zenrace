(() => {
  "use strict";

  class ZenraceRaceInfo extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === "true") return;
      this.dataset.ready = "true";
      const videoId = `race-live-${Math.random().toString(36).slice(2)}`;
      this.innerHTML = `
        <section class="shared-race-info featured-race" aria-label="浜松12R レース情報">
          <div class="race-info-primary">
            <strong class="race-info-venue">浜松</strong>
            <span class="race-info-number">12R</span>
            <span class="race-info-icon auto" aria-label="オートレース"></span>
            <span class="race-info-icon sg" aria-label="SG">SG</span>
            <span class="race-info-icon final-day" aria-label="最終日">終</span>
            <button class="race-live-button" type="button" aria-expanded="false" aria-controls="${videoId}"><span aria-hidden="true">▶</span>ライブ映像</button>
          </div>
          <h1 class="race-info-title">第39回全日本選抜オートレース</h1>
          <div class="race-info-status">
            <strong class="race-info-final">優勝戦</strong>
            <span class="race-info-time"><span class="race-info-time-label">投票締切</span><time datetime="2026-02-23T16:43:00+09:00">16:43</time></span>
            <span class="race-info-time"><span class="race-info-time-label">発走</span><time datetime="2026-02-23T16:45:00+09:00">16:45</time></span>
          </div>
          <p class="race-info-date">2026年2月23日(月)　5100m　晴　良走路57.0℃　気温20.0℃　湿度43.0%</p>
          <div class="race-info-video" id="${videoId}" hidden>
            <div class="race-info-video-frame" data-video-frame></div>
          </div>
        </section>`;

      const button = this.querySelector('.race-live-button');
      const video = this.querySelector('.race-info-video');
      const frame = this.querySelector('[data-video-frame]');
      button?.addEventListener('click', () => {
        const opening = video.hidden;
        video.hidden = !opening;
        button.setAttribute('aria-expanded', String(opening));
        button.classList.toggle('active', opening);
        if (opening && frame && !frame.firstElementChild) {
          const iframe = document.createElement('iframe');
          iframe.src = 'https://www.youtube.com/embed/6K-6KhGE238?rel=0&playsinline=1';
          iframe.title = '浜松オートレース ライブ映像';
          iframe.loading = 'lazy';
          iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
          iframe.referrerPolicy = 'strict-origin-when-cross-origin';
          iframe.allowFullscreen = true;
          frame.appendChild(iframe);
        }
      });
    }
  }

  if (!customElements.get("zenrace-race-info")) {
    customElements.define("zenrace-race-info", ZenraceRaceInfo);
  }
})();

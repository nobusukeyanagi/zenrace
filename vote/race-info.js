(() => {
  "use strict";

  class ZenraceRaceInfo extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === "true") return;
      this.dataset.ready = "true";
      const videoId = `race-live-${Math.random().toString(36).slice(2)}`;
      this.innerHTML = `
        <section class="shared-race-info" aria-label="浜松12R レース情報">
          <div class="race-info-primary">
            <button class="race-info-filter-toggle" type="button" aria-label="浜松のレースだけ表示" aria-pressed="false">
              <strong class="race-info-venue">浜松</strong>
              <span class="race-info-number">12R</span>
            </button>
            <span class="race-info-icon auto" aria-label="オートレース"></span>
            <span class="race-info-icon sg" aria-label="SG">SG</span>
            <span class="race-info-icon final-day" aria-label="最終日">終</span>
            <button class="race-live-button" type="button" aria-expanded="false" aria-controls="${videoId}"><span aria-hidden="true">▶</span>ライブ映像</button>
          </div>
          <h1 class="race-info-title race-info-marquee-line" data-race-info-marquee aria-label="第39回全日本選抜オートレース"><span class="race-info-marquee-track"><span class="race-info-marquee-copy">第39回全日本選抜オートレース</span><span class="race-info-marquee-copy" aria-hidden="true">第39回全日本選抜オートレース</span></span></h1>
          <div class="race-info-status race-info-marquee-line" data-race-info-marquee aria-label="優勝戦　締切16時43分　発走16時45分">
            <span class="race-info-marquee-track">
              <span class="race-info-status-copy">
                <strong class="race-info-final">優勝戦</strong>
                <span class="race-info-time"><span class="race-info-time-label">締切</span><time datetime="2026-02-23T16:43:00+09:00">16:43</time></span>
                <span class="race-info-time"><span class="race-info-time-label">発走</span><time datetime="2026-02-23T16:45:00+09:00">16:45</time></span>
              </span>
              <span class="race-info-status-copy" aria-hidden="true">
                <strong class="race-info-final">優勝戦</strong>
                <span class="race-info-time"><span class="race-info-time-label">締切</span><time datetime="2026-02-23T16:43:00+09:00">16:43</time></span>
                <span class="race-info-time"><span class="race-info-time-label">発走</span><time datetime="2026-02-23T16:45:00+09:00">16:45</time></span>
              </span>
            </span>
          </div>
          <p class="race-info-date race-info-marquee-line" data-race-info-marquee aria-label="2026年2月23日(月)　晴　良走路57.0℃　気温20.0℃　湿度43.0%　5100m(10周)"><span class="race-info-marquee-track"><span class="race-info-marquee-copy">2026年2月23日(月)　晴　良走路57.0℃　気温20.0℃　湿度43.0%　5100m(10周)</span><span class="race-info-marquee-copy" aria-hidden="true">2026年2月23日(月)　晴　良走路57.0℃　気温20.0℃　湿度43.0%　5100m(10周)</span></span></p>
          <div class="race-info-video" id="${videoId}" hidden>
            <div class="race-info-video-frame" data-video-frame></div>
          </div>
        </section>`;

      const filterToggle = this.querySelector('.race-info-filter-toggle');
      let venueOnly = false;
      filterToggle?.addEventListener('click', () => {
        venueOnly = !venueOnly;
        filterToggle.setAttribute('aria-pressed', String(venueOnly));
        filterToggle.setAttribute('aria-label', venueOnly ? '全開催場のレースを表示' : '浜松のレースだけ表示');
        filterToggle.classList.toggle('is-active', venueOnly);
        const raceSwitch = document.querySelector('zenrace-race-switch');
        if (raceSwitch && typeof raceSwitch.setVenueFilter === 'function') {
          raceSwitch.setVenueFilter('浜松', venueOnly);
        } else {
          document.dispatchEvent(new CustomEvent('zenrace:race-venue-filter', {
            detail: { venue: '浜松', enabled: venueOnly },
          }));
        }
      });

      const marqueeLines = [...this.querySelectorAll('[data-race-info-marquee]')];
      const updateMarquees = () => {
        marqueeLines.forEach((line) => {
          const copy = line.querySelector('.race-info-marquee-copy, .race-info-status-copy');
          if (!copy) return;
          line.classList.toggle('is-overflowing', copy.scrollWidth > line.clientWidth + 1);
        });
      };
      requestAnimationFrame(() => requestAnimationFrame(updateMarquees));
      window.addEventListener('resize', updateMarquees, { passive: true });

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

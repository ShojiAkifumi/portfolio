// 実績: data/works.json を読み込んで、トップ・一覧・詳細ページに表示する
(function () {
  "use strict";

  const cfg = window.SITE_CONFIG || {};
  const CATS = { lp: "LP", banner: "バナー" };
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const qs = new URLSearchParams(location.search);

  async function loadWorks() {
    const res = await fetch("data/works.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`works.json を読み込めませんでした (${res.status})`);
    const list = await res.json();
    // 新しい順（同じ日付は JSON に書いた順）
    return list
      .map((w, i) => ({ ...w, _i: i }))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || a._i - b._i);
  }

  const thumbOf = (w) => w.thumbnail || w.images?.mockup || w.images?.banner || w.images?.pc || "";

  function cardHTML(w) {
    const cat = w.category === "banner" ? "banner" : "lp";
    return `
      <a class="work-card" href="work.html?id=${encodeURIComponent(w.id)}" data-reveal data-cursor="view">
        <div class="work-card__visual work-card__visual--${cat} ink-reveal">
          <img src="${esc(thumbOf(w))}" alt="${esc(w.title)}" loading="lazy" decoding="async">
        </div>
        <div class="work-card__meta">
          <p class="work-card__tags">
            <span class="chip${cat === "banner" ? " chip--banner" : ""}">${CATS[cat]}</span>
            ${w.type === "実案件" ? `<span class="chip chip--client">${esc(w.type)}</span>` : `<span class="chip chip--line">${esc(w.type || "自主制作")}</span>`}
            <span>${esc(w.industry || "")}</span>
          </p>
          <h3 class="work-card__title">${esc(w.title)}</h3>
          ${w.summary ? `<p class="work-card__summary">${esc(w.summary)}</p>` : ""}
        </div>
      </a>`;
  }

  function renderFilter(box, works, current, onChange) {
    const count = (c) => (c === "all" ? works.length : works.filter((w) => w.category === c).length);
    const items = [
      ["all", "ALL"],
      ["lp", "LP"],
      ["banner", "BANNER"],
    ];
    box.innerHTML = items
      .map(
        ([k, label]) =>
          `<button type="button" data-cat="${k}" aria-pressed="${k === current}">${label}<span class="count">${count(k)}</span></button>`,
      )
      .join("");
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-cat]");
      if (!b) return;
      box.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      onChange(b.dataset.cat);
    });
  }

  function showError(box, err) {
    box.innerHTML = `<p class="works-empty">実績を読み込めませんでした。ページを再読み込みしてください。</p>`;
    console.error(err);
  }

  /* ---------- ファーストビューの実績スライダー ----------
     PC・タブレット: 右端に半円を描いて縦に流れる / スマホ: 横に流れる
     奥（正面から遠い）ほど小さく・淡く・ぼかして立体感を出す */
  async function initHero() {
    const root = document.querySelector("[data-hero-works]");
    if (!root) return;
    let works;
    try {
      works = await loadWorks();
    } catch (e) {
      console.error(e);
      return;
    }
    const cfg = window.SITE_CONFIG || {};
    const list = works.slice(0, cfg.heroWorksCount || 8);
    if (!list.length) return;
    new Arc(root, list, cfg.heroInterval || 3000);
  }

  function Arc(root, list, interval) {
    const stage = root.querySelector("[data-arc-stage]");
    const countEl = root.querySelector("[data-arc-count]");
    const titleEl = root.querySelector("[data-arc-title]");
    const reduce = window.Ink && window.Ink.reduceMotion;
    const narrow = window.matchMedia("(max-width: 640px)");
    // 1200px以下は横の広がりを狭めて、正面から上下3枚目までを画面内に収める
    const compact = window.matchMedia("(max-width: 1200px)");

    // 半円が途切れないよう、少ない時は複製して6枚以上にする
    const items = [];
    const copies = Math.max(1, Math.ceil(6 / list.length));
    for (let c = 0; c < copies; c++) {
      list.forEach((w, i) => {
        const cat = w.category === "banner" ? "banner" : "lp";
        const a = document.createElement("a");
        a.className = `arc-item arc-item--${cat}`;
        a.href = `work.html?id=${encodeURIComponent(w.id)}`;
        a.dataset.cursor = "view";
        a.innerHTML = `<span class="arc-item__in" style="--i:${items.length}"><img src="${esc(thumbOf(w))}" alt="${c ? "" : esc(w.title)}" decoding="async"></span>`;
        if (c) {
          a.setAttribute("aria-hidden", "true");
          a.tabIndex = -1;
        }
        a._work = w;
        a._src = i;
        stage.appendChild(a);
        items.push(a);
      });
    }
    const N = items.length;
    const wrap = (p) => {
      p = ((p % N) + N) % N;
      return p >= N / 2 ? p - N : p;
    };

    // 縦（PC）の半円。正面を原点に、右側に中心がある円の上に並べる
    const arcPos = (p, cw, R) => {
      const th = (p * (compact.matches ? 22 : 24) * Math.PI) / 180;
      const kx = compact.matches ? 0.5 : 1;
      const s = 1 / (1 + 0.68 * Math.abs(p));
      const w = cw * s;
      // 正面のすぐ後ろ（1番目・2番目）は40pxほど右へずらす
      const ap = Math.abs(p);
      const shift = 40 * Math.min(ap, 1) * Math.min(Math.max(3 - ap, 0), 1);
      // 右端が円に沿うように置く（奥の実績の右端が正面より右に来る）
      return { x: (cw - w) / 2 + R * kx * (1 - Math.cos(th)) + shift, y: R * Math.sin(th), s, w, h: cw * 0.75 * s };
    };

    let W = 0,
      H = 0,
      mode = "",
      cw = 0,
      R = 0,
      fx = 0;
    function measure() {
      W = stage.clientWidth;
      H = stage.clientHeight;
      mode = narrow.matches ? "h" : "v";
      if (mode === "v") {
        // 画面の幅・高さに収まるように全体を縮める（見切れ防止）
        const cw0 = H * 0.62,
          R0 = H * 0.56;
        let l = 0,
          r = 0,
          t = 0,
          b = 0;
        for (let p = -3; p <= 3; p += 0.25) {
          const g = arcPos(p, cw0, R0);
          l = Math.min(l, g.x - g.w / 2);
          r = Math.max(r, g.x + g.w / 2);
          if (Math.abs(p) <= (compact.matches ? 3 : 1.5)) {
            t = Math.min(t, g.y - g.h / 2);
            b = Math.max(b, g.y + g.h / 2);
          }
        }
        const f = Math.min(1, (W - 24) / (r - l), H / (b - t));
        cw = cw0 * f * 0.9; // 正面の実績は収まるサイズより1割小さく
        R = R0 * f;
        // 一番右の実績が画面の右端に収まる位置に正面を置く
        // PCはさらに幅の12%ぶん左へ寄せる（名前側にはみ出さない範囲で）
        fx = Math.max(-l * f, W - 12 - r * f - W * 0.12);
        // ラベルを正面の実績のすぐ下に置くための位置
        root.style.setProperty("--front-l", fx - cw / 2 + "px");
        root.style.setProperty("--front-b", H / 2 + (cw * 0.75) / 2 + "px");
      } else {
        cw = Math.min(W * 0.62, H * 1.15, 420);
      }
      root.style.setProperty("--card-w", cw + "px");
    }

    let offset = 0,
      target = 0;
    function layout() {
      const ch = cw * 0.75;
      items.forEach((el, i) => {
        const p = wrap(i - offset),
          ap = Math.abs(p);
        let x, y, s, o;
        if (mode === "v") {
          const g = arcPos(p, cw, R);
          x = fx + g.x;
          y = H / 2 + g.y;
          s = g.s;
          const fade = compact.matches ? 3.1 : 3.2;
          o = Math.max(0, 1 - 0.26 * ap) * (ap > fade ? Math.max(0, (fade + 0.4 - ap) / 0.4) : 1);
        } else {
          x = W / 2 + Math.sign(p) * cw * (0.62 * Math.min(ap, 1) + 0.42 * Math.max(0, ap - 1));
          y = H / 2;
          s = 1 / (1 + 0.38 * ap);
          o = Math.max(0, 1 - 0.32 * ap) * (ap > 2.2 ? Math.max(0, (2.7 - ap) / 0.5) : 1);
        }
        el.style.transform = `translate3d(${(x - cw / 2).toFixed(1)}px, ${(y - ch / 2).toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
        el.style.opacity = o.toFixed(3);
        el.style.zIndex = String(100 - Math.round(ap * 10));
        el.style.setProperty("--blur", Math.min(ap * 1.3, 3.5).toFixed(2) + "px");
        el.style.setProperty("--pale", Math.min(ap * 0.16, 0.5).toFixed(3));
        el.style.visibility = o < 0.01 ? "hidden" : "";
        el.classList.toggle("is-front", ap < 0.5);
      });
    }

    let shown = -1;
    function updateLabel() {
      const i = ((Math.round(offset) % N) + N) % N;
      if (i === shown) return;
      shown = i;
      const el = items[i];
      if (countEl)
        countEl.textContent = `${String(el._src + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`;
      if (titleEl) titleEl.textContent = el._work.title;
    }

    // 一定間隔で1枚ずつ送る（PC・タブレットは下から上へ、スマホは右から左へ）
    let drag = null,
      moved = false,
      visible = true,
      hover = false,
      last = 0,
      raf = 0,
      timer = 0;
    function frame(t) {
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      if (!drag) offset += (target - offset) * (1 - Math.exp(-dt * 4.2));
      if (Math.abs(target - offset) < 0.0005) offset = target;
      layout();
      updateLabel();
      raf = visible ? requestAnimationFrame(frame) : 0;
    }
    const run = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    const tick = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!hover && !drag && visible && !document.hidden) target = Math.round(target) + 1;
        tick();
      }, interval);
    };

    // カーソルを重ねている間は止める
    root.addEventListener("mouseenter", () => {
      hover = true;
    });
    root.addEventListener("mouseleave", () => {
      hover = false;
      tick();
    });

    // キーボードで選んだ実績を正面に（マウスのクリックは click 側で処理）
    root.addEventListener("focusin", (e) => {
      const i = items.indexOf(e.target.closest(".arc-item"));
      if (i >= 0 && e.target.matches(":focus-visible")) target += wrap(i - target);
    });

    // 正面以外をクリックしたら正面に送る。正面は詳細ページへ
    stage.addEventListener(
      "click",
      (e) => {
        const el = e.target.closest(".arc-item");
        if (!el) return;
        if (moved) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        const p = wrap(items.indexOf(el) - offset);
        if (Math.abs(p) > 0.5) {
          e.preventDefault();
          e.stopImmediatePropagation();
          target += wrap(items.indexOf(el) - target);
          tick();
        }
      },
      true,
    );

    // ドラッグ・スワイプで送る
    stage.addEventListener("pointerdown", (e) => {
      if (e.button) return;
      drag = { x: e.clientX, y: e.clientY, start: offset };
      moved = false;
    });
    window.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const d = mode === "v" ? e.clientY - drag.y : e.clientX - drag.x;
      if (Math.abs(d) > 6) moved = true;
      if (!moved) return;
      const delta = mode === "v" ? d : -d;
      offset = target = drag.start + delta / (cw * (mode === "v" ? 0.55 : 0.6));
      run();
    });
    const end = () => {
      if (!drag) return;
      drag = null;
      target = Math.round(target);
      tick();
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    stage.addEventListener("dragstart", (e) => e.preventDefault());

    new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      if (visible) run();
    }).observe(root);
    compact.addEventListener("change", () => {
      measure();
      layout();
    });
    window.addEventListener("resize", () => {
      measure();
      layout();
    });
    narrow.addEventListener("change", () => {
      measure();
      layout();
    });

    measure();
    layout();
    updateLabel();
    run();
    if (!reduce) tick();
    root.classList.add("is-built");
  }

  /* ---------- 実績一覧ページ ---------- */
  async function initList() {
    const grid = document.querySelector('[data-works="all"]');
    if (!grid) return;
    let works;
    try {
      works = await loadWorks();
    } catch (e) {
      showError(grid, e);
      return;
    }
    const per = cfg.worksPerPage || 12;
    const moreBox = document.querySelector("[data-more]");
    const moreBtn = moreBox && moreBox.querySelector("button");
    let cat = ["lp", "banner"].includes(qs.get("cat")) ? qs.get("cat") : "all";
    let shown = 0;
    const filtered = () => works.filter((w) => cat === "all" || w.category === cat);
    const more = () => {
      const list = filtered();
      const next = list.slice(shown, shown + per);
      grid.insertAdjacentHTML("beforeend", next.map(cardHTML).join(""));
      shown += next.length;
      if (moreBox) moreBox.hidden = shown >= list.length;
      window.Site.Reveal.observe(grid);
    };
    const reset = (c) => {
      cat = c;
      shown = 0;
      grid.innerHTML = "";
      const url = new URL(location.href);
      c === "all" ? url.searchParams.delete("cat") : url.searchParams.set("cat", c);
      history.replaceState(null, "", url);
      if (!filtered().length) {
        grid.innerHTML = '<p class="works-empty">この種類の実績は準備中です。</p>';
        if (moreBox) moreBox.hidden = true;
        return;
      }
      more();
    };
    const filter = document.querySelector("[data-filter]");
    if (filter) renderFilter(filter, works, cat, reset);
    if (moreBtn) moreBtn.addEventListener("click", more);
    reset(cat);
  }

  /* ---------- 実績詳細ページ ---------- */
  async function initDetail() {
    const root = document.querySelector("[data-work-detail]");
    if (!root) return;
    let works;
    try {
      works = await loadWorks();
    } catch (e) {
      showError(root, e);
      return;
    }
    const idx = works.findIndex((w) => w.id === qs.get("id"));
    if (idx < 0) {
      root.innerHTML = `<div class="wrap" style="padding-block:120px"><p class="works-empty">お探しの実績が見つかりませんでした。<br><a href="works.html">実績一覧へ戻る</a></p></div>`;
      return;
    }
    const w = works[idx];
    const cat = w.category === "banner" ? "banner" : "lp";
    document.title = `${w.title}｜制作実績｜ショウジアキフミ`;
    const md = document.querySelector('meta[name="description"]');
    if (md && w.summary) md.setAttribute("content", w.summary);

    const prev = works[idx - 1],
      next = works[idx + 1];
    const meta = [
      ["CATEGORY", CATS[cat]],
      w.client ? ["CLIENT", w.client] : null,
      ["INDUSTRY", w.industry],
      ["ROLE", (w.role || []).join("・")],
      ["PERIOD", w.period],
      ["TOOLS", (w.tools || []).join(" / ")],
    ].filter((m) => m && m[1]);

    const visual =
      cat === "banner"
        ? `<div class="detail-visual detail-visual--banner ink-reveal"><img src="${esc(w.images?.banner)}" alt="${esc(w.title)}" width="1080" height="1080"></div>`
        : `<div class="detail-visual ink-reveal"><img src="${esc(w.images?.mockup || thumbOf(w))}" alt="${esc(w.title)}のPC・スマホ表示" width="1600" height="1040"></div>`;

    const screens =
      cat === "lp" && (w.images?.pc || w.images?.sp)
        ? `
      <section class="detail-sec" data-reveal>
        <h2><span class="ink-dot" aria-hidden="true"></span>ページ全体</h2>
        <p class="screen__hint">枠の中をスクロールすると、ページ全体を見られます。</p>
        <div class="screens">
          ${w.images.pc ? `<div class="screen screen--pc"><p class="screen__label">PC</p><div class="screen__frame screen__frame--pc" tabindex="0" aria-label="PC表示のスクロール領域"><img src="${esc(w.images.pc)}" alt="${esc(w.title)}のPC表示（全体）" loading="lazy"></div></div>` : ""}
          ${w.images.sp ? `<div class="screen screen--sp"><p class="screen__label">SMARTPHONE</p><div class="screen__frame screen__frame--sp" tabindex="0" aria-label="スマホ表示のスクロール領域"><img src="${esc(w.images.sp)}" alt="${esc(w.title)}のスマホ表示（全体）" loading="lazy"></div></div>` : ""}
        </div>
      </section>`
        : "";

    root.innerHTML = `
      <section class="page-hero">
        <canvas class="ink-canvas" data-ink="page" aria-hidden="true"></canvas>
        <div class="wrap">
          <ol class="breadcrumb"><li><a href="./">HOME</a></li><li><a href="works.html">WORKS</a></li><li aria-current="page">${esc(w.title)}</li></ol>
          <div class="detail-head">
            <p class="detail-head__tags">
              <span class="chip${cat === "banner" ? " chip--banner" : ""}">${CATS[cat]}</span>
              ${w.type === "実案件" ? `<span class="chip chip--client">${esc(w.type)}</span>` : `<span class="chip chip--line">${esc(w.type || "自主制作")}</span>`}
            </p>
            <h1 class="detail-head__title">${esc(w.title)}</h1>
            ${w.summary ? `<p class="detail-head__summary">${esc(w.summary)}</p>` : ""}
          </div>
          ${visual}
        </div>
      </section>

      <section class="section" style="padding-top:clamp(56px,7vw,96px)">
        <div class="wrap detail-body">
          <div class="detail-main">
            ${w.purpose ? `<section class="detail-sec" data-reveal><h2><span class="ink-dot" aria-hidden="true"></span>目的・課題</h2><p>${esc(w.purpose)}</p></section>` : ""}
            ${w.points?.length ? `<section class="detail-sec" data-reveal><h2><span class="ink-dot" aria-hidden="true"></span>工夫した点</h2><ol class="points">${w.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></section>` : ""}
            ${w.specs?.length ? `<section class="detail-sec" data-reveal><h2><span class="ink-dot" aria-hidden="true"></span>デザイン仕様</h2><dl class="specs">${w.specs.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join("")}</dl></section>` : ""}
            ${w.result ? `<section class="detail-sec" data-reveal><h2><span class="ink-dot" aria-hidden="true"></span>成果</h2><p>${esc(w.result)}</p></section>` : ""}
            ${screens}
          </div>
          <aside class="detail-aside" data-reveal>
            <dl>${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
            ${w.url ? `<a class="btn btn--blue" href="${esc(w.url)}" target="_blank" rel="noopener">サイトを見る<svg class="btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg></a>` : ""}
            <a class="btn" href="./#contact">この実績について相談する</a>
          </aside>
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="wrap" style="display:grid;gap:clamp(40px,6vw,72px)">
          <nav class="pager" aria-label="前後の実績">
            ${prev ? `<a class="prev" href="work.html?id=${encodeURIComponent(prev.id)}"><small>← NEWER</small><span>${esc(prev.title)}</span></a>` : "<span></span>"}
            ${next ? `<a class="next" href="work.html?id=${encodeURIComponent(next.id)}"><small>OLDER →</small><span>${esc(next.title)}</span></a>` : "<span></span>"}
          </nav>
          <div class="cta-band" data-reveal>
            <div><h2>こんなバナー・LPを作りたい、をお聞かせください。</h2><p>ご相談・お見積もりは無料です。</p></div>
            <a class="btn" href="./#contact">無料で相談する<svg class="btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          </div>
        </div>
      </section>`;
    window.Site.Reveal.observe(root);
    document.dispatchEvent(new Event("ink:refresh"));
  }

  document.addEventListener("DOMContentLoaded", () => {
    initHero();
    initList();
    initDetail();
  });
})();

// 共通の演出: ローダー / ヘッダー / インクのにじみ / スクロール登場 / カーソル
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- ローダー（ピクセルが散って画面が現れる。初回のみ） ---------- */
  function runLoader(done) {
    let seen = false;
    try { seen = sessionStorage.getItem('px-loader') === '1'; sessionStorage.setItem('px-loader', '1'); } catch (e) { /* 保存できなくても表示は続ける */ }
    if (seen || reduceMotion) { done(); return; }
    const cols = window.innerWidth < 700 ? 8 : 16;
    const size = window.innerWidth / cols;
    const rows = Math.ceil(window.innerHeight / size);
    const el = document.createElement('div');
    el.className = 'loader';
    el.setAttribute('aria-hidden', 'true');
    el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    el.style.gridAutoRows = `${size}px`;
    const cells = [];
    for (let i = 0; i < cols * rows; i++) cells.push(el.appendChild(document.createElement('span')));
    document.body.appendChild(el);
    // 右下から左上へ、ゆらぎをつけて消える
    cells.forEach((c, i) => {
      const x = i % cols, y = Math.floor(i / cols);
      const order = (1 - (x / cols + y / rows) / 2) * 520 + rand(0, 380);
      setTimeout(() => c.classList.add('off'), 120 + order);
    });
    setTimeout(done, 420);
    setTimeout(() => el.remove(), 1400);
  }

  /* ---------- ヘッダー ---------- */
  function initHeader() {
    const header = $('.header');
    if (!header) return;
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const btn = $('.menu-btn');
    const nav = $('#nav');
    if (btn && nav) {
      const set = (open) => {
        document.body.classList.toggle('menu-open', open);
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
      };
      btn.addEventListener('click', () => set(!document.body.classList.contains('menu-open')));
      $$('a', nav).forEach((a) => a.addEventListener('click', () => set(false)));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
    }

    // 表示中のセクションをナビに反映
    const links = $$('.nav__list a[href^="#"]');
    if (links.length && 'IntersectionObserver' in window) {
      const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          const a = map.get(en.target.id);
          if (a && en.isIntersecting) {
            links.forEach((l) => l.removeAttribute('aria-current'));
            a.setAttribute('aria-current', 'true');
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    }
  }

  /* ---------- インクのにじみ＋ピクセル（canvas） ---------- */
  // blobs: [x, y, 半径, 'm'=マゼンタ] は幅・高さに対する割合。mask で文字の上にインクがかからないようにする
  const PRESETS = {
    hero: {
      blobs: (w) => w < 760
        ? [[.15, 1.02, .2], [.6, 1.06, .24], [1.0, .9, .18], [1.0, .02, .12], [.45, .97, .05, 'm']]
        : [[.80, .42, .15], [.71, .64, .12], [.90, .68, .14], [.84, .20, .11], [.99, .40, .12], [.66, .88, .08], [.70, .50, .035, 'm']],
      mask: (x, y, W, H) => W < 760
        ? Math.max(smooth(H * .74, H * .96, y), smooth(W * .78, W * 1.02, x) * smooth(H * .2, 0, y))
        : smooth(W * .44, W * .66, x),
      alpha: .9, pixel: true, mouse: true
    },
    page: {
      blobs: (w) => w < 760
        ? [[1.0, .05, .16], [.82, -.05, .1], [1.05, .45, .09]]
        : [[.88, .3, .14], [.98, .62, .12], [.78, .06, .09], [.76, .5, .025, 'm']],
      mask: (x, y, W) => smooth(W * (W < 760 ? .6 : .55), W * (W < 760 ? .95 : .78), x),
      alpha: .75, pixel: true, mouse: true
    },
    contact: {
      blobs: (w) => w < 760
        ? [[.0, 1.0, .24], [.35, 1.08, .16], [1.02, .0, .13]]
        : [[.02, .94, .18], [.20, 1.06, .14], [.0, .6, .1], [1.0, .04, .11]],
      mask: () => 1,
      alpha: .5, pixel: true, mouse: false
    }
  };

  // 小さな疑似乱数（セルごとに固定の値）
  const hash = (x, y, z) => {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function InkField(canvas, preset) {
    const ctx = canvas.getContext('2d');
    const buf = document.createElement('canvas');
    const bctx = buf.getContext('2d');
    const STEP = 6;           // にじみの計算解像度（px）
    let W = 0, H = 0, gw = 0, gh = 0, img, field, mfield, blobs = [], cell = 14;
    let running = false, visible = true, raf = 0, t0 = performance.now();
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: false };

    function resize() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gw = Math.ceil(W / STEP) + 1;
      gh = Math.ceil(H / STEP) + 1;
      buf.width = gw; buf.height = gh;
      img = bctx.createImageData(gw, gh);
      field = new Float32Array(gw * gh);
      mfield = new Float32Array(gw * gh);
      cell = W < 760 ? 11 : 15;
      const m = Math.min(W, H);
      blobs = preset.blobs(W).map((b, i) => ({
        bx: b[0] * W, by: b[1] * H, r: b[2] * Math.max(m, W * .55),
        magenta: b[3] === 'm',
        ax: rand(20, 60), ay: rand(16, 50), sp: rand(.12, .28), ph: rand(0, Math.PI * 2) + i
      }));
    }

    function compute(t) {
      const n = blobs.length;
      const pos = blobs.map((b) => {
        const r = b.r * (0.92 + Math.sin(t * .35 + b.ph) * .08);
        return {
          x: b.bx + Math.sin(t * b.sp + b.ph) * b.ax,
          y: b.by + Math.cos(t * b.sp * .8 + b.ph) * b.ay,
          k: 1 / (2 * r * r),
          m: b.magenta
        };
      });
      if (preset.mouse && mouse.on) { const r = Math.min(W, H) * .07; pos.push({ x: mouse.x, y: mouse.y, k: 1 / (2 * r * r), m: false }); }
      const data = img.data;
      for (let j = 0; j < gh; j++) {
        const py0 = j * STEP;
        for (let i = 0; i < gw; i++) {
          const px0 = i * STEP;
          // 輪郭をゆらす（水彩の不規則なふち）
          const px = px0 + Math.sin(py0 * .011 + t * .6) * 22 + Math.sin((px0 + py0) * .019 - t * .4) * 12;
          const py = py0 + Math.cos(px0 * .013 - t * .5) * 18;
          let v = 0, mv = 0;
          for (let k = 0; k < pos.length; k++) {
            const p = pos[k];
            const dx = px - p.x, dy = py - p.y;
            const c = Math.exp(-(dx * dx + dy * dy) * p.k) * 1.7;
            v += c;
            if (p.m) mv += c;
          }
          // にじみの濃淡にムラをつける
          v *= .86 + .14 * Math.sin(px0 * .006 + py0 * .004 + t * .3) * Math.cos(py0 * .007 - t * .25);
          v *= preset.mask(px0, py0, W, H);
          const idx = j * gw + i;
          field[idx] = v;
          mfield[idx] = v > 0 ? mv / v : 0;
          // 色: 空色 → 青 → コバルト。マゼンタ成分を少し混ぜる
          const deep = smooth(.95, 2.6, v);
          let r = 178 + (59 - 178) * Math.min(1, deep * 1.5);
          let g = 222 + (140 - 222) * Math.min(1, deep * 1.5);
          let bl = 255;
          if (deep > .7) { const d2 = (deep - .7) / .3; r += (29 - r) * d2; g += (91 - g) * d2; bl += (224 - bl) * d2; }
          const mm = Math.min(1, mfield[idx] * 1.5) * smooth(.6, 1.3, v) * .9;
          r += (255 - r) * mm; g += (61 - g) * mm; bl += (139 - bl) * mm;
          // ふちに顔料が溜まる感じ
          const edge = Math.exp(-Math.pow((v - .8) / .16, 2)) * .18;
          const a = Math.min(1, smooth(.5, 1.6, v) * .85 + edge) * preset.alpha;
          const o = idx * 4;
          data[o] = r * (1 - edge * .8); data[o + 1] = g * (1 - edge * .6); data[o + 2] = bl; data[o + 3] = a * 255;
        }
      }
      bctx.putImageData(img, 0, 0);
    }

    function sample(x, y) {
      const i = Math.min(gw - 1, Math.max(0, Math.round(x / STEP)));
      const j = Math.min(gh - 1, Math.max(0, Math.round(y / STEP)));
      return field[j * gw + i];
    }

    function drawPixels(t) {
      const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
      const tick = Math.floor(t * 2.2);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const cx = i * cell + cell / 2, cy = j * cell + cell / 2;
          const v = sample(cx, cy);
          if (v < .3) continue;
          const seed = hash(i, j, 7);
          const flick = hash(i, j, tick + Math.floor(seed * 9));
          let near = 0;
          if (preset.mouse && mouse.on) {
            const dx = cx - mouse.x, dy = cy - mouse.y;
            near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 150);
          }
          if (v < .8) {
            // にじみの外側にこぼれるピクセル
            const p = smooth(.3, .8, v) * .38 + near * .4;
            if (flick < p) {
              const a = (.35 + seed * .6) * preset.alpha;
              ctx.fillStyle = seed > .82 ? `rgba(29,91,224,${a})` : seed > .4 ? `rgba(59,140,255,${a * .8})` : `rgba(166,216,255,${a})`;
              ctx.fillRect(i * cell + 1, j * cell + 1, cell - 2, cell - 2);
            }
          } else {
            // にじみの内側が白いピクセルで欠ける
            const p = .03 + smooth(1.0, 1.6, v) * .03 + near * .55;
            if (flick < p) {
              ctx.fillStyle = `rgba(255,255,255,${(.55 + seed * .45)})`;
              ctx.fillRect(i * cell + 1, j * cell + 1, cell - 2, cell - 2);
            }
          }
        }
      }
    }

    function frame(now) {
      const t = (now - t0) / 1000;
      if (preset.mouse) {
        mouse.x += (mouse.tx - mouse.x) * .08;
        mouse.y += (mouse.ty - mouse.y) * .08;
      }
      compute(t);
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(buf, 0, 0, gw * STEP, gh * STEP);
      if (preset.pixel) drawPixels(t);
      if (running) raf = requestAnimationFrame(frame);
    }

    function start() { if (running || reduceMotion) return; running = true; raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    resize();
    frame(t0 + 4000);
    if (!reduceMotion) {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([en]) => { visible = en.isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(canvas);
      } else start();
      document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));
    }
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); if (!running) frame(performance.now()); }, 150); });

    if (preset.mouse && finePointer) {
      const host = canvas.parentElement;
      host.addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top;
        if (!mouse.on) { mouse.x = mouse.tx; mouse.y = mouse.ty; mouse.on = true; }
      });
      host.addEventListener('pointerleave', () => { mouse.on = false; });
    }
  }

  let inkReady = false;
  function initInk() {
    inkReady = true;
    $$('canvas[data-ink]').forEach((c) => {
      if (c.dataset.inkBound) return;
      c.dataset.inkBound = '1';
      const preset = PRESETS[c.dataset.ink];
      if (preset && c.getContext) InkField(c, preset);
    });
  }

  /* ---------- スクロール登場 ---------- */
  const Reveal = (function () {
    const supported = 'IntersectionObserver' in window && !reduceMotion;
    const io = supported ? new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        show(en.target);
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 }) : null;

    function show(el) {
      el.classList.remove('is-pending');
      if (el.classList.contains('px-reveal')) dissolve(el);
    }

    // 画像の上にピクセルのカバーをかけ、ランダムに消していく
    function cover(el) {
      if (el.querySelector(':scope > .px-cover')) return;
      const c = document.createElement('div');
      c.className = 'px-cover';
      c.setAttribute('aria-hidden', 'true');
      const r = el.getBoundingClientRect();
      const cols = 10, rows = Math.max(4, Math.round(cols * (r.height / Math.max(1, r.width))));
      c.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      c.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
      for (let i = 0; i < cols * rows; i++) {
        const s = document.createElement('span');
        const x = i % cols, y = Math.floor(i / cols);
        s.style.transitionDelay = `${Math.round((x / cols) * 260 + (y / rows) * 160 + rand(0, 320))}ms`;
        c.appendChild(s);
      }
      el.appendChild(c);
    }
    function dissolve(el) {
      const c = el.querySelector(':scope > .px-cover');
      if (!c) return;
      requestAnimationFrame(() => c.classList.add('is-done'));
      setTimeout(() => c.remove(), 1300);
    }

    function splitChars(el) {
      if (el.dataset.split) return;
      el.dataset.split = '1';
      const text = el.textContent;
      el.textContent = '';
      [...text].forEach((ch, i) => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.style.setProperty('--i', i);
        s.textContent = ch === ' ' ? ' ' : ch;
        el.appendChild(s);
      });
    }

    // 画面外にある要素だけを隠して監視する（最初に見えている内容は常に表示）
    function observe(root = document) {
      $$('.section-head__en', root).forEach(splitChars);
      const targets = $$('[data-reveal], .section-head__en, .px-reveal', root);
      targets.forEach((el) => {
        if (el.dataset.revealBound) return;
        el.dataset.revealBound = '1';
        if (!supported) return;
        const r = el.getBoundingClientRect();
        const below = r.top > window.innerHeight * .92;
        if (el.classList.contains('px-reveal')) cover(el);
        if (below) {
          el.classList.add('is-pending');
          io.observe(el);
        } else if (el.classList.contains('px-reveal')) {
          setTimeout(() => dissolve(el), 250);
        }
      });
    }
    return { observe };
  })();

  /* ---------- プロフィール写真の下端のピクセル ---------- */
  function initPhotoPixels() {
    $$('.about__pixels').forEach((el) => {
      const cols = 14, rows = 6;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const s = document.createElement('span');
          const depth = y / (rows - 1);            // 下にいくほど濃く
          const p = depth * depth * .95 + .05;
          if (Math.random() < p) {
            s.style.setProperty('--o', (.45 + Math.random() * .55 * depth).toFixed(2));
            s.style.setProperty('--c', Math.random() < .12 ? 'var(--blue)' : Math.random() < .2 ? 'var(--paper)' : 'var(--sky)');
            s.style.setProperty('--d', `${(-Math.random() * 5).toFixed(2)}s`);
            s.style.setProperty('--t', `${(3 + Math.random() * 4).toFixed(2)}s`);
          }
          el.appendChild(s);
        }
      }
    });
  }

  /* ---------- カーソルとホバーのにじみ位置 ---------- */
  function initPointer() {
    document.addEventListener('pointermove', (e) => {
      const t = e.target.closest && e.target.closest('.btn, .work-card__visual');
      if (!t) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      t.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    }, { passive: true });

    if (!finePointer || reduceMotion) return;
    const cur = document.createElement('div');
    cur.className = 'cursor';
    cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<span class="cursor__label">VIEW</span>';
    document.body.appendChild(cur);
    let x = -100, y = -100, tx = -100, ty = -100;
    document.addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      const view = e.target.closest && e.target.closest('[data-cursor="view"]');
      const link = !view && e.target.closest && e.target.closest('a, button, label, select');
      cur.classList.toggle('is-view', !!view);
      cur.classList.toggle('is-link', !!link);
    }, { passive: true });
    document.addEventListener('pointerleave', () => { tx = ty = -100; });
    (function loop() {
      x += (tx - x) * .2; y += (ty - y) * .2;
      cur.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- フッター ---------- */
  const SNS_ICONS = {
    X: '<path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/>',
    Instagram: '<path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.2.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zm5.2-9.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/>',
    note: '<path d="M4 4h10.5A5.5 5.5 0 0 1 20 9.5V20h-4v-9.6c0-1.5-.9-2.4-2.4-2.4H8V20H4V4z"/>'
  };
  function initFooter() {
    const y = $('[data-year]');
    if (y) y.textContent = new Date().getFullYear();
    const box = $('[data-sns]');
    const cfg = window.SITE_CONFIG || {};
    if (!box) return;
    if (!cfg.showSns) { box.remove(); return; }
    (cfg.sns || []).filter((s) => s.url).forEach((s) => {
      const a = document.createElement('a');
      a.href = s.url; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', s.name);
      a.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SNS_ICONS[s.name] || ''}</svg>`;
      box.appendChild(a);
    });
  }

  window.Site = { Reveal, $, $$ };
  // 後から描画された canvas（実績詳細ページ）にもインクを適用する
  document.addEventListener('ink:refresh', () => { if (inkReady) initInk(); });

  document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initFooter();
    initPhotoPixels();
    initPointer();
    Reveal.observe();
    runLoader(() => {
      document.body.classList.add('is-ready');
      initInk();
    });
  });
})();

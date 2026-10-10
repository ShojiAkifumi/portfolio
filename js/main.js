// 共通の演出: 画面切り替え / ヘッダー / インクの背景 / ふわっと登場 / カーソル
(function () {
  'use strict';

  const Ink = window.Ink;
  const reduceMotion = Ink.reduceMotion;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* 保存できなくても動作は続ける */ } }
  };

  /* ---------- 画面切り替え（インクが広がって次の画面へ） ---------- */
  function enterPage(done) {
    const html = document.documentElement;
    let origin = { x: window.innerWidth * .7, y: window.innerHeight * .42 };
    try { const o = JSON.parse(store.get('ink-origin') || 'null'); if (o) origin = o; } catch (e) { /* 既定の位置を使う */ }
    const played = Ink.InkTransition.play(0, origin, 1700, () => {});
    // 1コマ目が描かれてから白い覆いを外す
    requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove('is-covered')));
    setTimeout(done, played ? 350 : 0);
  }

  function initLinks() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // 同じページ内の移動はスクロールだけ
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (reduceMotion) return;
      e.preventDefault();
      store.set('ink-origin', JSON.stringify({ x: e.clientX, y: e.clientY }));
      document.body.classList.remove('menu-open');
      document.documentElement.classList.add('is-leaving');
      const ok = Ink.InkTransition.play(1, { x: e.clientX, y: e.clientY }, 950, () => { location.href = url.href; });
      if (!ok) location.href = url.href;
    });
    // 戻るボタンでキャッシュから表示された時は覆いを消す
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      document.documentElement.classList.remove('is-leaving', 'is-covered');
      const c = $('.ink-transition');
      if (c) c.hidden = true;
    });
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

  /* ---------- 漂うインクの背景 ---------- */
  // center: [x, y]（0〜1、y は下から）。scale: インクの大きさ
  const CLOUDS = {
    hero: { center: (w) => (w < 760 ? [.55, .32] : [.72, .5]), scale: (w) => (w < 760 ? .55 : .6), alpha: 1, mouse: true, delay: 250 },
    page: { center: (w) => (w < 760 ? [.95, .8] : [.88, .55]), scale: (w) => (w < 760 ? .5 : .62), alpha: .8, mouse: true, delay: 250 },
    contact: { center: (w) => (w < 760 ? [.05, .08] : [.08, .2]), scale: () => .7, alpha: .55, mouse: false, delay: 0 }
  };
  let inkStarted = false;
  function initClouds() {
    inkStarted = true;
    $$('canvas[data-ink]').forEach((c) => {
      if (c.dataset.inkBound) return;
      c.dataset.inkBound = '1';
      const opts = CLOUDS[c.dataset.ink];
      if (opts) Ink.InkCloud(c, opts);
    });
  }

  /* ---------- ふわっと登場 ---------- */
  const Reveal = (function () {
    const supported = 'IntersectionObserver' in window && !reduceMotion;
    const masks = Ink.prepareMasks();
    let ready = false;
    const queue = [];
    const io = supported ? new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        show(en.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: .1 }) : null;

    function inkIn(el) {
      el.dataset.ink = Math.random() < .5 ? 'a' : 'b';
      el.classList.remove('is-pending');
      el.classList.add('is-inking');
      const end = () => el.classList.remove('is-inking');
      el.addEventListener('animationend', (e) => { if (e.animationName === 'inkMask') end(); });
      setTimeout(end, 2200 + (parseFloat(el.style.getPropertyValue('--ink-delay')) || 0));
    }
    function show(el) {
      if (!el.classList.contains('ink-reveal')) { el.classList.remove('is-pending'); return; }
      // マスク画像の準備ができてから、インクの形で現す
      masks.then(() => inkIn(el), () => el.classList.remove('is-pending'));
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

    // 画面外にある要素だけを隠して監視する（最初に見えている内容は、ページが現れた後に登場）
    function observe(root = document) {
      $$('.section-head__en', root).forEach(splitChars);
      $$('[data-reveal], .section-head__en, .ink-reveal', root).forEach((el) => {
        if (el.dataset.revealBound) return;
        el.dataset.revealBound = '1';
        if (!supported) return;
        el.classList.add('is-pending');
        if (ready) io.observe(el); else queue.push(el);
      });
    }
    function start() {
      ready = true;
      queue.splice(0).forEach((el) => io && io.observe(el));
      // 速いスクロールで監視をすり抜けた要素（すでに画面より上にあるもの）も表示する
      let tick = 0;
      window.addEventListener('scroll', () => {
        if (tick) return;
        tick = requestAnimationFrame(() => {
          tick = 0;
          $$('.is-pending').forEach((el) => {
            if (el.getBoundingClientRect().top < window.innerHeight * .9) { io.unobserve(el); show(el); }
          });
        });
      }, { passive: true });
    }
    return { observe, start };
  })();

  /* ---------- セクションのつなぎ目のインク ---------- */
  function initEdges() {
    $$('[data-ink-edge]').forEach((sec) => {
      const color = getComputedStyle(sec).backgroundColor;
      sec.dataset.inkEdge.split(' ').forEach((pos) => {
        const e = document.createElement('div');
        e.className = `ink-edge ink-edge--${pos}`;
        e.setAttribute('aria-hidden', 'true');
        e.style.setProperty('--edge-color', color);
        sec.prepend(e);
      });
    });
  }

  /* ---------- カーソルとホバーのにじみ位置 ---------- */
  function initPointer() {
    document.addEventListener('pointermove', (e) => {
      const t = e.target.closest && e.target.closest('.btn');
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
      x += (tx - x) * .16; y += (ty - y) * .16;
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
  document.addEventListener('ink:refresh', () => { if (inkStarted) initClouds(); });

  document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initFooter();
    initEdges();
    initPointer();
    initLinks();
    Reveal.observe();
    enterPage(() => {
      document.body.classList.add('is-ready');
      initClouds();
      Reveal.start();
    });
  });
})();

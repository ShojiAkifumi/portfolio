// 共通の演出: 画面切り替え / ヘッダー / インクの背景 / ふわっと登場 / カーソル
(function () {
  'use strict';

  const Ink = window.Ink;
  const reduceMotion = Ink.reduceMotion;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

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
  }

  // 表示中のセクションをナビに反映（トップ）／実績の画面では WORKS を現在地にする
  function initNavCurrent(view, name, signal) {
    const links = $$('.nav__list a');
    const set = (a) => links.forEach((l) => l.setAttribute('aria-current', String(l === a)));
    if (name !== 'home') {
      set(name === 'works' || name === 'detail' ? links.find((l) => l.getAttribute('href') === '/works') : null);
      return;
    }
    set(null);
    if (!('IntersectionObserver' in window)) return;
    const map = new Map(links.filter((a) => a.getAttribute('href').startsWith('/#'))
      .map((a) => [a.getAttribute('href').slice(2), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const a = map.get(en.target.id);
        if (a && en.isIntersecting) set(a);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = $('#' + id, view); if (s) io.observe(s); });
    // ページのトップ（ファーストビュー）に戻ったら現在地の表示を外す
    const hero = $('.hero', view);
    const io2 = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) set(null);
    }, { rootMargin: '-45% 0px -50% 0px' });
    if (hero) io2.observe(hero);
    signal.addEventListener('abort', () => { io.disconnect(); io2.disconnect(); });
  }

  /* ---------- 漂うインクの背景 ---------- */
  // center: [x, y]（0〜1、y は下から）。scale: インクの大きさ
  const CLOUDS = {
    hero: { center: (w) => (w < 760 ? [.55, .32] : [.72, .5]), scale: (w) => (w < 760 ? .55 : .6), alpha: 1, mouse: true, delay: 250 },
    page: { center: (w) => (w < 760 ? [.95, .8] : [.88, .55]), scale: (w) => (w < 760 ? .5 : .62), alpha: .8, mouse: true, delay: 250 },
    contact: { center: (w) => (w < 760 ? [.05, .08] : [.08, .2]), scale: () => .7, alpha: .55, mouse: false, delay: 0 }
  };
  function initClouds() {
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
  function initEdges(scope) {
    $$('[data-ink-edge]', scope).forEach((sec) => {
      if (sec.dataset.edgeBound) return;
      sec.dataset.edgeBound = '1';
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
  function initFooter(scope) {
    const y = $('[data-year]', scope);
    if (y) y.textContent = new Date().getFullYear();
    const box = $('[data-sns]', scope);
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

  /* ---------- 画面（ビュー）の切り替え ----------
     1つの HTML の中で、<main> とフッターをまとめた .view を差し替える。
     次の画面は今の画面の上に重ねて置き、インクのにじみの形で切り抜いて見せる（空白を挟まず1回で切り替わる） */
  const view0 = document.createElement('div');
  view0.className = 'view';
  const main0 = $('main'), footer0 = $('.footer');
  main0.before(view0);
  view0.append(main0, footer0);
  // トップの中身とフッターは、JS が手を加える前の状態を控えておく
  const HOME = { title: document.title, description: ($('meta[name="description"]') || {}).content || '', html: main0.innerHTML };
  const FOOTER = footer0.outerHTML;

  function setMeta(title, description) {
    document.title = title;
    const md = $('meta[name="description"]');
    if (md && description) md.setAttribute('content', description);
  }

  // URL から画面を決める（以前の works.html / work.html?id= も受け付ける）
  function route(url) {
    let path = url.pathname.replace(/\/index\.html$/, '/');
    if (path === '/works.html') path = '/works';
    if (path === '/work.html') {
      const id = url.searchParams.get('id');
      url.searchParams.delete('id');
      path = id ? '/works/' + encodeURIComponent(id) : '/works';
    }
    path = path.replace(/\/+$/, '') || '/';
    const m = path.match(/^\/works\/([^/]+)$/);
    const name = path === '/' ? 'home' : path === '/works' ? 'works' : m ? 'detail' : 'notfound';
    return { name, id: m ? decodeURIComponent(m[1]) : null, href: (path === '/' ? '/' : path) + url.search + url.hash };
  }

  async function initView(view, r, signal) {
    const main = $('main', view);
    const v = window.Views[r.name] || HOME;
    setMeta(v.title, v.description);
    const jobs = [];
    if (r.name === 'home') { jobs.push(window.Works.initHero(main, signal)); window.Contact.init(main); }
    if (r.name === 'works') jobs.push(window.Works.initList(main, signal));
    if (r.name === 'detail') jobs.push(window.Works.initDetail(main, signal, r.id));
    await Promise.all(jobs).catch((e) => console.error(e));
    initFooter(view);
    initEdges(view);
    initNavCurrent(view, r.name, signal);
    Reveal.observe(view);
  }

  function buildView(r) {
    const view = document.createElement('div');
    view.className = 'view';
    view.innerHTML = `<main>${r.name === 'home' ? HOME.html : window.Views[r.name].html}</main>${FOOTER}`;
    return view;
  }

  // 画面の中の要素（#contact など）を、ヘッダーの高さを差し引いた位置に出すためのスクロール量
  function targetY(view, hash, top) {
    let el = null;
    try { el = hash && hash.length > 1 ? view.querySelector(decodeURIComponent(hash)) : null; } catch (e) { /* 不正な # は無視 */ }
    if (!el) return null;
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    return el.getBoundingClientRect().top - top - pad;
  }

  let current = { view: view0, ctrl: new AbortController(), route: null };
  let busy = false;
  const instant = (y) => {
    const html = document.documentElement, prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, Math.max(0, y));
    html.style.scrollBehavior = prev;
  };

  async function navigate(url, { push = true, origin = null, y = null } = {}) {
    if (busy) return;
    busy = true;
    const r = route(url);
    if (push) {
      history.replaceState({ ...(history.state || {}), y: window.scrollY }, '');
      history.pushState({ y: 0 }, '', r.href);
    }
    document.body.classList.remove('menu-open');
    const ctrl = new AbortController();
    const view = buildView(r);
    view.classList.add('view--next');
    view.style.clipPath = 'polygon(0 0, 0 0, 0 0)';
    const inner = document.createElement('div');
    inner.className = 'view__inner';
    inner.append(...view.childNodes);
    view.append(inner);
    document.body.append(view);
    document.documentElement.classList.add('is-leaving');
    await initView(view, r, ctrl.signal);

    // どこまでスクロールした状態で見せるか（# があればその位置、戻る・進むなら前の位置）
    const max = Math.max(0, inner.scrollHeight - window.innerHeight);
    let top = y != null ? y : targetY(view, url.hash, inner.getBoundingClientRect().top) ?? 0;
    top = Math.min(max, Math.max(0, top));
    inner.style.transform = `translateY(${-top}px)`;
    initClouds();
    setTimeout(() => $('main', view).classList.add('is-ready'), 200);

    const finish = () => {
      current.ctrl.abort();
      current.view.remove();
      view.classList.remove('view--next');
      view.style.clipPath = '';
      inner.style.transform = '';
      instant(top);
      document.documentElement.classList.remove('is-leaving');
      current = { view, ctrl, route: r };
      busy = false;
      const h = $('h1', view);
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    };
    const o = origin || { x: window.innerWidth / 2, y: window.innerHeight * 0.45 };
    Ink.InkTransition.play({ origin: o, onClip: (poly) => { view.style.clipPath = poly; }, done: finish });
  }

  function scrollToHash(hash) {
    const y = hash && hash !== '#top' ? targetY(current.view, hash, -window.scrollY) : 0;
    if (y == null) return;
    window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function initLinks() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      const raw = a.getAttribute('href');
      // 「#〇〇」だけのリンクは、今の画面の中でスクロール
      if (raw.startsWith('#')) {
        e.preventDefault();
        document.body.classList.remove('menu-open');
        scrollToHash(raw);
        return;
      }
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || /\.(pdf|png|jpe?g|webp|zip)$/i.test(url.pathname)) return;
      e.preventDefault();
      document.body.classList.remove('menu-open');
      const r = route(new URL(url.href));
      // 同じ画面の中の移動はスクロールだけ
      if (current.route && r.name === current.route.name && r.id === current.route.id && url.search === location.search) {
        if (url.hash) history.replaceState(history.state, '', r.href);
        scrollToHash(url.hash || '#top');
        return;
      }
      navigate(url, { origin: { x: e.clientX, y: e.clientY } });
    });
    window.addEventListener('popstate', (e) => {
      const r = route(new URL(location.href));
      if (current.route && r.name === current.route.name && r.id === current.route.id) {
        if (e.state && e.state.y != null) instant(e.state.y);
        return;
      }
      navigate(new URL(location.href), { push: false, y: e.state ? e.state.y : null });
    });
  }

  // 最初の読み込み：トップは雫が手前から落ちて、着地したところからにじみが広がって現れる（ほかの画面はにじみだけ）
  async function boot() {
    const r = route(new URL(location.href));
    if (r.href !== location.pathname + location.search + location.hash) history.replaceState({ y: 0 }, '', r.href);
    if (r.name !== 'home') $('main', view0).innerHTML = window.Views[r.name].html;
    current.route = r;
    await initView(view0, r, current.ctrl.signal);
    const y = targetY(view0, location.hash, -window.scrollY);
    if (y != null) instant(y);
    const html = document.documentElement;
    const ready = () => {
      $('main', view0).classList.add('is-ready');
      initClouds();
      Reveal.start();
    };
    // トップだけ雫を落とす。PC・タブレットは正面の実績（スライダーの中心）の近くに、スマホは画面の中心の少し下に落ちる
    const home = r.name === 'home';
    let origin = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.46 };
    const front = home && window.innerWidth > 640 && $('.arc-item.is-front', view0);
    if (front) {
      const b = front.getBoundingClientRect();
      if (b.width) origin = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }
    // そこから画面の幅・高さの5%ずつ右上へずらす（スマホは画面の中心から高さの10%下）
    if (home && !front) origin = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.6 };
    else if (home) {
      origin = {
        x: Math.min(window.innerWidth * 0.95, origin.x + window.innerWidth * 0.05),
        y: Math.max(window.innerHeight * 0.05, origin.y - window.innerHeight * 0.05)
      };
    }
    const strength = home && !reduceMotion ? $('#strength', view0) : null;
    if (strength) strength.classList.add('is-held');
    const header = home && !reduceMotion ? $('.header') : null;
    if (header) header.classList.add('is-held');
    if (home) await Ink.InkTransition.preload(1200);
    const played = Ink.InkTransition.play({
      origin,
      duration: 1700,
      drop: home,
      paper: true,
      onImpact: () => {
        setTimeout(ready, 40);
        // STRENGTH は着地から1秒後に現す
        setTimeout(() => strength && strength.classList.remove('is-held'), 1000);
        // ヘッダーは着地から0.3秒後に現す
        setTimeout(() => header && header.classList.remove('is-held'), 300);
      }
    });
    // 1コマ目が描かれてから白い覆いを外す
    requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove('is-covered')));
    if (!played) ready();
  }

  window.Site = { Reveal, $, $$, setMeta };

  document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initPointer();
    initLinks();
    boot();
  });
})();

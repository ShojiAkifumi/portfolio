// 実績: data/works.json を読み込んで、トップ・一覧・詳細ページに表示する
(function () {
  'use strict';

  const cfg = window.SITE_CONFIG || {};
  const CATS = { lp: 'LP', banner: 'バナー' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const qs = new URLSearchParams(location.search);

  async function loadWorks() {
    const res = await fetch('data/works.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`works.json を読み込めませんでした (${res.status})`);
    const list = await res.json();
    // 新しい順（同じ日付は JSON に書いた順）
    return list.map((w, i) => ({ ...w, _i: i }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || a._i - b._i);
  }

  const thumbOf = (w) => w.thumbnail || w.images?.mockup || w.images?.banner || w.images?.pc || '';

  function cardHTML(w) {
    const cat = w.category === 'banner' ? 'banner' : 'lp';
    return `
      <a class="work-card" href="work.html?id=${encodeURIComponent(w.id)}" data-reveal data-cursor="view">
        <div class="work-card__visual work-card__visual--${cat} ink-reveal">
          <img src="${esc(thumbOf(w))}" alt="${esc(w.title)}" loading="lazy" decoding="async">
        </div>
        <div class="work-card__meta">
          <p class="work-card__tags">
            <span class="chip${cat === 'banner' ? ' chip--banner' : ''}">${CATS[cat]}</span>
            ${w.type === '実案件' ? `<span class="chip chip--client">${esc(w.type)}</span>` : `<span class="chip chip--line">${esc(w.type || '自主制作')}</span>`}
            <span>${esc(w.industry || '')}</span>
          </p>
          <h3 class="work-card__title">${esc(w.title)}</h3>
          ${w.summary ? `<p class="work-card__summary">${esc(w.summary)}</p>` : ''}
        </div>
      </a>`;
  }

  function renderFilter(box, works, current, onChange) {
    const count = (c) => (c === 'all' ? works.length : works.filter((w) => w.category === c).length);
    const items = [['all', 'ALL'], ['lp', 'LP'], ['banner', 'BANNER']];
    box.innerHTML = items.map(([k, label]) =>
      `<button type="button" data-cat="${k}" aria-pressed="${k === current}">${label}<span class="count">${count(k)}</span></button>`).join('');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cat]');
      if (!b) return;
      box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onChange(b.dataset.cat);
    });
  }

  function showError(box, err) {
    box.innerHTML = `<p class="works-empty">実績を読み込めませんでした。ページを再読み込みしてください。</p>`;
    console.error(err);
  }

  /* ---------- トップページ ---------- */
  async function initTop() {
    const grid = document.querySelector('[data-works="top"]');
    if (!grid) return;
    let works;
    try { works = await loadWorks(); } catch (e) { showError(grid, e); return; }
    const n = cfg.topWorksCount || 6;
    const render = (cat) => {
      const list = works.filter((w) => cat === 'all' || w.category === cat).slice(0, n);
      grid.innerHTML = list.length ? list.map(cardHTML).join('') : '<p class="works-empty">この種類の実績は準備中です。</p>';
      window.Site.Reveal.observe(grid);
    };
    const filter = document.querySelector('[data-filter]');
    if (filter) renderFilter(filter, works, 'all', render);
    render('all');
  }

  /* ---------- 実績一覧ページ ---------- */
  async function initList() {
    const grid = document.querySelector('[data-works="all"]');
    if (!grid) return;
    let works;
    try { works = await loadWorks(); } catch (e) { showError(grid, e); return; }
    const per = cfg.worksPerPage || 12;
    const moreBox = document.querySelector('[data-more]');
    const moreBtn = moreBox && moreBox.querySelector('button');
    let cat = ['lp', 'banner'].includes(qs.get('cat')) ? qs.get('cat') : 'all';
    let shown = 0;
    const filtered = () => works.filter((w) => cat === 'all' || w.category === cat);
    const more = () => {
      const list = filtered();
      const next = list.slice(shown, shown + per);
      grid.insertAdjacentHTML('beforeend', next.map(cardHTML).join(''));
      shown += next.length;
      if (moreBox) moreBox.hidden = shown >= list.length;
      window.Site.Reveal.observe(grid);
    };
    const reset = (c) => {
      cat = c; shown = 0; grid.innerHTML = '';
      const url = new URL(location.href);
      c === 'all' ? url.searchParams.delete('cat') : url.searchParams.set('cat', c);
      history.replaceState(null, '', url);
      if (!filtered().length) { grid.innerHTML = '<p class="works-empty">この種類の実績は準備中です。</p>'; if (moreBox) moreBox.hidden = true; return; }
      more();
    };
    const filter = document.querySelector('[data-filter]');
    if (filter) renderFilter(filter, works, cat, reset);
    if (moreBtn) moreBtn.addEventListener('click', more);
    reset(cat);
  }

  /* ---------- 実績詳細ページ ---------- */
  async function initDetail() {
    const root = document.querySelector('[data-work-detail]');
    if (!root) return;
    let works;
    try { works = await loadWorks(); } catch (e) { showError(root, e); return; }
    const idx = works.findIndex((w) => w.id === qs.get('id'));
    if (idx < 0) {
      root.innerHTML = `<div class="wrap" style="padding-block:120px"><p class="works-empty">お探しの実績が見つかりませんでした。<br><a href="works.html">実績一覧へ戻る</a></p></div>`;
      return;
    }
    const w = works[idx];
    const cat = w.category === 'banner' ? 'banner' : 'lp';
    document.title = `${w.title}｜制作実績｜ショウジアキフミ`;
    const md = document.querySelector('meta[name="description"]');
    if (md && w.summary) md.setAttribute('content', w.summary);

    const prev = works[idx - 1], next = works[idx + 1];
    const meta = [
      ['CATEGORY', CATS[cat]],
      w.client ? ['CLIENT', w.client] : null,
      ['INDUSTRY', w.industry],
      ['ROLE', (w.role || []).join('・')],
      ['PERIOD', w.period],
      ['TOOLS', (w.tools || []).join(' / ')]
    ].filter((m) => m && m[1]);

    const visual = cat === 'banner'
      ? `<div class="detail-visual detail-visual--banner ink-reveal"><img src="${esc(w.images?.banner)}" alt="${esc(w.title)}" width="1080" height="1080"></div>`
      : `<div class="detail-visual ink-reveal"><img src="${esc(w.images?.mockup || thumbOf(w))}" alt="${esc(w.title)}のPC・スマホ表示" width="1600" height="1040"></div>`;

    const screens = cat === 'lp' && (w.images?.pc || w.images?.sp) ? `
      <section class="detail-sec" data-reveal>
        <h2><span class="ink-dot" aria-hidden="true"></span>ページ全体</h2>
        <p class="screen__hint">枠の中をスクロールすると、ページ全体を見られます。</p>
        <div class="screens">
          ${w.images.pc ? `<div class="screen screen--pc"><p class="screen__label">PC</p><div class="screen__frame screen__frame--pc" tabindex="0" aria-label="PC表示のスクロール領域"><img src="${esc(w.images.pc)}" alt="${esc(w.title)}のPC表示（全体）" loading="lazy"></div></div>` : ''}
          ${w.images.sp ? `<div class="screen screen--sp"><p class="screen__label">SMARTPHONE</p><div class="screen__frame screen__frame--sp" tabindex="0" aria-label="スマホ表示のスクロール領域"><img src="${esc(w.images.sp)}" alt="${esc(w.title)}のスマホ表示（全体）" loading="lazy"></div></div>` : ''}
        </div>
      </section>` : '';

    root.innerHTML = `
      <section class="page-hero">
        <canvas class="ink-canvas" data-ink="page" aria-hidden="true"></canvas>
        <div class="wrap">
          <ol class="breadcrumb"><li><a href="./">HOME</a></li><li><a href="works.html">WORKS</a></li><li aria-current="page">${esc(w.title)}</li></ol>
          <div class="detail-head">
            <p class="detail-head__tags">
              <span class="chip${cat === 'banner' ? ' chip--banner' : ''}">${CATS[cat]}</span>
              ${w.type === '実案件' ? `<span class="chip chip--client">${esc(w.type)}</span>` : `<span class="chip chip--line">${esc(w.type || '自主制作')}</span>`}
            </p>
            <h1 class="detail-head__title">${esc(w.title)}</h1>
            ${w.summary ? `<p class="detail-head__summary">${esc(w.summary)}</p>` : ''}
          </div>
          ${visual}
        </div>
      </section>

      <section class="section" style="padding-top:clamp(56px,7vw,96px)">
        <div class="wrap detail-body">
          <div class="detail-main">
            ${w.purpose ? `<section class="detail-sec" data-reveal><h2><span class="ink-dot" aria-hidden="true"></span>目的・課題</h2><p>${esc(w.purpose)}</p></section>` : ''}
            ${w.points?.length ? `<section class="detail-sec" data-reveal><h2><span class="ink-dot" aria-hidden="true"></span>工夫した点</h2><ol class="points">${w.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></section>` : ''}
            ${w.specs?.length ? `<section class="detail-sec" data-reveal><h2><span class="ink-dot" aria-hidden="true"></span>デザイン仕様</h2><dl class="specs">${w.specs.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl></section>` : ''}
            ${w.result ? `<section class="detail-sec" data-reveal><h2><span class="ink-dot" aria-hidden="true"></span>成果</h2><p>${esc(w.result)}</p></section>` : ''}
            ${screens}
          </div>
          <aside class="detail-aside" data-reveal>
            <dl>${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
            ${w.url ? `<a class="btn btn--blue" href="${esc(w.url)}" target="_blank" rel="noopener">サイトを見る<svg class="btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg></a>` : ''}
            <a class="btn" href="./#contact">この実績について相談する</a>
          </aside>
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="wrap" style="display:grid;gap:clamp(40px,6vw,72px)">
          <nav class="pager" aria-label="前後の実績">
            ${prev ? `<a class="prev" href="work.html?id=${encodeURIComponent(prev.id)}"><small>← NEWER</small><span>${esc(prev.title)}</span></a>` : '<span></span>'}
            ${next ? `<a class="next" href="work.html?id=${encodeURIComponent(next.id)}"><small>OLDER →</small><span>${esc(next.title)}</span></a>` : '<span></span>'}
          </nav>
          <div class="cta-band" data-reveal>
            <div><h2>こんなバナー・LPを作りたい、をお聞かせください。</h2><p>ご相談・お見積もりは無料です。</p></div>
            <a class="btn" href="./#contact">無料で相談する<svg class="btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          </div>
        </div>
      </section>`;
    window.Site.Reveal.observe(root);
    document.dispatchEvent(new Event('ink:refresh'));
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTop();
    initList();
    initDetail();
  });
})();

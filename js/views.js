// トップ以外の画面の中身（トップの中身は index.html の <main> をそのまま使う）
(function () {
  "use strict";

  const ctaBand = `
      <div class="cta-band" data-reveal>
        <div><h2>こんなバナー・LPを作りたい、をお聞かせください。</h2><p>ご相談・お見積もりは無料です。</p></div>
        <a class="btn" href="/#contact">無料で相談する<svg class="btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      </div>`;

  window.Views = {
    works: {
      title: "制作実績｜ショウジアキフミ",
      description: "ショウジアキフミが制作したバナー・LPの実績一覧です。",
      html: `
  <section class="page-hero" aria-labelledby="works-title">
    <canvas class="ink-canvas" data-ink="page" aria-hidden="true"></canvas>
    <div class="wrap">
      <ol class="breadcrumb"><li><a href="/">HOME</a></li><li aria-current="page">WORKS</li></ol>
      <div class="section-head" style="margin-bottom:0">
        <p class="section-head__en" aria-hidden="true">WORKS</p>
        <h1 class="section-head__ja" id="works-title"><span class="ink-dot" aria-hidden="true"></span>制作実績</h1>
        <p class="section-head__lead">これまでに制作したバナーとランディングページです。カードを選ぶと、制作の目的や工夫した点を見られます。</p>
      </div>
    </div>
  </section>
  <section class="section" style="padding-top:clamp(40px,5vw,64px)">
    <div class="wrap">
      <div class="filter" role="group" aria-label="実績の種類で絞り込む" data-filter style="margin-bottom:clamp(32px,4vw,48px)"></div>
      <div class="works-grid" data-works="all" aria-live="polite"></div>
      <div class="works-more" data-more hidden><button class="btn btn--ghost" type="button">もっと見る</button></div>
    </div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="wrap">${ctaBand}
    </div>
  </section>`,
    },

    detail: {
      title: "制作実績｜ショウジアキフミ",
      description: "ショウジアキフミが制作したバナー・LPの実績詳細です。",
      html: `
  <div data-work-detail>
    <section class="page-hero"><div class="wrap"><p class="breadcrumb"><a href="/works">WORKS</a></p><p>読み込み中…</p></div></section>
  </div>`,
    },

    notfound: {
      title: "ページが見つかりませんでした｜ショウジアキフミ",
      description: "お探しのページは見つかりませんでした。",
      html: `
  <section class="page-hero" style="min-height:70vh;display:grid;align-items:center">
    <canvas class="ink-canvas" data-ink="page" aria-hidden="true"></canvas>
    <div class="wrap">
      <div class="section-head">
        <p class="section-head__en" aria-hidden="true">404</p>
        <h1 class="section-head__ja"><span class="ink-dot" aria-hidden="true"></span>ページが見つかりませんでした</h1>
        <p class="section-head__lead">URLが変わったか、ページが削除された可能性があります。</p>
      </div>
      <a class="btn btn--ghost" href="/">トップへ戻る</a>
    </div>
  </section>`,
    },
  };
})();

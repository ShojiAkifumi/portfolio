// 実績: data/works.json を読み込んで、トップ・一覧・詳細の各画面に表示する（main.ts のルーターから呼ばれる）
import { SITE_CONFIG as cfg } from "./config";
import { reduceMotion } from "./ink";
import { Reveal, setMeta } from "./site";

// data/works.json の1件分
export interface Work {
  id: string;
  title: string;
  category?: string;
  type?: string;
  industry?: string;
  date?: string;
  client?: string;
  role?: string[];
  period?: string;
  tools?: string[];
  summary?: string;
  purpose?: string;
  points?: string[];
  specs?: { label: string; value: string }[];
  result?: string;
  url?: string;
  // 表示順（小さいほど先。空なら表示順のある実績の後ろに、制作日の新しい順）
  sortOrder?: number;
  thumbnail?: string;
  images?: { mockup?: string; banner?: string; pc?: string; sp?: string };
  _i: number;
}
type Cat = "lp" | "hp" | "banner" | "logo" | "app";

// カテゴリの表示名（日本語）と、一覧の絞り込みボタンの表示名（英字）。並び順は絞り込みボタンの順
const CATS: Record<Cat, string> = { lp: "LP", hp: "HP", banner: "バナー", logo: "ロゴ", app: "アプリ" };
const CAT_FILTER: Record<Cat, string> = { lp: "LP", hp: "WEBSITE", banner: "BANNER", logo: "LOGO", app: "APP" };
const isCat = (c: unknown): c is Cat => typeof c === "string" && c in CATS;
const catOf = (w: Work): Cat => (isCat(w.category) ? w.category : "lp");
// バナー・ロゴは1枚の画像（images.banner）で見せる。LP・HP・アプリはPC・スマホの画面で見せる
const isSingle = (c: Cat) => c === "banner" || c === "logo";
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
const workURL = (w: Work) => `/works/${encodeURIComponent(w.id)}`;

// 画面を切り替えるたびに読み直さないよう、1回読み込んだ結果を使い回す
let cache: Promise<Work[]> | null = null;
function loadWorks(): Promise<Work[]> {
  if (!cache) {
    cache = fetch("/data/works.json")
      .then((res) => {
        if (!res.ok) throw new Error(`works.json を読み込めませんでした (${res.status})`);
        return res.json();
      })
      .then((list: Omit<Work, "_i">[]) =>
        // 表示順の小さい順 → 制作日の新しい順（同じ日付は JSON の順）
        list
          .map((w, i) => ({ ...w, _i: i }))
          .sort(
            (a, b) =>
              (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) ||
              String(b.date || "").localeCompare(String(a.date || "")) ||
              a._i - b._i,
          ),
      );
    cache.catch(() => (cache = null));
  }
  return cache;
}

const thumbOf = (w: Work) => w.thumbnail || w.images?.mockup || w.images?.banner || w.images?.pc || "";

function cardHTML(w: Work) {
  const cat = catOf(w);
  return `
    <a class="work-card" href="${workURL(w)}" data-reveal data-cursor="view">
      <div class="work-card__visual work-card__visual--${isSingle(cat) ? "banner" : cat} ink-reveal">
        <img src="${esc(thumbOf(w))}" alt="${esc(w.title)}" loading="lazy" decoding="async">
      </div>
      <div class="work-card__meta">
        <p class="work-card__tags">
          <span class="chip${isSingle(cat) ? " chip--banner" : ""}">${CATS[cat]}</span>
          ${w.type === "実案件" ? `<span class="chip chip--client">${esc(w.type)}</span>` : `<span class="chip chip--line">${esc(w.type || "自主制作")}</span>`}
          <span>${esc(w.industry || "")}</span>
        </p>
        <h3 class="work-card__title">${esc(w.title)}</h3>
        ${w.summary ? `<p class="work-card__summary">${esc(w.summary)}</p>` : ""}
      </div>
    </a>`;
}

function renderFilter(box: HTMLElement, works: Work[], current: string, onChange: (cat: string) => void) {
  const count = (c: string) => (c === "all" ? works.length : works.filter((w) => w.category === c).length);
  const items = [["all", "ALL"], ...Object.entries(CAT_FILTER)];
  box.innerHTML = items
    .map(
      ([k, label]) =>
        `<button type="button" data-cat="${k}" aria-pressed="${k === current}">${label}<span class="count">${count(k)}</span></button>`,
    )
    .join("");
  box.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button[data-cat]");
    if (!b) return;
    box.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    onChange(b.dataset.cat || "all");
  });
}

function showError(box: HTMLElement, err: unknown) {
  box.innerHTML = `<p class="works-empty">実績を読み込めませんでした。ページを再読み込みしてください。</p>`;
  console.error(err);
}

/* ---------- ファーストビューの実績スライダー ----------
   PC・タブレット: 右端に半円を描いて縦に流れる / スマホ: 横に流れる
   奥（正面から遠い）ほど小さく・淡く・ぼかして立体感を出す */
async function initHero(scope: ParentNode, signal: AbortSignal): Promise<void> {
  const root = scope.querySelector<HTMLElement>("[data-hero-works]");
  if (!root) return;
  let works;
  try {
    works = await loadWorks();
  } catch (e) {
    console.error(e);
    return;
  }
  const list = works.slice(0, cfg.heroWorksCount || 8);
  if (!list.length) return;
  if (signal.aborted) return;
  Arc(root, list, cfg.heroInterval || 3000, signal);
}

function Arc(root: HTMLElement, list: Work[], interval: number, signal: AbortSignal) {
  const stage = root.querySelector("[data-arc-stage]") as HTMLElement;
  const countEl = root.querySelector("[data-arc-count]");
  const titleEl = root.querySelector("[data-arc-title]");
  const reduce = reduceMotion;
  const narrow = window.matchMedia("(max-width: 640px)");
  // 1200px以下は横の広がりを狭めて、正面から上下3枚目までを画面内に収める
  const compact = window.matchMedia("(max-width: 1200px)");

  // 半円が途切れないよう、少ない時は複製して6枚以上にする
  const items: HTMLAnchorElement[] = [];
  // 各カードの実績と、複製前の番号
  const info: { work: Work; src: number }[] = [];
  const copies = Math.max(1, Math.ceil(6 / list.length));
  for (let c = 0; c < copies; c++) {
    list.forEach((w, i) => {
      const cat = catOf(w);
      const a = document.createElement("a");
      a.className = `arc-item arc-item--${isSingle(cat) ? "banner" : cat}`;
      a.href = workURL(w);
      a.dataset.cursor = "view";
      a.innerHTML = `<span class="arc-item__in" style="--i:${items.length}"><img src="${esc(thumbOf(w))}" alt="${c ? "" : esc(w.title)}" decoding="async"></span>`;
      if (c) {
        a.setAttribute("aria-hidden", "true");
        a.tabIndex = -1;
      }
      info.push({ work: w, src: i });
      stage.appendChild(a);
      items.push(a);
    });
  }
  const N = items.length;
  const wrap = (p: number) => {
    p = ((p % N) + N) % N;
    return p >= N / 2 ? p - N : p;
  };

  // 縦（PC）の半円。正面を原点に、右側に中心がある円の上に並べる
  let KX = 1;
  const arcPos = (p: number, cw: number, R: number, kx = KX) => {
    const th = (p * (compact.matches ? 22 : 24) * Math.PI) / 180;
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
  // タブレット〜小さめPCでは、左の文字の右端のすぐ横からスライダーを始める（間が空きすぎないように）
  const hero = root.closest<HTMLElement>(".hero");
  const profile = hero && hero.querySelector<HTMLElement>(".hero__profile");
  function fitShowcase() {
    if (!hero) return;
    if (narrow.matches || !compact.matches || !profile) {
      hero.style.removeProperty("--showcase-left");
      return;
    }
    const vw = hero.clientWidth;
    // 文字・ボタンなど実際に見えている中身の右端を測る
    let right = 0;
    const range = document.createRange();
    const walk = document.createTreeWalker(profile, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
      if (!walk.currentNode.nodeValue?.trim()) continue;
      range.selectNodeContents(walk.currentNode);
      for (const r of range.getClientRects()) right = Math.max(right, r.right);
    }
    profile.querySelectorAll(".btn, .hero__tags li").forEach((el) => {
      right = Math.max(right, el.getBoundingClientRect().right);
    });
    const gap = Math.max(16, vw * 0.025);
    const left = Math.min(Math.max(right + gap, vw * 0.36), vw * 0.56);
    hero.style.setProperty("--showcase-left", Math.round(left) + "px");
  }

  function measure() {
    fitShowcase();
    W = stage.clientWidth;
    H = stage.clientHeight;
    mode = narrow.matches ? "h" : "v";
    if (mode === "v") {
      // 画面の幅・高さに収まるように全体を縮める（見切れ防止）
      const cw0 = H * 0.62,
        R0 = H * 0.56;
      const bounds = (kx: number) => {
        let l = 0,
          r = 0,
          t = 0,
          b = 0;
        for (let p = -3; p <= 3; p += 0.25) {
          const g = arcPos(p, cw0, R0, kx);
          l = Math.min(l, g.x - g.w / 2);
          r = Math.max(r, g.x + g.w / 2);
          if (Math.abs(p) <= (compact.matches ? 3 : 1.5)) {
            t = Math.min(t, g.y - g.h / 2);
            b = Math.max(b, g.y + g.h / 2);
          }
        }
        return { l, r, t, b, f: Math.min(1, (W - 24) / (r - l), H / (b - t)) };
      };
      // 1200px以下は、高さいっぱいの大きさを保てる範囲で半円の横の膨らみを広げる（細い画面ほど細い弧に）
      KX = compact.matches ? 0.35 : 1;
      let bd = bounds(KX);
      if (compact.matches) {
        for (let kx = 0.4; kx <= 1.0001; kx += 0.05) {
          const n = bounds(kx);
          if (n.f < bd.f - 0.001) break;
          KX = kx;
          bd = n;
        }
      }
      const { l, r, f } = bd;
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
      let x: number, y: number, s: number, o: number;
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
    const { work, src } = info[i];
    if (countEl) countEl.textContent = `${String(src + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`;
    if (titleEl) titleEl.textContent = work.title;
  }

  // 一定間隔で1枚ずつ送る（PC・タブレットは下から上へ、スマホは右から左へ）
  let drag: { x: number; y: number; start: number } | null = null,
    moved = false,
    visible = true,
    hover = false,
    last = 0,
    raf = 0,
    timer = 0;
  function frame(t: number) {
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    if (!drag) offset += (target - offset) * (1 - Math.exp(-dt * 4.2));
    if (Math.abs(target - offset) < 0.0005) offset = target;
    layout();
    updateLabel();
    raf = visible && !signal.aborted ? requestAnimationFrame(frame) : 0;
  }
  const run = () => {
    if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  const tick = () => {
    clearTimeout(timer);
    if (signal.aborted) return;
    timer = window.setTimeout(() => {
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
    const t = e.target as Element;
    const i = items.indexOf(t.closest(".arc-item") as HTMLAnchorElement);
    if (i >= 0 && t.matches(":focus-visible")) target += wrap(i - target);
  });

  // 正面以外をクリックしたら正面に送る。正面は詳細ページへ
  stage.addEventListener(
    "click",
    (e) => {
      const el = (e.target as Element).closest(".arc-item") as HTMLAnchorElement | null;
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
    // 指・カーソルを動かした方向に実績が動く（下へドラッグ→下へ、右へドラッグ→右へ）
    offset = target = drag.start - d / (cw * (mode === "v" ? 0.55 : 0.6));
    run();
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    target = Math.round(target);
    tick();
  };
  window.addEventListener("pointerup", end, { signal });
  window.addEventListener("pointercancel", end, { signal });
  stage.addEventListener("dragstart", (e) => e.preventDefault());

  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    if (visible) run();
  }).observe(root);
  const relayout = () => {
    measure();
    layout();
  };
  compact.addEventListener("change", relayout, { signal });
  window.addEventListener("resize", relayout, { signal });
  narrow.addEventListener("change", relayout, { signal });
  signal.addEventListener("abort", () => clearTimeout(timer));

  measure();
  layout();
  // 文字の幅はWebフォントの読み込みで変わるので、読み込み後に測り直す
  if (document.fonts) document.fonts.ready.then(() => !signal.aborted && relayout());
  updateLabel();
  run();
  if (!reduce) tick();
  root.classList.add("is-built");
}

/* ---------- 実績一覧ページ ---------- */
async function initList(scope: ParentNode, signal: AbortSignal): Promise<void> {
  const grid = scope.querySelector<HTMLElement>('[data-works="all"]');
  if (!grid) return;
  let works;
  try {
    works = await loadWorks();
  } catch (e) {
    showError(grid, e);
    return;
  }
  const per = cfg.worksPerPage || 6;
  const moreBox = scope.querySelector<HTMLElement>("[data-more]");
  const moreBtn = moreBox && moreBox.querySelector("button");
  const box = grid;
  const qs = new URLSearchParams(location.search);
  const q = qs.get("cat");
  let cat: string = isCat(q) ? q : "all";
  let shown = 0;
  const filtered = () => works.filter((w) => cat === "all" || w.category === cat);
  const more = () => {
    const list = filtered();
    const next = list.slice(shown, shown + per);
    box.insertAdjacentHTML("beforeend", next.map(cardHTML).join(""));
    shown += next.length;
    if (moreBox) moreBox.hidden = shown >= list.length;
    Reveal.observe(box);
  };
  const reset = (c: string, first = false) => {
    cat = c;
    shown = 0;
    grid.innerHTML = "";
    if (!first && !signal.aborted) {
      const url = new URL(location.href);
      c === "all" ? url.searchParams.delete("cat") : url.searchParams.set("cat", c);
      history.replaceState(history.state, "", url);
    }
    if (!filtered().length) {
      grid.innerHTML = '<p class="works-empty">この種類の実績は準備中です。</p>';
      if (moreBox) moreBox.hidden = true;
      return;
    }
    more();
  };
  const filter = scope.querySelector<HTMLElement>("[data-filter]");
  if (filter) renderFilter(filter, works, cat, (c) => reset(c));
  if (moreBtn) moreBtn.addEventListener("click", more);
  reset(cat, true);
}

/* ---------- 実績詳細ページ ---------- */
async function initDetail(scope: ParentNode, signal: AbortSignal, id: string): Promise<void> {
  const root = scope.querySelector<HTMLElement>("[data-work-detail]");
  if (!root) return;
  let works;
  try {
    works = await loadWorks();
  } catch (e) {
    showError(root, e);
    return;
  }
  const idx = works.findIndex((w) => w.id === id);
  if (idx < 0) {
    root.innerHTML = `<div class="wrap" style="padding-block:120px"><p class="works-empty">お探しの実績が見つかりませんでした。<br><a href="/works">実績一覧へ戻る</a></p></div>`;
    return;
  }
  const w = works[idx];
  const cat = catOf(w);
  if (!signal.aborted) setMeta(`${w.title}｜制作実績｜ショウジアキフミ`, w.summary);

  const prev = works[idx - 1],
    next = works[idx + 1];
  const meta = [
    ["CATEGORY", CATS[cat]],
    w.client ? ["CLIENT", w.client] : null,
    ["INDUSTRY", w.industry],
    ["ROLE", (w.role || []).join("・")],
    ["PERIOD", w.period],
    ["TOOLS", (w.tools || []).join(" / ")],
  ].filter((m): m is [string, string] => !!m && !!m[1]);

  const visual = isSingle(cat)
    ? `<div class="detail-visual detail-visual--banner ink-reveal"><img src="${esc(w.images?.banner)}" alt="${esc(w.title)}" width="1080" height="1080"></div>`
    : `<div class="detail-visual ink-reveal"><img src="${esc(w.images?.mockup || thumbOf(w))}" alt="${esc(w.title)}のPC・スマホ表示" width="1600" height="1040"></div>`;

  const screens =
    !isSingle(cat) && w.images && (w.images.pc || w.images.sp)
      ? `
    <section class="detail-sec" data-reveal>
      <h2><span class="ink-dot" aria-hidden="true"></span>ページ全体</h2>
      <p class="screen__hint">枠の中をスクロールすると、ページ全体を見られます。</p>
      <div class="screens">
        ${w.images.pc ? `<div class="screen screen--pc"><p class="screen__label">PC</p><div class="screen__frame screen__frame--pc" tabindex="0" role="region" aria-label="PC表示のスクロール領域"><img src="${esc(w.images.pc)}" alt="${esc(w.title)}のPC表示（全体）" loading="lazy"></div></div>` : ""}
        ${w.images.sp ? `<div class="screen screen--sp"><p class="screen__label">SMARTPHONE</p><div class="screen__frame screen__frame--sp" tabindex="0" role="region" aria-label="スマホ表示のスクロール領域"><img src="${esc(w.images.sp)}" alt="${esc(w.title)}のスマホ表示（全体）" loading="lazy"></div></div>` : ""}
      </div>
    </section>`
      : "";

  root.innerHTML = `
    <section class="page-hero">
      <canvas class="ink-canvas" data-ink="page" aria-hidden="true"></canvas>
      <div class="wrap">
        <ol class="breadcrumb"><li><a href="/">HOME</a></li><li><a href="/works">WORKS</a></li><li aria-current="page">${esc(w.title)}</li></ol>
        <div class="detail-head">
          <p class="detail-head__tags">
            <span class="chip${isSingle(cat) ? " chip--banner" : ""}">${CATS[cat]}</span>
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
          <a class="btn" href="/#contact">この実績について相談する</a>
        </aside>
      </div>
    </section>

    <section class="section" style="padding-top:0">
      <div class="wrap" style="display:grid;gap:clamp(40px,6vw,72px)">
        <nav class="pager" aria-label="前後の実績">
          ${prev ? `<a class="prev" href="${workURL(prev)}"><small>← NEWER</small><span>${esc(prev.title)}</span></a>` : "<span></span>"}
          ${next ? `<a class="next" href="${workURL(next)}"><small>OLDER →</small><span>${esc(next.title)}</span></a>` : "<span></span>"}
        </nav>
        <div class="cta-band" data-reveal>
          <div><h2>こんなバナー・LPを作りたい、をお聞かせください。</h2><p>ご相談・お見積もりは無料です。</p></div>
          <a class="btn" href="/#contact">無料で相談する<svg class="btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        </div>
      </div>
    </section>`;
}

export const Works = { initHero, initList, initDetail, load: loadWorks };

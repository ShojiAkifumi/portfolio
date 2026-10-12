// 共通の演出: 画面切り替え / ヘッダー / インクの背景 / カーソル（ここからサイト全体が動き出す）
import { SITE_CONFIG } from "./config";
import { Contact } from "./contact";
import { InkCloud, InkTransition, reduceMotion, type CloudOptions } from "./ink";
import { $, $$, Reveal, setMeta } from "./site";
import { Views, type ViewDef, type ViewName } from "./views";
import { Works } from "./works";

const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
type Point = { x: number; y: number };

/* ---------- ヘッダー ---------- */
// スマホのメニューの中のリンクで閉じた時は true（パネルが消えるのを待ってから画面を切り替える）
let menuClosedByLink = false;
// メニューのパネルが消える時間（scss/_header.scss の .nav の transition と同じ）
const MENU_FADE_MS = 500;

function initHeader() {
  const header = $(".header");
  if (!header) return;
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const btn = $(".menu-btn");
  const nav = $("#nav");
  if (btn && nav) {
    const set = (open: boolean) => {
      document.body.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    };
    btn.addEventListener("click", () => set(!document.body.classList.contains("menu-open")));
    $$("a", nav).forEach((a) =>
      a.addEventListener("click", () => {
        menuClosedByLink = document.body.classList.contains("menu-open");
        set(false);
      }),
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") set(false);
    });
  }
}

// 表示中のセクションをナビに反映（トップ）／実績の画面では WORKS を現在地にする
function initNavCurrent(view: HTMLElement, name: RouteName, signal: AbortSignal) {
  const links = $$<HTMLAnchorElement>(".nav__list a");
  const set = (a: Element | null | undefined) => links.forEach((l) => l.setAttribute("aria-current", String(l === a)));
  if (name !== "home") {
    set(name === "works" || name === "detail" ? links.find((l) => l.getAttribute("href") === "/works") : null);
    return;
  }
  set(null);
  if (!("IntersectionObserver" in window)) return;
  const map = new Map(
    links
      .filter((a) => (a.getAttribute("href") || "").startsWith("/#"))
      .map((a) => [(a.getAttribute("href") || "").slice(2), a]),
  );
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        const a = map.get(en.target.id);
        if (a && en.isIntersecting) set(a);
      });
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  map.forEach((_, id) => {
    const s = $("#" + id, view);
    if (s) io.observe(s);
  });
  // ページのトップ（ファーストビュー）に戻ったら現在地の表示を外す
  const hero = $(".hero", view);
  const io2 = new IntersectionObserver(
    (entries) => {
      if (entries.some((en) => en.isIntersecting)) set(null);
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  if (hero) io2.observe(hero);
  signal.addEventListener("abort", () => {
    io.disconnect();
    io2.disconnect();
  });
}

/* ---------- 漂うインクの背景 ---------- */
// center: [x, y]（0〜1、y は下から）。scale: インクの大きさ
const CLOUDS: Record<string, CloudOptions> = {
  hero: {
    center: (w) => (w < 760 ? [0.55, 0.32] : [0.72, 0.5]),
    scale: (w) => (w < 760 ? 0.55 : 0.6),
    alpha: 1,
    mouse: true,
    delay: 250,
  },
  page: {
    center: (w) => (w < 760 ? [0.95, 0.8] : [0.88, 0.55]),
    scale: (w) => (w < 760 ? 0.5 : 0.62),
    alpha: 0.8,
    mouse: true,
    delay: 250,
  },
  contact: {
    center: (w) => (w < 760 ? [0.05, 0.08] : [0.08, 0.2]),
    scale: () => 0.7,
    alpha: 0.55,
    mouse: false,
    delay: 0,
  },
};
// signal: その画面を閉じた時に abort される（インクの WebGL も一緒に手放す）
function initClouds(scope: ParentNode, signal: AbortSignal) {
  $$<HTMLCanvasElement>("canvas[data-ink]", scope).forEach((c) => {
    if (c.dataset.inkBound) return;
    c.dataset.inkBound = "1";
    const opts = CLOUDS[c.dataset.ink || ""];
    if (opts) InkCloud(c, opts, signal);
  });
}

/* ---------- セクションのつなぎ目のインク ---------- */
function initEdges(scope: ParentNode) {
  $$("[data-ink-edge]", scope).forEach((sec) => {
    if (sec.dataset.edgeBound) return;
    sec.dataset.edgeBound = "1";
    const color = getComputedStyle(sec).backgroundColor;
    (sec.dataset.inkEdge || "").split(" ").forEach((pos) => {
      const e = document.createElement("div");
      e.className = `ink-edge ink-edge--${pos}`;
      e.setAttribute("aria-hidden", "true");
      e.style.setProperty("--edge-color", color);
      sec.prepend(e);
    });
  });
}

/* ---------- カーソルとホバーのにじみ位置 ---------- */
function initPointer() {
  document.addEventListener(
    "pointermove",
    (e) => {
      const t = (e.target as Element).closest?.<HTMLElement>(".btn");
      if (!t) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
      t.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
    },
    { passive: true },
  );

  if (!finePointer || reduceMotion) return;
  const cur = document.createElement("div");
  cur.className = "cursor";
  cur.setAttribute("aria-hidden", "true");
  cur.innerHTML = '<span class="cursor__label">VIEW</span>';
  document.body.appendChild(cur);
  let x = -100,
    y = -100,
    tx = -100,
    ty = -100;
  document.addEventListener(
    "pointermove",
    (e) => {
      tx = e.clientX;
      ty = e.clientY;
      const el = e.target as Element;
      const view = el.closest?.('[data-cursor="view"]');
      const link = !view && el.closest?.("a, button, label, select");
      cur.classList.toggle("is-view", !!view);
      cur.classList.toggle("is-link", !!link);
    },
    { passive: true },
  );
  document.addEventListener("pointerleave", () => {
    tx = ty = -100;
  });
  (function loop() {
    x += (tx - x) * 0.16;
    y += (ty - y) * 0.16;
    cur.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    requestAnimationFrame(loop);
  })();
}

/* ---------- フッター ---------- */
const SNS_ICONS: Record<string, string> = {
  X: '<path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/>',
  Instagram:
    '<path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.2.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zm5.2-9.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/>',
  note: '<path d="M4 4h10.5A5.5 5.5 0 0 1 20 9.5V20h-4v-9.6c0-1.5-.9-2.4-2.4-2.4H8V20H4V4z"/>',
};
function initFooter(scope: ParentNode) {
  const y = $("[data-year]", scope);
  if (y) y.textContent = String(new Date().getFullYear());
  const box = $("[data-sns]", scope);
  const cfg = SITE_CONFIG;
  if (!box) return;
  if (!cfg.showSns) {
    box.remove();
    return;
  }
  (cfg.sns || [])
    .filter((s) => s.url)
    .forEach((s) => {
      const a = document.createElement("a");
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", s.name);
      a.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SNS_ICONS[s.name] || ""}</svg>`;
      box.appendChild(a);
    });
}

/* ---------- 画面（ビュー）の切り替え ----------
   1つの HTML の中で、<main> とフッターをまとめた .view を差し替える。
   次の画面は今の画面の上に重ねて置き、インクのにじみの形で切り抜いて見せる（空白を挟まず1回で切り替わる） */
const view0 = document.createElement("div");
view0.className = "view";
const main0 = $("main") as HTMLElement,
  footer0 = $(".footer") as HTMLElement;
main0.before(view0);
view0.append(main0, footer0);
// トップの中身とフッターは、JS が手を加える前の状態を控えておく
const HOME: ViewDef = {
  title: document.title,
  description: $<HTMLMetaElement>('meta[name="description"]')?.content || "",
  html: main0.innerHTML,
};
const FOOTER = footer0.outerHTML;

// URL から画面を決める（以前の works.html / work.html?id= も受け付ける）
type RouteName = "home" | ViewName;
interface Route {
  name: RouteName;
  id: string | null;
  href: string;
}
const viewOf = (name: RouteName): ViewDef => (name === "home" ? HOME : Views[name]);

function route(url: URL): Route {
  let path = url.pathname.replace(/\/index\.html$/, "/");
  if (path === "/works.html") path = "/works";
  if (path === "/work.html") {
    const id = url.searchParams.get("id");
    url.searchParams.delete("id");
    path = id ? "/works/" + encodeURIComponent(id) : "/works";
  }
  path = path.replace(/\/+$/, "") || "/";
  const m = path.match(/^\/works\/([^/]+)$/);
  const name: RouteName = path === "/" ? "home" : path === "/works" ? "works" : m ? "detail" : "notfound";
  return { name, id: m ? decodeURIComponent(m[1]) : null, href: (path === "/" ? "/" : path) + url.search + url.hash };
}

async function initView(view: HTMLElement, r: Route, signal: AbortSignal) {
  const main = $("main", view) as HTMLElement;
  const v = viewOf(r.name);
  setMeta(v.title, v.description);
  const jobs: Promise<void>[] = [];
  if (r.name === "home") {
    jobs.push(Works.initHero(main, signal));
    Contact.init(main);
  }
  if (r.name === "works") jobs.push(Works.initList(main, signal));
  if (r.name === "detail") jobs.push(Works.initDetail(main, signal, r.id || ""));
  await Promise.all(jobs).catch((e) => console.error(e));
  initFooter(view);
  initEdges(view);
  initNavCurrent(view, r.name, signal);
  Reveal.observe(view);
}

function buildView(r: Route) {
  const view = document.createElement("div");
  view.className = "view";
  view.innerHTML = `<main>${viewOf(r.name).html}</main>${FOOTER}`;
  return view;
}

// 画面の中の要素（#contact など）を、ヘッダーの高さを差し引いた位置に出すためのスクロール量
function targetY(view: ParentNode, hash: string, top: number) {
  let el: Element | null = null;
  try {
    el = hash && hash.length > 1 ? view.querySelector(decodeURIComponent(hash)) : null;
  } catch (e) {
    /* 不正な # は無視 */
  }
  if (!el) return null;
  const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  return el.getBoundingClientRect().top - top - pad;
}

let current: { view: HTMLElement; ctrl: AbortController; route: Route | null } = {
  view: view0,
  ctrl: new AbortController(),
  route: null,
};
let busy = false;
// CSS の scroll-behavior: smooth を無視して、その場で一瞬でスクロール位置を合わせる
const instant = (y: number) => window.scrollTo({ top: Math.max(0, y), left: 0, behavior: "instant" });

async function navigate(url: URL, { push = true, origin = null as Point | null, y = null as number | null } = {}) {
  if (busy) return;
  busy = true;
  const r = route(url);
  if (push) {
    history.replaceState({ ...(history.state || {}), y: window.scrollY }, "");
    history.pushState({ y: 0 }, "", r.href);
  }
  document.body.classList.remove("menu-open");
  const ctrl = new AbortController();
  const view = buildView(r);
  view.classList.add("view--next");
  view.style.clipPath = "polygon(0 0, 0 0, 0 0)";
  const inner = document.createElement("div");
  inner.className = "view__inner";
  inner.append(...view.childNodes);
  view.append(inner);
  document.body.append(view);
  document.documentElement.classList.add("is-leaving");
  await initView(view, r, ctrl.signal);

  // どこまでスクロールした状態で見せるか（# があればその位置、戻る・進むなら前の位置）
  const max = Math.max(0, inner.scrollHeight - window.innerHeight);
  let top = y != null ? y : (targetY(view, url.hash, inner.getBoundingClientRect().top) ?? 0);
  top = Math.min(max, Math.max(0, top));
  inner.style.transform = `translateY(${-top}px)`;
  initClouds(view, ctrl.signal);
  setTimeout(() => $("main", view)?.classList.add("is-ready"), 200);

  const finish = () => {
    current.ctrl.abort();
    current.view.remove();
    view.classList.remove("view--next");
    view.style.clipPath = "";
    inner.style.transform = "";
    instant(top);
    document.documentElement.classList.remove("is-leaving");
    current = { view, ctrl, route: r };
    busy = false;
    const h = $("h1", view);
    if (h) {
      h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: true });
    }
  };
  const o = origin || { x: window.innerWidth / 2, y: window.innerHeight * 0.45 };
  InkTransition.play({
    origin: o,
    onClip: (poly) => {
      view.style.clipPath = poly;
    },
    done: finish,
  });
}

function scrollToHash(hash: string) {
  const y = hash && hash !== "#top" ? targetY(current.view, hash, -window.scrollY) : 0;
  if (y == null) return;
  window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion ? "auto" : "smooth" });
}

function initLinks() {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  document.addEventListener("click", (e) => {
    const fromMenu = menuClosedByLink;
    menuClosedByLink = false;
    const a = (e.target as Element).closest?.<HTMLAnchorElement>("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === "_blank" || a.hasAttribute("download")) return;
    const raw = a.getAttribute("href") || "";
    // 「#〇〇」だけのリンクは、今の画面の中でスクロール
    if (raw.startsWith("#")) {
      e.preventDefault();
      document.body.classList.remove("menu-open");
      scrollToHash(raw);
      return;
    }
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || /\.(pdf|png|jpe?g|webp|zip)$/i.test(url.pathname)) return;
    e.preventDefault();
    document.body.classList.remove("menu-open");
    const r = route(new URL(url.href));
    // 同じ画面の中の移動はスクロールだけ
    if (current.route && r.name === current.route.name && r.id === current.route.id && url.search === location.search) {
      if (url.hash) history.replaceState(history.state, "", r.href);
      scrollToHash(url.hash || "#top");
      return;
    }
    const go = () => navigate(url, { origin: { x: e.clientX, y: e.clientY } });
    // メニューから移動する時は、パネルがバツで閉じた時と同じようにゆっくり消えてから切り替える
    // （すぐに切り替えると、次の画面の準備の間アニメーションが止まり、パネルがパッと消えて見える）
    if (fromMenu) setTimeout(go, MENU_FADE_MS);
    else go();
  });
  window.addEventListener("popstate", (e) => {
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
  if (r.href !== location.pathname + location.search + location.hash) history.replaceState({ y: 0 }, "", r.href);
  const main = $("main", view0) as HTMLElement;
  if (r.name !== "home") main.innerHTML = viewOf(r.name).html;
  current.route = r;
  await initView(view0, r, current.ctrl.signal);
  const y = targetY(view0, location.hash, -window.scrollY);
  if (y != null) instant(y);
  const html = document.documentElement;
  const ready = () => {
    main.classList.add("is-ready");
    initClouds(view0, current.ctrl.signal);
    Reveal.start();
  };
  // トップだけ雫を落とす。PC・タブレットは正面の実績（スライダーの中心）の近くに、スマホは画面の中心の少し下に落ちる
  const home = r.name === "home";
  let origin = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.46 };
  const front = home && window.innerWidth > 640 ? $(".arc-item.is-front", view0) : null;
  if (front) {
    const b = front.getBoundingClientRect();
    if (b.width) origin = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }
  // そこから画面の幅・高さの4%ずつ右上へずらす（スマホは画面の中心から高さの5%下）
  if (home && !front) origin = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.55 };
  else if (home) {
    origin = {
      x: Math.min(window.innerWidth * 0.95, origin.x + window.innerWidth * 0.04),
      y: Math.max(window.innerHeight * 0.05, origin.y - window.innerHeight * 0.04),
    };
  }
  const strength = home && !reduceMotion ? $("#strength", view0) : null;
  if (strength) strength.classList.add("is-held");
  const header = home && !reduceMotion ? $(".header") : null;
  if (header) header.classList.add("is-held");
  if (home) await InkTransition.preload(1200);
  const played = InkTransition.play({
    origin,
    duration: 1700,
    drop: home,
    paper: true,
    onImpact: () => {
      setTimeout(ready, 40);
      // STRENGTH は着地から1秒後に現す
      setTimeout(() => strength && strength.classList.remove("is-held"), 1000);
      // ヘッダーは着地から0.3秒後に現す
      setTimeout(() => header && header.classList.remove("is-held"), 300);
    },
  });
  // 1コマ目が描かれてから白い覆いを外す
  requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove("is-covered")));
  if (!played) ready();
}

document.addEventListener("DOMContentLoaded", () => {
  initHeader();
  initPointer();
  initLinks();
  boot();
});

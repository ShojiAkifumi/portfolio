// アクセス解析（Googleアナリティクス 4）
// - 画面を切り替えるたびに、タイトルが決まってから page_view を1回送る（SPA のため自動の計測は使わない）
// - X の DM ボタンを押した時は generate_lead、「無料で相談する」など #contact へのボタンは contact_click を送る
// - 手元（localhost など）では読み込まない
import { SITE_CONFIG } from "./config";

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: Gtag;
  }
}

const id = SITE_CONFIG.gaId;
const enabled = !!id && /\./.test(location.hostname) && !/^(127\.|192\.168\.|10\.)/.test(location.hostname);
let lastPath = "";

function init() {
  if (!enabled) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // gtag.js は arguments オブジェクトのまま受け取る決まり
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", id, { send_page_view: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.append(s);

  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element).closest?.<HTMLAnchorElement>("a[href]");
      if (!a) return;
      // どこのボタンか（header / footer / セクションの id）
      const where = a.closest("header, footer")?.tagName.toLowerCase() || a.closest("main section[id]")?.id || "";
      const url = new URL(a.href, location.href);
      if (/(^|\.)(x|twitter)\.com$/.test(url.hostname) && url.pathname.replace(/\/$/, "") === "/shojiwebdesign") {
        event("generate_lead", { method: "x_dm", link_location: where });
      } else if (url.origin === location.origin && url.hash === "#contact") {
        event("contact_click", {
          link_location: where,
          link_text: a.textContent?.trim() || "",
        });
      }
    },
    true,
  );
}

export function pageView() {
  if (!enabled || !window.gtag) return;
  const path = location.pathname + location.search;
  if (path === lastPath) return;
  lastPath = path;
  window.gtag("event", "page_view", {
    page_location: location.origin + path,
    page_path: path,
    page_title: document.title,
  });
}

export function event(name: string, params: Record<string, unknown> = {}) {
  if (enabled && window.gtag) window.gtag("event", name, params);
}

init();

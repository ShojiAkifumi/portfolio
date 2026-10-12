// どの画面からも使う共通の部品: 要素の取得 / ページのタイトル / ふわっと登場
import { prepareMasks, reduceMotion } from "./ink";

export const $ = <E extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<E>(s);
export const $$ = <E extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  Array.from(r.querySelectorAll<E>(s));

export function setMeta(title: string, description?: string) {
  document.title = title;
  const md = $('meta[name="description"]');
  if (md && description) md.setAttribute("content", description);
}

/* ---------- ふわっと登場 ---------- */
export const Reveal = (function () {
  const supported = "IntersectionObserver" in window && !reduceMotion;
  const masks = prepareMasks();
  let ready = false;
  const queue: HTMLElement[] = [];
  const io = supported
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (!en.isIntersecting) return;
            io?.unobserve(en.target);
            show(en.target as HTMLElement);
          });
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
      )
    : null;

  function inkIn(el: HTMLElement) {
    el.dataset.ink = Math.random() < 0.5 ? "a" : "b";
    el.classList.remove("is-pending");
    el.classList.add("is-inking");
    const end = () => el.classList.remove("is-inking");
    el.addEventListener("animationend", (e) => {
      if (e.animationName === "inkMask") end();
    });
    setTimeout(end, 2200 + (parseFloat(el.style.getPropertyValue("--ink-delay")) || 0));
  }
  function show(el: HTMLElement) {
    if (!el.classList.contains("ink-reveal")) {
      el.classList.remove("is-pending");
      return;
    }
    // マスク画像の準備ができてから、インクの形で現す
    masks.then(
      () => inkIn(el),
      () => el.classList.remove("is-pending"),
    );
  }

  function splitChars(el: HTMLElement) {
    if (el.dataset.split) return;
    el.dataset.split = "1";
    const text = el.textContent || "";
    el.textContent = "";
    [...text].forEach((ch, i) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.style.setProperty("--i", String(i));
      s.textContent = ch === " " ? " " : ch;
      el.appendChild(s);
    });
  }

  // 画面外にある要素だけを隠して監視する（最初に見えている内容は、ページが現れた後に登場）
  function observe(root: ParentNode = document) {
    $$(".section-head__en", root).forEach(splitChars);
    $$("[data-reveal], .section-head__en, .ink-reveal", root).forEach((el) => {
      if (el.dataset.revealBound) return;
      el.dataset.revealBound = "1";
      if (!io) return;
      el.classList.add("is-pending");
      if (ready) io.observe(el);
      else queue.push(el);
    });
  }
  function start() {
    ready = true;
    queue.splice(0).forEach((el) => io?.observe(el));
    // 速いスクロールで監視をすり抜けた要素（すでに画面より上にあるもの）も表示する
    let tick = 0;
    window.addEventListener(
      "scroll",
      () => {
        if (tick) return;
        tick = requestAnimationFrame(() => {
          tick = 0;
          $$(".is-pending").forEach((el) => {
            if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
              io?.unobserve(el);
              show(el);
            }
          });
        });
      },
      { passive: true },
    );
  }
  return { observe, start };
})();

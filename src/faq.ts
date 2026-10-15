// よくある質問：<details> の開閉を高さのアニメーションでやわらかく動かす
import { reduceMotion } from "./ink";
import { $$ } from "./site";

const EASE = "cubic-bezier(0.33, 0.1, 0.2, 1)";

// 開閉中はブラウザのスクロール位置の自動調整（scroll anchoring）を止める。
// 止めないと、下にある要素を基準に画面がずれ、質問の上端が動いて見える
let anchorTimer = 0;
function holdScroll(ms: number) {
  const root = document.documentElement;
  root.style.overflowAnchor = "none";
  clearTimeout(anchorTimer);
  anchorTimer = window.setTimeout(() => (root.style.overflowAnchor = ""), ms + 100);
}

function animate(item: HTMLDetailsElement, summary: HTMLElement, opening: boolean) {
  holdScroll(600);
  const answer = item.querySelector<HTMLElement>(".faq__a");
  const closed = summary.offsetHeight;
  const from = item.offsetHeight;
  if (opening) item.open = true;
  const to = opening ? item.scrollHeight : closed;
  item.classList.toggle("is-open", opening);
  item.getAnimations().forEach((a) => a.cancel());
  answer?.getAnimations().forEach((a) => a.cancel());
  const duration = Math.min(520, 300 + Math.abs(to - from) * 0.8);
  const anim = item.animate({ height: [`${from}px`, `${to}px`] }, { duration, easing: EASE });
  answer?.animate(
    opening
      ? { opacity: [0, 1], transform: ["translateY(-6px)", "translateY(0)"] }
      : { opacity: [1, 0], transform: ["translateY(0)", "translateY(-6px)"] },
    { duration: duration * 0.9, easing: EASE, fill: "forwards" },
  );
  anim.onfinish = () => {
    if (!opening) item.open = false;
    answer?.getAnimations().forEach((a) => a.cancel());
  };
}

function init(scope: ParentNode, signal: AbortSignal) {
  $$<HTMLDetailsElement>(".faq__item", scope).forEach((item) => {
    const summary = item.querySelector<HTMLElement>(".faq__q");
    if (!summary) return;
    item.classList.toggle("is-open", item.open);
    summary.addEventListener(
      "click",
      (e) => {
        if (reduceMotion) {
          holdScroll(0);
          item.classList.toggle("is-open", !item.open);
          return;
        }
        e.preventDefault();
        animate(item, summary, !item.classList.contains("is-open"));
      },
      { signal },
    );
    // 開いている時は、答えの部分を押しても閉じる（文字を選択した時は閉じない）
    item.querySelector(".faq__a")?.addEventListener(
      "click",
      () => {
        if (!item.classList.contains("is-open") || String(window.getSelection() || "")) return;
        summary.click();
      },
      { signal },
    );
  });
}

export const Faq = { init };

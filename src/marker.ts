// マーカー（data-marker を付けた要素）：画面に入ったら、1行ずつ左から右へ線を引く
// 行ごとにアニメーションを遅らせるため、表示中の折り返し位置で文字を行ごとの <span> に分け直す
import { reduceMotion } from "./ink";
import { $$ } from "./site";

// 文字を1つずつ並べて位置を測り、同じ高さの文字を1行の <span> にまとめる
function splitLines(el: HTMLElement) {
  const text = el.dataset.markerText ?? el.textContent ?? "";
  el.dataset.markerText = text;
  el.textContent = "";
  const chars = Array.from(text).map((ch) => {
    const s = document.createElement("span");
    s.textContent = ch;
    el.appendChild(s);
    return s;
  });
  const lines: string[] = [];
  let top = NaN;
  chars.forEach((s) => {
    const t = s.offsetTop;
    if (t !== top) {
      lines.push("");
      top = t;
    }
    lines[lines.length - 1] += s.textContent;
  });
  el.textContent = "";
  lines.forEach((line, i) => {
    const s = document.createElement("span");
    s.className = "marker__line";
    s.style.setProperty("--i", String(i));
    s.textContent = line;
    el.appendChild(s);
  });
}

function init(scope: ParentNode, signal: AbortSignal) {
  const els = $$<HTMLElement>("[data-marker]", scope);
  if (!els.length) return;
  els.forEach(splitLines);
  if (reduceMotion || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-marked"));
  } else {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          // ふわっと登場が落ち着いてから引き始める
          setTimeout(() => en.target.classList.add("is-marked"), 500);
        }),
      { rootMargin: "0px 0px -15% 0px", threshold: 1 },
    );
    els.forEach((el) => io.observe(el));
    signal.addEventListener("abort", () => io.disconnect());
  }
  // 画面幅が変わると折り返し位置も変わるので、分け直す
  let timer = 0;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => els.forEach(splitLines), 200);
    },
    { signal },
  );
}

export const Marker = { init };

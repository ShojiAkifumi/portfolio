// お問い合わせフォーム: 入力チェックと送信（送信先は src/config.ts の formEndpoint）
import { SITE_CONFIG } from "./config";

// ページ（ビュー）が表示されるたびに、その中のフォームに対して呼ばれる
function init(scope: ParentNode) {
  const found = scope.querySelector<HTMLFormElement>("#contact-form");
  if (!found) return;
  const form = found;
  const status = form.querySelector(".form__status") as HTMLElement;
  const submit = form.querySelector('[type="submit"]') as HTMLButtonElement;
  const endpoint = SITE_CONFIG.formEndpoint;
  type Field = HTMLInputElement | HTMLTextAreaElement;
  const field = (name: string) => form.elements.namedItem(name) as Field;

  const rules: Record<string, (v: string) => string> = {
    name: (v) => (v.trim() ? "" : "お名前を入力してください。"),
    email: (v) =>
      !v.trim()
        ? "メールアドレスを入力してください。"
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
          ? ""
          : "メールアドレスの形式をご確認ください（例：name@example.com）。",
    message: (v) => (v.trim() ? "" : "ご相談内容を入力してください。"),
  };

  function check(input: Field) {
    const rule = rules[input.name];
    if (!rule) return true;
    const msg = rule(input.value);
    const err = form.querySelector(`#${input.id}-err`);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (err) err.textContent = msg;
    if (err && msg) input.setAttribute("aria-describedby", err.id);
    return !msg;
  }

  Object.keys(rules).forEach((name) => {
    const input = field(name);
    input.addEventListener("blur", () => check(input));
    input.addEventListener("input", () => {
      if (input.getAttribute("aria-invalid") === "true") check(input);
    });
  });

  // メールで読みやすいよう、日本語の項目名でまとめて送る
  const labels: Record<string, string> = {
    name: "お名前",
    company: "会社名・屋号",
    email: "メールアドレス",
    service: "ご依頼内容",
    budget: "ご予算",
    deadline: "ご希望の納期",
    message: "ご相談内容",
  };
  function payload() {
    const fd = new FormData(form);
    const data: Record<string, string> = {
      _subject: "【ポートフォリオ】お問い合わせが届きました",
      _template: "table",
      _captcha: "false",
    };
    Object.keys(labels).forEach((k) => {
      data[labels[k]] =
        fd
          .getAll(k)
          .map((v) => String(v).trim())
          .filter(Boolean)
          .join("、") || "—";
    });
    data._replyto = String(fd.get("email") || "").trim();
    return data;
  }

  function show(text: string, state: "ok" | "error") {
    status.hidden = false;
    status.textContent = text;
    status.dataset.state = state;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const invalid = Object.keys(rules)
      .map(field)
      .filter((i) => !check(i));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    if (!endpoint) {
      show("フォームは現在準備中です。公開までもうしばらくお待ちください。", "error");
      return;
    }

    submit.disabled = true;
    const text = submit.firstChild as Text;
    const label = text.textContent;
    text.textContent = "送信中…";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify(payload()),
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || String(data.success) === "false") throw new Error(data.message || String(res.status));
      form.reset();
      show("送信しました。24時間以内に、ご入力のメールアドレスへお返事します。", "ok");
    } catch (err) {
      // 原因を開発者ツールのコンソールで確認できるように残す
      console.error("[contact] 送信エラー:", err);
      // FormSubmit を有効化する前は「Activation が必要」という返事が返ってくる
      if (/activat/i.test(String((err as Error)?.message))) {
        show("フォームの有効化待ちです。サイト管理者宛てに届いた FormSubmit のメールから有効化してください。", "error");
        return;
      }
      show("送信できませんでした。通信環境をご確認のうえ、もう一度お試しください。", "error");
    } finally {
      submit.disabled = false;
      text.textContent = label;
    }
  });
}

export const Contact = { init };

// data/works.json の実績を microCMS に登録する（移行用。1回だけ使う想定）
//
// 使い方: MICROCMS_SERVICE_DOMAIN=xxxx MICROCMS_WRITE_KEY=yyyy node tools/microcms-import.mjs [--dry-run]
// キーには works の PUT と、マネジメントAPIの「メディアのアップロード」の権限が必要です。
// 同じコンテンツIDがあれば上書きします。
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const domain = process.env.MICROCMS_SERVICE_DOMAIN;
const key = process.env.MICROCMS_WRITE_KEY;
const dry = process.argv.includes("--dry-run");
if (!domain || (!key && !dry)) {
  console.log("MICROCMS_SERVICE_DOMAIN と MICROCMS_WRITE_KEY を指定してください");
  process.exit(1);
}

const MIME = { ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
async function upload(rel) {
  const file = path.join(root, rel);
  if (dry) return `(upload ${rel})`;
  const form = new FormData();
  form.append("file", new Blob([await readFile(file)], { type: MIME[path.extname(file)] }), path.basename(file));
  const res = await fetch(`https://${domain}.microcms-management.io/api/v1/media`, {
    method: "POST",
    headers: { "X-MICROCMS-API-KEY": key },
    body: form,
  });
  if (!res.ok) throw new Error(`画像をアップロードできませんでした ${rel} (${res.status} ${await res.text()})`);
  return (await res.json()).url;
}

// works.json の1件 → microCMS のコンテンツ（microcms/works-schema.json の項目）
async function toContent(w) {
  const c = {
    title: w.title,
    category: [w.category === "banner" ? "バナー" : "LP"],
    type: [w.type === "実案件" ? "実案件" : "自主制作"],
    client: w.client || "",
    industry: w.industry || "",
    // 日本時間の 0時
    date: w.date ? `${w.date}T00:00:00+09:00` : undefined,
    role: w.role || [],
    period: w.period || "",
    tools: (w.tools || []).join(", "),
    summary: w.summary || "",
    purpose: w.purpose || "",
    points: (w.points || []).join("\n"),
    specs: (w.specs || []).map((s) => `${s.label}：${s.value}`).join("\n"),
    result: w.result || "",
    url: w.url || "",
  };
  for (const k of ["mockup", "banner", "pc", "sp"]) {
    if (w.images?.[k]) c[k] = await upload(w.images[k]);
  }
  return c;
}

const works = JSON.parse(await readFile(path.join(root, "data/works.json"), "utf8"));
for (const w of works) {
  const body = await toContent(w);
  if (dry) {
    console.log(w.id, JSON.stringify(body));
    continue;
  }
  const res = await fetch(`https://${domain}.microcms.io/api/v1/works/${encodeURIComponent(w.id)}`, {
    method: "PUT",
    headers: { "X-MICROCMS-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${w.id} を登録できませんでした (${res.status} ${await res.text()})`);
  console.log(`登録しました: ${w.id} ${w.title}`);
}

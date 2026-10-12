// microCMS から実績を読み込む（npm run build の時だけ使います）
//
// 環境変数 MICROCMS_SERVICE_DOMAIN（xxxx.microcms.io の xxxx）と MICROCMS_API_KEY がある時だけ読み込み、
// data/works.json と同じ形に変換します。API の項目は microcms/works-schema.json を参照してください。
const ENDPOINT = "works";
// microCMS の画像は WebP に変換して配信（WebP の上限 16383px を超える縦長画像はそのまま）
const WEBP_MAX = 16383;

export const microcmsEnabled = () => Boolean(process.env.MICROCMS_SERVICE_DOMAIN && process.env.MICROCMS_API_KEY);

export async function fetchWorks() {
  const domain = process.env.MICROCMS_SERVICE_DOMAIN;
  const key = process.env.MICROCMS_API_KEY;
  const items = [];
  for (let offset = 0; ; offset += 100) {
    const url = `https://${domain}.microcms.io/api/v1/${ENDPOINT}?limit=100&offset=${offset}`;
    const res = await fetch(url, { headers: { "X-MICROCMS-API-KEY": key } });
    if (!res.ok) throw new Error(`microCMS から実績を読み込めませんでした (${res.status} ${await res.text()})`);
    const data = await res.json();
    items.push(...data.contents);
    if (items.length >= data.totalCount || !data.contents.length) break;
  }
  return items.map(toWork);
}

// セレクトの表示名 → works.json の値
const CATEGORY = { LP: "lp", バナー: "banner" };
const first = (v) => (Array.isArray(v) ? v[0] : v);
// 改行区切りのテキスト → 配列（空の行は無視）
const lines = (s) =>
  String(s || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
// microCMS の日付（UTC）→ 日本時間の YYYY-MM-DD
const jstDate = (iso) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10) : "");
const image = (m) => {
  if (!m?.url) return undefined;
  if (/\.(webp|gif|svg)$/i.test(m.url) || (m.height || 0) > WEBP_MAX || (m.width || 0) > WEBP_MAX) return m.url;
  return `${m.url}?fm=webp&q=85`;
};

export function toWork(c) {
  const images = Object.fromEntries(["mockup", "banner", "pc", "sp"].map((k) => [k, image(c[k])]).filter(([, v]) => v));
  const w = {
    id: c.id,
    title: c.title || "",
    category: CATEGORY[first(c.category)] || "lp",
    type: first(c.type) || "自主制作",
    client: c.client || undefined,
    industry: c.industry || "",
    date: jstDate(c.date || c.publishedAt),
    role: c.role || [],
    period: c.period || "",
    // 「Figma, Photoshop」のようにカンマか改行で区切る（HTML/CSS の / は区切らない）
    tools: String(c.tools || "")
      .split(/[,、，\n]/)
      .map((t) => t.trim())
      .filter(Boolean),
    summary: c.summary || "",
    purpose: c.purpose || "",
    points: lines(c.points),
    // 1行に「ラベル：値」
    specs: lines(c.specs)
      .map((l) => l.match(/^([^:：]*)[:：](.*)$/) || [])
      .map(([, label = "", value = ""]) => ({ label: label.trim(), value: value.trim() }))
      .filter((s) => s.label && s.value),
    result: c.result || "",
    url: c.url || "",
    images,
  };
  if (!w.client) delete w.client;
  if (!w.specs.length) delete w.specs;
  return w;
}

// data/works.json と microCMS をまとめる（同じ ID は microCMS を優先）
export function mergeWorks(local, remote) {
  const ids = new Set(remote.map((w) => w.id));
  return [...remote, ...local.filter((w) => !ids.has(w.id))];
}

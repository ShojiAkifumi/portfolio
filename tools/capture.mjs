// 実績画像の自動生成ツール
//
// LP:     node tools/capture.mjs lp <公開URL> <id>
//         → images/works/<id>/ に mockup.webp（PC＋スマホのフレーム合成）と
//           pc / sp のフルページスクショを書き出します
// バナー: node tools/capture.mjs banner <画像ファイル> <id>
//         → images/works/<id>/banner.webp に変換します
//
// 最後に data/works.json に貼り付ける images の値を表示します。
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [mode, src, id] = process.argv.slice(2);
if (!['lp', 'banner'].includes(mode) || !src || !id) {
  console.log('使い方:\n  node tools/capture.mjs lp <URL> <id>\n  node tools/capture.mjs banner <画像ファイル> <id>');
  process.exit(1);
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(root, 'images', 'works', id);
const rel = (f) => `images/works/${id}/${f}`;
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const tool = await (await browser.newContext()).newPage();

// ブラウザの canvas で縮小・WebP変換する（追加ライブラリ不要）
// WebP の上限(16383px)を超える縦長画像は JPEG にします
async function encode(buf, width, mime = 'image/png') {
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
  const { data, ext } = await tool.evaluate(async ({ dataUrl, width }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const w = Math.min(width, img.naturalWidth);
    const h = Math.round(img.naturalHeight * (w / img.naturalWidth));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const type = h > 16000 ? 'image/jpeg' : 'image/webp';
    const url = c.toDataURL(type, 0.82);
    return { data: url.split(',')[1], ext: type === 'image/jpeg' ? 'jpg' : 'webp' };
  }, { dataUrl, width });
  return { buf: Buffer.from(data, 'base64'), ext };
}

async function save(name, buf, width, mime) {
  const { buf: out, ext } = await encode(buf, width, mime);
  const file = `${name}.${ext}`;
  await writeFile(path.join(outDir, file), out);
  console.log(`  ✓ ${rel(file)} (${Math.round(out.length / 1024)}KB)`);
  return rel(file);
}

async function shoot(url, device) {
  const pc = device === 'pc';
  const ctx = await browser.newContext({
    viewport: pc ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    deviceScaleFactor: pc ? 1 : 2,
    isMobile: !pc,
    hasTouch: !pc,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1500);
  // スクロールでフェードイン系のアニメーションを発火させてから撮影
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 400) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
  const fv = await page.screenshot();
  const full = await page.screenshot({ fullPage: true });
  await ctx.close();
  return { fv, full };
}

async function mockup(pcFv, spFv) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1040 } });
  const b64 = (b) => `data:image/png;base64,${b.toString('base64')}`;
  await page.setContent(`<!doctype html><html><head><style>
    html,body{margin:0;background:transparent}
    .stage{position:relative;width:1600px;height:1040px}
    .laptop{position:absolute;left:70px;top:40px;width:1260px}
    .lid{background:linear-gradient(#1b2433,#0d1320);border-radius:26px 26px 6px 6px;padding:22px 22px 30px;box-shadow:0 40px 80px -30px rgba(20,70,160,.45)}
    .lid img{display:block;width:100%;aspect-ratio:1440/900;object-fit:cover;object-position:top;border-radius:6px}
    .base{height:26px;margin:0 -60px;background:linear-gradient(#e9eef6,#b9c3d3);border-radius:0 0 30px 30px;position:relative;box-shadow:0 30px 50px -24px rgba(20,70,160,.5)}
    .base:before{content:"";position:absolute;left:50%;top:0;width:200px;height:10px;margin-left:-100px;background:#c9d2df;border-radius:0 0 12px 12px}
    .phone{position:absolute;right:70px;bottom:40px;width:300px;background:#0d1320;border-radius:48px;padding:13px;box-shadow:0 40px 70px -24px rgba(20,70,160,.55),inset 0 0 0 2px #2a3446}
    .phone img{display:block;width:100%;aspect-ratio:390/844;object-fit:cover;object-position:top;border-radius:36px}
    .phone:before{content:"";position:absolute;left:50%;top:24px;width:84px;height:24px;margin-left:-42px;background:#0d1320;border-radius:20px;z-index:1}
  </style></head><body><div class="stage">
    <div class="laptop"><div class="lid"><img src="${b64(pcFv)}"></div><div class="base"></div></div>
    <div class="phone"><img src="${b64(spFv)}"></div>
  </div></body></html>`);
  await page.waitForTimeout(300);
  const png = await page.locator('.stage').screenshot({ omitBackground: true });
  await page.close();
  return png;
}

const images = {};
if (mode === 'lp') {
  console.log(`撮影中: ${src}`);
  const pc = await shoot(src, 'pc');
  const sp = await shoot(src, 'sp');
  images.mockup = await save('mockup', await mockup(pc.fv, sp.fv), 1600);
  images.pc = await save('pc', pc.full, 1100);
  images.sp = await save('sp', sp.full, 520);
} else {
  const buf = await readFile(src);
  const mime = /\.jpe?g$/i.test(src) ? 'image/jpeg' : /\.webp$/i.test(src) ? 'image/webp' : 'image/png';
  images.banner = await save('banner', buf, 1080, mime);
}
await browser.close();

console.log('\ndata/works.json の "images" に貼り付けてください:');
console.log(JSON.stringify(images, null, 2));

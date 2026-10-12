// サイトのビルド
//
// npm run build : 公開用のファイルを dist/ に書き出します（Cloudflare Pages はこれを公開します）
//                 - src/*.ts（TypeScript）を1つの JS にまとめて圧縮
//                 - css/style.css を圧縮
//                 - index.html の空白・コメントを取り除いて圧縮
//                 - ファイル名に中身のハッシュを付け、ブラウザに長くキャッシュさせる（_headers）
// npm run dev   : 手元の確認用。src/ を保存するたびに js/app.js を作り直し、http://localhost:8080 で表示します
import * as esbuild from "esbuild";
import { minify } from "html-minifier-terser";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist");
const dev = process.argv.includes("--dev");
const preview = process.argv.includes("--preview");
// 対応ブラウザ（この範囲で動く書き方に変換されます）
const target = ["es2020", "chrome100", "edge100", "firefox100", "safari15"];

const jsOptions = {
  entryPoints: [path.join(root, "src/main.ts")],
  bundle: true,
  format: "iife",
  target,
  charset: "utf8",
  logLevel: "info",
};

if (dev) {
  // 手元の確認用：保存するたびに js/app.js を作り直し、どの URL でも index.html を返すサーバーで表示
  const ctx = await esbuild.context({ ...jsOptions, outfile: path.join(root, "js/app.js"), sourcemap: true });
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: root, fallback: path.join(root, "index.html"), port: 8080 });
  console.log(`\n  http://localhost:${port} で確認できます（終了は Ctrl+C）\n`);
} else if (preview) {
  // ビルドした dist/ をそのまま表示して確認する
  const ctx = await esbuild.context({});
  const { port } = await ctx.serve({ servedir: out, fallback: path.join(out, "index.html"), port: 8081 });
  console.log(`\n  http://localhost:${port} で dist/ を確認できます（終了は Ctrl+C）\n`);
} else {
  await build();
}

async function build() {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  // JS と CSS を圧縮して、ハッシュ付きのファイル名で書き出す
  const js = await esbuild.build({
    ...jsOptions,
    outdir: path.join(out, "js"),
    entryNames: "app-[hash]",
    minify: true,
    legalComments: "none",
    metafile: true,
  });
  const css = await esbuild.build({
    entryPoints: [path.join(root, "css/style.css")],
    outdir: path.join(out, "css"),
    entryNames: "style-[hash]",
    minify: true,
    target,
    charset: "utf8",
    logLevel: "info",
    metafile: true,
  });
  const fileOf = (meta) => path.relative(out, Object.keys(meta.outputs)[0]).split(path.sep).join("/");
  const jsFile = fileOf(js.metafile);
  const cssFile = fileOf(css.metafile);

  // 画像と実績データはそのままコピー
  await cp(path.join(root, "images"), path.join(out, "images"), { recursive: true });
  await cp(path.join(root, "data"), path.join(out, "data"), { recursive: true });

  // index.html：JS・CSS をハッシュ付きの名前に差し替えて圧縮
  let html = await readFile(path.join(root, "index.html"), "utf8");
  const swap = (from, to) => {
    if (!html.includes(from)) throw new Error(`index.html に ${from} が見つかりません`);
    html = html.replace(from, to);
  };
  swap('href="css/style.css"', `href="${cssFile}"`);
  swap('src="js/app.js"', `src="${jsFile}"`);
  html = await minify(html, {
    collapseWhitespace: true,
    conservativeCollapse: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
    sortAttributes: true,
    sortClassName: false,
  });
  await writeFile(path.join(out, "index.html"), html);

  // Cloudflare Pages に渡すキャッシュの設定
  //  - ハッシュ付きの JS・CSS は中身が変わると名前も変わるので、1年キャッシュ
  //  - 画像は1週間、実績データと HTML は毎回更新を確認
  await writeFile(
    path.join(out, "_headers"),
    `/js/*
  Cache-Control: public, max-age=31536000, immutable
/css/*
  Cache-Control: public, max-age=31536000, immutable
/images/*
  Cache-Control: public, max-age=604800
/data/*
  Cache-Control: public, max-age=0, must-revalidate
`,
  );

  const size = async (f) => ((await readFile(path.join(out, f))).length / 1024).toFixed(1) + " KB";
  console.log(`\n  dist/ に書き出しました`);
  console.log(`    index.html  ${await size("index.html")}`);
  console.log(`    ${jsFile}  ${await size(jsFile)}`);
  console.log(`    ${cssFile}  ${await size(cssFile)}\n`);
}

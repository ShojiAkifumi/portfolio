# ショウジアキフミ ポートフォリオサイト

バナー・LP制作の実績を掲載し、お問い合わせにつなげるポートフォリオサイトです。
HTML / SCSS / TypeScript で作ったSPA（1つの `index.html` の中で画面を切り替える形）です。Cloudflare（Workers）で公開します。
公開用のファイルは `npm run build` で圧縮して `dist/` に書き出します（SCSS の変換、JS・CSS・HTML の圧縮、ファイル名にハッシュを付けた長期キャッシュ）。

- URL は `/`（トップ）、`/works`（実績一覧）、`/works/実績ID`（実績詳細）です。以前の `works.html`・`work.html?id=` で開いた場合も、新しいURLに切り替わります。
- どのURLで開いても `index.html` を返す設定が必要です（`wrangler.jsonc` の `not_found_handling` で設定済みです）。手元では `npm run dev` で同じ動きになります。
- サイトのルート（`/`）に置く前提です。`https://〇〇.github.io/portfolio/` のようなサブフォルダでは画像などが読み込めません。

## ファイル構成

| パス | 内容 |
|---|---|
| `index.html` | サイトの土台とトップの中身（ファーストビューの実績スライダー・強み・料金・流れ・プロフィール・お問い合わせ） |
| `src/views.ts` | 実績一覧・実績詳細・404 の画面の中身 |
| `src/main.ts` | 画面の切り替え（URLと画面の対応、インクのにじみで切り替え）と共通の演出。ここからサイト全体が動き出します |
| `src/site.ts` | どの画面でも使う共通の部品（ふわっと登場など） |
| `src/works.ts` | 実績一覧（LP / バナーで絞り込み、「もっと見る」で追加表示）・実績詳細・スライダー |
| `src/contact.ts` | お問い合わせフォームの入力チェックと送信 |
| `data/works.json` | **実績データ。ここに追記すると全ページに反映されます** |
| `images/works/実績ID/` | 実績ごとの画像 |
| `src/config.ts` | フォームの送信先、SNSの表示、表示件数の設定 |
| `src/ink.ts` | インクのにじみ・最初の雫・画面切り替えの演出（WebGL） |
| `scss/style.scss` | デザインの入口。下のファイルを順に読み込みます |
| `scss/_variables.scss` | 配色とブレークポイント（画面幅の区切り） |
| `scss/_mixins.scss` | メディアクエリの書き方（`@include down(sp)` で640px以下など） |
| `scss/_base.scss` ほか | セクションごとのデザイン（`_hero`・`_works`・`_contact` など） |
| `tools/build.mjs` | ビルドと、手元確認用のサーバー |
| `tools/capture.mjs` | 実績画像（PC・スマホのフレーム合成）を自動で作るツール |
| `js/app.js`・`css/style.css`・`dist/` | ビルドで自動的に作られるファイル（直接編集しないでください。Git にも入りません） |

## 実績を追加する

### 1. 画像を用意する

初回だけ、このフォルダで `npm install` を実行してください（Node.js が必要です）。

**LP の場合**（公開URLから自動でスクショを撮り、PC・スマホのフレームに合成します）

```bash
npm run capture -- lp https://shojiakifumi.github.io/lp-xxxx/ lp-xxxx
```

`images/works/lp-xxxx/` に `mockup.webp`（一覧用の合成画像）、`pc`・`sp`（ページ全体）が作られます。

**バナーの場合**（画像をWebPに変換して配置します）

```bash
npm run capture -- banner ~/Desktop/banner.png banner-xxxx
```

最後に表示される `"images": {...}` を、次の手順でそのまま使います。

### 2. `data/works.json` に1件追加する

配列の先頭に追加すると管理しやすいです（表示は `date` の新しい順に並びます）。

```json
{
  "id": "lp-xxxx",
  "title": "〇〇LP",
  "category": "lp",
  "type": "自主制作",
  "industry": "美容",
  "date": "2026-10-11",
  "role": ["デザイン", "コーディング"],
  "period": "2週間",
  "tools": ["Figma", "Photoshop", "HTML/CSS"],
  "summary": "一覧のカードに出る一文の説明",
  "purpose": "目的・課題",
  "points": ["工夫した点1", "工夫した点2"],
  "result": "",
  "url": "https://...",
  "images": { "mockup": "...", "pc": "...", "sp": "..." }
}
```

| 項目 | 説明 |
|---|---|
| `id` | URLに使う英数字。画像フォルダ名と同じにします |
| `category` | `lp` または `banner` |
| `type` | `自主制作` / `実案件` など。`実案件` はピンクのラベルで目立ちます |
| `client` | 実名を出してよいクライアント名（任意） |
| `specs` | バナーのデザイン仕様（任意）。`[{ "label": "配色", "value": "..." }]` |
| `result` | 成果（CVR改善など）。空なら表示されません |
| `url` | 公開URL。空なら「サイトを見る」ボタンが出ません |

GitHub のサイト上で `data/works.json` を開き、鉛筆ボタンから直接編集してもOKです。

### 3. 公開する

`git add . && git commit -m "実績を追加" && git push` で、数分後にサイトに反映されます。

## 設定（`src/config.ts`）

- `formEndpoint` … お問い合わせフォームの送信先。[FormSubmit](https://formsubmit.co/) を使い、`https://formsubmit.co/ajax/ackeytoday@gmail.com` に送ります。初回の送信時に届く確認メールの「Activate Form」を押すと有効になります。空にすると送信されません
- `showSns` / `sns` … フッターのSNSアイコン。`showSns: true` にして `url` を入れると表示されます

## 手元で確認する

初回だけ `npm install` を実行してから、次のコマンドで確認用のサーバーを起動します。

```bash
npm run dev       # → http://localhost:8080（src/ や scss/ を保存すると、再読み込みで反映されます）
```

公開されるものと同じ圧縮済みのファイルで確認したい時は、次の2つを実行します。

```bash
npm run build     # 型のチェック → dist/ に圧縮したファイルを書き出し
npm run preview   # → http://localhost:8081 で dist/ を表示
```

`npm run typecheck` で TypeScript の型のチェックだけを行えます。

## 公開する（Cloudflare Workers）

1. Cloudflare のダッシュボードで「Workers & Pages」→「作成」→ GitHub の `ShojiAkifumi/portfolio` を選びます。
2. ビルドの設定は次のとおりにします。
   - ビルドコマンド: `npm run build`
   - デプロイコマンド: `npx wrangler deploy`
   - ルートディレクトリ（パス）: 空欄（`/`）。`dist` にはしないでください（`dist` はビルドの途中で作られるため、最初は存在しません）
3. 公開するフォルダ（`dist`）と、どのURLでも `index.html` を返す設定は `wrangler.jsonc` に書いてあります。`wrangler.jsonc` の `name` は、ダッシュボードの Worker 名と同じにしてください。
4. 以後は GitHub の main に push するたびに自動でビルドされ、更新されます。gzip・Brotli での圧縮配信は Cloudflare が自動で行います。

## 独自ドメイン

ドメイン取得後、Cloudflare の Worker の「設定」→「ドメインとルート」から追加します。

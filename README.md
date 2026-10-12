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
| `src/config.ts` | フォームの送信先、SNSの表示、表示件数の設定 |
| `src/ink.ts` | インクのにじみ・最初の雫・画面切り替えの演出（WebGL） |
| `scss/style.scss` | デザインの入口。下のファイルを順に読み込みます |
| `scss/_variables.scss` | 配色とブレークポイント（画面幅の区切り） |
| `scss/_mixins.scss` | メディアクエリの書き方（`@include down(sp)` で640px以下など） |
| `scss/_base.scss` ほか | セクションごとのデザイン（`_hero`・`_works`・`_contact` など） |
| `tools/build.mjs` | ビルドと、手元確認用のサーバー |
| `tools/microcms.mjs` | microCMS から実績を読み込む（ビルドの時だけ） |
| `microcms/works-schema.json` | microCMS の API スキーマ（インポート用） |
| `tools/capture.mjs` | 実績画像（PC・スマホのフレーム合成）を自動で作るツール |
| `js/app.js`・`css/style.css`・`dist/` | ビルドで自動的に作られるファイル（直接編集しないでください。Git にも入りません） |

## 実績を追加する

実績は microCMS で管理しています（設定は下の「microCMS で実績を管理する」）。

1. **画像を用意する**（初回だけ `npm install` を実行してください。Node.js が必要です）
   - LP：`npm run capture -- lp https://shojiakifumi.github.io/lp-xxxx/ lp-xxxx` で、公開URLからスクショを撮って `images/works/lp-xxxx/` に `mockup`（一覧用の合成画像）と `pc`・`sp`（ページ全体）を作ります
   - バナー：`npm run capture -- banner ~/Desktop/banner.png banner-xxxx` で WebP に変換します
2. **microCMS に登録する**：実績の API で「追加」を押し、コンテンツID（URL になります）を `lp-xxxx` のように変えてから、各項目と画像を入れます
3. **公開する**：「公開」を押すと、Cloudflare のビルドが自動で始まり、1〜2分でサイトに反映されます。下書きの実績はサイトに出ません

`images/works/` は画像を作るための作業フォルダです（Git には入りません）。

## microCMS で実績を管理する

`npm run build` の時に microCMS から実績を読み込んで公開します。
ブラウザから microCMS へは取りに行かないので、表示の速さは変わらず、API キーも外に出ません。


### 1. microCMS に API を作る（最初の1回）

1. microCMS で API を新しく作ります。API名は「実績」、エンドポイントは **`works`**、型は **リスト形式** にします。
2. 「APIスキーマを定義」の画面で「ファイルをインポートする場合はこちら」を押し、`microcms/works-schema.json` を選びます。
3. 「APIキー」で GET だけできるキーを用意します（最初からある「デフォルト」のキーで大丈夫です）。

| 項目 | 入れ方 |
|---|---|
| コンテンツID | 実績の URL（`/works/ここ`）になります。登録画面の右側で `lp-xxxx` のように変えてください |
| カテゴリ・種類 | LP / バナー、自主制作 / 実案件 から選ぶ |
| 表示順 | 小さい数字ほど先に表示（1, 2, 3…）。空欄の実績は、その後ろに制作日の新しい順で並びます |
| 制作日 | 表示順が空欄の実績は、この日付の新しい順に並びます |
| 使用ツール | カンマ区切り（`Figma, Photoshop, HTML/CSS`） |
| 工夫した点 | 1行に1つ |
| デザイン仕様（バナー） | 1行に「ラベル：値」（`サイズ：1080 × 1080px`） |
| 画像 | LP は「一覧用の画像」「PC表示の全体」「スマホ表示の全体」、バナーは「バナー画像」。`npm run capture` で作った画像をアップロードします（WebP に変換して配信されます） |

### 2. Cloudflare に API キーを設定する（最初の1回）

Cloudflare の Workers の画面で、このサイト（portfolio）の **Settings → Builds → Variables and secrets** に次の2つを追加します。

| 名前 | 値 |
|---|---|
| `MICROCMS_SERVICE_DOMAIN` | microCMS の URL `https://xxxx.microcms.io` の `xxxx` |
| `MICROCMS_API_KEY` | microCMS の API キー（Secret にしてください） |

設定がない時や、microCMS から読み込めなかった時はビルドが止まり、前の状態のまま公開が続きます（実績が空のサイトは公開されません）。

### 3. microCMS で公開したら自動で反映する（最初の1回）

1. Cloudflare の **Settings → Builds → Deploy Hooks** で、ブランチ `main` のフックを作り、URL をコピーします。
2. microCMS の API 設定 →「Webhook」→「カスタム通知」で、その URL を登録します（通知のタイミングは「コンテンツの公開」「公開終了」など）。

これで microCMS で公開ボタンを押すと、1〜2分ほどでサイトに反映されます。

### 手元で確認する

このフォルダに `.env` を作って下の2行を書いてください。`npm run dev`・`npm run build` で microCMS の実績を読み込みます（`.env` は Git に入りません）。

```
MICROCMS_SERVICE_DOMAIN=xxxx
MICROCMS_API_KEY=xxxxxxxx
```

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

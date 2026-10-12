# ショウジアキフミ ポートフォリオサイト

バナー・LP制作の実績を掲載し、お問い合わせにつなげるポートフォリオサイトです。
HTML / CSS / Vanilla JS のみで作ったSPA（1つの `index.html` の中で画面を切り替える形）です。Cloudflare Pages で公開します。

- URL は `/`（トップ）、`/works`（実績一覧）、`/works/実績ID`（実績詳細）です。以前の `works.html`・`work.html?id=` で開いた場合も、新しいURLに切り替わります。
- どのURLで開いても `index.html` を返す設定が必要です。Cloudflare Pages はルートに `404.html` がなければ自動でそうなります（`404.html` は置かないでください）。手元では `npm run serve`（`serve.json` の設定）で同じ動きになります。
- サイトのルート（`/`）に置く前提です。`https://〇〇.github.io/portfolio/` のようなサブフォルダでは画像などが読み込めません。

## ファイル構成

| パス | 内容 |
|---|---|
| `index.html` | サイトの土台とトップの中身（ファーストビューの実績スライダー・強み・料金・流れ・プロフィール・お問い合わせ） |
| `js/views.js` | 実績一覧・実績詳細・404 の画面の中身 |
| `js/main.js` | 画面の切り替え（URLと画面の対応、インクのにじみで切り替え）と共通の演出 |
| `js/works.js` | 実績一覧（LP / バナーで絞り込み、「もっと見る」で追加表示）・実績詳細・スライダー |
| `data/works.json` | **実績データ。ここに追記すると全ページに反映されます** |
| `images/works/実績ID/` | 実績ごとの画像 |
| `js/config.js` | フォームの送信先、SNSの表示、表示件数の設定 |
| `js/ink.js` | インクのにじみ・最初の雫・画面切り替えの演出（WebGL） |
| `tools/capture.mjs` | 実績画像（PC・スマホのフレーム合成）を自動で作るツール |

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

## 設定（`js/config.js`）

- `formEndpoint` … お問い合わせフォームの送信先。[FormSubmit](https://formsubmit.co/) を使い、`https://formsubmit.co/ajax/ackeytoday@gmail.com` に送ります。初回の送信時に届く確認メールの「Activate Form」を押すと有効になります。空にすると送信されません
- `showSns` / `sns` … フッターのSNSアイコン。`showSns: true` にして `url` を入れると表示されます

## 手元で確認する

`works.json` を読み込むため、ファイルを直接開くのではなくローカルサーバーで確認してください。

```bash
npm run serve   # → http://localhost:8080
```

## 公開する（Cloudflare Pages）

1. Cloudflare のダッシュボードで「Workers & Pages」→「作成」→「Pages」→「Git に接続」を選び、GitHub の `ShojiAkifumi/portfolio` を選びます。
2. ビルドの設定は、フレームワーク「なし」、ビルドコマンドは空欄、出力ディレクトリは `/` のままにします。
3. 保存すると `https://〇〇.pages.dev` で公開されます。以後は GitHub の main に push するたびに自動で更新されます。

## 独自ドメイン

ドメイン取得後、Cloudflare Pages のプロジェクトの「カスタムドメイン」から追加します。

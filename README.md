# ショウジアキフミ ポートフォリオサイト

バナー・LP制作の実績を掲載し、お問い合わせにつなげるポートフォリオサイトです。
HTML / CSS / Vanilla JS のみで作っていて、GitHub Pages でそのまま公開できます。

## ファイル構成

| パス | 内容 |
|---|---|
| `index.html` | トップページ（実績・強み・料金・流れ・プロフィール・お問い合わせ） |
| `works.html` | 実績一覧（LP / バナーで絞り込み、「もっと見る」で追加表示） |
| `work.html?id=実績ID` | 実績の詳細ページ（works.json から自動で作られます） |
| `data/works.json` | **実績データ。ここに追記すると全ページに反映されます** |
| `images/works/実績ID/` | 実績ごとの画像 |
| `js/config.js` | フォームの送信先、SNSの表示、表示件数の設定 |
| `js/ink.js` | インクのにじみ・画面切り替えの演出（WebGL） |
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

- `formEndpoint` … お問い合わせフォームの送信先。[Formspree](https://formspree.io/) で無料のフォームを作り、表示されるURL（`https://formspree.io/f/xxxx`）を入れます。空のままだと送信されません
- `showSns` / `sns` … フッターのSNSアイコン。`showSns: true` にして `url` を入れると表示されます

## 手元で確認する

`works.json` を読み込むため、ファイルを直接開くのではなくローカルサーバーで確認してください。

```bash
npm run serve   # → http://localhost:8080
```

## 独自ドメイン

ドメイン取得後、GitHub の Settings → Pages → Custom domain にドメインを入力し、
DNS に GitHub Pages 用のレコードを設定します。

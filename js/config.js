// サイト全体の設定
window.SITE_CONFIG = {
  // お問い合わせフォームの送信先（Formspree のフォームURL。例: "https://formspree.io/f/xxxxxxx"）
  // 空のままだと送信ボタンを押しても送信されず、準備中の案内が表示されます
  formEndpoint: "",

  // フッターのSNSアイコン。公開する時は showSns を true にして url を入れてください
  showSns: false,
  sns: [
    { name: "X", url: "" },
    { name: "Instagram", url: "" },
    { name: "note", url: "" }
  ],

  // ファーストビューの半円スライダーに表示する実績の数（新しい順）
  heroWorksCount: 8,
  // スライダーが流れる速さ（1秒あたりに進む実績の枚数。0.1 なら10秒で1枚分）
  heroSpeed: 0.12,
  // 実績一覧ページで一度に表示する数
  worksPerPage: 12
};

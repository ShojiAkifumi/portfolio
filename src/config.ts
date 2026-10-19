// サイト全体の設定（変更したら npm run build で反映されます）
export interface SiteConfig {
  formEndpoint: string;
  showSns: boolean;
  sns: { name: string; url: string }[];
  heroWorksCount: number;
  heroInterval: number;
  worksPerPage: number;
}

export const SITE_CONFIG: SiteConfig = {
  // お問い合わせフォームの送信先（FormSubmit 経由で ackeytoday@gmail.com に届きます）
  // 空にすると送信ボタンを押しても送信されず、準備中の案内が表示されます
  formEndpoint: "https://formsubmit.co/ajax/ackeytoday@gmail.com",

  // フッターのSNSアイコン。公開する時は showSns を true にして url を入れてください
  showSns: true,
  sns: [
    { name: "X", url: "https://x.com/shojiwebdesign" },
    { name: "Instagram", url: "" },
    { name: "note", url: "" },
  ],

  // ファーストビューの半円スライダーに表示する実績の数（新しい順）
  heroWorksCount: 8,
  // スライダーが1枚分動く間隔（ミリ秒）
  heroInterval: 3600,
  // 実績一覧ページで一度に表示する数（それより多い時だけ「もっと見る」ボタンが出ます）
  worksPerPage: 6,
};

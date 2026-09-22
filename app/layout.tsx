import type { Metadata } from 'next';
import './globals.css';
import './studio.css';
import './motion.css';
export const metadata: Metadata = {
  title: 'Web Experience Lab — 触れて伝わるWebサイト制作',
  description:
    '企業サイト、美容室、レストラン、3D製品ページまで。実際に操作できる10の制作サンプルと、料金・制作の流れ・ご相談窓口。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Zen+Old+Mincho:wght@500;700&display=swap"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}

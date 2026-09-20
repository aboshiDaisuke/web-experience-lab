import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'WEB EXPERIENCE LAB — Beyond the Screen',
  description:
    'スクリーンの、その先へ。3D・モーション・インタラクションがつくる体験型WEB制作ポートフォリオ。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

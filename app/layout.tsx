import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'WEB EXPERIENCE LAB — 10のWEB制作を体験する',
  description:
    '企業・美容・飲食・3Dなど10作品を、一覧から選んで操作できるWEB制作ショールーム。',
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

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'BRO TV | غرفة المشاهدة المشتركة',
    template: '%s | BRO TV',
  },
  description: 'BRO TV — شاهد الأفلام والمسلسلات مع أصدقائك في غرفة مشتركة بمزامنة فورية ودردشة حية.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'BRO TV',
    description: 'غرفة مشاهدة مشتركة — شاهد مع أصدقائك لحظة بلحظة.',
    images: ['/logo.png'],
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#3C1A4F',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

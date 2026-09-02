import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({
  variable: '--font-ui',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://superantichrist.github.io/odyssey-reader/'),
  title: '오디세이아 — 원문과 직역',
  description:
    '호메로스의 『오디세이아』 고대 그리스어 원문과 직접 옮긴 한국어 직역을 24권의 흐름대로 읽습니다.',
  openGraph: {
    title: '오디세이아 — 원문과 직역',
    description:
      '24권·12,107행의 고대 그리스어 원문을 출전과 함께 천천히 읽는 병렬 독서판.',
    type: 'website',
    locale: 'ko_KR',
    images: [
      {
        url: 'https://superantichrist.github.io/odyssey-reader/og.png',
        width: 1200,
        height: 630,
        alt: '검푸른 밤바다를 항해하는 배와 오디세이아 원문과 직역이라는 제목',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '오디세이아 — 원문과 직역',
    description: '호메로스의 원문과 직접 옮긴 한국어 직역을 나란히 읽습니다.',
    images: ['https://superantichrist.github.io/odyssey-reader/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3efe5' },
    { media: '(prefers-color-scheme: dark)', color: '#11191b' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={geist.variable}>{children}</body>
    </html>
  );
}

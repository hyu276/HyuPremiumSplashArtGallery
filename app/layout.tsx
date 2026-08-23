import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://hyupremium.vercel.app'),
  title: {
    default: 'HYU PREMIUM — Gaming Splash Art Archive',
    template: '%s | HYU PREMIUM'
  },
  description: 'A curated searchable archive of gaming splash art organized by character/category, skin rank and image credit.',
  robots: { index: true, follow: true },
  verification: { google: 'KMBRePIo30hKHau-mQc3tM_H0bELdtJRxXfo8I1PDGE' },
  openGraph: { siteName: 'HYU PREMIUM', type: 'website' },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/assets/brand/hyu-industries-logo.png', apple: '/assets/brand/hyu-industries-logo.png' }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body>{children}</body></html>;
}

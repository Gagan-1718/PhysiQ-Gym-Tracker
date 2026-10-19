import type { Metadata, Viewport } from 'next';
import { Inter, Nunito } from 'next/font/google';
import Providers from './providers';
import './globals.css';

// Inter for interface text; Nunito's rounded numerals for metrics (Apple Fitness feel)
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const nunito = Nunito({ subsets: ['latin'], weight: ['700', '800', '900'], variable: '--font-nunito', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'PhysiQ', template: '%s · PhysiQ' },
  description: 'Adaptive, database-driven gym tracker: it tells you what to train next and how much to lift.',
  applicationName: 'PhysiQ',
  appleWebApp: { capable: true, title: 'PhysiQ', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${nunito.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

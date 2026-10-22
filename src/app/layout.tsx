import type { Metadata, Viewport } from 'next';
import { Exo_2, Inter } from 'next/font/google';
import Providers from './providers';
import './globals.css';

// Inter for interface text. Exo 2 (squared, athletic, close to the logo's wordmark) for headings and big numbers,
// with one slanted weight for the "PhysiQ" wordmark.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const exo = Exo_2({ subsets: ['latin'], weight: ['700', '800', '900'], variable: '--font-display', display: 'swap' });
const exoSlanted = Exo_2({ subsets: ['latin'], weight: '900', style: 'italic', variable: '--font-display-italic', display: 'swap' });

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
    <html lang="en" className={`${inter.variable} ${exo.variable} ${exoSlanted.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PhysiQ — Adaptive DBMS Gym Tracker',
  description: 'A database-driven fitness management system where historical data derives subsequent training decisions.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}

'use client';

import { SessionProvider } from 'next-auth/react';
import { SWRConfig } from 'swr';
import { fetcher } from '@/lib/client';
import { ToastProvider } from '@/components/ui/Toast';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <SWRConfig value={{ fetcher, revalidateOnFocus: true, keepPreviousData: true, errorRetryCount: 2 }}>
        <ToastProvider>{children}</ToastProvider>
      </SWRConfig>
    </SessionProvider>
  );
}

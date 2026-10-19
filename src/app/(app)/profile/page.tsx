'use client';

import { signOut, useSession } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ProfilePage() {
  const { data: session } = useSession();
  return (
    <>
      <header className="pb-5 pt-4">
        <h1 className="text-large-title">Profile</h1>
      </header>
      <Card className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-train to-train-deep text-xl font-bold">
          {session?.user?.name?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-headline">{session?.user?.name}</p>
          <p className="truncate text-[15px] text-fg-2">{session?.user?.email}</p>
        </div>
      </Card>
      <Button variant="secondary" size="lg" block className="mt-6" onClick={() => signOut({ callbackUrl: '/login' })}>
        <LogOut className="h-5 w-5" /> Sign out
      </Button>
    </>
  );
}

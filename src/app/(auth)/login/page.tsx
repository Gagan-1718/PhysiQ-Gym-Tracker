'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Rings } from '@/components/ui/Rings';

const HERO_RINGS = [
  { progress: 0.78, color: '#FA2D55', deep: '#B3123A', label: 'Train' },
  { progress: 0.9, color: '#B6F23B', deep: '#6FA312', label: 'Protein' },
  { progress: 0.62, color: '#2DD4F5', deep: '#0E7FA0', label: 'Water' },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // A token that outlived its account is cleared silently
  useEffect(() => {
    if (params.get('stale')) signOut({ redirect: false });
  }, [params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    if (!res || res.error) {
      setLoading(false);
      setError(res?.error && res.error !== 'CredentialsSignin' ? res.error : 'Email or password is incorrect.');
      return;
    }
    const target = params.get('callbackUrl');
    router.replace(target && target.startsWith('/') && !target.startsWith('//') ? target : '/');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Field
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && (
        <p role="alert" className="px-1 text-[15px] text-train">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" block loading={loading} disabled={!email || !password}>
        Sign in
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="animate-pop-in">
      <div className="mb-8 flex justify-center">
        <Rings rings={HERO_RINGS} size={132} stroke={14} gap={3} />
      </div>
      <h1 className="text-center text-large-title">Train smarter.</h1>
      <p className="mb-8 mt-2 text-center text-[17px] text-fg-2">Your history decides what to train next and how much to lift.</p>

      <Suspense>
        <LoginForm />
      </Suspense>

      <p className="mt-6 text-center text-[15px] text-fg-2">
        New here?{' '}
        <Link href="/register" className="font-semibold text-accent hover:brightness-110">
          Create an account
        </Link>
      </p>

      {process.env.NODE_ENV !== 'production' && (
        <div className="mt-8 rounded-2xl border border-line bg-surface-1 px-4 py-3 text-footnote text-fg-3">
          <span className="font-semibold text-fg-2">Demo accounts</span> (password <code className="text-fg-2">physiq123</code>):
          <br />
          alex@physiq.test · admin@physiq.test
        </div>
      )}
    </div>
  );
}

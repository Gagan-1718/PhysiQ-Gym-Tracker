'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { HttpError, send } from '@/lib/client';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) return setError('Password needs at least 8 characters.');
    setLoading(true);
    try {
      await send('/api/auth/register', 'POST', form);
      const res = await signIn('credentials', { email: form.email, password: form.password, redirect: false });
      if (res?.error) throw new Error('Account created, but signing in failed. Please sign in.');
      router.replace('/onboarding');
      router.refresh();
    } catch (err) {
      setError(err instanceof HttpError || err instanceof Error ? err.message : 'Something went wrong.');
      setLoading(false);
    }
  }

  return (
    <div className="animate-pop-in">
      <h1 className="text-large-title">Create your account</h1>
      <p className="mb-8 mt-2 text-[17px] text-fg-2">Takes 30 seconds. Then we set up your split.</p>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Name" autoComplete="name" value={form.name} onChange={set('name')} required />
        <Field label="Email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} required />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          value={form.password}
          onChange={set('password')}
          required
        />
        {error && (
          <p role="alert" className="px-1 text-[15px] text-train">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" block loading={loading} disabled={!form.name || !form.email || !form.password}>
          Continue
        </Button>
      </form>

      <p className="mt-6 text-center text-[15px] text-fg-2">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-accent hover:brightness-110">
          Sign in
        </Link>
      </p>
    </div>
  );
}

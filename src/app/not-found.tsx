import Link from 'next/link';
import { LogoMark } from '@/components/shell/Logo';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <LogoMark size={56} />
      <p className="mt-6 font-round text-6xl font-extrabold text-fg-3">404</p>
      <h1 className="mt-2 text-title">That page doesn’t exist</h1>
      <p className="mt-2 text-[15px] text-fg-2">The link may be old, or the workout was deleted.</p>
      <Link href="/" className="press mt-8 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-accent text-[17px] font-semibold text-black">
        Back to Today
      </Link>
    </main>
  );
}

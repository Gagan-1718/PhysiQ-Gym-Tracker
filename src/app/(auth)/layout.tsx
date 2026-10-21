import { LogoMark, Wordmark } from '@/components/shell/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Soft ring-colour glow behind the form */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-train/20 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -top-24 left-[15%] h-72 w-72 rounded-full bg-water/10 blur-[110px]" />
      <header className="relative flex items-center gap-2.5 px-6 pt-safe sm:px-10 sm:pt-8">
        <LogoMark size={28} />
        <Wordmark />
      </header>
      <main className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">{children}</main>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Ember-red glow behind the logo and form */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-train/20 blur-[120px]" />
      <main className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10 pt-safe">{children}</main>
    </div>
  );
}

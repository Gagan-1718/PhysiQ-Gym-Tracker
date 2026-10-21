'use client';

// Replaces the root layout when the layout itself fails, so it must render <html> and <body>.
// Styles are inline on purpose: the stylesheet may be the thing that failed to load.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000', color: '#F5F5F7', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>PhysiQ hit a problem</h1>
          <p style={{ color: '#A1A1A6', maxWidth: 320 }}>Your data is safe. Reload to continue.</p>
          <button
            onClick={reset}
            style={{ marginTop: 16, height: 52, padding: '0 28px', border: 0, borderRadius: 16, background: '#B6F23B', color: '#000', fontSize: 17, fontWeight: 600 }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}

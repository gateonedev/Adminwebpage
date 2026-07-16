'use client';

/**
 * Root error boundary (replaces the whole document when an uncaught error
 * escapes rendering, including hydration failures and JS chunk-load errors).
 *
 * Symptom this addresses: on the FIRST visit the app occasionally crashes with
 * "a client-side exception has occurred" and a manual refresh fixes it. The two
 * usual causes are (a) a JS chunk that 404s because of Vercel deployment skew
 * (the browser holds an older HTML/RSC than the chunk hashes it asks for), and
 * (b) a transient hydration mismatch. Both are cured by a single reload — so we
 * do that reload automatically, once, instead of showing the user a dead screen.
 *
 * The reload is guarded (once per 10s via sessionStorage) so a *persistent*
 * error never loops; after the first attempt the user sees a recoverable UI.
 *
 * Root-cause fix lives in Vercel: enable Project → Settings → Advanced →
 * "Skew Protection" so chunks from the deployment that served the page stay
 * available for the whole session. This boundary is the safety net.
 */

import { useEffect } from 'react';

const RELOAD_KEY = 'go_autoreload_ts';

function isRecoverable(error: { name?: string; message?: string }): boolean {
  const sig = `${error?.name ?? ''} ${error?.message ?? ''}`;
  return (
    /ChunkLoadError/i.test(sig) ||
    /Loading chunk [\w-]+ failed/i.test(sig) ||
    /Loading CSS chunk/i.test(sig) ||
    /dynamically imported module/i.test(sig) ||
    /Importing a module script failed/i.test(sig) ||
    /Failed to fetch/i.test(sig) ||
    /Minified React error #(418|421|422|423|425)/i.test(sig) ||
    /hydrat/i.test(sig)
  );
}

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isRecoverable(error)) return;

    // Avoid reload loops: only auto-reload once per 10s window.
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
    } catch {
      /* sessionStorage unavailable (private mode) — skip the guard */
    }
    const now = Date.now();
    if (now - last < 10_000) return;
    try {
      sessionStorage.setItem(RELOAD_KEY, String(now));
    } catch {
      /* ignore */
    }
    window.location.reload();
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0f15',
          color: '#e2e8f0',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            textAlign: 'center',
            background: '#131820',
            border: '1px solid #1e293b',
            borderRadius: 16,
            padding: '32px 28px',
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>
            Bir şeyler ters gitti
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              color: '#94a3b8',
              margin: '0 0 24px',
            }}
          >
            Sayfa yüklenirken beklenmeyen bir hata oluştu. Yeniden denemek için
            aşağıdaki düğmeye dokunun.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              appearance: 'none',
              border: 'none',
              cursor: 'pointer',
              background: '#3b82f6',
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 500,
              borderRadius: 10,
              padding: '11px 20px',
            }}
          >
            Yenile
          </button>
        </div>
      </body>
    </html>
  );
}

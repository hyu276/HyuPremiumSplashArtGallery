'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const MIN_CHECK_INTERVAL_MS = 30_000;
const DELAYED_CHECK_MS = 45_000;

export default function CatalogueFreshnessGuard({ revision }: { revision: string }) {
  const router = useRouter();
  const lastCheckAt = useRef(0);
  const refreshing = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const now = Date.now();
      if (refreshing.current || now - lastCheckAt.current < MIN_CHECK_INTERVAL_MS) return;
      lastCheckAt.current = now;

      try {
        const response = await fetch('/api/catalogue-revision', {
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) return;
        const payload = await response.json() as { revision?: string };
        if (!cancelled && payload.revision && payload.revision !== revision) {
          refreshing.current = true;
          router.refresh();
        }
      } catch {
        // Freshness checks are best-effort; the current gallery remains usable offline/on errors.
      }
    };

    const onFocus = () => { void check(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void check();
    };

    void check();
    const delayedCheck = window.setTimeout(() => { void check(); }, DELAYED_CHECK_MS);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(delayedCheck);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [revision, router]);

  return null;
}

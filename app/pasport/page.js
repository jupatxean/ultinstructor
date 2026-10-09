'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { analyze } from '@/lib/engine';
import { PassportCard, decodeInput } from '@/components/Passport';

function Inner() {
  const params = useSearchParams();
  const d = params.get('d');
  const r = useMemo(() => {
    try { return d ? analyze(decodeInput(d)) : null; } catch { return null; }
  }, [d]);
  const url = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)', textDecoration: 'none' }}>
          <img src="/icon.svg" alt="" width="32" height="32" />
          <strong style={{ fontFamily: 'var(--cond)', fontSize: 20, letterSpacing: '0.04em' }}>ULT<span style={{ color: 'var(--accent)' }}>INSTRUCTOR</span></strong>
        </a>
        <button type="button" className="btn-outline noprint" onClick={() => window.print()}>Çap et / PDF</button>
      </div>
      {r ? <PassportCard r={r} url={url} /> : <div className="err">Pasport tapılmadı və ya link zədələnib.</div>}
    </div>
  );
}

export default function PassportPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

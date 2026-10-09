'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { fmtAZN, fmtNum } from '@/lib/engine';

const GC = { A: '#067647', B: '#3b7d23', C: '#b54708', D: '#c2410c', E: '#b42318' };
const LC = { ok: 'var(--ok)', warn: 'var(--warn)', fail: 'var(--fail)' };
const LS = { ok: '✓', warn: '!', fail: '✕' };

const KEYS = ['projectName', 'district', 'plotWidth', 'plotDepth', 'soil', 'groundwater', 'bearing', 'slope', 'func', 'floors', 'basements', 'quality', 'style', 'features', 'budget', 'materialIdx'];

export function encodeInput(input) {
  const o = {};
  KEYS.forEach((k) => { if (input[k] !== undefined && input[k] !== '') o[k] = input[k]; });
  const json = JSON.stringify(o);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeInput(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

export function ScoreDial({ score, size = 120 }) {
  const r = 46; const c = 2 * Math.PI * r;
  const col = GC[score.grade];
  return (
    <svg className="dial" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`UltScore ${score.total} / 100, dərəcə ${score.grade}`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#e3e5df" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={col} strokeWidth="10" strokeDasharray={`${(score.total / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 60 60)" />
      <text x="60" y="58" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontWeight="600" fontSize="30" fill="#15181B">{score.total}</text>
      <text x="60" y="80" textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight="700" fontSize="14" fill={col}>{score.grade} dərəcə</text>
    </svg>
  );
}

export function PassportCard({ r, url }) {
  const [qr, setQr] = useState('');
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#15181B', light: '#FFFFFF' } }).then(setQr).catch(() => setQr(''));
  }, [url]);
  const s = r.score;
  const id = `UI-${(Math.abs([...JSON.stringify(r.input)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7)) % 1e6).toString().padStart(6, '0')}`;

  return (
    <article className="passport">
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', borderBottom: '2px solid var(--ink)', paddingBottom: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="eyebrow">UltInstructor · Bina pasportu</span>
          <h2 style={{ margin: 0, fontFamily: 'var(--cond)', fontSize: 28 }}>{r.input.projectName}</h2>
          <span style={{ color: 'var(--ink-2)' }}>{r.refs.district.group} r., {r.refs.district.name} · {r.refs.func.name} · {r.input.floors} mərtəbə</span>
        </div>
        <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>№ {id}</span>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', padding: '16px 0' }}>
        <ScoreDial score={s} />
        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong style={{ fontSize: 18, color: GC[s.grade] }}>{s.label}</strong>
          {s.parts.map((p) => (
            <div key={p.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{p.label}</span><span className="mono">{p.value}</span></div>
              <div className="bar-bg" style={{ height: 6 }}><div className="bar" style={{ height: 6, width: `${p.value}%`, background: p.value >= 70 ? 'var(--ok)' : p.value >= 45 ? 'var(--warn)' : 'var(--fail)' }} /></div>
            </div>
          ))}
        </div>
        {qr && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <img src={qr} alt="Bina pasportunun QR kodu" width="132" height="132" />
            <span className="note">Skan edin və yoxlayın</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
        {r.geo.items.map((g) => (
          <div key={g.key} style={{ background: '#fff', padding: '10px 12px', display: 'flex', gap: 10 }}>
            <span className="badge" style={{ background: LC[g.level] }}>{LS[g.level]}</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{g.title}</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{g.value}</span>
            </div>
          </div>
        ))}
      </div>

      <table className="table" style={{ marginTop: 12 }}>
        <tbody>
          <tr><td>Təməl</td><td className="r" style={{ fontFamily: 'var(--sans)' }}>{r.foundation.type}</td></tr>
          <tr><td>Torpaq sahəsi / tikinti ləkəsi</td><td className="r">{fmtNum(r.site.plotArea)} m² / {fmtNum(r.site.footprint)} m²</td></tr>
          <tr><td>Ümumi sahə</td><td className="r">{fmtNum(r.cost.grossArea)} m²{r.units ? ` · ${r.units} vahid` : ''}</td></tr>
          <tr><td>Təhlükəsiz mərtəbə limiti</td><td className="r">{r.floorCap} ({r.limitingFactor.toLowerCase()})</td></tr>
          <tr><td>Təxmini xərc / gəlir</td><td className="r">{fmtAZN(r.cost.totalCost)} / {fmtAZN(r.revenue.revenue)}</td></tr>
          {r.refs.feats.length > 0 && <tr><td>Əlavə xüsusiyyətlər</td><td className="r" style={{ fontFamily: 'var(--sans)' }}>{r.refs.feats.map((f) => f.name).join(', ')}</td></tr>}
        </tbody>
      </table>
      <p className="note" style={{ margin: '12px 0 0' }}>
        Konsept səviyyəli qiymətləndirmədir; qazma və laboratoriya testləri ({r.geo.survey.boreholes} quyu × {r.geo.survey.depth} m) ilə təsdiqlənməlidir. Tarix: {new Date().toLocaleDateString('az-AZ')}.
      </p>
    </article>
  );
}

export default function Passport({ r }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    setUrl(`${window.location.origin}/pasport?d=${encodeInput(r.input)}`);
  }, [r.input]);
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="note" style={{ flex: '1 1 300px' }}>Developer bu pasportu satış ofisində və elanlarda QR kod kimi paylaşır. Alıcı skan edib torpağın və layihənin yoxlandığını görür.</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn-outline" href={url || '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Pasportu aç</a>
          <button type="button" className="btn-outline" onClick={() => navigator.clipboard?.writeText(url)}>Linki kopyala</button>
        </div>
      </div>
      {isLocal && <span className="note" style={{ color: 'var(--warn)' }}>QR telefonda yalnız sayt internetə yerləşdiriləndən (deploy) sonra açılacaq. İndi kompüterdə "Pasportu aç" ilə baxın.</span>}
      <PassportCard r={r} url={url} />
    </div>
  );
}

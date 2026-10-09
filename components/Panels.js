'use client';

import { useState, useRef, useEffect } from 'react';
import { fmtAZN, fmtNum } from '@/lib/engine';
import { ScoreDial } from '@/components/Passport';

const LVL = {
  fail: { c: 'var(--fail)', s: '✕' },
  warn: { c: 'var(--warn)', s: '!' },
  ok: { c: 'var(--ok)', s: '✓' },
};
export const STATUS = {
  ok: { color: 'var(--ok)', title: 'Bu ideya alınır', tag: 'ALINIR' },
  warn: { color: 'var(--warn)', title: 'Şərtlərlə alınır', tag: 'ŞƏRTLƏ' },
  fail: { color: 'var(--fail)', title: 'Bu formada alınmır', tag: 'ALINMIR' },
};

export function Verdict({ r, ai }) {
  const st = STATUS[r.status];
  const fallback = r.status === 'fail'
    ? `${(() => { const t = r.issues.filter((i) => i.level === 'fail').map((i) => i.title.toLowerCase()).join(', '); return t.charAt(0).toUpperCase() + t.slice(1); })()}. Layihə ${r.recommendedFloors} mərtəbəli variantda real olur.`
    : r.status === 'warn'
      ? 'Əsas göstəricilər qəbul ediləndir, amma aşağıdakı xəbərdarlıqlar həll olunmalıdır.'
      : 'Büdcə, torpaq və gəlirlilik bu ideyanı dəstəkləyir.';
  return (
    <section className={`card verdict s-${r.status}`} style={{ borderTopColor: st.color }}>
      <div style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="eyebrow" style={{ color: st.color }}>Hökm</span>
        <h1>{st.title}</h1>
        <p>{ai?.xulase || fallback}</p>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} title="UltScore: geologiya, konstruktiv təhlükəsizlik, maliyyə və bazar riskinin ümumi balı">
          <ScoreDial score={r.score} size={104} />
          <small className="eyebrow">UltScore</small>
        </div>
        <div className="floorbox">
          <small>İstənilən</small>
          <span className="n" style={{ color: r.input.floors > r.floorCap ? 'var(--fail)' : 'inherit' }}>{r.input.floors}</span>
          <small>mərtəbə</small>
        </div>
        <div className="floorbox dark">
          <small>Tövsiyə</small>
          <span className="n">{r.recommendedFloors === r.floorCap || r.recommendedFloors === r.input.floors ? r.recommendedFloors : `${r.recommendedFloors}–${Math.min(r.floorCap, r.input.floors)}`}</span>
          <small>limit {r.floorCap} mərtəbə</small>
        </div>
      </div>
    </section>
  );
}

function useCount(target, ms = 900) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const a = from.current; const b = target; if (a === b) return undefined;
    let raf; const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms); const e = 1 - Math.pow(1 - k, 3);
      const cur = a + (b - a) * e; setV(cur); from.current = cur;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Num({ value, fmt }) {
  const v = useCount(value);
  return <>{fmt(v)}</>;
}

export function Kpis({ r }) {
  const over = r.cost.budgetRatio > 1;
  const items = [
    { l: 'Ümumi sahə', n: r.cost.grossArea, f: (x) => `${fmtNum(x)} m²`, s: r.units ? `${r.units} ${r.input.func === 'otel' ? 'otaq' : 'mənzil'}` : `${r.input.floors} mərtəbə`, k: '#2f6f9f' },
    { l: 'Təxmini xərc', n: r.cost.totalCost, f: fmtAZN, s: `${fmtNum(r.cost.costPerM2)} ₼/m²`, k: '#12161a' },
    { l: 'Büdcə', n: r.cost.budgetRatio * 100, f: (x) => `${Math.round(x)}%`, s: over ? `${fmtAZN(r.cost.totalCost - r.input.budget)} çatmır` : `${fmtAZN(r.input.budget - r.cost.totalCost)} ehtiyat`, c: over ? (r.cost.budgetRatio > 1.15 ? 'var(--fail)' : 'var(--warn)') : 'var(--ok)' },
    { l: 'Proqnoz gəlir', n: r.revenue.revenue, f: fmtAZN, s: `${fmtNum(r.revenue.salePrice)} ₼/m² satış`, k: '#7a5af8' },
    { l: 'Marja', n: r.revenue.margin * 100, f: (x) => `${x.toFixed(1)}%`, s: 'norma 20–30%', c: r.revenue.margin < 0 ? 'var(--fail)' : r.revenue.margin < 0.15 ? 'var(--warn)' : 'var(--ok)' },
    { l: 'Tikinti müddəti', n: r.months, f: (x) => `${Math.round(x)} ay`, s: 'təxmini', k: '#e0531a' },
  ];
  return (
    <section className="kpis" aria-label="Əsas göstəricilər">
      {items.map((k) => (
        <div key={k.l} className="kpi" style={{ '--kc': k.c || k.k }}><span className="l">{k.l}</span><span className="v" style={{ color: k.c }}><Num value={k.n} fmt={k.f} /></span><span className="s">{k.s}</span></div>
      ))}
    </section>
  );
}

export function Issues({ r }) {
  return (
    <section className="card" style={{ flex: '2 1 300px', minWidth: 0 }}>
      <div className="card-h"><h2>Yoxlama nəticələri</h2></div>
      <ul className="issues">
        {r.issues.map((i, k) => (
          <li key={k}>
            <span className="badge" style={{ background: LVL[i.level].c }}>{LVL[i.level].s}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><strong style={{ fontWeight: 600 }}>{i.title}</strong><span style={{ color: 'var(--ink-2)' }}>{i.text}</span></div>
          </li>
        ))}
      </ul>
      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line)' }}>
        <span className="eyebrow">Mərtəbə limitləri</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {r.caps.map((c) => (
            <span key={c.by} className="mono" style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--line)', background: c.value === r.floorCap ? 'var(--ink)' : '#fff', color: c.value === r.floorCap ? '#fff' : 'var(--ink)' }}>{c.by}: {c.value}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CostBreakdown({ r, onPatch }) {
  const max = Math.max(...r.cost.breakdown.map((b) => b.value));
  const sorted = [...r.cost.breakdown].sort((a, b) => b.value - a.value);
  const mi = r.input.materialIdx || 0;
  return (
    <div>
      <div className="card-h" style={{ borderBottom: 0 }}>
        <h2>Xərc bölgüsü</h2>
        <span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{fmtAZN(r.cost.totalCost)}</span>
      </div>
      {onPatch && (
        <div style={{ margin: '0 18px 6px', padding: '12px 14px', background: 'var(--panel-2)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="matIdx" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: 600 }}>
            <span>Material qiyməti ssenarisi</span>
            <span className="mono" style={{ color: mi > 0 ? 'var(--fail)' : mi < 0 ? 'var(--ok)' : 'var(--ink)' }}>{mi > 0 ? '+' : ''}{mi}%</span>
          </label>
          <input id="matIdx" type="range" min="-20" max="50" step="5" value={mi} onChange={(e) => onPatch({ materialIdx: Number(e.target.value) })} style={{ accentColor: '#C2410C' }} />
          <span className="note">
            Sement, armatur və digər materiallar bahalaşarsa layihə nə olur? Hazırda: mənfəət {fmtAZN(r.revenue.profit)}, ROI {Math.round(r.revenue.roi * 100)}%, hökm: {r.status === 'ok' ? 'alınır' : r.status === 'warn' ? 'şərtlə' : 'alınmır'}.
          </span>
        </div>
      )}
      <ul className="bars">
        {sorted.map((b) => (
          <li key={b.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{b.label}</span><span className="mono">{fmtAZN(b.value)} · {Math.round((b.value / r.cost.totalCost) * 100)}%</span></div>
            <div className="bar-bg"><div className="bar" style={{ width: `${(b.value / max) * 100}%`, background: b.key === 'temel' ? 'var(--accent)' : ['soft', 'ehtiyat'].includes(b.key) ? '#8a9096' : 'var(--ink)' }} /></div>
          </li>
        ))}
      </ul>
      <table className="table">
        <tbody>
          <tr><td>Yerüstü sahə</td><td className="r">{fmtNum(r.cost.grossArea)} m²</td></tr>
          {r.cost.bsmtArea > 0 && <tr><td>Yeraltı sahə</td><td className="r">{fmtNum(r.cost.bsmtArea)} m² · {r.parkingSpots} avtomobil</td></tr>}
          <tr><td>Satış sahəsi</td><td className="r">{fmtNum(r.revenue.netArea)} m²</td></tr>
          <tr><td>Proqnoz mənfəət</td><td className="r" style={{ color: r.revenue.profit < 0 ? 'var(--fail)' : 'var(--ok)' }}>{fmtAZN(r.revenue.profit)} · ROI {Math.round(r.revenue.roi * 100)}%</td></tr>
        </tbody>
      </table>
      <p className="note" style={{ padding: '10px 18px', margin: 0 }}>Qiymətlər illüstrativ bazar ortalamalarıdır; real layihədə smeta ilə dəqiqləşdirilir.</p>
    </div>
  );
}

export function Scenarios({ list, best, onApply }) {
  return (
    <div className="scen">
      {list.map((s) => {
        const st = STATUS[s.result.status];
        const isBest = s.id === best;
        return (
          <article key={s.id} className={`scard${isBest ? ' best' : ''}`} style={{ borderTopColor: st.color }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <h3>{s.name}</h3>
              {isBest ? <span className="tag dark">AI TÖVSİYƏSİ</span> : <span className="tag" style={{ color: st.color }}>{st.tag}</span>}
            </div>
            <p style={{ margin: 0, color: 'var(--ink-2)' }}>{s.result.input.floors} mərtəbə · {s.desc}</p>
            <dl>
              <div><dt>Xərc</dt><dd>{fmtAZN(s.result.cost.totalCost)}</dd></div>
              <div><dt>Mənfəət</dt><dd style={{ color: s.result.revenue.profit < 0 ? 'var(--fail)' : undefined }}>{fmtAZN(s.result.revenue.profit)}</dd></div>
              <div><dt>ROI</dt><dd>{Math.round(s.result.revenue.roi * 100)}%</dd></div>
            </dl>
            <span className="note">Büdcənin {Math.round(s.result.cost.budgetRatio * 100)}%-i · {s.result.units ? `${s.result.units} vahid · ` : ''}{s.result.months} ay</span>
            <button type="button" className={isBest ? 'btn-accent' : 'btn-outline'} style={{ marginTop: 'auto', fontSize: 13, minHeight: 44, padding: '10px 14px' }} onClick={() => onApply(s.patch)}>
              Bu ssenarini tətbiq et
            </button>
          </article>
        );
      })}
    </div>
  );
}

function Cell({ label, b }) {
  if (!b) return null;
  return (
    <div className="ai-cell">
      <span className="eyebrow">{label}</span>
      <strong style={{ fontWeight: 600 }}>{b.basliq}</strong>
      <span className="t">{b.izah}</span>
      {b.reng_palitrasi && (
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>{b.reng_palitrasi.map((c) => <i key={c} className="swatch" style={{ background: c }} title={c} />)}</div>
      )}
    </div>
  );
}

const SEV = { yuksek: 'var(--fail)', orta: '#f79009', asagi: '#32d583' };

export function AIPanel({ ai, loading, stale, meta, onRun }) {
  return (
    <section className="ai">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h2>AI memarın rəyi</h2>
        <span className="eyebrow" style={{ color: '#a9afb5' }}>
          {meta?.mode === 'ai' ? `${meta.model}` : meta?.mode === 'offline' ? 'oflayn rejim · qayda əsaslı' : ''} · konsept səviyyəsi
        </span>
      </div>
      {meta?.note && <span className="note" style={{ color: '#f5a47a' }}>{meta.note}</span>}
      {loading && (
        <div>
          <p style={{ margin: 0, color: '#c5c8c1' }}>AI memar torpağı, büdcəni və riskləri təhlil edir…</p>
          <div className="skeleton" style={{ width: '90%' }} /><div className="skeleton" style={{ width: '75%' }} /><div className="skeleton" style={{ width: '82%' }} />
        </div>
      )}
      {!loading && !ai && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <p style={{ margin: 0, color: '#c5c8c1', flex: '1 1 300px' }}>Hesablamalar hazırdır. AI memardan təməl, istiqamət, planlama və fasad üzrə konkret rəy alın.</p>
          <button type="button" className="btn-accent" onClick={onRun}>AI memarla təhlil et</button>
        </div>
      )}
      {!loading && ai && (
        <>
          {stale && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', background: '#2a3036', padding: '8px 12px' }}>
              <span style={{ color: '#f5a47a', fontSize: 13, flex: '1 1 auto' }}>Parametrlər dəyişib, rəy köhnəlib.</span>
              <button type="button" className="btn-light" style={{ minHeight: 36, padding: '6px 12px' }} onClick={onRun}>Yenidən təhlil et</button>
            </div>
          )}
          {ai.esas_ideya && <p style={{ margin: 0, fontSize: 17, maxWidth: 860, color: '#fff' }}><span style={{ color: 'var(--accent-soft)' }}>Əsas ideya: </span>{ai.esas_ideya}</p>}
          <div className="ai-grid">
            <Cell label="Təməl" b={ai.temel} />
            <Cell label="İstiqamət" b={ai.yonlendirme} />
            <Cell label="Planlama" b={ai.planlama} />
            <Cell label="Fasad" b={ai.fasad} />
            <Cell label="Növbəti addım" b={ai.novbeti_addim} />
          </div>
          <div className="row">
            <div style={{ flex: '1 1 320px' }}>
              <span className="eyebrow" style={{ color: 'var(--accent-soft)' }}>Risklər</span>
              <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
                {(ai.riskler || []).map((x, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <i style={{ flex: 'none', width: 8, height: 8, marginTop: 7, background: SEV[x.seviyye] || '#f79009' }} />
                    <span><strong style={{ fontWeight: 600 }}>{x.basliq}.</strong> <span style={{ color: '#c5c8c1' }}>{x.izah}</span></span>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ flex: '1 1 320px' }}>
              <span className="eyebrow" style={{ color: 'var(--accent-soft)' }}>Tövsiyələr</span>
              <ol style={{ paddingLeft: 18, marginTop: 8, color: '#e3e5e0' }}>
                {(ai.tovsiyeler || []).map((x, i) => <li key={i} style={{ marginBottom: 6 }}>{x}</li>)}
              </ol>
            </div>
          </div>
          {ai.investor_cumlesi && <p style={{ margin: 0, borderTop: '1px solid #2f363d', paddingTop: 12, color: '#e3e5e0', fontStyle: 'italic' }}>“{ai.investor_cumlesi}”</p>}
        </>
      )}
    </section>
  );
}

export function Chat({ input, onPatch }) {
  const [msgs, setMsgs] = useState([
    { role: 'assistant', content: 'Salam! Layihə üzərində birlikdə işləyək. Məsələn yazın: "mərtəbəni 6-ya endir və premium et" və ya "bu torpaqda niyə svay lazımdır?"' },
  ]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [msgs]);

  const send = async (e) => {
    e?.preventDefault();
    const t = text.trim(); if (!t || busy) return;
    const next = [...msgs, { role: 'user', content: t }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, messages: next.slice(1) }) });
      const d = await res.json();
      let reply = d.reply || '…';
      if (d.patch) {
        onPatch(d.patch);
        reply += `\n\n✓ Tətbiq edildi: ${Object.entries(d.patch).map(([k, v]) => `${k} = ${v}`).join(', ')}`;
      }
      setMsgs([...next, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMsgs([...next, { role: 'assistant', content: `Xəta: ${err.message}` }]);
    } finally { setBusy(false); }
  };

  const quick = ['Ən ideal variantı tətbiq et', 'Təməli niyə belə seçdin?', 'Mənzil sayını necə artıra bilərik?'];
  return (
    <section className="card">
      <div className="card-h"><h2>AI memarla işləyin</h2><span className="note">Parametrləri söhbətlə dəyişə bilərsiniz</span></div>
      <div className="chat" style={{ maxHeight: 360, overflowY: 'auto' }}>
        {msgs.map((m, i) => <div key={i} className={`msg ${m.role === 'user' ? 'u' : 'a'}`}>{m.content}</div>)}
        {busy && <div className="msg a">Düşünürəm…</div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 18px 10px' }}>
        {quick.map((q) => <button key={q} type="button" className="btn-outline" style={{ fontWeight: 500, minHeight: 36, padding: '6px 10px' }} onClick={() => setText(q)}>{q}</button>)}
      </div>
      <form onSubmit={send} style={{ display: 'flex', gap: 8, padding: '0 18px 18px' }}>
        <label style={{ flex: 1 }}>
          <span style={{ position: 'absolute', left: -9999 }}>Mesaj</span>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Memara yazın…" />
        </label>
        <button type="submit" className="btn-accent" disabled={busy} style={{ minHeight: 44, fontSize: 14 }}>Göndər</button>
      </form>
    </section>
  );
}

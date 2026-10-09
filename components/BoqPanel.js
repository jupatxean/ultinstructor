'use client';

import { useMemo, useState } from 'react';
import { boq as calcBoq } from '@/lib/boq';
import { fmtAZN, fmtNum } from '@/lib/engine';

const GROUP_COL = { 'Hazırlıq': '#8A9096', 'Yeraltı hissə': '#6B5B3E', 'Karkas': '#C2410C', 'Bağlama': '#2F6F9F', 'Mühəndis sistemləri': '#00897B', 'Bəzək': '#7E57C2', 'Təhvil': '#2E7D32' };
const P_LBL = ['', 'Aşağı', 'Orta', 'Yüksək'];

const num = (n) => (Math.abs(n) >= 100 ? fmtNum(n) : String(Math.round(n * 10) / 10).replace('.', ','));

export default function BoqPanel({ result }) {
  const b = useMemo(() => calcBoq(result), [result]);
  const [view, setView] = useState('smeta');
  const [open, setOpen] = useState('karkas');

  const csv = () => {
    const rows = [['Bölmə', 'Material / iş', 'Vahid', 'Miqdar', 'Vahid qiyməti (AZN)', 'Material (AZN)', 'Qeyd']];
    b.sections.forEach((S) => {
      S.items.forEach((x) => rows.push([S.name, x.name, x.unit, x.qty, x.price, Math.round(x.qty * x.price), x.note || '']));
      if (S.lab) rows.push([S.name, 'İşçi qüvvəsi (əmək haqqı)', '', '', '', Math.round(S.lab), '']);
    });
    rows.push([], ['', 'Birbaşa xərclər', '', '', '', b.direct], ['', 'Podratçı üstə xərcləri (7%)', '', '', '', b.overhead], ['', 'Layihə, icazə, kəşfiyyat', '', '', '', b.soft], ['', 'Gözlənilməz xərclər', '', '', '', b.contingency], ['', 'CƏMİ', '', '', '', b.total]);
    const text = '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${(result.input.projectName || 'layihe').replace(/[^\wəöüğıçşƏÖÜĞIÇŞ-]+/g, '_')}_smeta.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const parts = [
    { k: 'Materiallar', v: b.matTotal, c: '#C2410C' }, { k: 'İşçi qüvvəsi', v: b.labTotal, c: '#2F6F9F' },
    { k: 'Texnika və meydança', v: b.sections.find((s) => s.id === 'muveqqeti').total, c: '#8A9096' },
    { k: 'Üstə xərclər', v: b.overhead, c: '#B0A27A' }, { k: 'Layihə və icazələr', v: b.soft, c: '#7E57C2' }, { k: 'Ehtiyat', v: b.contingency, c: '#D6D3CC' },
  ];

  return (
    <div>
      <div style={{ padding: '16px 18px 6px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Smeta, iş qrafiki və risklər</h2>
          <button type="button" className="btn-outline" onClick={csv}>⬇ Smetanı yüklə (Excel / CSV)</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {[
            ['Detallı smeta', fmtAZN(b.total)], ['1 m² üzrə', `${fmtNum(b.perM2)} ₼`], ['Ümumi müddət', `${b.schedule.months} ay`], ['Tikinti müddəti', `${b.schedule.buildMonths} ay`],
            ['Pik işçi sayı', `~${b.workers}`], ['Parametrik ilə fərq', `${b.diff > 0 ? '+' : ''}${Math.round(b.diff * 100)}%`],
          ].map(([k, v]) => (
            <div key={k} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
              <div className="eyebrow">{k}</div><div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: 16 }}>{v}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ display: 'flex', height: 14, borderRadius: 8, overflow: 'hidden' }}>
            {parts.map((p) => <div key={p.k} title={`${p.k}: ${fmtAZN(p.v)}`} style={{ width: `${(p.v / b.total) * 100}%`, background: p.c }} />)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6 }}>
            {parts.map((p) => <span key={p.k} className="note" style={{ fontSize: 12 }}><i style={{ display: 'inline-block', width: 9, height: 9, background: p.c, borderRadius: 2, marginRight: 5 }} />{p.k} {fmtAZN(p.v)} ({Math.round((p.v / b.total) * 100)}%)</span>)}
          </div>
          <div className="note" style={{ fontSize: 12, marginTop: 6 }}>İki müstəqil üsul: detallı smeta (miqdar × qiymət) {fmtAZN(b.total)}, parametrik (m² əsaslı) {fmtAZN(b.parametric)}. Konsept mərhələsində ±20–30% fərq normaldır (AACE sinif 4). Material qiymətləri "Xərclər" tabındakı slayderlə dəyişir.</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['smeta', 'Materiallar və smeta'], ['qrafik', 'İş qrafiki və maliyyə axını'], ['risk', `Risklər (${b.risks.length})`]].map(([id, l]) => (
            <button key={id} type="button" className={`chip${view === id ? ' on' : ''}`} style={{ boxShadow: 'none', border: '1px solid var(--line-2)' }} onClick={() => setView(id)}>{l}</button>
          ))}
        </div>
      </div>

      {view === 'smeta' && (
        <div style={{ padding: '4px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="eyebrow">Əsas materialların ümumi miqdarı</span>
          <table className="table" style={{ margin: 0 }}>
            <tbody>{b.key.map((k) => <tr key={k.k}><td style={{ fontWeight: 600 }}>{k.k}</td><td className="r" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{k.v}</td><td className="note" style={{ fontSize: 12.5 }}>{k.n}</td></tr>)}</tbody>
          </table>
          <span className="eyebrow" style={{ marginTop: 8 }}>Bölmələr üzrə smeta ({b.sections.reduce((a, s) => a + s.items.length, 0)} mövqe)</span>
          {b.sections.map((S) => (
            <div key={S.id} style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              <button type="button" onClick={() => setOpen(open === S.id ? null : S.id)} style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', padding: '11px 14px', background: open === S.id ? '#f7f7f4' : '#fff', border: 0, cursor: 'pointer', textAlign: 'left' }}>
                <strong style={{ flex: 1, fontSize: 14.5 }}>{S.name}</strong>
                <span className="note" style={{ fontSize: 12 }}>{S.items.length} mövqe</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, minWidth: 90, textAlign: 'right' }}>{fmtAZN(S.total)}</span>
                <span style={{ width: 70, height: 6, background: '#eee', borderRadius: 4, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${Math.min(100, (S.total / b.direct) * 300)}%`, background: '#C2410C' }} /></span>
              </button>
              {open === S.id && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ margin: 0, minWidth: 640 }}>
                    <thead><tr><th>Material / iş</th><th>Vahid</th><th className="r">Miqdar</th><th className="r">Qiymət</th><th className="r">Məbləğ</th></tr></thead>
                    <tbody>
                      {S.items.map((x) => (
                        <tr key={x.name}>
                          <td>{x.name}{x.note && <div className="note" style={{ fontSize: 11.5 }}>{x.note}</div>}</td>
                          <td className="note">{x.unit}</td>
                          <td className="r" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{num(x.qty)}</td>
                          <td className="r" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{num(x.price)} ₼</td>
                          <td className="r" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmtNum(x.qty * x.price)} ₼</td>
                        </tr>
                      ))}
                      {S.lab > 0 && <tr><td><em>İşçi qüvvəsi ({Math.round(S.labour * 100)}%)</em></td><td /><td /><td /><td className="r" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmtNum(S.lab)} ₼</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          <table className="table" style={{ margin: 0 }}>
            <tbody>
              <tr><td>Birbaşa xərclər (material + əmək + texnika)</td><td className="r">{fmtNum(b.direct)} ₼</td></tr>
              <tr><td>Podratçının üstə xərcləri (7%)</td><td className="r">{fmtNum(b.overhead)} ₼</td></tr>
              <tr><td>Layihələndirmə, ekspertiza, icazələr, geoloji kəşfiyyat</td><td className="r">{fmtNum(b.soft)} ₼</td></tr>
              <tr><td>Gözlənilməz xərclər ehtiyatı</td><td className="r">{fmtNum(b.contingency)} ₼</td></tr>
              <tr><td><strong>CƏMİ</strong></td><td className="r"><strong>{fmtNum(b.total)} ₼</strong></td></tr>
            </tbody>
          </table>
          <p className="note" style={{ margin: 0, fontSize: 12 }}>Qiymətlər Bakı bazarı üzrə təxminidir (2026, ƏDV daxil). Tender mərhələsində təchizatçı təklifləri ilə dəqiqləşdirilməlidir.</p>
        </div>
      )}
      {view === 'qrafik' && <Gantt b={b} />}
      {view === 'risk' && <Risks b={b} />}
    </div>
  );
}

function Gantt({ b }) {
  const { tasks, weeks } = b.schedule;
  const W = 900; const left = 290; const rowH = 22; const top = 34;
  const scale = (W - left - 20) / weeks;
  const H = top + tasks.length * rowH + 20;
  const months = Math.ceil(weeks / 4.345);
  const step = months > 30 ? 3 : months > 15 ? 2 : 1;
  const cash = b.cash; const maxSp = Math.max(...cash.map((c) => c.spend)); const CH = 170; const cw = (W - left - 20) / cash.length;
  return (
    <div style={{ padding: '4px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="stage" style={{ padding: 10, minHeight: 0, overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', background: '#fff' }} role="img" aria-label="İş qrafiki">
          {Array.from({ length: months + 1 }).map((_, m) => m % step === 0 && (
            <g key={m}><line x1={left + m * 4.345 * scale} x2={left + m * 4.345 * scale} y1={top - 8} y2={H - 14} stroke="#ECEDE9" />
              <text x={left + m * 4.345 * scale + 2} y={top - 14} fontSize="10" fontFamily="IBM Plex Mono, monospace" fill="#6A7178">{m + 1}</text></g>
          ))}
          <text x={left} y="12" fontSize="10.5" fill="#6A7178">Ay →</text>
          {tasks.map((t, i) => {
            const y = top + i * rowH;
            return (
              <g key={t.id}>
                <text x={left - 8} y={y + 14} textAnchor="end" fontSize="11" fontWeight={t.crit ? 600 : 400} fill="#2B3238">{t.name.length > 44 ? `${t.name.slice(0, 43)}…` : t.name}</text>
                <rect x={left + t.start * scale} y={y + 4} width={Math.max(3, t.dur * scale)} height={rowH - 8} rx="4" fill={GROUP_COL[t.group] || '#888'} opacity={t.crit ? 1 : 0.55} stroke={t.crit ? '#15181B' : 'none'} strokeWidth="1" />
                {t.dur * scale > 34 && <text x={left + t.start * scale + 5} y={y + 14.5} fontSize="9.5" fill="#fff" fontFamily="IBM Plex Mono, monospace">{Math.round(t.dur)} hf</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
        {Object.entries(GROUP_COL).map(([g, c]) => <span key={g} className="note" style={{ fontSize: 12 }}><i style={{ display: 'inline-block', width: 10, height: 10, background: c, borderRadius: 2, marginRight: 5 }} />{g}</span>)}
        <span className="note" style={{ fontSize: 12 }}>Qara çərçivə: kritik yol · hf = həftə · 6 günlük iş həftəsi · karkas tsikli {b.schedule.cycle} gün/mərtəbə</span>
      </div>
      <span className="eyebrow">Aylıq xərc axını (investor və bank üçün)</span>
      <div className="stage" style={{ padding: 10, minHeight: 0 }}>
        <svg viewBox={`0 0 ${W} ${CH + 40}`} style={{ width: '100%', height: 'auto', display: 'block', background: '#fff' }} role="img" aria-label="Aylıq xərc axını">
          <text x="10" y="16" fontSize="11" fill="#6A7178">Aylıq xərc (sütun) və yığılmış xərc (xətt)</text>
          <text x={left - 10} y={CH + 10} fontSize="10" textAnchor="end" fill="#6A7178">0</text>
          <text x={left - 10} y="34" fontSize="10" textAnchor="end" fill="#6A7178">{fmtAZN(maxSp)}/ay</text>
          {cash.map((c, i) => <rect key={i} x={left + i * cw + 1} y={CH + 6 - (c.spend / maxSp) * (CH - 30)} width={Math.max(2, cw - 2)} height={(c.spend / maxSp) * (CH - 30)} fill="#C2410C" opacity="0.8"><title>{`${c.month}-ci ay: ${fmtAZN(c.spend)} (cəmi ${fmtAZN(c.cum)})`}</title></rect>)}
          <polyline fill="none" stroke="#15181B" strokeWidth="2" points={cash.map((c, i) => `${left + i * cw + cw / 2},${CH + 6 - (c.cum / cash[cash.length - 1].cum) * (CH - 30)}`).join(' ')} />
          {cash.map((c, i) => (i % step === 0) && <text key={`t${i}`} x={left + i * cw + cw / 2} y={CH + 24} textAnchor="middle" fontSize="9.5" fontFamily="IBM Plex Mono, monospace" fill="#6A7178">{c.month}</text>)}
          <text x={W - 20} y="34" fontSize="10" textAnchor="end" fill="#15181B">{fmtAZN(cash[cash.length - 1].cum)}</text>
        </svg>
      </div>
      <span className="note" style={{ fontSize: 12 }}>Ən yüksək xərc dövrü karkas, fasad və mühəndis sistemlərinin üst-üstə düşdüyü aylardır. Kredit xətti və ilkin satışlar bu aylara planlaşdırılmalıdır.</span>
    </div>
  );
}

function Risks({ b }) {
  const cell = (p, i) => b.risks.filter((r) => r.p === p && r.i === i);
  const col = (s) => (s >= 6 ? '#FDE2E1' : s >= 3 ? '#FEF0C7' : '#DCFAE6');
  return (
    <div style={{ padding: '4px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Risk matrisi (ehtimal × təsir)</div>
          <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {[3, 2, 1].map((p) => (
                <tr key={p}>
                  <td className="note" style={{ paddingRight: 6, textAlign: 'right' }}>{P_LBL[p]}</td>
                  {[1, 2, 3].map((i) => <td key={i} style={{ width: 64, height: 46, background: col(p * i), border: '2px solid #fff', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 16 }}>{cell(p, i).length || ''}</td>)}
                </tr>
              ))}
              <tr><td /><td className="note" style={{ textAlign: 'center' }}>Aşağı</td><td className="note" style={{ textAlign: 'center' }}>Orta</td><td className="note" style={{ textAlign: 'center' }}>Yüksək</td></tr>
            </tbody>
          </table>
          <div className="note" style={{ fontSize: 11, marginTop: 4 }}>↑ ehtimal · → təsir</div>
        </div>
        <div style={{ flex: 1, minWidth: 240, fontSize: 13 }} className="note">
          {b.risks.filter((r) => r.score >= 6).length} yüksək, {b.risks.filter((r) => r.score >= 3 && r.score < 6).length} orta, {b.risks.filter((r) => r.score < 3).length} aşağı risk. Risklər bu layihənin rayonu, torpağı, qrunt suyu, hündürlüyü, büdcəsi və iqliminə görə avtomatik müəyyən edilir. Hər riskin qarşısını almaq üçün konkret addımlar verilir.
        </div>
      </div>
      {b.risks.map((r) => (
        <div key={r.name} style={{ border: '1px solid var(--line)', borderLeft: `5px solid ${r.score >= 6 ? '#D92D20' : r.score >= 3 ? '#F79009' : '#12B76A'}`, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span className="eyebrow">{r.cat}</span>
            <strong style={{ fontSize: 15, flex: 1 }}>{r.name}</strong>
            <span className="note" style={{ fontSize: 12 }}>Ehtimal: {P_LBL[r.p]} · Təsir: {P_LBL[r.i]} · Bal {r.score}/9</span>
          </div>
          <span className="note" style={{ fontSize: 12.5 }}>Səbəb: {r.why}</span>
          <ul style={{ margin: '2px 0 0', paddingLeft: 18, fontSize: 13 }}>{r.steps.map((s) => <li key={s}>{s}</li>)}</ul>
          {r.cost && r.cost !== '—' && <span className="note" style={{ fontSize: 12 }}>Tədbirin xərci: {r.cost}</span>}
        </div>
      ))}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { systems as calcSystems, CLIMATE } from '@/lib/systems';
import { fmtAZN } from '@/lib/engine';
import FloorPlan from '@/components/FloorPlan';

export default function SystemsPanel({ result }) {
  const sys = useMemo(() => calcSystems(result), [result]);
  const [open, setOpen] = useState('su');
  const [view, setView] = useState('plan');

  return (
    <div>
      <div style={{ padding: '16px 18px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Mühəndis sistemləri</h2>
          <span className="note">{sys.hc.name} · yanğın hündürlüyü {sys.H} m · {sys.pop.residents + sys.pop.staff || sys.pop.visitors} {sys.pop.label}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 8 }}>
          {sys.kpis.map((k) => (
            <div key={k.k} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', background: 'var(--paper, #fff)' }}>
              <div className="eyebrow">{k.k}</div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: 16 }}>{k.v}</div>
            </div>
          ))}
        </div>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Mövcud şərtlərə uyğunluq yoxlaması</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '6px 16px' }}>
            {sys.checks.map((c) => (
              <div key={c.t} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                <span style={{ color: c.ok ? '#12b76a' : '#f79009', fontWeight: 700 }}>{c.ok ? '✓' : '!'}</span>
                <span><strong style={{ fontWeight: 600 }}>{c.t}</strong>{c.d ? <span className="note"> — {c.d}</span> : null}</span>
              </div>
            ))}
          </div>
          <div className="note" style={{ marginTop: 8 }}>Bakı iqlimi: qış {CLIMATE.winterDesign} °C, yay +{CLIMATE.summerDesign} °C, Xəzri {CLIMATE.windMax} m/s, seysmiklik {result.refs.district.seismic} bal, qrunt suyu: {result.refs.gw.name.toLowerCase()}{sys.ctx.coastal ? ', dəniz sahili (korroziya)' : ''}{sys.ctx.slidey ? ', torpaq hərəkəti riski' : ''}.</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['plan', 'Mərtəbə üzrə sistem planı'], ['riser', 'Şaquli sxem (stoyaklar)'], ['rooms', 'Texniki otaqlar və şaxtalar']].map(([id, l]) => (
            <button key={id} type="button" className={`chip${view === id ? ' on' : ''}`} style={{ boxShadow: 'none', border: '1px solid var(--line-2)' }} onClick={() => setView(id)}>{l}</button>
          ))}
        </div>
      </div>

      {view === 'plan' && <FloorPlan result={result} defaultLayers={['su', 'elek', 'hvac', 'yangin', 'qaz']} />}
      {view === 'riser' && <Riser r={result} sys={sys} />}
      {view === 'rooms' && <Rooms sys={sys} />}

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span className="eyebrow">Sistemlər üzrə ətraflı həll ({sys.list.length})</span>
          <span className="note">Mühəndis sistemlərinin ümumi xərci: <strong>{fmtAZN(sys.mepTotal)}</strong> (smetaya daxildir)</span>
        </div>
        {sys.list.map((s) => (
          <div key={s.id} style={{ border: '1px solid var(--line)', borderLeft: `4px solid ${s.color}`, borderRadius: 12, overflow: 'hidden' }}>
            <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: open === s.id ? '#f7f7f4' : '#fff', border: 0, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <strong style={{ flex: 1, fontSize: 15 }}>{s.name}</strong>
              <span className="note" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmtAZN(s.cost)}</span>
              <span style={{ transform: open === s.id ? 'rotate(90deg)' : 'none', transition: '.2s' }}>›</span>
            </button>
            {open === s.id && (
              <div>
                <table className="table" style={{ margin: 0 }}>
                  <thead><tr><th style={{ width: '24%' }}>Element</th><th style={{ width: '32%' }}>Həll / ölçü</th><th>Əsaslandırma və şərtlərə uyğunluq</th></tr></thead>
                  <tbody>
                    {s.items.map((it) => (
                      <tr key={it.k}><td style={{ fontWeight: 600 }}>{it.k}</td><td style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12.5 }}>{it.v}</td><td className="note" style={{ fontSize: 12.5 }}>{it.n}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="note" style={{ padding: '8px 14px 12px', fontSize: 12 }}>Normativ əsas: {s.norm}</div>
              </div>
            )}
          </div>
        ))}
        <p className="note" style={{ margin: '6px 0 0' }}>Konsept mərhələsi üçün hesablanıb (SNiP/SP əsaslı AzDTN normaları, IEC/EN standartları). İşçi layihədə lisenziyalı mühəndislər, FHN, Azərsu, Azərişıq və Azəriqaz texniki şərtləri ilə dəqiqləşdirilməlidir.</p>
      </div>
    </div>
  );
}

function Rooms({ sys }) {
  return (
    <div style={{ padding: '8px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
      <table className="table">
        <thead><tr><th>Texniki otaq</th><th>Yeri</th><th className="r">Sahə</th></tr></thead>
        <tbody>
          {sys.rooms.map((x) => <tr key={x.name}><td>{x.name}</td><td className="note">{x.where}</td><td className="r">{x.area} m²</td></tr>)}
          <tr><td><strong>Cəmi</strong></td><td /><td className="r"><strong>{sys.rooms.reduce((a, x) => a + x.area, 0)} m²</strong></td></tr>
        </tbody>
      </table>
      <table className="table">
        <thead><tr><th>Şaxta (hər mərtəbədə)</th><th>Ölçü</th><th className="r">Say</th></tr></thead>
        <tbody>
          {sys.shafts.map((x) => <tr key={x.name}><td>{x.name}</td><td className="note">{x.size}</td><td className="r">{x.count}</td></tr>)}
          <tr><td><strong>Mərtəbədə şaxta sahəsi</strong></td><td /><td className="r"><strong>{sys.shaftArea} m²</strong></td></tr>
        </tbody>
      </table>
    </div>
  );
}

function Riser({ r, sys }) {
  const F = r.input.floors; const B = r.input.basements;
  const rows = F + B;
  const fh = Math.max(9, Math.min(26, 420 / rows));
  const top = 110; const bx0 = 230; const bx1 = 600; const W = 860;
  const groundY = top + F * fh;
  const bH = Math.max(B * fh, 76); const fhB = bH / Math.max(B, 1);
  const H = groundY + bH + 108;
  const yOf = (lv) => (lv > 0 ? groundY - (lv - 1) * fh - fh : groundY + (-lv - 1) * fhB); // mərtəbənin yuxarı xətti
  const rowH = (lv) => (lv > 0 ? fh : fhB);
  const su = sys.list.find((s) => s.id === 'su'); const el = sys.list.find((s) => s.id === 'elek');
  const hv = sys.list.find((s) => s.id === 'hvac'); const lf = sys.list.find((s) => s.id === 'lift');
  const c = sys.ctx;
  const zoneH = F / su.zones;
  const lvls = []; for (let i = F; i >= 1; i -= 1) lvls.push(i); for (let b = 1; b <= B; b += 1) lvls.push(-b);
  const bottomY = groundY + bH;
  const showDots = fh >= 11;
  const X = { w: 270, k: 300, e: 335, f: 365, l0: 400, l1: 440, v: 480, sm: 510, g: 615 };
  const Box = ({ x, y, w, h, fill, stroke, t1, t2 }) => (
    <g><rect x={x} y={y} width={w} height={h} rx="6" fill={fill} stroke={stroke} strokeWidth="1.4" />
      <text x={x + w / 2} y={y + (t2 ? h / 2 - 2 : h / 2 + 4)} textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="IBM Plex Sans, sans-serif" fill="#1d2329">{t1}</text>
      {t2 && <text x={x + w / 2} y={y + h / 2 + 11} textAnchor="middle" fontSize="10" fontFamily="IBM Plex Mono, monospace" fill="#555">{t2}</text>}</g>
  );
  return (
    <div className="stage" style={{ padding: 12, minHeight: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', background: '#fff' }} role="img" aria-label="Mühəndis sistemlərinin şaquli sxemi">
        {/* bina */}
        <rect x={bx0} y={top} width={bx1 - bx0} height={F * fh} fill="#FAFAF7" stroke="#15181B" strokeWidth="2" />
        <rect x={bx0 - 20} y={groundY} width={bx1 - bx0 + 40} height={bH} fill={B > 0 ? '#EEEDE8' : '#F6F5F1'} stroke="#15181B" strokeWidth={B > 0 ? 2 : 1} strokeDasharray={B > 0 ? 'none' : '5 4'} />
        {B === 0 && <text x={bx1 + 14} y={groundY + 14} fontSize="9.5" fill="#6B5B3E">texniki blok (1-ci mərtəbə)</text>}
        <line x1="20" x2={W - 20} y1={groundY} y2={groundY} stroke="#6B5B3E" strokeWidth="2.5" />
        <text x={bx0 - 30} y={groundY + 14} textAnchor="end" fontSize="10" fontFamily="IBM Plex Mono, monospace" fill="#6B5B3E">±0.000</text>
        {lvls.map((lv) => <g key={lv}>
          <line x1={lv > 0 ? bx0 : bx0 - 20} x2={lv > 0 ? bx1 : bx1 + 20} y1={yOf(lv) + rowH(lv)} y2={yOf(lv) + rowH(lv)} stroke="#C9CBC4" strokeWidth="0.8" />
          {(fh >= 12 || lv === F || lv === 1 || lv < 0 || lv % 5 === 0) && <text x={bx0 - (lv < 0 ? 26 : 6)} y={yOf(lv) + rowH(lv) / 2 + 4} textAnchor="end" fontSize="10" fontFamily="IBM Plex Mono, monospace" fill="#5B6168">{lv > 0 ? lv : `−${-lv}`}</text>}
        </g>)}
        {/* su zonaları */}
        {Array.from({ length: su.zones }).map((_, z) => {
          const fromF = Math.round(z * zoneH) + 1; const toF = Math.round((z + 1) * zoneH);
          const y1 = yOf(toF); const y2 = yOf(fromF) + fh;
          return <g key={z}>
            <rect x={bx0 + 4} y={y1 + 1} width="18" height={y2 - y1 - 2} fill={['#E3F2FD', '#BBDEFB', '#90CAF9', '#64B5F6'][z % 4]} />
            <text x={bx0 + 13} y={(y1 + y2) / 2} textAnchor="middle" fontSize="9" fontFamily="IBM Plex Mono, monospace" fill="#0D47A1" transform={`rotate(-90 ${bx0 + 13} ${(y1 + y2) / 2})`}>Zona {z + 1}</text>
          </g>;
        })}
        {/* stoyaklar */}
        <line x1={X.w} x2={X.w} y1={yOf(F) + 4} y2={bottomY - 18} stroke="#1E88E5" strokeWidth="3" />
        <line x1={X.k} x2={X.k} y1={top - 18} y2={bottomY + 30} stroke="#6D4C41" strokeWidth="3.5" />
        <line x1={X.e} x2={X.e} y1={yOf(F) + 4} y2={bottomY - 18} stroke="#F9A825" strokeWidth="3" />
        {su.hyd && <line x1={X.f} x2={X.f} y1={yOf(F) + 4} y2={bottomY - 18} stroke="#C62828" strokeWidth="3" />}
        <rect x={X.l0} y={top - 14} width={X.l1 - X.l0} height={bottomY - top + 14} fill="#EDE7F6" stroke="#5E35B1" strokeWidth="1.2" />
        <text x={(X.l0 + X.l1) / 2} y={top + (bottomY - top) / 2} textAnchor="middle" fontSize="11" fontWeight="600" fill="#4527A0" transform={`rotate(-90 ${(X.l0 + X.l1) / 2} ${top + (bottomY - top) / 2})`}>Lift şaxtası · {lf.passenger} lift · {lf.speed} m/s{lf.fire ? ' · yanğın rejimi' : ''}</text>
        <line x1={X.v} x2={X.v} y1={top - 30} y2={yOf(1) + fh} stroke="#00897B" strokeWidth="3" strokeDasharray="6 3" />
        {c.smokeExhaust && <line x1={X.sm} x2={X.sm} y1={top - 30} y2={yOf(1) + fh} stroke="#757575" strokeWidth="3" strokeDasharray="2 3" />}
        {c.gasApt && <line x1={X.g} x2={X.g} y1={yOf(F) + 6} y2={groundY + 26} stroke="#EF6C00" strokeWidth="3" />}
        {!c.gasApt && r.input.func !== 'ofis' && <polyline points={`${bx1 + 40},${groundY + 26} ${bx1 + 40},${top - 40} ${bx1 - 60},${top - 40}`} fill="none" stroke="#EF6C00" strokeWidth="3" />}
        {/* mərtəbə nöqtələri */}
        {showDots && lvls.filter((lv) => lv > 0).map((lv) => {
          const y = yOf(lv) + fh / 2;
          return <g key={`d${lv}`}>
            <circle cx={X.w} cy={y} r="2.6" fill="#1E88E5" />
            <rect x={X.e - 4} y={y - 3} width="8" height="6" fill="#F9A825" stroke="#8D6E00" strokeWidth="0.6" />
            {su.hyd && <rect x={X.f - 4} y={y - 3} width="8" height="6" fill="#C62828" />}
            {c.gasApt && <circle cx={X.g} cy={y} r="2.6" fill="#EF6C00" />}
          </g>;
        })}
        {/* zona sərhədlərində təzyiq azaldıcı */}
        {Array.from({ length: su.zones - 1 }).map((_, z) => { const y = yOf(Math.round((z + 1) * zoneH)) + fh; return <g key={`p${z}`}><path d={`M${X.w - 7} ${y - 5} L${X.w + 7} ${y + 5} L${X.w + 7} ${y - 5} L${X.w - 7} ${y + 5} Z`} fill="#fff" stroke="#1E88E5" strokeWidth="1.4" /></g>; })}

        {/* dam */}
        <Box x={bx0 + 10} y={top - 66} w={150} h={40} fill="#E0F2F1" stroke="#00897B" t1={/Çiller|çiller/.test(hv.items[4].v) ? 'Çiller / soyuducu' : /split/i.test(hv.items[4].v) ? 'Split blokları (fasad)' : 'VRF xarici bloklar'} t2={`${hv.coolKw} kVt soyutma`} />
        {!c.gasApt && r.input.func !== 'ofis' && <Box x={bx1 - 160} y={top - 66} w={100} h={40} fill="#FFF3E0" stroke="#EF6C00" t1="Qazanxana" t2={`${Math.round(hv.heatKw * 1.15)} kVt`} />}
        {c.solar && <Box x={bx0 + 170} y={top - 66} w={110} h={40} fill="#FFFDE7" stroke="#F9A825" t1="Günəş panelləri" t2={`${el.solarKwp} kVtp`} />}
        {c.smokeExhaust && <Box x={X.sm - 30} y={top - 100} w={110} h={28} fill="#F5F5F5" stroke="#757575" t1="Tüstü ventilyatoru" />}
        <line x1={bx1 - 10} x2={bx1 - 10} y1={top} y2={top - 90} stroke="#455A64" strokeWidth="2" />
        <text x={bx1 - 6} y={top - 80} fontSize="10" fill="#455A64">İldırımqəbuledici</text>

        {/* yer / zirzəmi avadanlığı */}
        {(() => {
          const by = bottomY - 50; const bh = 42;
          return <g>
            <Box x={bx0 + 26} y={by} w={92} h={bh} fill="#E3F2FD" stroke="#1E88E5" t1="Su çəni" t2={`${su.tankHousehold} m³`} />
            <Box x={bx0 + 124} y={by} w={84} h={bh} fill="#E3F2FD" stroke="#1E88E5" t1="Nasoslar" t2={su.needBoost ? `H=${su.head} m` : 'tələb yox'} />
            {su.tankFire > 0 && <Box x={bx0 + 214} y={by} w={92} h={bh} fill="#FFEBEE" stroke="#C62828" t1="Yanğın çəni" t2={`${su.tankFire} m³`} />}
            <Box x={bx0 + 312 - (su.tankFire > 0 ? 0 : 98)} y={by} w={70} h={bh} fill="#FFF8E1" stroke="#F9A825" t1="GPQ" t2="0,4 kV" />
          </g>;
        })()}
        {el.own && <Box x={30} y={groundY - 56} w={150} h={46} fill="#FFF8E1" stroke="#F9A825" t1="Transformator (TM)" t2={`2 × ${el.trEach} kVA`} />}
        <Box x={W - 200} y={groundY - 56} w={170} h={46} fill="#FFF8E1" stroke="#8D6E00" t1="Dizel generator" t2={`${el.genKva} kVA`} />
        {/* xarici girişlər */}
        <line x1="30" x2={X.w} y1={bottomY - 12} y2={bottomY - 12} stroke="#1E88E5" strokeWidth="2.5" />
        <text x="30" y={bottomY - 18} fontSize="10" fill="#1565C0">Azərsu girişi (2 × DN{su.items[2].v.match(/DN(\d+)/)?.[1]})</text>
        <line x1={X.k} x2="30" y1={bottomY + 30} y2={bottomY + 30} stroke="#6D4C41" strokeWidth="3" />
        <text x="30" y={bottomY + 46} fontSize="10" fill="#4E342E">Şəhər kanalizasiyasına (DN150)</text>
        {(c.gasApt || r.input.func !== 'ofis') && <g>
          <line x1={W - 30} x2={c.gasApt ? X.g : bx1 + 40} y1={groundY + 26} y2={groundY + 26} stroke="#EF6C00" strokeWidth="3" />
          <rect x={W - 150} y={groundY + 18} width="16" height="16" fill="#fff" stroke="#EF6C00" strokeWidth="2" />
          <text x={W - 30} y={groundY + 50} textAnchor="end" fontSize="10" fill="#E65100">Azəriqaz · seysmik avtomatik klapan</text>
        </g>}
        {el.own && <line x1="105" x2="105" y1={groundY - 10} y2={groundY + 22} stroke="#F9A825" strokeWidth="2.5" />}
        {el.own && <text x="30" y={groundY + 32} fontSize="10" fill="#8D6E00">Azərişıq 10 kV (2 giriş)</text>}

        {/* leqenda */}
        {[['#1E88E5', 'Su stoyağı + zonalar'], ['#6D4C41', 'Kanalizasiya'], ['#F9A825', 'Elektrik stoyağı + ML'], ['#C62828', 'Yanğın kranları'], ['#00897B', 'Ventilyasiya'], ['#757575', 'Tüstü sorma'], ['#EF6C00', 'Qaz']].map(([col, t], i) => (
          <g key={t} transform={`translate(${24 + (i % 4) * 205} ${H - 34 + Math.floor(i / 4) * 16})`}><rect width="18" height="5" y="-5" fill={col} /><text x="24" fontSize="10.5" fill="#333">{t}</text></g>
        ))}
      </svg>
    </div>
  );
}

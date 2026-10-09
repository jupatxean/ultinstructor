'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { floorList, floorPlan, floorSummary } from '@/lib/floors';
import { systems as calcSystems } from '@/lib/systems';
import { mepOverlay, LAYERS } from '@/lib/overlay';

const FILL = {
  corridor: '#ECEDE9', core: '#3B444C', room: '#FFFFFF', wet: '#E3ECF2', hall: '#F3F4F0', tech: '#D5D7D1', open: '#FFFFFF', meeting: '#FDE7DC',
  shop: '#FFF1E6', anchor: '#FCDDC6', walk: '#F4F3EF', atrium: '#E3EEF6', esc: '#B9CAD6', wc: '#DCE8F1', storage: '#E8E2D3', lobby: '#EFEAE0',
  food: '#FFF6DF', kitchen: '#F8DFC0', play: '#E4F2DC', office: '#EDEAF6', slab: '#E9EAE6', ramp: '#D6D3CC',
};
const ORDER = ['slab', 'open', 'walk', 'food', 'corridor', 'lobby', 'atrium', 'esc', 'core', 'shop', 'anchor', 'kitchen', 'play', 'room', 'wet', 'hall', 'wc', 'storage', 'tech', 'meeting', 'office', 'ramp'];
const LEGEND = {
  room: 'Yaşayış otaqları', wet: 'Mətbəx / SQ', core: 'Lift + pilləkən', corridor: 'Dəhliz', shop: 'Mağaza', anchor: 'Supermarket', walk: 'Gəzinti zolağı', atrium: 'Atrium',
  esc: 'Eskalator', wc: 'WC', storage: 'Anbar', tech: 'Texniki', lobby: 'Lobbi / giriş', food: 'Yemək zalı / restoran', kitchen: 'Kafe / mətbəx', play: 'Uşaq zonası',
  open: 'Açıq ofis', meeting: 'İclas', office: 'Xidmət', ramp: 'Rampa',
};
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function FloorPlan({ result, defaultLayers = [] }) {
  const [layers, setLayers] = useState(defaultLayers);
  const sys = useMemo(() => calcSystems(result), [result]);
  const toggleLayer = (id) => setLayers((L) => (L.includes(id) ? L.filter((x) => x !== id) : [...L, id]));
  const { site } = result;
  const floors = useMemo(() => floorList(result), [result]);
  const [level, setLevel] = useState(1);
  useEffect(() => { if (!floors.some((f) => f.level === level)) setLevel(1); }, [floors, level]);
  const fp = useMemo(() => floorPlan(result, level), [result, level]);
  const summary = useMemo(() => floorSummary(fp), [fp]);
  const ov = useMemo(() => mepOverlay(fp, sys, level, result), [fp, sys, level, result]);
  const cur = floors.find((f) => f.level === level) || floors[0];

  const s = 20; const pad = 30;
  const dw = fp.dims?.w ?? site.fw; const dh = fp.dims?.h ?? site.fd;
  const W = dw * s; const H = dh * s;
  const fullW = W + pad * 2 + 40; const fullH = H + pad * 2 + 30;
  const rects = fp.rects.filter((r) => r.kind !== 'unit').sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const unitRects = fp.rects.filter((r) => r.kind === 'unit');
  const kinds = [...new Set(fp.rects.map((r) => r.kind))].filter((k) => LEGEND[k]);

  // --- zoom / pan ---
  const [vb, setVb] = useState({ x: 0, y: 0, w: fullW, h: fullH });
  const svgRef = useRef(null); const drag = useRef(null);
  useEffect(() => { setVb({ x: 0, y: 0, w: fullW, h: fullH }); }, [fullW, fullH]);
  const vbRef = useRef(vb); vbRef.current = vb;
  const zoomAt = useCallback((factor, cx, cy) => {
    setVb((v) => {
      const nw = Math.min(fullW * 1.5, Math.max(fullW / 10, v.w * factor));
      const k = nw / v.w; const nh = v.h * k;
      const px = cx ?? v.x + v.w / 2; const py = cy ?? v.y + v.h / 2;
      return { x: px - (px - v.x) * k, y: py - (py - v.y) * k, w: nw, h: nh };
    });
  }, [fullW]);
  useEffect(() => {
    const el = svgRef.current; if (!el) return undefined;
    const onWheel = (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); const v = vbRef.current; zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, v.x + ((e.clientX - r.left) / r.width) * v.w, v.y + ((e.clientY - r.top) / r.height) * v.h); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);
  const onDown = (e) => { drag.current = { sx: e.clientX, sy: e.clientY, v: vb }; };
  const onMove = (e) => { const d = drag.current; if (!d) return; const r = svgRef.current.getBoundingClientRect(); setVb({ ...d.v, x: d.v.x - ((e.clientX - d.sx) / r.width) * d.v.w, y: d.v.y - ((e.clientY - d.sy) / r.height) * d.v.h }); };
  const onUp = () => { drag.current = null; };
  const zoomPct = Math.round((fullW / vb.w) * 100);
  const fine = zoomPct >= 180;

  // ofis masaları
  const desks = useMemo(() => {
    if (!fp.desks) return [];
    const open = fp.rects.find((r) => r.kind === 'open'); if (!open) return [];
    const blocks = fp.rects.filter((r) => !['open', 'unit'].includes(r.kind));
    const out = [];
    for (let x = open.x + 1.2; x + 1.6 < open.x + open.w - 0.6; x += 3.2) {
      for (let y = open.y + 1.2; y + 0.8 < open.y + open.h - 0.8; y += 2.4) {
        if (!blocks.some((b) => x < b.x + b.w + 0.8 && x + 1.6 > b.x - 0.8 && y < b.y + b.h + 0.8 && y + 0.8 > b.y - 0.8)) out.push({ x, y });
      }
    }
    return out;
  }, [fp]);

  const fontFor = (r) => Math.min((r.w * s) / Math.max(4, (r.label || '').length * 0.62), r.h * s * 0.32, 13);

  return (
    <div>
      <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>Mərtəbə</span>
          {floors.map((f) => (
            <button key={f.level} type="button" className={`chip${f.level === level ? ' on' : ''}`} style={{ boxShadow: 'none', border: '1px solid var(--line-2)', minWidth: 44, padding: '6px 10px' }} onClick={() => setLevel(f.level)} title={f.name}>
              {f.short}
            </button>
          ))}
        </div>
        <strong style={{ fontSize: 16 }}>{cur?.name}</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>Sistem qatları</span>
          {LAYERS.map((l) => (
            <button key={l.id} type="button" className={`chip${layers.includes(l.id) ? ' on' : ''}`} style={{ boxShadow: 'none', border: `1px solid ${l.color}`, padding: '6px 10px' }} onClick={() => toggleLayer(l.id)}>
              <i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 9, background: l.color, marginRight: 6 }} />{l.name}
            </button>
          ))}
          <button type="button" className="chip" style={{ boxShadow: 'none', border: '1px solid var(--line-2)', padding: '6px 10px' }} onClick={() => setLayers(layers.length ? [] : LAYERS.map((l) => l.id))}>{layers.length ? 'Gizlət' : 'Hamısı'}</button>
        </div>
      </div>

      <div className="stage" style={{ padding: 16, minHeight: 0, position: 'relative', marginTop: 8 }}>
        <div className="stage-tools" style={{ left: 'auto', right: 12, top: 12, zIndex: 2 }}>
          <button type="button" className="chip" onClick={() => zoomAt(1 / 1.3)} aria-label="Yaxınlaşdır">＋</button>
          <button type="button" className="chip" onClick={() => zoomAt(1.3)} aria-label="Uzaqlaşdır">－</button>
          <button type="button" className="chip" onClick={() => setVb({ x: 0, y: 0, w: fullW, h: fullH })}>↺ {zoomPct}%</button>
        </div>
        <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 640, cursor: 'grab', touchAction: 'none', userSelect: 'none', background: '#fff' }} role="img" aria-label={cur?.name}>
          <g transform={`translate(${pad} ${pad})`}>
            {rects.map((r, i) => {
              const tc = r.kind === 'core' ? '#FFFFFF' : '#2B3238';
              const fs = fontFor(r);
              const show = r.label && (fs >= 7 || fine) && r.w * s > 26 && r.h * s > 14;
              const big = r.w * s > 70 && r.h * s > 40;
              const cx = r.x * s + (r.w * s) / 2;
              return (
                <g key={i}>
                  <rect x={r.x * s} y={r.y * s} width={r.w * s} height={r.h * s} fill={FILL[r.kind] || '#fff'} stroke={r.kind === 'slab' ? '#B9BCB5' : '#8A9096'} strokeWidth={r.kind === 'esc' ? 0.5 : 1} />
                  {r.kind === 'esc' && Array.from({ length: Math.floor((r.h * s) / 6) }).map((_, k) => <line key={k} x1={r.x * s} x2={(r.x + r.w) * s} y1={r.y * s + k * 6} y2={r.y * s + k * 6} stroke="#7E8F9B" strokeWidth="0.6" />)}
                  {r.kind === 'ramp' && <path d={`M${cx} ${(r.y + r.h - 1) * s} L${cx} ${(r.y + 1) * s} M${cx - 0.8 * s} ${(r.y + 2) * s} L${cx} ${(r.y + 1) * s} L${cx + 0.8 * s} ${(r.y + 2) * s}`} stroke="#5B6168" fill="none" strokeWidth="1.5" />}
                  {show && r.kind !== 'esc' && r.kind !== 'slab' && (
                    <text x={cx} y={r.y * s + (r.h * s) / 2 + (big && r.area ? -2 : 4)} textAnchor="middle" fontSize={Math.max(fs, fine ? 5 : 7)} fontFamily="IBM Plex Sans, sans-serif" fontWeight="500" fill={tc}>
                      {r.label}
                      {big && r.area > 0 && <tspan x={cx} dy={Math.max(fs, 7) + 2} fontSize={Math.max(fs - 2, 6)} fill={r.kind === 'core' ? '#C9CDD1' : '#6A7178'} fontFamily="IBM Plex Mono, monospace">{Math.round(r.area)} m²</tspan>}
                    </text>
                  )}
                </g>
              );
            })}
            {(fp.stalls || []).map((p, i) => (
              <g key={`p${i}`}>
                <rect x={p.x * s} y={p.y * s} width={p.w * s} height={p.h * s} fill={p.acc ? '#DCE8F1' : '#FFFFFF'} stroke="#9AA1A8" strokeWidth="0.8" />
                <text x={(p.x + p.w / 2) * s} y={(p.y + p.h / 2) * s + 3} textAnchor="middle" fontSize="7" fontFamily="IBM Plex Mono, monospace" fill={p.acc ? '#2F6F9F' : '#9AA1A8'}>{p.acc ? '♿' : i + 1}</text>
              </g>
            ))}
            {(fp.tables || []).map((t, i) => (
              <g key={`t${i}`}>
                <circle cx={t.x * s} cy={t.y * s} r={0.45 * s} fill="#E8D7B5" stroke="#B89A6A" strokeWidth="0.8" />
                {[[-1, 0], [1, 0], [0, -1], [0, 1]].map(([a, b], k) => <circle key={k} cx={(t.x + a * 0.75) * s} cy={(t.y + b * 0.75) * s} r={0.2 * s} fill="#fff" stroke="#B89A6A" strokeWidth="0.6" />)}
              </g>
            ))}
            {desks.map((d, i) => (
              <g key={`d${i}`}>
                <rect x={d.x * s} y={d.y * s} width={1.6 * s} height={0.8 * s} fill="#EDEFF1" stroke="#8A9096" strokeWidth="0.7" />
                <circle cx={(d.x + 0.8) * s} cy={(d.y + 1.15) * s} r={0.25 * s} fill="#fff" stroke="#8A9096" strokeWidth="0.6" />
              </g>
            ))}
            {unitRects.map((u, i) => <rect key={`u${i}`} x={u.x * s} y={u.y * s} width={u.w * s} height={u.h * s} fill="none" stroke="#15181B" strokeWidth="3" />)}
            {unitRects.map((u, i) => {
              const top = fp.rects.some((r) => r.kind === 'corridor' && r.y > u.y);
              const y = top ? u.y * s + 13 : u.y * s + u.h * s - 7;
              return <text key={`l${i}`} x={u.x * s + 6} y={y} fontSize="10" fontFamily="IBM Plex Mono, monospace" fontWeight="600" fill="#C2410C">{u.w * s > 120 ? `${LETTERS[i % 26]} · ${u.label}` : LETTERS[i % 26]}</text>;
            })}
            {ov.filter((o) => layers.includes(o.layer)).map((o, i) => <Sym key={`m${i}`} o={o} s={s} fine={fine} />)}
            <rect x="0" y="0" width={W} height={H} fill="none" stroke="#15181B" strokeWidth="4" />
            <line x1="0" y1={H + 12} x2={W} y2={H + 12} stroke="#5B6168" />
            <text x={W / 2} y={H + 26} textAnchor="middle" fontSize="11" fontFamily="IBM Plex Mono, monospace" fill="#5B6168">CƏNUB · {level < 0 ? 'yeraltı' : 'əsas fasad'} · {dw.toFixed(1)} m</text>
            <g transform={`translate(${W + 24} 16)`}>
              <circle r="14" fill="#fff" stroke="#5B6168" />
              <path d="M0 -10 L5 4 L0 1 L-5 4 Z" fill="#15181B" />
              <text y="-19" textAnchor="middle" fontSize="11" fontFamily="IBM Plex Mono, monospace">Ş</text>
            </g>
            <text x={W + 12} y={H / 2} fontSize="11" fontFamily="IBM Plex Mono, monospace" fill="#5B6168" transform={`rotate(90 ${W + 12} ${H / 2})`} textAnchor="middle">{dh.toFixed(1)} m</text>
          </g>
        </svg>
      </div>
      <div className="legend" style={{ border: 0, borderTop: '1px solid var(--line)' }}>
        {kinds.map((k) => <span key={k}><i className="sw" style={{ background: FILL[k], borderColor: '#8a9096' }} />{LEGEND[k]}</span>)}
        {fp.stalls && <span><i className="sw" style={{ background: '#DCE8F1', borderColor: '#8a9096' }} />Əlçatan yer</span>}
        {LAYERS.filter((l) => layers.includes(l.id)).flatMap((l) => l.legend.map((g) => <span key={l.id + g.t}><svg width="16" height="16" viewBox="-8 -8 16 16" style={{ verticalAlign: 'middle', marginRight: 4 }}><Sym o={{ ...g, x: 0, y: 0, legend: true }} s={1} fine /></svg>{g.label}</span>))}
        <span className="note" style={{ marginLeft: 'auto' }}>Təkərlə yaxınlaşdırın · sürüşdürərək hərəkət etdirin</span>
      </div>
      {layers.length > 0 && (
        <table className="table">
          <thead><tr><th>Bu mərtəbədə mühəndis elementləri</th><th className="r">Say</th></tr></thead>
          <tbody>
            {Object.entries(ov.filter((o) => layers.includes(o.layer)).reduce((a, o) => { const k = LAYERS.find((l) => l.id === o.layer).legend.find((g) => g.t === o.t)?.label || o.t; a[k] = (a[k] || 0) + 1; return a; }, {})).map(([k, n]) => <tr key={k}><td>{k}</td><td className="r">{n}</td></tr>)}
          </tbody>
        </table>
      )}
      <table className="table">
        <thead><tr><th>Bu mərtəbədə</th><th className="r">Say</th><th className="r">Sahə</th></tr></thead>
        <tbody>
          {summary.map((x) => <tr key={x.k}><td>{x.k}</td><td className="r">{x.n}</td><td className="r">{x.a ? `${x.a} m²` : '—'}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

// Mühəndis simvolları (metrlə koordinatlar, s = miqyas)
function Sym({ o, s, fine }) {
  const x = o.x * s; const y = o.y * s;
  const k = o.legend ? 1 : Math.max(0.55, Math.min(1.1, s / 20));
  const T = (txt, c, fs = 6.5) => <text x={x} y={y + fs * 0.36 * k} textAnchor="middle" fontSize={fs * k} fontFamily="IBM Plex Mono, monospace" fontWeight="700" fill={c}>{txt}</text>;
  switch (o.t) {
    case 'ws': return <g><circle cx={x} cy={y} r={5 * k} fill="#E3F2FD" stroke="#1E88E5" strokeWidth={1.2} />{T('S', '#1565C0')}</g>;
    case 'ks': return <g><circle cx={x} cy={y} r={5 * k} fill="#EFEBE9" stroke="#6D4C41" strokeWidth={1.2} />{T('K', '#4E342E')}</g>;
    case 'cd': return <g><circle cx={x} cy={y} r={3.2 * k} fill="#fff" stroke="#00897B" strokeWidth={1} strokeDasharray="1.5 1" /></g>;
    case 'rd': return <g><rect x={x - 4 * k} y={y - 4 * k} width={8 * k} height={8 * k} fill="#E3F2FD" stroke="#1E88E5" />{T('Y', '#1565C0', 5.5)}</g>;
    case 'pn': return <g><rect x={x - 5 * k} y={y - 3.5 * k} width={10 * k} height={7 * k} fill="#FFF8E1" stroke="#F9A825" strokeWidth={1.2} /><path d={`M${x + 1 * k} ${y - 2.5 * k} L${x - 1.5 * k} ${y + 0.3 * k} L${x + 1 * k} ${y + 0.3 * k} L${x - 1 * k} ${y + 2.8 * k}`} stroke="#E65100" fill="none" strokeWidth={0.9} /></g>;
    case 'ml': return <g><rect x={x - 7 * k} y={y - 4.5 * k} width={14 * k} height={9 * k} fill="#F9A825" stroke="#8D6E00" />{T('ML', '#3E2723', 5.5)}</g>;
    case 'lt': return <circle cx={x} cy={y} r={2.2 * k} fill="#FFF59D" stroke="#F9A825" strokeWidth={0.8} />;
    case 'ac': return <g><rect x={x - 9 * k} y={y - 2.5 * k} width={18 * k} height={5 * k} rx={1.5 * k} fill="#E0F2F1" stroke="#00897B" strokeWidth={1.1} /><line x1={x - 6 * k} x2={x + 6 * k} y1={y + 0.8 * k} y2={y + 0.8 * k} stroke="#00897B" strokeWidth={0.7} /></g>;
    case 'cs': return <g><rect x={x - 6 * k} y={y - 6 * k} width={12 * k} height={12 * k} fill="#E0F2F1" stroke="#00897B" strokeWidth={1.1} /><path d={`M${x - 6 * k} ${y - 6 * k} L${x + 6 * k} ${y + 6 * k} M${x + 6 * k} ${y - 6 * k} L${x - 6 * k} ${y + 6 * k}`} stroke="#00897B" strokeWidth={0.6} /></g>;
    case 'vx': return <g><circle cx={x} cy={y} r={4 * k} fill="#fff" stroke="#00897B" strokeWidth={1} /><path d={`M${x - 2.5 * k} ${y} L${x + 2.5 * k} ${y} M${x} ${y - 2.5 * k} L${x} ${y + 2.5 * k}`} stroke="#00897B" strokeWidth={0.8} /></g>;
    case 'sd': return <g><circle cx={x} cy={y} r={3.4 * k} fill="#FFEBEE" stroke="#C62828" strokeWidth={1} /><circle cx={x} cy={y} r={1 * k} fill="#C62828" /></g>;
    case 'sp': return <g><path d={`M${x - 2.4 * k} ${y - 2.4 * k} L${x + 2.4 * k} ${y + 2.4 * k} M${x + 2.4 * k} ${y - 2.4 * k} L${x - 2.4 * k} ${y + 2.4 * k}`} stroke="#E53935" strokeWidth={1.1} /></g>;
    case 'pk': return <g><rect x={x - 6 * k} y={y - 4.5 * k} width={12 * k} height={9 * k} fill="#C62828" stroke="#7F0000" />{T('PK', '#fff', 5.5)}</g>;
    case 'ex': return <g><rect x={x - 7 * k} y={y - 3.5 * k} width={14 * k} height={7 * k} fill="#2E7D32" />{T('ÇIX', '#fff', 4.6)}</g>;
    case 'gs': return <g><circle cx={x} cy={y} r={4.5 * k} fill="#FFF3E0" stroke="#EF6C00" strokeWidth={1.2} />{T('Q', '#E65100')}</g>;
    default: return null;
  }
}

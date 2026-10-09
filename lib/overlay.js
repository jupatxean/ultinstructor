// Mərtəbə planı üzərində mühəndis sistemləri qatları (koordinatlar metrlə)
export const LAYERS = [
  { id: 'su', name: 'Su və kanalizasiya', color: '#1E88E5', legend: [{ t: 'ws', label: 'Su stoyağı' }, { t: 'ks', label: 'Kanalizasiya stoyağı' }, { t: 'cd', label: 'Kondensat stoyağı' }, { t: 'rd', label: 'Dam su qıfı' }] },
  { id: 'elek', name: 'Elektrik və işıq', color: '#F9A825', legend: [{ t: 'ml', label: 'Mərtəbə elektrik lövhəsi' }, { t: 'pn', label: 'Mənzil / icarəçi lövhəsi + sayğac' }, { t: 'lt', label: 'İşıqlandırıcı' }] },
  { id: 'hvac', name: 'İstilik, soyutma, ventilyasiya', color: '#00897B', legend: [{ t: 'ac', label: 'Kondisioner daxili bloku' }, { t: 'cs', label: 'Kaset / diffuzor' }, { t: 'vx', label: 'Sorma ventilyasiyası' }] },
  { id: 'yangin', name: 'Yanğın təhlükəsizliyi', color: '#C62828', legend: [{ t: 'sd', label: 'Tüstü detektoru' }, { t: 'sp', label: 'Sprinkler' }, { t: 'pk', label: 'Yanğın kranı şkafı' }, { t: 'ex', label: 'Çıxış işarəsi' }] },
  { id: 'qaz', name: 'Qaz', color: '#EF6C00', legend: [{ t: 'gs', label: 'Qaz sayğacı + detektor' }] },
];

const WET = ['wet', 'wc', 'kitchen'];
const SKIP_DET = ['core', 'esc', 'atrium', 'slab', 'ramp', 'unit'];

function grid(r, step, inset = 0) {
  const pts = [];
  const nx = Math.max(1, Math.round((r.w - inset * 2) / step)); const ny = Math.max(1, Math.round((r.h - inset * 2) / step));
  const dx = (r.w - inset * 2) / nx; const dy = (r.h - inset * 2) / ny;
  for (let i = 0; i < nx; i += 1) for (let j = 0; j < ny; j += 1) pts.push({ x: r.x + inset + dx * (i + 0.5), y: r.y + inset + dy * (j + 0.5) });
  return pts;
}

export function mepOverlay(fp, sys, level, result) {
  const out = [];
  const add = (layer, t, x, y) => out.push({ layer, t, x, y });
  const dims = fp.dims || { w: result.site.fw, h: result.site.fd };
  const rects = fp.rects;
  const c = sys.ctx;
  const top = level === result.input.floors;
  const isPark = fp.role === 'parking';
  const resi = fp.role === 'residential';

  // --- Su / kanalizasiya ---
  rects.filter((r) => WET.includes(r.kind)).forEach((r) => {
    add('su', 'ks', r.x + Math.min(0.6, r.w * 0.25), r.y + Math.min(0.6, r.h * 0.3));
    add('su', 'ws', r.x + Math.min(1.5, r.w * 0.6), r.y + Math.min(0.6, r.h * 0.3));
  });
  // kondensat stoyağı: hər mənzildə / hər xidmət zonasında 1
  rects.filter((r) => r.kind === 'unit').forEach((u) => add('su', 'cd', u.x + 0.5, u.y + u.h / 2));
  if (top && !isPark) {
    const n = Math.max(2, Math.ceil((dims.w * dims.h) / 250));
    const cols = Math.ceil(n / 2);
    for (let i = 0; i < n; i += 1) add('su', 'rd', (dims.w / (cols + 1)) * ((i % cols) + 1), i < cols ? dims.h * 0.25 : dims.h * 0.75);
  }

  // --- Elektrik ---
  rects.filter((r) => r.kind === 'core').forEach((r) => add('elek', 'ml', r.x + r.w - 1.2, r.y + 0.9));
  rects.filter((r) => r.kind === 'unit').forEach((u) => {
    const corrBelow = rects.some((k) => (k.kind === 'corridor' || k.kind === 'lobby') && k.y >= u.y + u.h - 0.1);
    add('elek', 'pn', u.x + u.w - 0.8, corrBelow ? u.y + u.h - 0.5 : u.y + 0.5);
  });
  rects.filter((r) => ['shop', 'anchor', 'food', 'kitchen', 'office', 'meeting'].includes(r.kind) && !resi).forEach((r) => add('elek', 'pn', r.x + 0.7, r.y + 0.6));
  rects.filter((r) => ['corridor', 'walk', 'lobby'].includes(r.kind)).forEach((r) => {
    const n = Math.max(1, Math.round(Math.max(r.w, r.h) / 5));
    for (let i = 0; i < n; i += 1) add('elek', 'lt', r.w >= r.h ? r.x + (r.w / n) * (i + 0.5) : r.x + r.w / 2, r.w >= r.h ? r.y + r.h / 2 : r.y + (r.h / n) * (i + 0.5));
  });
  if (isPark) grid({ x: 0, y: 0, w: dims.w, h: dims.h }, 6).forEach((p) => add('elek', 'lt', p.x, p.y));

  // --- HVAC ---
  rects.filter((r) => r.kind === 'room').forEach((r) => {
    const toTop = r.y; const toBot = dims.h - (r.y + r.h);
    add('hvac', 'ac', r.x + r.w / 2, toTop <= toBot ? r.y + 0.35 : r.y + r.h - 0.35);
  });
  rects.filter((r) => ['open', 'shop', 'anchor', 'walk', 'food', 'lobby', 'meeting', 'office'].includes(r.kind)).forEach((r) => {
    const step = r.kind === 'open' || r.kind === 'anchor' || r.kind === 'walk' || r.kind === 'food' ? 6 : 5;
    if (r.w < 2.5 || r.h < 2.5) return;
    grid(r, step, 0.5).forEach((p) => {
      if (rects.some((b) => ['core', 'atrium', 'esc', 'wet', 'meeting', 'hall'].includes(b.kind) && b !== r && p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h)) return;
      add('hvac', 'cs', p.x, p.y);
    });
  });
  rects.filter((r) => WET.includes(r.kind)).forEach((r) => add('hvac', 'vx', r.x + r.w - Math.min(0.7, r.w * 0.3), r.y + r.h - Math.min(0.7, r.h * 0.3)));
  if (isPark) grid({ x: 0, y: 0, w: dims.w, h: dims.h }, 12).forEach((p) => add('hvac', 'vx', p.x, p.y));

  // --- Yanğın ---
  rects.filter((r) => !SKIP_DET.includes(r.kind) && r.kind !== 'wet').forEach((r) => {
    if (r.w * r.h > 70) grid(r, 8).forEach((p) => add('yangin', 'sd', p.x, p.y));
    else add('yangin', 'sd', r.x + r.w / 2, r.y + Math.min(r.h / 2, 0.9));
  });
  const sprinkKinds = c.sprinkFull ? null : c.sprinkCommon ? ['corridor', 'lobby', 'walk'] : [];
  const sprinkTargets = isPark ? [{ x: 0, y: 0, w: dims.w, h: dims.h }] : rects.filter((r) => !['core', 'esc', 'slab', 'ramp', 'unit', 'atrium'].includes(r.kind) && (sprinkKinds === null || sprinkKinds.includes(r.kind)));
  let sp = [];
  sprinkTargets.forEach((r) => { sp = sp.concat(grid(r, 3.5)); });
  if (sp.length > 1600) sp = sp.filter((_, i) => i % 2 === 0);
  sp.forEach((p) => add('yangin', 'sp', p.x + 0.35, p.y + 0.35));
  rects.filter((r) => r.kind === 'core').forEach((r) => {
    if (sys.list.find((s) => s.id === 'su').hyd) add('yangin', 'pk', r.x + 1.0, r.y + r.h - 0.8);
    add('yangin', 'ex', r.x + r.w / 2, r.y + r.h - 0.5);
  });

  // --- Qaz (yalnız ≤ 28 m yaşayışda mətbəxlərə) ---
  if (c.gasApt && (resi)) rects.filter((r) => r.kind === 'wet' && /Mətbəx/.test(r.label)).forEach((r) => add('qaz', 'gs', r.x + r.w - 0.6, r.y + r.h / 2));
  return out;
}

// Mərtəbə-mərtəbə plan generatoru: hər mərtəbənin funksiyasına uyğun ayrıca plan
import { generatePlan } from './engine';

export function ordinal(n) {
  const d = n % 10;
  if (d === 0) {
    const t = Math.floor(n / 10) % 10;
    return { 1: 'cu', 2: 'ci', 3: 'cu', 4: 'cı', 5: 'ci', 6: 'cı', 7: 'ci', 8: 'ci', 9: 'cı', 0: 'cü' }[t];
  }
  return { 1: 'ci', 2: 'ci', 3: 'cü', 4: 'cü', 5: 'ci', 6: 'cı', 7: 'ci', 8: 'ci', 9: 'cu' }[d];
}

export function floorList(r) {
  const L = [];
  for (let b = r.input.basements; b >= 1; b -= 1) L.push({ level: -b, short: `−${b}`, name: `${b}-${ordinal(b)} yeraltı mərtəbə (parkinq)` });
  const f = r.input.floors;
  for (let i = 1; i <= f; i += 1) {
    const role = floorRole(r, i);
    L.push({ level: i, short: `${i}`, name: `${i}-${ordinal(i)} mərtəbə · ${ROLE_NAME[role]}` });
  }
  return L;
}

const ROLE_NAME = {
  'mall-ground': 'giriş, supermarket, mağazalar',
  'mall-typical': 'mağazalar',
  'mall-food': 'yemək zalı',
  'res-ground': 'lobbi və ticarət obyektləri',
  residential: 'mənzillər',
  'mixed-ground': 'mağazalar',
  'office-ground': 'lobbi, resepsiya, kafe',
  office: 'ofislər',
  'hotel-ground': 'lobbi, restoran',
  hotel: 'otel otaqları',
  parking: 'parkinq',
};

export function floorRole(r, level) {
  if (level < 0) return 'parking';
  const f = r.input.func; const n = r.input.floors;
  if (f === 'ticaret') return level === 1 ? 'mall-ground' : level === n && n >= 2 ? 'mall-food' : 'mall-typical';
  if (f === 'qarisiq') return level === 1 ? 'mixed-ground' : 'residential';
  if (f === 'yasayis') return level === 1 ? 'res-ground' : 'residential';
  if (f === 'ofis') return level === 1 ? 'office-ground' : 'office';
  if (f === 'otel') return level === 1 ? 'hotel-ground' : 'hotel';
  return 'residential';
}

const area = (o) => Math.round(o.w * o.h);
const R = (x, y, w, h, kind, label, extra = {}) => ({ x, y, w, h, kind, label, area: Math.round(w * h), ...extra });

function splitRow(out, x0, x1, y, h, kind, prefix, counter, target = 7) {
  const L = x1 - x0; if (L < 2) return;
  const n = Math.max(1, Math.round(L / target));
  const w = L / n;
  for (let i = 0; i < n; i += 1) {
    counter.n += 1;
    out.push(R(x0 + i * w, y, w, h, kind, `${prefix} ${counter.n}`));
  }
}

function endBlocks(out, fw, fd, cw) {
  [[0, 'L'], [fw - cw, 'R']].forEach(([x0, side]) => {
    const h1 = fd * 0.34; const h2 = fd * 0.2; const h3 = fd * 0.2; const h4 = fd - h1 - h2 - h3;
    out.push(R(x0, 0, cw, h1, 'core', 'Lift + pilləkən'));
    out.push(R(x0, h1, cw, h2, 'wc', 'WC kişi'));
    out.push(R(x0, h1 + h2, cw, h3, 'wc', side === 'L' ? 'WC qadın' : 'WC qadın + əlil'));
    out.push(R(x0, h1 + h2 + h3, cw, h4, side === 'L' ? 'storage' : 'tech', side === 'L' ? 'Anbar + yükləmə' : 'Texniki otaq'));
  });
}

function mall(fw, fd, mode) {
  const out = []; const c = { n: 0 };
  const cw = Math.min(8, Math.max(5, fw * 0.16));
  endBlocks(out, fw, fd, cw);
  const x0 = cw; const x1 = fw - cw; const L = x1 - x0;
  const two = fd >= 16;
  const sd = two ? Math.min(9, fd * 0.3) : Math.min(9, fd * 0.5);
  const walkY = two ? sd : 0; const walkH = two ? fd - 2 * sd : fd - sd;
  const southY = fd - sd;

  if (mode === 'food') {
    const cafes = { n: 0 };
    splitRow(out, x0, x1, 0, Math.min(6, sd), 'kitchen', 'Kafe', cafes, 4.5);
    const hall = R(x0, Math.min(6, sd), L, fd - Math.min(6, sd), 'food', 'Yemək zalı');
    out.push(hall);
    if (L > 18 && fd > 14) out.push(R(x1 - Math.min(10, L * 0.25), fd - Math.min(8, fd * 0.35), Math.min(10, L * 0.25), Math.min(8, fd * 0.35), 'play', 'Uşaq əyləncə zonası'));
    return { rects: out, tables: tablesIn(hall, out) };
  }

  // gəzinti zolağı və atrium
  out.push(R(x0, walkY, L, walkH, 'walk', 'Gəzinti zolağı'));
  if (walkH >= 6) {
    const aw = Math.min(L * 0.32, 14); const ah = walkH * 0.6;
    const ax = x0 + (L - aw) / 2; const ay = walkY + (walkH - ah) / 2;
    out.push(R(ax, ay, aw, ah, 'atrium', 'Atrium'));
    out.push(R(ax + 0.6, ay + 0.4, 1.4, ah - 0.8, 'esc', 'Eskalator'));
    out.push(R(ax + aw - 2.0, ay + 0.4, 1.4, ah - 0.8, 'esc', 'Eskalator'));
  }
  if (mode === 'ground') {
    if (two) {
      const aL = L * 0.45;
      out.push(R(x0, 0, aL, sd, 'anchor', 'Supermarket'));
      splitRow(out, x0 + aL, x1, 0, sd, 'shop', 'Mağaza', c);
    }
    const ew = Math.min(9, L * 0.2); const ex = x0 + (L - ew) / 2;
    splitRow(out, x0, ex, southY, sd, 'shop', 'Mağaza', c);
    out.push(R(ex, southY, ew, sd, 'lobby', 'Əsas giriş'));
    splitRow(out, ex + ew, x1, southY, sd, 'shop', 'Mağaza', c);
  } else {
    if (two) splitRow(out, x0, x1, 0, sd, 'shop', 'Mağaza', c);
    splitRow(out, x0, x1, southY, sd, 'shop', 'Mağaza', c);
  }
  return { rects: out };
}

function tablesIn(hall, blocks) {
  const t = [];
  for (let x = hall.x + 1.5; x < hall.x + hall.w - 1; x += 2.6) {
    for (let y = hall.y + 1.6; y < hall.y + hall.h - 1; y += 2.6) {
      if (!blocks.some((b) => b.kind === 'play' && x > b.x - 1 && x < b.x + b.w + 1 && y > b.y - 1 && y < b.y + b.h + 1)) t.push({ x, y });
    }
  }
  return t;
}

function parking(site, level, basements) {
  const bw = Math.max(site.fw, Math.min(site.W - 1, site.fw * 1.15));
  const bd = Math.max(site.fd, Math.min(site.D - 1, site.fd * 1.15));
  const out = [R(0, 0, bw, bd, 'slab', '')];
  const rampH = Math.min(16, bd * 0.6);
  out.push(R(bw - 4.5, bd - rampH, 4.5, rampH, 'ramp', level === -1 ? 'Rampa ↑ çıxış' : 'Rampa'));
  const core = R(bw / 2 - 3.5, bd / 2 - 3, 7, 6, 'core', 'Lift + pilləkən');
  out.push(core);
  const techNames = level === -1 ? ['Elektrik', 'Su nasosu', 'Generator', 'Yanğın stansiyası'] : level === -basements ? ['Su çəni', 'Drenaj nasosu', 'Anbar'] : ['Anbar', 'Ventilyasiya'];
  let tx = 0;
  techNames.forEach((n) => { if (tx + 4 <= bw - 5) { out.push(R(tx, 0, 4, 4, 'tech', n)); tx += 4; } });
  const blocks = out.filter((o) => o.kind !== 'slab');
  const stalls = [];
  const hit = (x, y, w, h) => blocks.some((b) => x < b.x + b.w + 0.3 && x + w > b.x - 0.3 && y < b.y + b.h + 0.3 && y + h > b.y - 0.3);
  for (let y = 4.6; y + 5 <= bd; y += 16) {
    [y, y + 11].forEach((sy) => {
      if (sy + 5 > bd) return;
      for (let x = 0.3; x + 2.5 <= bw - 0.3; x += 2.5) if (!hit(x, sy, 2.5, 5)) stalls.push({ x, y: sy, w: 2.5, h: 5 });
    });
  }
  // əlçatan yerlər: liftə ən yaxın 2 yer
  const cx = core.x + core.w / 2; const cy = core.y + core.h / 2;
  const near = [...stalls].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, 2);
  near.forEach((s) => { s.acc = true; });
  return { rects: out, stalls, dims: { w: bw, h: bd } };
}

function relabelGround(typical, kind, prefix, extras) {
  const out = []; const c = { n: 0 };
  const units = typical.rects.filter((x) => x.kind === 'unit');
  typical.rects.forEach((x) => {
    if (x.kind === 'corridor') out.push({ ...x, kind: 'lobby', label: 'Lobbi' });
    else if (x.kind === 'core' || x.kind === 'tech') out.push({ ...x });
  });
  units.forEach((u, i) => {
    const ex = extras[i];
    if (ex) { out.push(R(u.x, u.y, u.w, u.h, ex.kind, ex.label)); return; }
    c.n += 1;
    out.push(R(u.x, u.y, u.w, u.h, kind, `${prefix} ${c.n}`));
    const s = Math.min(2.2, u.w * 0.35, u.h * 0.35);
    const towardCorr = typical.rects.some((k) => k.kind === 'corridor' && k.y > u.y);
    out.push(R(u.x + u.w - s, towardCorr ? u.y + u.h - s : u.y, s, s, 'wc', 'WC'));
  });
  return { rects: out };
}

export function floorPlan(r, level) {
  const role = floorRole(r, level);
  const { fw, fd } = r.site;
  const q = r.input.quality; const floors = r.input.floors;
  if (role === 'parking') return { role, ...parking(r.site, level, r.input.basements) };
  if (role.startsWith('mall')) return { role, ...mall(fw, fd, role === 'mall-ground' ? 'ground' : role === 'mall-food' ? 'food' : 'typical'), dims: { w: fw, h: fd } };
  if (role === 'residential') return { role, rects: r.plan.rects, dims: { w: fw, h: fd } };
  if (role === 'hotel') return { role, rects: generatePlan(fw, fd, 'otel', q, floors).rects, dims: { w: fw, h: fd } };
  const typical = generatePlan(fw, fd, r.input.func === 'otel' ? 'otel' : r.input.func === 'ofis' ? 'ofis' : 'yasayis', q, floors);
  if (role === 'res-ground') {
    const ex = { 0: { kind: 'storage', label: 'Sakinlər üçün anbar' }, 1: { kind: 'lobby', label: 'Konsyerj + poçt qutuları' } };
    return { role, ...relabelGround(typical, 'shop', 'Ticarət obyekti', ex), dims: { w: fw, h: fd } };
  }
  if (role === 'mixed-ground') {
    const n = typical.rects.filter((x) => x.kind === 'unit').length;
    const ex = { [n - 1]: { kind: 'storage', label: 'Anbar + yükləmə' } };
    return { role, ...relabelGround(typical, 'shop', 'Mağaza', ex), dims: { w: fw, h: fd } };
  }
  if (role === 'hotel-ground') {
    const names = [['lobby', 'Lobbi + resepsiya'], ['food', 'Restoran'], ['kitchen', 'Mətbəx'], ['meeting', 'Konfrans zalı'], ['wc', 'WC kişi / qadın'], ['storage', 'Baqaj otağı'], ['office', 'Administrasiya'], ['tech', 'Camaşırxana'], ['shop', 'Suvenir mağazası'], ['meeting', 'Biznes mərkəzi']];
    const out = [];
    typical.rects.forEach((x) => { if (x.kind === 'corridor') out.push({ ...x, kind: 'walk', label: 'Dəhliz' }); else if (x.kind === 'core') out.push({ ...x }); });
    typical.rects.filter((x) => x.kind === 'unit').forEach((u, i) => { const [k, l] = names[i % names.length]; out.push(R(u.x, u.y, u.w, u.h, k, l)); });
    return { role, rects: out, dims: { w: fw, h: fd } };
  }
  if (role === 'office-ground' || role === 'office') {
    const ground = role === 'office-ground';
    const map = ground
      ? { open: ['lobby', 'Lobbi və gözləmə zonası'], meeting: ['food', 'Kafe'], wet: ['wc', 'WC kişi / qadın'], hall: ['office', 'Resepsiya + təhlükəsizlik'] }
      : { open: ['open', 'Açıq ofis sahəsi'], meeting: ['meeting', 'İclas otağı'], wet: ['wc', 'WC kişi / qadın'], hall: ['kitchen', 'Mətbəxçə'] };
    const out = typical.rects.map((x) => (map[x.kind] ? { ...x, kind: map[x.kind][0], label: map[x.kind][1], area: area(x) } : { ...x }));
    if (!ground) {
      const core = out.find((x) => x.kind === 'core');
      if (core) out.push(R(core.x, core.y + core.h, Math.min(4, core.w), 3, 'tech', 'Server otağı'));
    }
    return { role, rects: out, dims: { w: fw, h: fd }, desks: ground ? null : true };
  }
  return { role, rects: r.plan.rects, dims: { w: fw, h: fd } };
}

export function floorSummary(fp) {
  const rows = new Map();
  const add = (k, a) => { const v = rows.get(k) || { n: 0, a: 0 }; v.n += 1; v.a += a; rows.set(k, v); };
  const NAME = { shop: 'Mağaza / ticarət obyekti', anchor: 'Supermarket', wc: 'WC', storage: 'Anbar', tech: 'Texniki otaq', kitchen: 'Kafe / mətbəx', food: 'Yemək / restoran zalı', lobby: 'Lobbi / giriş', meeting: 'İclas / konfrans', office: 'Ofis xidməti', open: 'Açıq ofis', play: 'Uşaq zonası', atrium: 'Atrium', esc: 'Eskalator', ramp: 'Rampa' };
  fp.rects.forEach((x) => {
    if (x.kind === 'unit') add(x.unitType === 'otel' ? 'Otel otağı' : `${x.unitType} otaqlı mənzil`, x.area);
    else if (NAME[x.kind]) add(NAME[x.kind], x.area || area(x));
  });
  if (fp.stalls) rows.set('Parkinq yeri', { n: fp.stalls.length, a: fp.stalls.length * 12.5 });
  if (fp.tables) rows.set('Masa (4 nəfərlik)', { n: fp.tables.length, a: 0 });
  return [...rows.entries()].map(([k, v]) => ({ k, n: v.n, a: Math.round(v.a) }));
}

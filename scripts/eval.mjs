// AI keyfiyyət testi. İstifadə: əvvəlcə `npm run dev`, sonra ikinci terminalda `npm run eval`.
// Nəticələr lib/ai-eval-results.js faylına yazılır və /testler səhifəsində görünür.
import { writeFileSync } from 'node:fs';

const PORT = process.argv[2] || process.env.PORT || '3000';
const BASE = process.env.EVAL_URL || `http://localhost:${PORT}`;
try {
  await fetch(BASE + '/', { method: 'GET' });
} catch (e) {
  console.error(`\n✕ ${BASE} ünvanına qoşulmaq olmadı (${e.cause?.code || e.message}).`);
  console.error('  Əvvəlcə BİRİNCİ terminalda "npm run dev" işləməlidir.');
  console.error('  Server başqa portdadırsa (məs. 3001): npm run eval -- 3001\n');
  process.exit(1);
}
const base = { projectName: 'Test', plotWidth: 40, plotDepth: 30, soil: 'qum', groundwater: 'orta', bearing: '', slope: 'duz', func: 'yasayis', floors: 9, basements: 1, quality: 'standart', style: 'modern', features: [], budget: 12000000, notes: '', district: 'xetai' };

const ANALYZE = [
  { name: 'Badamdar, 12 mərtəbə (alınmır gözlənilir)', expectFail: true, input: { ...base, district: 'badamdar', soil: 'gil', slope: 'cox', floors: 12, budget: 9000000, quality: 'premium' } },
  { name: 'Nəsimi, qaya, 7 mərtəbə (alınır gözlənilir)', expectFail: false, input: { ...base, district: 'nesimi', soil: 'qaya', groundwater: 'derin', floors: 7, budget: 20000000 } },
  { name: 'Ağ Şəhər, dayaz su, mayeləşmə', expectFail: false, input: { ...base, district: 'agseher', soil: 'qum', groundwater: 'dayaz', floors: 10, budget: 30000000, func: 'ofis' } },
  { name: 'Tökmə torpaq, 5 mərtəbə', expectFail: false, input: { ...base, soil: 'dolma', floors: 5, budget: 20000000 } },
  { name: 'Büdcə çatmır', expectFail: true, input: { ...base, budget: 3000000 } },
  { name: 'Mərdəkan otel, yaşıl dam', expectFail: false, input: { ...base, district: 'xezer', func: 'otel', floors: 5, basements: 0, quality: 'premium', features: ['yasildam', 'gunes'], budget: 8000000, style: 'med' } },
];

const CHAT = [
  { name: '"Mərtəbəni 6-ya endir" → floors = 6', msg: 'mərtəbə sayını 6-ya endir', check: (p) => p && p.floors === 6 },
  { name: '"Premium keyfiyyət et" → quality = premium', msg: 'keyfiyyəti premium et', check: (p) => p && p.quality === 'premium' },
  { name: '"Ofis binası olsun" → func = ofis', msg: 'bunu ofis binası et', check: (p) => p && p.func === 'ofis' },
  { name: 'Sual (parametr dəyişməməli) → patch = null', msg: 'bu torpaqda niyə svay təməl lazımdır?', check: (p) => !p },
];

const KEYS = ['xulase', 'riskler', 'tovsiyeler', 'temel', 'yonlendirme', 'planlama', 'fasad', 'tovsiye_ssenari'];
const post = async (path, body) => {
  const t = Date.now();
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { data: await r.json(), sec: (Date.now() - t) / 1000 };
};

const checks = [];
const times = [];
let model = '?';
for (const c of ANALYZE) {
  process.stdout.write(`• ${c.name} ... `);
  try {
    const { data, sec } = await post('/api/analyze', { input: c.input });
    times.push(sec);
    if (data.mode !== 'ai') { checks.push({ name: c.name, ok: false, detail: `AI işləmədi: ${data.note || data.mode}` }); console.log('AI YOX'); continue; }
    model = data.model || model;
    const a = data.ai || {};
    const missing = KEYS.filter((k) => a[k] === undefined);
    const az = /[əğıöüşç]/i.test(JSON.stringify(a));
    const scenOk = ['gelir', 'qenaet', 'keyfiyyet'].includes(a.tovsiye_ssenari);
    const txt = String(a.xulase || '').toLowerCase();
    const sayNo = /alınmır|mümkün deyil|riskli|təhlükəli|çatmır|şərt/.test(txt);
    const verdictOk = c.expectFail ? sayNo : true;
    const ok = !missing.length && az && scenOk && verdictOk;
    checks.push({ name: c.name, ok, detail: `${sec.toFixed(1)} san.; ${missing.length ? `çatışmayan sahələr: ${missing.join(', ')}` : 'struktur tam'}; ${az ? 'Azərbaycan dili' : 'dil səhvi'}; ${verdictOk ? 'hökm uyğundur' : 'hökm mühərriklə ziddiyyətlidir'}` });
    console.log(ok ? 'OK' : 'PROBLEM');
  } catch (e) { checks.push({ name: c.name, ok: false, detail: `Xəta: ${e.cause?.code || e.message}` }); console.log(`XƏTA (${e.cause?.code || e.message})`); }
}
for (const c of CHAT) {
  process.stdout.write(`• Söhbət: ${c.name} ... `);
  try {
    const { data, sec } = await post('/api/chat', { input: base, messages: [{ role: 'user', content: c.msg }] });
    times.push(sec);
    const ok = data.mode === 'ai' && c.check(data.patch);
    checks.push({ name: `Söhbət: ${c.name}`, ok, detail: `${sec.toFixed(1)} san.; patch: ${JSON.stringify(data.patch)}` });
    console.log(ok ? 'OK' : 'PROBLEM');
  } catch (e) { checks.push({ name: `Söhbət: ${c.name}`, ok: false, detail: `Xəta: ${e.cause?.code || e.message}` }); console.log(`XƏTA (${e.cause?.code || e.message})`); }
}

const passed = checks.filter((c) => c.ok).length;
const connErr = checks.every((c) => /fetch failed|ECONNREFUSED/i.test(c.detail));
if (connErr) { console.error('Server cavab vermədi, nəticə yazılmadı.'); process.exit(1); }
const avg = times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1) : '0';
const out = { model, passed, total: checks.length, avgSec: avg, date: new Date().toISOString().slice(0, 16).replace('T', ' '), note: 'Struktur, dil, hökm uyğunluğu və söhbətlə parametr dəyişmə dəqiqliyi', checks };
writeFileSync(new URL('../lib/ai-eval-results.js', import.meta.url), `// npm run eval tərəfindən yaradılıb\nexport const AI_EVAL = ${JSON.stringify(out, null, 2)};\n`);
console.log(`\nNəticə: ${passed}/${checks.length} keçdi, orta cavab ${avg} san. → lib/ai-eval-results.js yeniləndi`);

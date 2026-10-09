// Keyfiyyət testləri: mühərrikin mühəndis qaydalarına uyğun davranıb-davranmadığını yoxlayır.
// Hər test real ssenari + gözlənilən nəticədir (ekspert qaydası). Brauzerdə /testler səhifəsində canlı işləyir.
import { analyze, bestUse } from './engine';
import { systems } from './systems';
import { boq } from './boq';
import { floorList, floorPlan } from './floors';
import { mepOverlay } from './overlay';
import { PRESETS, DEFAULT_INPUT, DISTRICTS, SOILS, SLOPES, FUNCTIONS, QUALITIES, STYLES, GROUNDWATER } from './data';

const base = { ...DEFAULT_INPUT };
const I = (p) => ({ ...base, ...p });

export const CASES = [
  {
    id: 'T01', group: 'Ssenari', name: 'Badamdar sürüşmə zonası, gilli maili torpaq, 12 mərtəbə',
    expect: 'Hökm "alınmır", limit ≤ 6 mərtəbə, svay təməl',
    run: () => { const r = analyze(I({ district: 'badamdar', soil: 'gil', slope: 'cox', floors: 12, budget: 9e6, quality: 'premium', plotWidth: 36, plotDepth: 32 })); return { ok: r.status === 'fail' && r.floorCap <= 6 && /svay/i.test(r.foundation.type), got: `${r.status}, limit ${r.floorCap}, ${r.foundation.type}` }; },
  },
  {
    id: 'T02', group: 'Ssenari', name: 'Nəsimi, qaya əsası, düz sahə, 7 mərtəbə, kifayət qədər büdcə',
    expect: 'Hökm "alınır" və ya "şərtlə" (alınmır deyil), lent təməl',
    run: () => { const r = analyze(I({ district: 'nesimi', soil: 'qaya', slope: 'duz', groundwater: 'derin', floors: 7, budget: 20e6, basements: 1 })); return { ok: r.status !== 'fail' && /lent/i.test(r.foundation.type), got: `${r.status}, ${r.foundation.type}` }; },
  },
  {
    id: 'T03', group: 'Ssenari', name: 'Ağ Şəhər: qumlu torpaq + dayaz qrunt suyu + 9 bal',
    expect: 'Mayeləşmə riski aşkarlanır, limit ≤ 9, svay təməl',
    run: () => { const r = analyze(I({ district: 'agseher', soil: 'qum', groundwater: 'dayaz', floors: 10, budget: 30e6 })); return { ok: r.geo.liq === 'high' && r.floorCap <= 9 && /svay/i.test(r.foundation.type), got: `mayeləşmə ${r.geo.liq}, limit ${r.floorCap}, ${r.foundation.type}` }; },
  },
  {
    id: 'T04', group: 'Ssenari', name: 'Tökmə (doldurma) torpaq, 5 mərtəbə',
    expect: 'Dərin svay təməl tələb olunur',
    run: () => { const r = analyze(I({ soil: 'dolma', floors: 5, budget: 20e6 })); return { ok: /svay/i.test(r.foundation.type), got: r.foundation.type }; },
  },
  {
    id: 'T05', group: 'Ssenari', name: 'Büdcə xərcin yarısı qədərdir',
    expect: '"Büdcə çatmır" xətası və hökm "alınmır"',
    run: () => { const c = analyze(I({})).cost.totalCost; const r = analyze(I({ budget: Math.round(c * 0.5) })); return { ok: r.status === 'fail' && r.issues.some((i) => /Büdcə çatmır/.test(i.title)), got: `${r.status}, büdcə ${Math.round(r.cost.budgetRatio * 100)}%` }; },
  },
  {
    id: 'T06', group: 'Ssenari', name: 'Dayaz qrunt suyu + 2 mərtəbəli yeraltı parkinq',
    expect: 'Hidroizolyasiya xəbərdarlığı, parkinq xərci artır',
    run: () => { const a = analyze(I({ groundwater: 'derin', basements: 2 })); const b = analyze(I({ groundwater: 'dayaz', basements: 2 })); const pa = a.cost.breakdown.find((x) => x.key === 'parkinq').value; const pb = b.cost.breakdown.find((x) => x.key === 'parkinq').value; return { ok: b.issues.some((i) => /qrunt suyu/i.test(i.title)) && pb > pa * 1.2, got: `parkinq ${Math.round(pa / 1e3)}k → ${Math.round(pb / 1e3)}k ₼` }; },
  },
  {
    id: 'T07', group: 'Ssenari', name: 'Ticarət mərkəzi, 8 mərtəbə',
    expect: 'Funksiya limiti (5) aşılır',
    run: () => { const r = analyze(I({ func: 'ticaret', floors: 8, budget: 50e6 })); return { ok: r.floorCap === 5 && r.status !== 'ok', got: `limit ${r.floorCap}, ${r.status}` }; },
  },
  {
    id: 'T08', group: 'Məntiq', name: 'Seysmik izolyatorlar konstruktiv balı artırmalıdır',
    expect: 'İzolyatorlu variantın konstruktiv balı daha yüksək',
    run: () => { const p = { district: 'agseher', soil: 'qum', groundwater: 'dayaz', floors: 9, budget: 40e6 }; const a = analyze(I(p)); const b = analyze(I({ ...p, features: ['seysmik'] })); const sa = a.score.parts.find((x) => x.key === 'str').value; const sb = b.score.parts.find((x) => x.key === 'str').value; return { ok: sb > sa, got: `${sa} → ${sb}` }; },
  },
  {
    id: 'T09', group: 'Məntiq', name: 'Material qiyməti +30% olanda mənfəət azalmalıdır',
    expect: 'Mənfəət azalır, xərc artır',
    run: () => { const a = analyze(I({})); const b = analyze(I({ materialIdx: 30 })); return { ok: b.revenue.profit < a.revenue.profit && b.cost.totalCost > a.cost.totalCost, got: `mənfəət ${Math.round(a.revenue.profit / 1e5) / 10} → ${Math.round(b.revenue.profit / 1e5) / 10} mln` }; },
  },
  {
    id: 'T10', group: 'Məntiq', name: 'Limitdən yuxarı mərtəbə əlavə etmək risk balını aşağı salmalıdır',
    expect: 'UltScore azalır',
    run: () => { const p = { district: 'badamdar', soil: 'gil', slope: 'cox', budget: 50e6 }; const a = analyze(I({ ...p, floors: 5 })); const b = analyze(I({ ...p, floors: 12 })); return { ok: b.score.total < a.score.total, got: `${a.score.total} → ${b.score.total}` }; },
  },
  {
    id: 'T11', group: 'Məntiq', name: 'Ən yaxşı istifadə: 5 funksiya, mənfəətə görə sıralı',
    expect: '5 nəticə, azalan sıra',
    run: () => { const l = bestUse(I({})); const sorted = l.every((x, i) => i === 0 || l[i - 1].result.revenue.profit >= x.result.revenue.profit); return { ok: l.length === 5 && sorted, got: l.map((x) => x.id).join(' > ') }; },
  },
  {
    id: 'T12', group: 'Həndəsə', name: 'Mərtəbə planı tikinti ləkəsindən kənara çıxmamalıdır',
    expect: 'Bütün mənzillər ləkənin daxilində, sahələr müsbət',
    run: () => { const r = analyze(I({ plotWidth: 36, plotDepth: 32 })); const u = r.plan.rects.filter((x) => x.kind === 'unit'); const inside = u.every((x) => x.x >= -0.01 && x.y >= -0.01 && x.x + x.w <= r.site.fw + 0.01 && x.y + x.h <= r.site.fd + 0.01 && x.area > 0); const sum = u.reduce((a, x) => a + x.area, 0); return { ok: inside && sum <= r.site.footprint, got: `${u.length} mənzil, ${Math.round(sum)} / ${r.site.footprint} m²` }; },
  },
  {
    id: 'T13', group: 'Dayanıqlıq', name: 'Kiçik sahə (10×10 m) — çökmə olmamalıdır',
    expect: 'Nəticə qaytarılır, sahə > 0',
    run: () => { const r = analyze(I({ plotWidth: 10, plotDepth: 10, floors: 3 })); return { ok: r.site.footprint > 0 && Number.isFinite(r.cost.totalCost), got: `ləkə ${r.site.footprint} m²` }; },
  },
  {
    id: 'T14', group: 'Dayanıqlıq', name: '600 təsadüfi giriş (fuzz): NaN və ya 0–100 xaricində bal olmamalıdır',
    expect: 'Bütün nəticələr sonlu, bal 0–100',
    run: () => {
      let s = 12345; const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      const pick = (a) => a[Math.floor(R() * a.length)].id;
      let bad = 0;
      for (let i = 0; i < 600; i++) {
        const r = analyze({ projectName: 'fuzz', district: pick(DISTRICTS), soil: pick(SOILS), slope: pick(SLOPES), func: pick(FUNCTIONS), quality: pick(QUALITIES), style: pick(STYLES), groundwater: pick(GROUNDWATER), plotWidth: 8 + R() * 150, plotDepth: 8 + R() * 150, floors: 1 + Math.floor(R() * 40), basements: Math.floor(R() * 4), budget: R() * 1e8, materialIdx: Math.round(-20 + R() * 70), features: [] });
        if (!Number.isFinite(r.cost.totalCost) || !Number.isFinite(r.revenue.profit) || r.score.total < 0 || r.score.total > 100 || Number.isNaN(r.score.total)) bad += 1;
      }
      return { ok: bad === 0, got: `${600 - bad}/600 keçdi` };
    },
  },
  {
    id: 'T15', group: 'Mühəndis sistemləri', name: '18 mərtəbəli yaşayış (> 28 m): qaz, yanğın lifti, tüstüsüz pilləkən',
    expect: 'Mənzillərə qaz verilmir, yanğın lifti ≥ 1, hava basqısı var, ≥ 2 sərnişin lifti',
    run: () => { const s = systems(analyze(I({ floors: 18, budget: 60e6 }))); const lf = s.list.find((x) => x.id === 'lift'); return { ok: !s.ctx.gasApt && lf.fire >= 1 && s.ctx.pressurize && lf.passenger >= 2, got: `H=${s.H} m, qaz ${s.ctx.gasApt ? 'var' : 'yox'}, yanğın lifti ${lf.fire}, lift ${lf.passenger}` }; },
  },
  {
    id: 'T16', group: 'Mühəndis sistemləri', name: '7 mərtəbəli yaşayış (≤ 28 m): fərdi qaz qazanları icazəlidir, yanğın lifti lazım deyil',
    expect: 'Qaz mənzillərə verilir, yanğın lifti 0, seysmik qaz klapanı var',
    run: () => { const s = systems(analyze(I({ floors: 7 }))); const g = s.list.find((x) => x.id === 'qaz'); return { ok: s.ctx.gasApt && s.list.find((x) => x.id === 'lift').fire === 0 && g.items.some((i) => /Seysmik/.test(i.k)), got: `H=${s.H} m, qaz ${s.ctx.gasApt ? 'var' : 'yox'}` }; },
  },
  {
    id: 'T17', group: 'Mühəndis sistemləri', name: 'Dayaz qrunt suyu + zirzəmi: drenaj nasosları generatora qoşulmalıdır',
    expect: 'Kanalizasiya bölməsində dayaz qrunt suyu üçün nasos + generator',
    run: () => { const s = systems(analyze(I({ groundwater: 'dayaz', basements: 2 }))); const it = s.list.find((x) => x.id === 'kanal').items.find((i) => /Zirzəmi/.test(i.k)); return { ok: !!it && /generator/i.test(it.n), got: it ? it.n.slice(0, 60) : 'yoxdur' }; },
  },
  {
    id: 'T18', group: 'Mühəndis sistemləri', name: 'Ticarət mərkəzi: tam sprinkler, tüstü sorma, eskalatorlar',
    expect: 'Bütün sahədə sprinkler, atriumdan tüstü sorma, eskalator > 0',
    run: () => { const s = systems(analyze(I({ func: 'ticaret', floors: 3, budget: 60e6 }))); const lf = s.list.find((x) => x.id === 'lift'); return { ok: s.ctx.sprinkFull && s.ctx.smokeExhaust && lf.esc > 0, got: `sprinkler ${s.ctx.sprinkFull ? 'tam' : 'yox'}, eskalator ${lf.esc}` }; },
  },
  {
    id: 'T19', group: 'Mühəndis sistemləri', name: 'Bakı yayı: soyutma yükü isitmədən böyük, Vt/m² real diapazonda',
    expect: 'Ofisdə soyutma 60–140 Vt/m² və soyutma > isitmə',
    run: () => { const s = systems(analyze(I({ func: 'ofis', floors: 8, budget: 60e6 }))); const h = s.list.find((x) => x.id === 'hvac'); const w = Math.round(h.coolKw * 1000 / analyze(I({ func: 'ofis', floors: 8, budget: 60e6 })).cost.grossArea); return { ok: h.coolKw > h.heatKw && w >= 60 && w <= 140, got: `soyutma ${h.coolKw} kVt (${w} Vt/m²), isitmə ${h.heatKw} kVt` }; },
  },
  {
    id: 'T20', group: 'Mühəndis sistemləri', name: 'Dəniz sahili (Mərdəkan): antikorroziya icrası',
    expect: 'HVAC bölməsində korroziya tədbiri',
    run: () => { const s = systems(analyze(I({ district: 'xezer' }))); return { ok: s.ctx.coastal && s.list.find((x) => x.id === 'hvac').items.some((i) => /Korroziya/.test(i.k)), got: s.ctx.coastal ? 'sahil zonası aşkarlandı' : 'aşkarlanmadı' }; },
  },
  {
    id: 'T21', group: 'Dayanıqlıq', name: '300 təsadüfi layihədə mühəndis sistemləri, smeta, qrafik və plan qatları xətasız hesablanır',
    expect: 'NaN yoxdur, hər mərtəbə üçün qatlar qurulur',
    run: () => {
      let s = 777; const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      const pick = (a) => a[Math.floor(R() * a.length)].id;
      let bad = 0;
      for (let i = 0; i < 300; i++) {
        try {
          const r = analyze({ projectName: 'fuzz', district: pick(DISTRICTS), soil: pick(SOILS), slope: pick(SLOPES), func: pick(FUNCTIONS), quality: pick(QUALITIES), style: pick(STYLES), groundwater: pick(GROUNDWATER), plotWidth: 12 + R() * 120, plotDepth: 12 + R() * 120, floors: 1 + Math.floor(R() * 35), basements: Math.floor(R() * 3), budget: R() * 1e8, features: R() > 0.5 ? ['gunes', 'ev', 'smart', 'yagis'] : [] });
          const y = systems(r);
          const bq = boq(r, y);
          const nums = [y.H, ...y.list.map((x) => x.cost), bq.total, bq.schedule.months, ...bq.cash.map((c) => c.spend)];
          floorList(r).slice(0, 3).forEach((f) => mepOverlay(floorPlan(r, f.level), y, f.level, r));
          if (nums.some((n) => !Number.isFinite(n)) || y.list.some((x) => x.items.some((it) => /NaN|undefined/.test(String(it.v))))) bad += 1;
        } catch (e) { bad += 1; }
      }
      return { ok: bad === 0, got: `${300 - bad}/300 keçdi` };
    },
  },
  {
    id: 'T22', group: 'Smeta və qrafik', name: 'Armatur sərfi seysmik karkas üçün real diapazonda',
    expect: 'Orta armatur 70–160 kq/m³ beton',
    run: () => { const b = boq(analyze(I({}))); const c = parseFloat(b.key[0].v.replace(/\s/g, '')); const t = parseFloat(b.key[1].v); const k = Math.round((t * 1000) / c); return { ok: k >= 70 && k <= 160, got: `${k} kq/m³` }; },
  },
  {
    id: 'T23', group: 'Smeta və qrafik', name: 'Detallı smeta ilə parametrik qiymətləndirmə üst-üstə düşür (bütün demo layihələr)',
    expect: 'Fərq ±35%-dən az (AACE sinif 4)',
    run: () => { const ds = PRESETS.map((p) => boq(analyze(p.input)).diff); return { ok: ds.every((d) => Math.abs(d) < 0.35), got: ds.map((d) => `${Math.round(d * 100)}%`).join(', ') }; },
  },
  {
    id: 'T24', group: 'Smeta və qrafik', name: 'Mərtəbə artdıqca müddət və smeta artır',
    expect: '6 → 16 mərtəbə: müddət və xərc artır',
    run: () => { const a = boq(analyze(I({ floors: 6 }))); const c = boq(analyze(I({ floors: 16 }))); return { ok: c.schedule.months > a.schedule.months && c.total > a.total, got: `${a.schedule.months} → ${c.schedule.months} ay` }; },
  },
  {
    id: 'T25', group: 'Smeta və qrafik', name: 'Dayaz qrunt suyu: su endirmə smetaya, risk reyestrinə düşür',
    expect: 'Su endirmə mövqeyi + "Qrunt suyu" riski',
    run: () => { const b = boq(analyze(I({ groundwater: 'dayaz', basements: 2 }))); const ok = b.sections.some((s) => s.items.some((x) => /Su endirmə/.test(x.name))) && b.risks.some((x) => /Qrunt suyu/.test(x.name)); return { ok, got: ok ? 'tapıldı' : 'yoxdur' }; },
  },
  {
    id: 'T26', group: 'Smeta və qrafik', name: 'Maliyyə axını smetanın cəminə bərabərdir',
    expect: 'Aylıq xərclərin cəmi = smeta (±1%)',
    run: () => { const b = boq(analyze(I({}))); const c = b.cash[b.cash.length - 1].cum; return { ok: Math.abs(c - b.total) / b.total < 0.01, got: `${Math.round(c / 1e3)}k / ${Math.round(b.total / 1e3)}k` }; },
  },
];

export function runAll() {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const results = CASES.map((c) => {
    try { const r = c.run(); return { ...c, ...r }; } catch (e) { return { ...c, ok: false, got: `Xəta: ${e.message}` }; }
  });
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return { results, passed: results.filter((r) => r.ok).length, total: results.length, ms };
}

// Testlər zamanı tapılan real problemlər (dürüstlük üçün)
export const FOUND_ISSUES = [
  { title: 'Ticarət mərkəzinin gəliri şişirdilmişdi', status: 'düzəldildi', text: '"Ən yaxşı istifadə" testində ticarət mərkəzi hər torpaqda (hətta Mərdəkan kurort zonasında) birinci çıxırdı. Satış əmsalı 1.4-dən 1.15-ə endirildi.' },
  { title: 'Mərtəbə planı yalnız düzbucaqlı sahələr üçündür', status: 'məlum məhdudiyyət', text: 'Qeyri-düzgün formalı torpaqlarda plan sadələşdirilmiş düzbucaqlı ləkə üzərində qurulur.' },
  { title: 'Bazar qiymətləri statikdir', status: 'məlum məhdudiyyət', text: 'Rayon üzrə m² satış qiymətləri əl ilə daxil edilib (yeni tikililərdə Bakı medianı ~2 800 ₼/m² ilə uyğunlaşdırılıb), canlı bazar datasına qoşulmayıb.' },
  { title: 'Seysmiklik rayon səviyyəsindədir', status: 'məlum məhdudiyyət', text: 'Eyni rayon daxilində sahəyə görə seysmik fərqlər nəzərə alınmır; bunun üçün seysmik mikrorayonlaşdırma xəritəsi lazımdır.' },
  { title: 'Mətndə 3D etiketləri üst-üstə düşürdü', status: 'düzəldildi', text: 'Limit və külək etiketləri bəzi bucaqlarda bir-birini örtürdü; yerləri dəyişdirildi.' },
  { title: 'Gecə rejimində pəncərə işıqları yanmırdı', status: 'düzəldildi', text: 'Çox materiallı obyektlərdə işıq parametri tətbiq olunmurdu; düzəldildi.' },
];

export const COMPARISON = [
  { k: 'İlk cavab müddəti', old: 'Həftələr (memar, geoloq, smetaçı ayrı-ayrı)', neu: '< 1 dəqiqə (hesablama dərhal, AI rəyi 5–20 san.)' },
  { k: 'Bir ilkin analizin xərci', old: 'Mütəxəssis haqqı (bir neçə gün iş)', neu: '~0.01–0.05 $ AI xərci' },
  { k: 'Alternativlərin müqayisəsi', old: 'Hər variant ayrıca hesablanır', neu: '5 funksiya + 3 ssenari avtomatik' },
  { k: 'Geoloji risklərin görünməsi', old: 'Çox vaxt layihədən sonra', neu: 'Torpaq alınmadan əvvəl, 6 göstərici' },
  { k: 'Dəqiqlik', old: 'Yüksək (sahə ölçmələri ilə)', neu: 'Konsept səviyyəsi; qazma testləri ilə təsdiq lazımdır' },
];

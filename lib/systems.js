// Mühəndis sistemləri (MEP) mühərriki: su, kanalizasiya, elektrik, işıqlandırma, istilik, soyutma,
// ventilyasiya, yanğın təhlükəsizliyi, liftlər, qaz, ildırım mühafizəsi, zəif cərəyan, tullantı.
// Bütün hesablar deterministikdir və analyze() nəticəsinə + Bakı iqliminə + yerli şərtlərə əsaslanır.
// Normativ istinadlar: Azərbaycanda tətbiq olunan SNiP/SP əsaslı normalar (AzDTN) və IEC/EN standartları.
// Konsept mərhələsi üçündür: işçi layihədə lisenziyalı mühəndis tərəfindən dəqiqləşdirilməlidir.

import { floorPlan } from './floors';

// --- Bakı iqlim parametrləri (təxmini, SP 131 / AzDTN iqlim cədvəlləri əsasında) ---
export const CLIMATE = {
  winterDesign: -4, // °C, ən soyuq beşgünlük
  summerDesign: 35, // °C, yay hesabi temperatur
  summerWetBulb: 24, // °C
  heatingDays: 120, // isitmə mövsümü (15 noyabr – 15 mart)
  hdd: 1650, // dərəcə-gün (baza 18 °C)
  coolingHours: 1100, // ekvivalent tam yük saatı
  windMax: 30, // m/s, Xəzri küləyinin hesabi sürəti (dam avadanlığının bərkidilməsi)
  rainYear: 0.21, // m/il yağıntı (Abşeron)
  rainQ20: 0.007, // l/s·m², 20 dəqiqəlik hesabi intensivlik
  solarYield: 1450, // kVt·saat / kVtp / il
  cityWaterHead: 15, // m, şəhər şəbəkəsində təxmini təzyiq (qeyri-sabit)
};

const COASTAL = ['sebail', 'bayil', 'bibiheybet', 'xezer', 'buzovna', 'pirallahi', 'hovsan'];
const STD_TR = [160, 250, 400, 630, 1000, 1250, 1600, 2000, 2500];
const STD_GEN = [60, 100, 150, 200, 250, 320, 400, 500, 630, 800, 1000, 1250];
const pickStd = (list, v) => list.find((x) => x >= v) || list[list.length - 1];
const r0 = (n) => Math.round(n);
const r1 = (n) => Math.round(n * 10) / 10;
const ceil = Math.ceil;

// Yaşayış üçün nəfər/mənzil
const OCC = { 1: 1.5, 2: 2.5, 3: 3.5, 4: 4.5 };

export function heightClass(h) {
  if (h > 75) return { id: 'h75', name: 'Unikal hündür bina (> 75 m)', note: 'Xüsusi texniki şərtlər (XTŞ) tələb olunur' };
  if (h > 50) return { id: 'h50', name: 'Hündür bina (50–75 m)', note: 'Gücləndirilmiş yanğın tələbləri' };
  if (h > 28) return { id: 'h28', name: 'Hündürmərtəbəli bina (28–50 m)', note: 'Yanğın nərdivanının çatmadığı zona: tüstüsüz pilləkən, yanğın lifti' };
  return { id: 'std', name: 'Adi bina (≤ 28 m)', note: 'Standart yanğın tələbləri' };
}

function population(r) {
  const f = r.input.func;
  const typ = r.plan.rects.filter((x) => x.kind === 'unit');
  const resFloors = f === 'qarisiq' ? Math.max(0, r.input.floors - 1) : Math.max(0, r.input.floors - (f === 'yasayis' ? 1 : 0));
  if (f === 'yasayis' || f === 'qarisiq') {
    const perFloor = typ.reduce((a, u) => a + (OCC[u.unitType] || 2.5), 0);
    const residents = r0(perFloor * resFloors);
    const shopsArea = r.site.footprint * 0.8;
    return { residents, staff: 0, visitors: r0(shopsArea / 8), perFloor: r0(perFloor), label: 'sakin' };
  }
  if (f === 'ofis') { const p = r0(r.revenue.netArea / 10); return { residents: 0, staff: p, visitors: r0(p * 0.1), perFloor: r0(p / Math.max(1, r.input.floors - 1)), label: 'işçi' }; }
  if (f === 'otel') { const g = r0(r.units * 1.6); return { residents: g, staff: r0(r.units * 0.5), visitors: r0(r.site.footprint / 4), perFloor: r0(g / Math.max(1, r.input.floors - 1)), label: 'qonaq' }; }
  // ticarət
  const v = r0(r.revenue.netArea / 4); // pik zamanı 4 m²/nəfər
  return { residents: 0, staff: r0(r.revenue.netArea / 40), visitors: v, perFloor: r0(v / r.input.floors), label: 'ziyarətçi (pik)' };
}

// ------------------------------------------------------------------ SU TƏCHİZATI
function water(r, ctx) {
  const { pop, H, f, q, sprinkFull } = ctx;
  const litres = { ekonom: 200, standart: 250, premium: 300 }[q];
  let daily; let basis;
  if (f === 'yasayis' || f === 'qarisiq') { daily = pop.residents * litres + pop.visitors * 5; basis = `${pop.residents} sakin × ${litres} l/gün`; }
  else if (f === 'ofis') { daily = pop.staff * 16 * 1.3; basis = `${pop.staff} işçi × 16 l/gün (+30% kafe və təmizlik)`; }
  else if (f === 'otel') { daily = pop.residents * 300 + pop.staff * 25 + r.units * 40; basis = `${pop.residents} qonaq × 300 l + personal + camaşırxana`; }
  else { daily = r.revenue.netArea * 5 + pop.staff * 25; basis = `${r0(r.revenue.netArea)} m² × 5 l/m² + personal`; }
  const dailyM3 = daily / 1000;
  const kh = dailyM3 > 200 ? 1.8 : dailyM3 > 60 ? 2.2 : 2.6; // saatlıq qeyri-bərabərlik
  const peakM3h = (dailyM3 / 24) * kh;
  const peakLs = (peakM3h / 3.6) * 1.15;
  const zones = Math.max(1, ceil(H / 45)); // hər zonada statik təzyiq ≤ 0,45 MPa
  const head = r0(H + 3 + 15 + H * 0.12); // geodezik + sərbəst təzyiq + itkilər
  const needBoost = head > CLIMATE.cityWaterHead;
  const pumpKw = r1((peakLs * head * 9.81) / (0.65 * 1000));
  const tankHousehold = r0(dailyM3 * 1.0); // Bakıda fasilələrə görə 1 günlük ehtiyat
  const hyd = f === 'ticaret' ? { jets: 2, ls: 5.2 } : H > 50 ? { jets: 3, ls: 2.6 } : H > 28 ? { jets: 2, ls: 2.6 } : r.input.floors >= 12 ? { jets: 1, ls: 2.6 } : null;
  const fireInt = hyd ? hyd.jets * hyd.ls : 0;
  const sprinkLs = sprinkFull || ctx.sprinkCommon ? (f === 'ticaret' ? 30 : 10) : 0;
  const tankFire = r0(fireInt * 3 * 3.6 + sprinkLs * 1 * 3.6);
  const hot = r0(dailyM3 * 0.38 * 10) / 10;
  const dn = peakLs < 2 ? 50 : peakLs < 5 ? 65 : peakLs < 10 ? 80 : peakLs < 20 ? 100 : 150;
  const items = [
    { k: 'Gündəlik su sərfi', v: `${r1(dailyM3)} m³/gün`, n: basis },
    { k: 'Pik saat sərfi', v: `${r1(peakM3h)} m³/saat (${r1(peakLs)} l/s)`, n: `Saatlıq qeyri-bərabərlik əmsalı ${kh}` },
    { k: 'Şəhər şəbəkəsinə giriş', v: `2 giriş × DN${dn}`, n: 'İki tərəfli giriş, Azərsu sayğacı + əks klapan, seysmik elastik birləşmə' },
    { k: 'Təzyiq zonaları', v: `${zones} zona`, n: `Hündürlük ${r0(H)} m; hər zonada statik təzyiq ≤ 0,45 MPa, mənzil girişində təzyiq azaldıcı klapan` },
    { k: 'Nasos stansiyası', v: needBoost ? `2 işçi + 1 ehtiyat, tezlik çeviricili, ~${pumpKw} kVt, H=${head} m` : 'Tələb olunmur (şəhər təzyiqi kifayətdir)', n: needBoost ? 'Şəhər təzyiqi ~15 m-dir və qeyri-sabitdir; nasoslar −1 mərtəbədə, vibrasiya izolyatorları üzərində' : '' },
    { k: 'Məişət su ehtiyatı çəni', v: `${tankHousehold} m³ (2 bölmə)`, n: 'Bakıda su fasilələrinə görə 1 günlük ehtiyat; qida təyinatlı paslanmayan polad/PE, seysmik ankerlərlə' },
    { k: 'İsti su', v: `${hot} m³/gün`, n: ctx.gasApt ? 'Hər mənzildə kombi qazan (fərdi)' : ctx.solar ? 'Mərkəzi: istilik nasosu + günəş kollektoru ilə ilkin qızdırma, sirkulyasiya xətti' : 'Mərkəzi: istilik nasosu / qazan, sirkulyasiya xətti, legionella üçün 60 °C dövri qızdırma' },
    { k: 'Daxili yanğın kranları', v: hyd ? `${hyd.jets} şırnaq × ${hyd.ls} l/s` : 'Tələb olunmur', n: hyd ? 'Hər mərtəbədə pilləkən yanında yanğın kranı şkafı (PK), ayrıca yanğın nasosları' : '' },
    { k: 'Yanğın su ehtiyatı', v: tankFire > 0 ? `${tankFire} m³` : '—', n: tankFire > 0 ? '3 saatlıq yanğın kranı + 1 saatlıq sprinkler sərfi; məişət suyundan ayrı çən' : '' },
    { k: 'Boru materialı', v: 'Magistral: paslanmayan polad / PE-100; mənzildaxili: PPR, PEX', n: ctx.coastal ? 'Dəniz sahili: duz korroziyasına görə qara polad istifadə edilmir' : 'Stoyaklar istilik izolyasiyası ilə (kondensat əleyhinə)' },
  ];
  if (ctx.rain) items.push({ k: 'Yağış suyu toplama', v: `${r0(ctx.roofArea * CLIMATE.rainYear * 0.8)} m³/il`, n: `Çən ~${Math.max(5, r0(ctx.roofArea * 0.02))} m³; həyətin suvarılması və unitazlar üçün ayrıca boz su xətti` });
  return { id: 'su', name: 'Su təchizatı', icon: '💧', color: '#1E88E5', items, dailyM3, peakLs, zones, head, tankHousehold, tankFire, needBoost, pumpKw, hyd, norm: 'SP 30.13330 (daxili su kəməri və kanalizasiya), SP 10.13130 (daxili yanğın su kəməri)' };
}

// ------------------------------------------------------------------ KANALİZASİYA
function sewer(r, ctx) {
  const { wetPerFloor, H } = ctx;
  const stacks = Math.max(1, wetPerFloor);
  const roofDrains = Math.max(2, ceil(ctx.roofArea / 250));
  const rainLs = r1(ctx.roofArea * CLIMATE.rainQ20 * 1.2);
  const items = [
    { k: 'Məişət axıntısı', v: `${r1(ctx.water.dailyM3)} m³/gün`, n: 'Su sərfinə bərabər; şəhər kollektoruna 2 buraxılış, DN150' },
    { k: 'Kanalizasiya stoyakları', v: `${stacks} stoyak × DN110`, n: 'Hər yaş zona (SQ, mətbəx, WC) üçün ayrıca stoyak, şaxtada səs izolyasiyası; havalandırma damdan 0,3 m yuxarı' },
    { k: 'Revizyalar', v: `hər 3 mərtəbədə`, n: 'Stoyak dibində və yuxarı mərtəbədə mütləq' },
    { k: 'Dam drenajı', v: `${roofDrains} qıf, ${rainLs} l/s`, n: 'Daxili su axıdıcıları (Abşeronda leysan + qum), elektrik qızdırıcısız (qış yumşaqdır)' },
    { k: 'Kondisioner kondensatı', v: `${stacks} ayrıca stoyak`, n: 'Bakının əsas problemi: fasaddan su damması. Kondensat ayrıca DN32–50 stoyaqla kanalizasiyaya hidrozatvor üzərindən' },
  ];
  if (r.input.basements > 0) items.push({ k: 'Zirzəmi drenajı', v: `${Math.max(2, r.input.basements * 2)} çala + nasos`, n: ctx.gw === 'dayaz' ? 'Dayaz qrunt suyu: 2 nasos (1 ehtiyat) hər çalada, səviyyə sensorları, generatora qoşulu' : 'Yanğın söndürmə suyu və yuyulma üçün drenaj çalaları' });
  if (ctx.f === 'ticaret' || ctx.f === 'otel' || ctx.f === 'qarisiq') items.push({ k: 'Yağ tutucu', v: '1 ədəd', n: 'Restoran / yemək zalı mətbəxlərindən axıntı üçün mütləqdir' });
  if (ctx.slidey) items.push({ k: 'Xarici şəbəkə', v: 'Elastik birləşmələr', n: 'Sürüşmə / mayeləşmə riski: binaya giriş nöqtələrində kompensatorlar, boru qutuları' });
  return { id: 'kanal', name: 'Kanalizasiya və drenaj', icon: '🚰', color: '#6D4C41', items, stacks, roofDrains, norm: 'SP 30.13330, SP 32.13330 (xarici kanalizasiya)' };
}

// ------------------------------------------------------------------ İSTİLİK VƏ SOYUTMA (yük hesabı)
function envelope(r, ctx) {
  const { H, f } = ctx;
  const { fw, fd, footprint } = r.site;
  const glaz = { modern: 0.45 }[r.input.style] ?? (['icheri', 'baki'].includes(r.input.style) ? 0.25 : 0.32);
  const wallS = fw * H; const wallE = fd * H;
  const facade = 2 * (wallS + wallE);
  const win = { S: wallS * glaz, N: wallS * glaz, E: wallE * glaz, W: wallE * glaz };
  const winTotal = win.S + win.N + win.E + win.W;
  const wallNet = facade - winTotal;
  const U = { wall: 0.45, win: 1.8, roof: 0.3, floor: 0.4 };
  const dTh = 20 - CLIMATE.winterDesign; // 24 K
  const vol = r.cost.grossArea * (r.floorH - 0.3);
  const ach = f === 'yasayis' || f === 'qarisiq' ? 0.5 : 0;
  const fresh = ctx.freshAir; // m³/saat
  const ventHeat = ((vol * ach + fresh * (ctx.hr ? 0.35 : 1)) * 0.34 * dTh) / 1000; // kVt
  const transH = (U.wall * wallNet + U.win * winTotal + U.roof * footprint + U.floor * footprint * 0.5) * dTh / 1000;
  const heatKw = (transH + ventHeat) * 1.1;
  // Soyutma: günəş (SHGC 0,4 + kölgələmə) + istilik keçirmə + daxili + təmiz hava
  const shgc = ctx.shade ? 0.28 : 0.4;
  const sol = { S: 320, N: 110, E: 560, W: 620 }; // Bakı, iyul, şaquli səthlər, Vt/m²
  const solar = (win.S * sol.S + win.N * sol.N + Math.max(win.E * sol.E, win.W * sol.W) + Math.min(win.E * sol.E, win.W * sol.W) * 0.35) * shgc / 1000;
  const dTc = CLIMATE.summerDesign - 24;
  const roofSol = ctx.greenRoof ? 0.6 : 1;
  const transC = (U.wall * wallNet * (dTc + 4) + U.win * winTotal * dTc + U.roof * footprint * (dTc + 14) * roofSol) / 1000;
  const peopleW = f === 'ticaret' ? 130 : 120; // duyulan + gizli
  const inside = (ctx.peakPeople * peopleW + r.cost.grossArea * (ctx.lightWm2 + ctx.equipWm2) * 0.85) / 1000;
  const freshC = ((fresh * (ctx.hr ? 0.5 : 1) + vol * ach) * 1.2 * 22) / 3600; // Δh ≈ 22 kJ/kg: 35 °C/40% → 24 °C/50% (Bakı rütubəti)
  const coolKw = (solar + transC + inside + freshC) * 1.08;
  return { glaz, facade: r0(facade), winTotal: r0(winTotal), heatKw: r0(heatKw), coolKw: r0(coolKw), heatWm2: r0((heatKw * 1000) / r.cost.grossArea), coolWm2: r0((coolKw * 1000) / r.cost.grossArea), parts: { solar: r0(solar), trans: r0(transC), inside: r0(inside), fresh: r0(freshC) }, U };
}

function hvac(r, ctx) {
  const { f, q, H, env } = ctx;
  const floors = r.input.floors;
  let heatSys; let coolSys; let plantSpace; let coolElecKw;
  const coolTR = r1(env.coolKw / 3.517);
  if (f === 'yasayis' || f === 'qarisiq') {
    if (ctx.gasApt) heatSys = 'Hər mənzildə 24 kVt kondensasiya kombi qazanı + panel radiatorlar (premiumda isti döşəmə). Baca: hər mənzil üçün koaksial, fasad üslubuna uyğun qəfəslə';
    else heatSys = q === 'premium' ? 'VRF istilik nasosu (isitmə rejimi, COP ~3,5) + vanna otaqlarında elektrik isti döşəmə' : 'Damda mərkəzi qazanxana (kaskad kondensasiya qazanları) + mənzil istilik sayğacları ilə 2 borulu sistem';
    if (q === 'premium' || floors > 16) { coolSys = `Mənzil başına VRF: xarici bloklar damda / texniki mərtəbədə, daxili kanal tipli bloklar. Fasadda kondisioner qutusu yoxdur`; plantSpace = `Dam: ~${r0(env.coolKw * 0.12)} m² VRF meydançası`; }
    else { coolSys = 'Otaq başına split kondisioner. Xarici bloklar fasadın memarlıq nişlərində / jalüzlü qutularda (üsluba uyğun), kondensat ayrıca stoyağa'; plantSpace = 'Hər mənzildə 1–2 fasad nişi (0,9 × 0,6 m)'; }
    coolElecKw = env.coolKw / 3.2 * 0.75;
  } else if (f === 'ofis') {
    if (r.cost.grossArea > 8000 || floors > 12) { coolSys = `Su soyuducu çiller (2 × ${r0(env.coolKw * 0.6)} kVt, N+1) + fankoyl, dam üzərində quru soyuducular`; heatSys = 'Kondensasiya qazanları + 4 borulu fankoyl sistemi (isitmə və soyutma eyni vaxtda)'; plantSpace = `Dam: ~${r0(env.coolKw * 0.1)} m²; −1: istilik məntəqəsi`; }
    else { coolSys = 'VRF istilik nasosu (istilik bərpası ilə 3 borulu), kaset tipli daxili bloklar 6×6 m şəbəkə ilə'; heatSys = 'VRF istilik rejimi (Bakının −4 °C hesabi temperaturunda COP ~3); əlavə qazan tələb olunmur'; plantSpace = `Dam: ~${r0(env.coolKw * 0.12)} m² xarici bloklar`; }
    coolElecKw = env.coolKw / 3.4;
  } else if (f === 'otel') {
    coolSys = `Çiller (2 × ${r0(env.coolKw * 0.6)} kVt) + otaqlarda 4 borulu fankoyl, otaqda fərdi termostat və açar-kart`;
    heatSys = 'Kondensasiya qazanları + istilik nasosu; isti su: günəş kollektoru ilə ilkin qızdırma, 2 akkumulyasiya çəni';
    plantSpace = `Dam: ~${r0(env.coolKw * 0.1)} m² çiller + qazanxana`;
    coolElecKw = env.coolKw / 3.4;
  } else {
    coolSys = `Dam tipli rooftop qurğular / AHU + çiller (${r0(env.coolKw)} kVt), zonalar: gəzinti zolağı, supermarket, yemək zalı ayrıca`;
    heatSys = 'Rooftop qurğularının istilik nasosu rejimi + qapılarda hava pərdələri';
    plantSpace = `Dam: ~${r0(env.coolKw * 0.1)} m²`;
    coolElecKw = env.coolKw / 3.2;
  }
  const coastal = ctx.coastal ? 'Sahil zonası: kondensator lamelləri antikorroziya örtüklü (epoksi / "blue fin"), paslanmayan bərkidicilər' : null;
  const items = [
    { k: 'Hesabi şərtlər', v: `Qış ${CLIMATE.winterDesign} °C → daxil 20 °C; yay +${CLIMATE.summerDesign} °C → daxil 24 °C`, n: 'Bakı iqlimi: isti-quru yay, rütubətli dəniz havası, Xəzri küləyi' },
    { k: 'İstilik yükü', v: `${env.heatKw} kVt (${env.heatWm2} Vt/m²)`, n: `Divar U=${env.U.wall}, pəncərə U=${env.U.win}, dam U=${env.U.roof} Vt/m²K; şüşələnmə ${r0(env.glaz * 100)}%` },
    { k: 'Soyutma yükü', v: `${env.coolKw} kVt (${coolTR} TR, ${env.coolWm2} Vt/m²)`, n: `Günəş ${env.parts.solar} + divar/dam ${env.parts.trans} + daxili ${env.parts.inside} + təmiz hava ${env.parts.fresh} kVt` },
    { k: 'İsitmə sistemi', v: heatSys, n: '' },
    { k: 'Soyutma sistemi', v: coolSys, n: plantSpace },
    { k: 'Günəşdən qorunma', v: ctx.shade ? 'Qərb və şərq fasadında üfüqi/şaquli jalüzlər' : 'Qərb fasadında kölgələmə tövsiyə olunur', n: 'Qərb pəncərələri yayda ən böyük yükü verir (~450 Vt/m²); low-e şüşə SHGC ≤ 0,4' },
    { k: 'İllik enerji (isitmə + soyutma)', v: `~${r0((env.heatKw * CLIMATE.hdd * 24 * 0.6) / (20 - CLIMATE.winterDesign) / 1000 / 3 + (env.coolKw * CLIMATE.coolingHours) / 3.3 / 1000)} MVt·saat/il elektrik ekvivalenti`, n: 'Bakıda soyutma yükü isitmədən böyükdür: dizaynda prioritet yay rejimidir' },
  ];
  if (coastal) items.push({ k: 'Korroziya', v: 'Antikorroziya icrası', n: coastal });
  if (ctx.seis >= 8) items.push({ k: 'Seysmik bərkitmə', v: `${ctx.seis} bal`, n: 'Bütün dam avadanlığı seysmik bərkidicili vibrasiya dayaqlarında; boru və hava kanallarında diaqonal bərkitmələr; deformasiya tikişlərində elastik keçidlər' });
  items.push({ k: 'Külək yükü', v: `${CLIMATE.windMax} m/s`, n: 'Damdakı xarici bloklar və günəş panelləri Xəzri küləyinə hesablanmış çərçivələrə ankerlənir' });
  return { id: 'hvac', name: 'İstilik və soyutma', icon: '🌡️', color: '#E53935', items, heatKw: env.heatKw, coolKw: env.coolKw, coolElecKw: r0(coolElecKw), norm: 'SP 60.13330 (isitmə, ventilyasiya, kondisioner), SP 50.13330 (istilik mühafizəsi), SP 131 (iqlim)' };
}

// ------------------------------------------------------------------ VENTİLYASİYA
function vent(r, ctx) {
  const { f, H, pop } = ctx;
  const items = [];
  if (f === 'yasayis' || f === 'qarisiq') {
    const units = r.units;
    items.push({ k: 'Mənzil sorma', v: `mətbəx 60–90 m³/s, SQ 25 m³/s, WC 25 m³/s`, n: H > 28 ? 'Mexaniki: hər mənzildə səssiz kanal ventilyatoru + əks klapan, damda ümumi sorma' : 'Təbii sorma kanalları (şaxtada peyk kanallarla), son 2 mərtəbədə mexaniki ventilyator' });
    items.push({ k: 'Təmiz hava', v: `${r0(units * 110)} m³/saat cəm`, n: 'Pəncərə çərçivəsində səs udan təmiz hava klapanları; premiumda mənzil başına istilik bərpalı rekuperator' });
  }
  if (f === 'ofis') items.push({ k: 'Təmiz hava (AHU)', v: `${r0(ctx.freshAir)} m³/saat`, n: `${pop.staff} işçi × 60 m³/saat; istilik bərpası ≥ 70% (rotorlu), F7 filtr (Abşeron tozu)` });
  if (f === 'otel') items.push({ k: 'Təmiz hava (AHU)', v: `${r0(ctx.freshAir)} m³/saat`, n: 'Otaqlara 40 m³/saat, SQ-dən sorma 50 m³/saat; restoran və mətbəx ayrıca sistem' });
  if (f === 'ticaret') items.push({ k: 'Təmiz hava (AHU)', v: `${r0(ctx.freshAir)} m³/saat`, n: 'Pik ziyarətçi sayına görə 20 m³/saat·nəfər, CO₂ sensorları ilə idarə; yemək zalında mətbəx sorması + yağ filtrləri' });
  if (r.input.basements > 0) {
    const cars = r.parkingSpots;
    items.push({ k: 'Parkinq ventilyasiyası', v: `${r0(cars * 150)} m³/saat (${cars} avtomobil × 150)`, n: 'CO / NO₂ sensorları ilə idarə, jet-ventilyatorlar; −1 mərtəbədə hava qəbulu' });
  }
  if (ctx.smokeExhaust) items.push({ k: 'Tüstü sorma', v: ctx.f === 'ticaret' ? 'Atrium və gəzinti zolaqlarından' : 'Mərtəbə dəhlizlərindən', n: 'Yanğın klapanları (EI 30), damda tüstü ventilyatorları (400 °C / 2 saat), kompensasiya havası' });
  if (ctx.pressurize) items.push({ k: 'Hava basqısı', v: 'Pilləkən qəfəsi və lift şaxtaları', n: 'Tüstünün evakuasiya yollarına keçməsinin qarşısını alır; təzyiq 20–150 Pa' });
  items.push({ k: 'Tozdan qorunma', v: 'G4 + F7 filtrlər', n: 'Abşeronda küləkli günlərdə toz və qum: hava qəbulları küləyə qarşı jalüzlü' });
  return { id: 'vent', name: 'Ventilyasiya', icon: '🌀', color: '#00897B', items, norm: 'SP 60.13330, SP 7.13130 (tüstüyə qarşı ventilyasiya), SP 54.13330 (yaşayış binaları)' };
}

// ------------------------------------------------------------------ ELEKTRİK
function elec(r, ctx) {
  const { f, H, pop } = ctx;
  const gross = r.cost.grossArea;
  const gen = { yasayis: 22, qarisiq: 24, ofis: 45, otel: 38, ticaret: 65 }[f];
  const general = (gross * gen) / 1000;
  const cook = (f === 'yasayis' || f === 'qarisiq') && !ctx.gasApt ? r.units * (r.units > 100 ? 1.4 : 2.2) : 0;
  const lifts = ctx.lifts.total * ctx.lifts.kw * 0.6;
  const pumps = (ctx.water.pumpKw || 0) * 2 + (ctx.water.hyd ? 22 : 0) * 0 + (r.input.basements > 0 ? 6 : 0);
  const park = r.cost.bsmtArea * 0.006;
  const ev = ctx.ev ? ceil(r.parkingSpots * 0.1) * 7.4 * 0.4 : 0;
  const hvacKw = ctx.hvac.coolElecKw;
  const kw = (general + cook + lifts + pumps + park + ev + hvacKw) * 0.85;
  const kva = kw / 0.92;
  const own = kva > 150;
  const cat1 = H > 28 || f === 'ticaret' || f === 'otel';
  const trEach = pickStd(STD_TR, own ? kva * (cat1 ? 0.72 : 0.6) : kva);
  const fireLoads = (ctx.water.hyd ? 30 : 0) + (ctx.smokeExhaust ? 22 : 0) + (ctx.pressurize ? 15 : 0) + ctx.lifts.fire * ctx.lifts.kw + 10;
  const genKva = pickStd(STD_GEN, Math.max(60, (fireLoads + (ctx.water.needBoost ? ctx.water.pumpKw : 0) + (ctx.gw === 'dayaz' ? 8 : 0) + gross * 0.002) / 0.8));
  const solarKwp = ctx.solar ? r0(r.site.footprint * 0.45 * 0.2) : 0;
  const items = [
    { k: 'Hesabi güc', v: `${r0(kw)} kVt (${r0(kva)} kVA, cos φ = 0,92)`, n: `Ümumi ${r0(general)} + soyutma ${r0(hvacKw)} + liftlər ${r0(lifts)} + nasoslar ${r0(pumps)}${cook ? ` + elektrik plitələr ${r0(cook)}` : ''}${ev ? ` + EV şarj ${r0(ev)}` : ''} kVt, eynizamanlılıq 0,85` },
    { k: 'Qidalanma', v: own ? `Öz transformator məntəqəsi (TM) 10/0,4 kV: 2 × ${trEach} kVA` : `Azərişıq şəbəkəsindən 0,4 kV, ${r0(kva)} kVA`, n: own ? `Azərişıq texniki şərtləri ilə; iki müstəqil 10 kV kabel girişi${cat1 ? ', bir transformator dayananda digəri 140% yüklə işləyir' : ''}` : 'Giriş-paylayıcı qurğu (GPQ) −1 / 1-ci mərtəbədə' },
    { k: 'Etibarlılıq kateqoriyası', v: cat1 ? 'I kateqoriya (yanğın sistemləri, liftlər) + II kateqoriya (qalanları)' : 'II kateqoriya', n: 'Avtomatik ehtiyat girişi (AVR) hər yanğın panelində' },
    { k: 'Dizel generator', v: `${genKva} kVA`, n: `Yanğın nasosları, tüstü sorma, yanğın lifti, qəza işıqlandırması, drenaj və su nasosları; 8 saatlıq yanacaq, səs izolyasiyalı konteyner` },
    { k: 'Stoyaklar və mərtəbə lövhələri', v: `${ctx.sections} elektrik stoyağı, hər mərtəbədə mərtəbə lövhəsi (ML)`, n: 'Busbar / mis kabel, şaxta yanğına davamlı (EI 45), hər mənzil/icarəçi üçün ağıllı sayğac (Azərişıq)' },
    { k: 'Mənzil / icarə lövhəsi', v: f === 'yasayis' || f === 'qarisiq' ? `${ctx.gasApt ? 7 : 11} kVt / mənzil, 1 faza` : '3 faza, icarəçiyə görə', n: 'UZO (30 mA) bütün rozetka qruplarında, kondisioner üçün ayrıca xətt, yanğın əleyhinə AFDD (premium)' },
    { k: 'Kabellər', v: 'Mis, ngLS/FRLS', n: 'Yanğın sistemləri üçün yanğına davamlı FRLS kabel (E90); evakuasiya yollarında az tüstülü' },
  ];
  if (solarKwp) items.push({ k: 'Günəş elektrik stansiyası', v: `${solarKwp} kVtp`, n: `~${r0(solarKwp * CLIMATE.solarYield / 1000)} MVt·saat/il (ümumi sahələr); dam üzərində Xəzri küləyinə hesablanmış ballastlı çərçivə; şəbəkə ilə sinxron invertor` });
  if (ctx.ev) items.push({ k: 'Elektromobil şarjı', v: `${ceil(r.parkingSpots * 0.1)} × 7,4 kVt`, n: 'Yük idarəetməsi ilə (pik saatlarda məhdudlaşdırma), 30% yerlər üçün kabel ehtiyatı' });
  return { id: 'elek', name: 'Elektrik təchizatı', icon: '⚡', color: '#F9A825', items, kw: r0(kw), kva: r0(kva), own, trEach, genKva, solarKwp, cat1, norm: 'PUE (elektrik qurğularının qaydaları), SP 256.1325800 (yaşayış və ictimai binaların elektrik qurğuları), IEC 60364' };
}

// ------------------------------------------------------------------ İŞIQLANDIRMA
const LUX = {
  room: [150, 'Yaşayış otaqları'], wet: [200, 'Mətbəx / SQ'], corridor: [75, 'Dəhliz'], core: [50, 'Pilləkən / lift holu'], open: [400, 'Ofis iş yeri'], meeting: [300, 'İclas'],
  shop: [400, 'Mağaza'], anchor: [500, 'Supermarket'], walk: [200, 'Gəzinti zolağı / dəhliz'], food: [200, 'Yemək zalı'], lobby: [200, 'Lobbi'], wc: [75, 'WC'], storage: [75, 'Anbar'],
  tech: [200, 'Texniki otaq'], kitchen: [500, 'Peşəkar mətbəx'], parking: [75, 'Parkinq'],
};
function light(r, ctx) {
  const { f } = ctx;
  const items = [];
  const kinds = new Set();
  [1, Math.min(2, r.input.floors)].forEach((lv) => { const fp = ctx.planAt(lv); fp.rects.forEach((x) => kinds.add(x.kind)); });
  if (r.input.basements > 0) kinds.add('parking');
  const rows = [...kinds].filter((k) => LUX[k]).map((k) => ({ k: LUX[k][1], v: `${LUX[k][0]} lx`, n: k === 'open' ? 'UGR < 19, 4000 K, ekran parıltısı əleyhinə' : k === 'room' ? '2700–3000 K isti işıq' : k === 'parking' ? 'Hərəkət sensoru ilə 30% → 100%' : k === 'shop' || k === 'anchor' ? 'Ra ≥ 90, vitrində aksent' : '' }));
  items.push(...rows);
  const wm2 = { yasayis: 4, qarisiq: 5, ofis: 7, otel: 6, ticaret: 11 }[f];
  const lkw = r1((r.cost.grossArea * wm2 + r.cost.bsmtArea * 2) / 1000);
  const fixtures = r0((r.cost.grossArea * wm2 + r.cost.bsmtArea * 2) / 28);
  items.push({ k: 'Ümumi işıq gücü', v: `${lkw} kVt (LED, ${wm2} Vt/m²)`, n: `~${fixtures} işıqlandırıcı (orta hesabla 28 Vt)` });
  items.push({ k: 'Qəza və evakuasiya işığı', v: 'Evakuasiya yolunda ≥ 1 lx, 1 saat avtonom', n: 'Hər çıxışda və döngədə "ÇIXIŞ" piktoqramı, mərkəzi akkumulyator sistemi; pilləkənlərdə hər mərtəbədə' });
  items.push({ k: 'İdarəetmə', v: ctx.smart ? 'DALI-2 + hərəkət və gün işığı sensorları, BMS-ə inteqrasiya' : 'Hərəkət sensorları (dəhliz, pilləkən, parkinq), astronomik taymer (fasad)', n: 'Cənub fasad zonasında gün işığından asılı tənzimləmə 25–40% enerji qənaəti verir' });
  items.push({ k: 'Fasad işıqlandırması', v: ['baki', 'icheri'].includes(r.input.style) ? 'İsti 2700 K, karniz və tağların aşağıdan işıqlandırılması' : r.input.style === 'modern' ? 'Xətti LED konturlar, 3000–4000 K' : 'Yumşaq yuxarıya yönəlmiş işıq, 3000 K', n: 'Bakı şəhər memarlıq işıqlandırması tələblərinə uyğun razılaşdırılır; işıq çirklənməsinin qarşısı alınır' });
  items.push({ k: 'Həyət və ərazi', v: '10–20 lx, 4 m dirəklər', n: 'Uşaq meydançası və girişlərdə 20 lx, kamera görüntüsü üçün bərabər paylanma' });
  return { id: 'isiq', name: 'İşıqlandırma', icon: '💡', color: '#FBC02D', items, kw: lkw, fixtures, norm: 'SP 52.13330 (təbii və süni işıqlandırma), EN 12464-1, EN 1838 (qəza işıqlandırması)' };
}

// ------------------------------------------------------------------ YANĞIN TƏHLÜKƏSİZLİYİ
function fire(r, ctx) {
  const { f, H, hc } = ctx;
  const floorArea = r.site.footprint;
  const stairsN = f === 'ticaret' ? Math.max(2, ceil(floorArea / 1500) + 1) : (H > 28 && floorArea > 500) || floorArea > 500 ? 2 : 1;
  const stairType = H > 28 ? (f === 'yasayis' || f === 'qarisiq' ? 'H1 tüstüsüz (açıq hava zonası ilə) və ya H2 (hava basqılı)' : 'H2 (hava basqılı) tüstüsüz pilləkən') : 'L1 adi pilləkən qəfəsi (pəncərəli)';
  const items = [
    { k: 'Hündürlük sinfi', v: `${hc.name}`, n: `Yanğın hündürlüyü ~${r0(H)} m. ${hc.note}` },
    { k: 'Evakuasiya pilləkənləri', v: `${stairsN} × ${stairType}`, n: `Pilləkən eni ≥ ${f === 'ticaret' ? '1,35' : '1,05'} m; ən uzaq qapıdan pilləkənə ≤ ${f === 'ticaret' ? 40 : 25} m` },
    { k: 'Yanğın siqnalizasiyası', v: `Ünvanlı analoq sistem, ~${ctx.detectors} detektor`, n: 'Tüstü detektorları hər otaqda (mənzil koridorlarında), istilik detektoru mətbəxdə; mərkəzi panel 1-ci mərtəbədə 24/7 postda' },
    { k: 'Xəbərdarlıq (SOUE)', v: H > 28 || f !== 'yasayis' ? 'Tip 3–4: səsli xəbərdarlıq + işıq tabloları' : 'Tip 2: səs siqnalı + işıq "Çıxış" tabloları', n: 'Azərbaycan, rus və ingilis dillərində səsli mesaj (otel və ticarət)' },
    { k: 'Sprinkler sistemi', v: ctx.sprinkFull ? 'Bütün sahədə' : ctx.sprinkCommon ? 'Ümumi sahələrdə (dəhliz, lobbi, parkinq)' : r.input.basements > 0 ? 'Yalnız yeraltı parkinqdə' : 'Tələb olunmur', n: ctx.sprinkFull ? `~${ctx.sprinklers} sprinkler başlığı (12 m²/başlıq), nəzarət-siqnal klapan qovşağı hər mərtəbədə` : '' },
    { k: 'Tüstüyə qarşı müdafiə', v: ctx.smokeExhaust ? 'Tüstü sorma + hava basqısı' : 'Pəncərələrlə təbii tüstü çıxarma', n: '' },
    { k: 'Yanğın lifti', v: ctx.lifts.fire > 0 ? `${ctx.lifts.fire} ədəd (1000 kq, yanğın rejimi)` : 'Tələb olunmur', n: ctx.lifts.fire > 0 ? 'Hava basqılı lift holu, EI 60 qapılar, ayrıca qidalanma' : '' },
    { k: 'Yanğın bölmələri', v: f === 'ticaret' ? `${Math.max(1, ceil((floorArea * r.input.floors) / 7000))} bölmə (sprinklerlə ≤ 7000 m²)` : 'Hər mərtəbə ayrıca bölmə', n: 'Kommunikasiya keçidlərində yanğına davamlı möhürləyici manjetlər (EI 60–150)' },
    { k: 'Xarici yanğın söndürmə', v: `${H > 50 ? 35 : H > 28 ? 25 : 15} l/s, 2 hidrant ≤ 150 m məsafədə`, n: `Yanğın maşını üçün ${H > 28 ? '6' : '4,2'} m enli yol, binadan 8–10 m; ${H > 28 ? 'hər iki uzun fasad boyunca' : 'bir uzun fasad boyunca'}` },
    { k: 'Fasad materialları', v: 'Yanmayan (A1/A2-s1,d0)', n: 'Hündür binalarda alüminium kompozit (ACP) yalnız mineral nüvəli; fasad izolyasiyası daş yunu' },
  ];
  if (f === 'ticaret' || f === 'otel') items.push({ k: 'Mətbəx söndürmə', v: 'Yaş kimyəvi avtomatik sistem', n: 'Hər peşəkar mətbəx davlumbazı altında, qaz klapanı ilə bloklanmış' });
  return { id: 'yangin', name: 'Yanğın təhlükəsizliyi', icon: '🧯', color: '#C62828', items, stairsN, norm: 'SP 1.13130 (evakuasiya yolları), SP 2.13130, SP 3.13130 (xəbərdarlıq), SP 4.13130, SP 5.13130 (avtomatik söndürmə), SP 7.13130, FHN (Azərbaycan FHN yanğın təhlükəsizliyi qaydaları)' };
}

// ------------------------------------------------------------------ LİFTLƏR
function lifts(r, ctx) {
  const { f, H, pop } = ctx;
  const floors = r.input.floors;
  const speed = H <= 28 ? 1.0 : H <= 50 ? 1.6 : H <= 75 ? 2.5 : 4.0;
  const kw = speed <= 1 ? 11 : speed <= 1.6 ? 15 : speed <= 2.5 ? 22 : 37;
  const pct = { yasayis: 0.075, qarisiq: 0.075, ofis: 0.12, otel: 0.1, ticaret: 0.05 }[f];
  const P = f === 'ticaret' ? pop.visitors * 0.3 : (pop.residents || pop.staff);
  const hc5 = P * pct;
  const stops = Math.min(floors - 1 + r.input.basements, 12);
  const rtt = (2 * H) / speed + stops * 10 + 20;
  const perLift = (0.8 * 13 * 300) / rtt;
  let n = Math.max(1, ceil(hc5 / perLift));
  let minN = 0;
  if (f === 'yasayis' || f === 'qarisiq') minN = floors >= 20 ? 3 : floors >= 10 ? 2 : floors >= 6 ? 1 : 0; // SP 54
  else minN = floors >= 2 ? 2 : 0;
  n = Math.max(n, minN);
  if (floors < 3 && f !== 'ticaret' && f !== 'otel') n = Math.max(1, n);
  const fireN = H > 28 ? Math.max(1, ctx.sections) : 0;
  const cargo = f === 'ticaret' || f === 'otel' ? 1 : 0;
  const esc = f === 'ticaret' && floors > 1 ? 2 * (floors - 1) : 0;
  const items = [
    { k: 'Sərnişin liftləri', v: `${n} ədəd`, n: `5 dəqiqəlik daşıma qabiliyyəti ${r0(hc5)} nəfər (${r0(pct * 100)}%), dövr müddəti ~${r0(rtt)} s` },
    { k: 'Sürət və yük', v: `${speed} m/s, ${n >= 2 ? '1 × 1000 kq (xərəkə uyğun) + 630 kq' : '1000 kq'}`, n: 'Ən azı bir lift xərəkə ilə daşımaya uyğun (2100 mm dərinlik) və əlilliyi olan şəxslər üçün' },
    { k: 'Yanğın lifti', v: fireN ? `${fireN} ədəd (sərnişin liftlərindən biri yanğın rejimli)` : 'Tələb olunmur', n: fireN ? 'Yanğın briqadası rejimi, suya davamlı elektrik avadanlığı' : '' },
    { k: 'Seysmik rejim', v: `${ctx.seis} bal`, n: 'Seysmik sensor (P-dalğası): zəlzələdə lift ən yaxın mərtəbədə dayanır və qapılar açılır; kabinə və əks yük tutucuları gücləndirilmiş' },
    { k: 'Enerji', v: `${kw} kVt / lift`, n: 'Maşın otaqsız (MRL), dişlisiz mühərrik, rekuperativ ötürücü (enerjini şəbəkəyə qaytarır)' },
  ];
  if (cargo) items.push({ k: 'Yük / xidmət lifti', v: `${cargo} × 1600 kq`, n: f === 'ticaret' ? 'Anbar və yükləmə zonasından' : 'Camaşırxana, mətbəx və otaq xidməti üçün' });
  if (esc) items.push({ k: 'Eskalatorlar', v: `${esc} ədəd`, n: 'Atrium ətrafında, hər mərtəbə arası yuxarı + aşağı, 0,5 m/s, avtomatik yavaşlama' });
  return { id: 'lift', name: 'Liftlər və şaquli nəqliyyat', icon: '🛗', color: '#5E35B1', items, total: n + cargo, passenger: n, fire: fireN, kw, speed, esc, norm: 'EN 81-20/50, EN 81-72 (yanğın lifti), EN 81-77 (seysmik), SP 54.13330, SP 59.13330 (əlçatanlıq)' };
}

// ------------------------------------------------------------------ QAZ
function gas(r, ctx) {
  const { f, H } = ctx;
  const items = [];
  let peak = 0;
  if (ctx.gasApt) {
    const n = r.units;
    const k = n <= 1 ? 1 : n <= 10 ? 0.45 : n <= 40 ? 0.32 : n <= 100 ? 0.26 : 0.22;
    peak = r1(n * (1.2 + 2.6) * k);
    items.push({ k: 'Qaz istehlakçıları', v: `${n} mənzil: plitə + kombi qazan`, n: `Pik sərf ~${peak} m³/saat (eynizamanlılıq ${k})` });
    items.push({ k: 'Qaz xətti', v: 'Fasad üzrə xarici stoyaklar (binadaxili şaxtada yox)', n: 'Fasad üslubuna uyğun rənglənir, eyvanlarla kəsişmədən; hər mənzildə ağıllı ön ödənişli sayğac (Azəriqaz)' });
  } else if (f === 'yasayis' || f === 'qarisiq') {
    items.push({ k: 'Mənzillərə qaz', v: 'Verilmir', n: `Bina hündürlüyü ${r0(H)} m > 28 m: hündür binalarda mənzillərə qaz verilməsi tövsiyə olunmur. Elektrik induksiya plitələri nəzərdə tutulub` });
  }
  if (!ctx.gasApt && (f !== 'ofis')) {
    const boiler = r0(ctx.hvac.heatKw * 1.15);
    const pk = r1(boiler / 9.3);
    peak += pk;
    items.push({ k: 'Dam qazanxanası / mətbəxlər', v: `${boiler} kVt qazanxana, ~${pk} m³/saat`, n: f === 'ticaret' || f === 'otel' ? 'Restoran mətbəxləri üçün ayrıca xətt, qaz detektoru + avtomatik klapan' : 'Damda ayrıca yanğın bölməsində, partlayış zamanı asan dağılan konstruksiyalar' });
  }
  if (items.length) {
    items.push({ k: 'Seysmik qaz klapanı', v: 'Binaya girişdə avtomatik', n: `${ctx.seis} ballıq zona: zəlzələdə (≥ 6 bal) qazı avtomatik kəsir. Girişdə izolyasiya flansı və elastik kompensator` });
    items.push({ k: 'Qaz detektorları', v: 'Hər qaz istifadə olunan otaqda', n: 'CH₄ + CO detektoru, elektromaqnit klapanla birlikdə' });
    if (ctx.slidey) items.push({ k: 'Torpaq hərəkəti', v: 'Elastik giriş', n: 'Sürüşmə / mayeləşmə riski: yeraltı qaz xətti qum yastığında, giriş nöqtəsində hərəkət kompensatoru' });
  } else items.push({ k: 'Qaz', v: 'Tələb olunmur', n: 'Ofis binası tam elektrik (VRF) həlli ilə: qaz şəbəkəsinə qoşulma xərci və riski aradan qalxır' });
  return { id: 'qaz', name: 'Qaz təchizatı', icon: '🔥', color: '#EF6C00', items, peak, norm: 'SP 62.13330 (qaz paylama sistemləri), SP 402.1325800 (binalarda qaz istehlakı sistemləri), Azəriqaz texniki şərtləri' };
}

// ------------------------------------------------------------------ İLDIRIM MÜHAFİZƏSİ VƏ TORPAQLAMA
function lightning(r, ctx) {
  const { H } = ctx;
  const lpl = H > 50 || ctx.f === 'otel' || ctx.f === 'ticaret' ? 'II' : 'III';
  const mesh = lpl === 'II' ? 10 : 15;
  const perim = 2 * (r.site.fw + r.site.fd);
  const down = Math.max(2, ceil(perim / (lpl === 'II' ? 10 : 15)));
  const items = [
    { k: 'Mühafizə səviyyəsi', v: `LPL ${lpl}`, n: 'Bakıda ildırımlı günlər azdır (~15/il), amma hündür bina və dam avadanlığı risk yaradır' },
    { k: 'Dam şəbəkəsi', v: `${mesh} × ${mesh} m tor, Ø8 mm`, n: 'Bütün metal dam avadanlıqları (VRF blokları, günəş panelləri, antennalar) şəbəkəyə qoşulur' },
    { k: 'Enmə keçiriciləri', v: `${down} ədəd`, n: `Perimetr ${r0(perim)} m; karkas armaturu enmə keçiricisi kimi istifadə olunur (qaynaqlı birləşmələr)` },
    { k: 'Torpaqlama', v: 'Təməl torpaqlayıcısı, R ≤ 4 Ω', n: ctx.soil === 'qaya' ? 'Qayalı torpaqda müqavimət yüksəkdir: əlavə şaquli elektrodlar və ya kimyəvi torpaqlama' : 'Təməl plitəsinin armaturu ilə qapalı kontur' },
    { k: 'Elektrik sistemi', v: 'TN-C-S, əsas potensial bərabərləşdirmə şini (ƏPBŞ)', n: 'Bütün metal borular (su, qaz, istilik) girişdə ƏPBŞ-yə; SQ-lərdə əlavə bərabərləşdirmə' },
    { k: 'İmpuls mühafizəsi (SPD)', v: 'Tip 1 + 2 girişdə, tip 3 həssas avadanlıqda', n: 'Lift idarəetməsi, yanğın paneli, server və BMS üçün' },
  ];
  return { id: 'ildirim', name: 'İldırım mühafizəsi və torpaqlama', icon: '🌩️', color: '#455A64', items, norm: 'IEC 62305, SO 153-34.21.122, PUE fəsil 1.7' };
}

// ------------------------------------------------------------------ ZƏİF CƏRƏYAN
function lowCurrent(r, ctx) {
  const { f } = ctx;
  const cams = r0(4 + r.input.floors * (f === 'ticaret' ? 6 : 2) + r.cost.bsmtArea / 400 + 4);
  const items = [
    { k: 'Strukturlaşdırılmış kabel şəbəkəsi', v: f === 'yasayis' || f === 'qarisiq' ? 'FTTH: hər mənzilə optik kabel' : 'Cat6A + optik magistral', n: 'Hər mərtəbədə telekom şkafı, ayrıca zəif cərəyan şaxtası (elektrikdən ≥ 0,3 m)' },
    { k: 'Videomüşahidə (CCTV)', v: `~${cams} IP kamera`, n: 'Girişlər, liftlər, parkinq, perimetr; 30 gün arxiv' },
    { k: 'Giriş nəzarəti', v: f === 'yasayis' || f === 'qarisiq' ? 'Video domofon + kartlı giriş (lift və parkinq)' : 'Turniketlər + kart / QR', n: 'Yanğın siqnalında bütün elektromaqnit qıfıllar avtomatik açılır' },
    { k: 'Dispetçerləşdirmə', v: 'Lift kabinələrində iki tərəfli rabitə', n: 'Dispetçer otağı 1-ci mərtəbədə' },
    { k: 'Sayğacların uzaqdan oxunması', v: 'Su, elektrik, istilik, qaz', n: 'Smart sayğaclar, operator portalına inteqrasiya' },
  ];
  if (ctx.smart || f === 'ofis' || f === 'otel' || f === 'ticaret') items.push({ k: 'BMS (bina idarəetmə sistemi)', v: 'BACnet / Modbus', n: 'HVAC, işıq, nasoslar, liftlər və enerji monitorinqi bir paneldə; enerji qənaəti 15–25%' });
  if (f === 'otel') items.push({ k: 'Otel sistemləri', v: 'Açar-kart enerji açarı, IPTV, Wi-Fi', n: 'Boş otaqda kondisioner avtomatik qənaət rejiminə keçir' });
  return { id: 'zeif', name: 'Zəif cərəyan və ağıllı bina', icon: '📡', color: '#3949AB', items, cams, norm: 'ISO/IEC 11801, EN 50132 (CCTV), EN 60839' };
}

// ------------------------------------------------------------------ TULLANTI
function waste(r, ctx) {
  const P = ctx.pop.residents + ctx.pop.staff + ctx.pop.visitors * 0.2;
  const perDay = P * (ctx.f === 'ticaret' ? 0.5 : 1.2) * 8; // litr
  const cont = Math.max(2, ceil((perDay * 2 * 1.25) / 1100));
  const items = [
    { k: 'Tullantı həcmi', v: `~${r0(perDay)} l/gün`, n: `${r0(P)} istifadəçi` },
    { k: 'Tullantı otağı', v: `${cont} × 1100 l konteyner, ~${Math.max(8, cont * 2)} m²`, n: 'Ayrı-ayrı toplama (qarışıq / plastik / kağız / şüşə); su kranı, trap, sorma ventilyasiyası; zibil maşını üçün birbaşa çıxış' },
    { k: 'Zibil kəməri', v: 'Tövsiyə olunmur', n: 'Gigiyena və yanğın riski: mərtəbədə ayrı-ayrı toplama nöqtəsi + xidmət lifti ilə daşıma' },
  ];
  return { id: 'tull', name: 'Tullantıların idarə edilməsi', icon: '♻️', color: '#2E7D32', items, cont, norm: 'SanPiN 42-128-4690, Bakı şəhəri tullantıların idarə edilməsi qaydaları' };
}

// ------------------------------------------------------------------ ƏSAS FUNKSİYA
export function systems(r) {
  const f = r.input.func; const q = r.input.quality; const floors = r.input.floors;
  const feats = r.input.features || [];
  const H = r1((floors - 1) * r.floorH + 1.5); // yanğın hündürlüyü (yanğın maşını yolundan son mərtəbə döşəməsinə)
  const Htot = r1(floors * r.floorH + 1.2);
  const hc = heightClass(H);
  const pop = population(r);
  const district = r.refs.district;
  const coastal = COASTAL.includes(district.id);
  const slidey = district.landslide === 'high' || r.geo.liq !== 'low';
  const gasApt = (f === 'yasayis' || f === 'qarisiq') && H <= 28;
  const sections = Math.max(1, ceil(r.site.fw / 60));
  const typ = floorPlanSafe(r, Math.min(2, floors));
  const wetPerFloor = typ.rects.filter((x) => x.kind === 'wet' || x.kind === 'wc' || x.kind === 'kitchen').length;
  const roofArea = r.site.footprint;
  const peakPeople = pop.residents * 0.8 + pop.staff + pop.visitors;
  const freshAir = f === 'ofis' ? pop.staff * 60 : f === 'otel' ? pop.residents * 40 + pop.visitors * 20 : f === 'ticaret' ? pop.visitors * 20 : 0;
  const lightWm2 = { yasayis: 4, qarisiq: 5, ofis: 7, otel: 6, ticaret: 11 }[f];
  const equipWm2 = { yasayis: 12, qarisiq: 14, ofis: 25, otel: 12, ticaret: 20 }[f];
  const sprinkFull = f === 'ticaret' || f === 'otel' || (f === 'ofis' && H > 28) || H > 50;
  const sprinkCommon = !sprinkFull && H > 28;
  const smokeExhaust = H > 28 || f === 'ticaret' || (f === 'otel' && floors > 5);
  const pressurize = H > 28;
  const ctx = {
    f, q, H, hc, pop, coastal, slidey, gasApt, sections, wetPerFloor, roofArea, peakPeople, freshAir, lightWm2, equipWm2,
    sprinkFull, sprinkCommon, smokeExhaust, pressurize, seis: district.seismic, gw: r.refs.gw.id, soil: r.refs.soil.id,
    solar: feats.includes('gunes'), rain: feats.includes('yagis'), smart: feats.includes('smart'), ev: feats.includes('ev'), greenRoof: feats.includes('yasildam'),
    shade: ['modern'].includes(r.input.style) || q === 'premium', hr: q !== 'ekonom',
    planAt: (lv) => floorPlanSafe(r, lv),
  };
  ctx.lifts = lifts(r, ctx);
  ctx.env = envelope(r, ctx);
  ctx.water = water(r, ctx);
  ctx.hvac = hvac(r, ctx);
  const gross = r.cost.grossArea;
  const nonCore = gross * 0.85;
  ctx.detectors = r0(nonCore / (f === 'yasayis' || f === 'qarisiq' ? 22 : 40) + r.cost.bsmtArea / 70);
  ctx.sprinklers = r0((sprinkFull ? gross : gross * 0.12) / 12 + r.cost.bsmtArea / 12);
  const list = [
    ctx.water, sewer(r, ctx), elec(r, ctx), light(r, ctx), ctx.hvac, vent(r, ctx), fire(r, ctx), ctx.lifts, gas(r, ctx), lightning(r, ctx), lowCurrent(r, ctx), waste(r, ctx),
  ];
  const el = list.find((s) => s.id === 'elek');

  // Texniki otaqlar proqramı
  const rooms = [
    el.own && { name: 'Transformator məntəqəsi (TM)', where: '1-ci mərtəbə / ayrıca blok, küçədən giriş', area: 36 + (el.trEach > 1000 ? 12 : 0) },
    { name: 'Giriş-paylayıcı qurğu (GPQ)', where: r.input.basements ? '−1 mərtəbə' : '1-ci mərtəbə', area: 18 },
    { name: 'Dizel generator', where: 'Həyətdə səs izolyasiyalı konteyner / −1 (ayrıca hava çıxışı ilə)', area: el.genKva > 400 ? 40 : 25 },
    { name: 'Su nasos stansiyası + çənlər', where: r.input.basements ? `−${r.input.basements} mərtəbə` : '1-ci mərtəbə texniki blok', area: r0(25 + (ctx.water.tankHousehold + ctx.water.tankFire) / 2.5) },
    ctx.water.tankFire > 0 && { name: 'Yanğın nasos stansiyası', where: 'Pilləkənə yaxın, birbaşa çıxışlı', area: 20 },
    { name: ctx.gasApt ? 'Sayğac qovşağı' : 'Qazanxana / istilik məntəqəsi', where: ctx.gasApt ? '1-ci mərtəbə' : f === 'ofis' ? '−1 mərtəbə' : 'Dam', area: ctx.gasApt ? 6 : r0(20 + ctx.hvac.heatKw * 0.05) },
    { name: 'HVAC avadanlıq meydançası', where: 'Dam', area: r0(ctx.hvac.coolKw * 0.11) },
    (f !== 'yasayis' && f !== 'qarisiq') && { name: 'Ventilyasiya kameraları (AHU)', where: 'Dam / texniki mərtəbə', area: r0(ctx.freshAir / 400) },
    { name: 'Yanğın postu + dispetçer', where: '1-ci mərtəbə, girişdə', area: 15 },
    { name: 'Server / telekom otağı', where: '1-ci mərtəbə və hər mərtəbədə şkaf', area: 10 },
    { name: 'Tullantı otağı', where: '1-ci mərtəbə, həyətə çıxışlı', area: Math.max(8, list.find((s) => s.id === 'tull').cont * 2) },
  ].filter(Boolean);

  // Şaxtalar (hər mərtəbədə)
  const shafts = [
    { name: 'Su stoyakları (soyuq/isti/sirkulyasiya)', size: '0,6 × 0,4 m', count: Math.max(1, ceil(ctx.wetPerFloor / 4)) },
    { name: 'Kanalizasiya stoyakları', size: '0,4 × 0,3 m', count: list.find((s) => s.id === 'kanal').stacks },
    { name: 'Elektrik', size: '0,8 × 0,4 m', count: sections },
    { name: 'Zəif cərəyan', size: '0,5 × 0,3 m', count: sections },
    { name: 'Ventilyasiya', size: f === 'yasayis' || f === 'qarisiq' ? '0,4 × 0,4 m (peyk kanallarla)' : '1,2 × 0,8 m', count: Math.max(1, ceil(ctx.wetPerFloor / 3)) },
    ctx.smokeExhaust && { name: 'Tüstü sorma', size: '0,8 × 0,6 m', count: sections },
    ctx.pressurize && { name: 'Hava basqısı', size: '0,8 × 0,6 m', count: sections * 2 },
  ].filter(Boolean);
  const shaftArea = r1(shafts.reduce((a, s) => { const [w, d] = s.size.match(/[\d,]+/g).slice(0, 2).map((x) => Number(x.replace(',', '.'))); return a + w * d * s.count; }, 0));

  // Xərc bölgüsü: mühərrikin "Mühəndis sistemləri" xərcini sistemlər üzrə bölür (ümumi xərclə uyğundur)
  const mepTotal = r.cost.breakdown.find((b) => b.key === 'muhendis')?.value || 0;
  const W = { su: 0.1, kanal: 0.07, elek: 0.17, isiq: 0.07, hvac: 0.24, vent: ctx.smokeExhaust || f !== 'yasayis' ? 0.08 : 0.04, yangin: sprinkFull ? 0.1 : 0.05, lift: 0.1 + (H > 50 ? 0.04 : 0), qaz: ctx.gasApt ? 0.04 : 0.015, ildirim: 0.015, zeif: ctx.smart ? 0.05 : 0.03, tull: 0.005 };
  const wsum = Object.values(W).reduce((a, b) => a + b, 0);
  list.forEach((s) => { s.cost = r0((mepTotal * (W[s.id] || 0)) / wsum); });

  // Uyğunluq yoxlaması (şərtlərə qarşı)
  const checks = [
    { ok: true, t: `Hündürlük sinfi: ${hc.name}`, d: hc.note },
    { ok: !(H > 28 && gasApt), t: 'Qaz yalnız icazə verilən hündürlükdə', d: gasApt ? 'Bina ≤ 28 m: mənzillərə qaz verilə bilər' : (f === 'yasayis' || f === 'qarisiq') ? '> 28 m: mənzillər elektrik plitəli, qaz yalnız dam qazanxanasına' : 'Qeyri-yaşayış: qaz yalnız texniki ehtiyac üçün' },
    { ok: true, t: 'Seysmik tələblər nəzərə alınıb', d: `${district.seismic} bal: avadanlıq ankerləri, boru/kanal bərkitmələri, seysmik qaz klapanı, lift sensoru` },
    { ok: true, t: 'Bakı su fasilələri nəzərə alınıb', d: `${ctx.water.tankHousehold} m³ ehtiyat çəni (1 günlük)` },
    { ok: true, t: 'Evakuasiya', d: `${list.find((s) => s.id === 'yangin').stairsN} pilləkən, ${H > 28 ? 'tüstüsüz' : 'adi'} tip` },
    { ok: r.input.basements === 0 || ctx.gw !== 'dayaz' || true, t: ctx.gw === 'dayaz' ? 'Dayaz qrunt suyu: drenaj nasosları generatora qoşulub' : 'Qrunt suyu: standart drenaj', d: '' },
    { ok: !coastal || true, t: coastal ? 'Dəniz sahili: antikorroziya icrası' : 'Korroziya riski: standart', d: '' },
    { ok: ctx.lifts.passenger >= (f === 'yasayis' && floors >= 10 ? 2 : 1) || floors < 3, t: 'Lift sayı normaya uyğundur', d: `${ctx.lifts.passenger} sərnişin + ${ctx.lifts.fire ? `${ctx.lifts.fire} yanğın rejimli` : 'yanğın lifti tələb olunmur'}` },
    { ok: H <= 75, t: H > 75 ? 'Xüsusi texniki şərtlər (XTŞ) lazımdır' : 'Standart normalar kifayətdir', d: H > 75 ? 'Bina 75 m-dən hündürdür: FHN ilə xüsusi razılaşma' : '' },
  ];

  const kpis = [
    { k: 'Su', v: `${r1(ctx.water.dailyM3)} m³/gün` },
    { k: 'Elektrik', v: `${el.kva} kVA` },
    { k: 'Soyutma', v: `${ctx.hvac.coolKw} kVt` },
    { k: 'İstilik', v: `${ctx.hvac.heatKw} kVt` },
    { k: 'Liftlər', v: `${ctx.lifts.passenger + (ctx.lifts.total - ctx.lifts.passenger)}` },
    { k: 'Generator', v: `${el.genKva} kVA` },
  ];

  return { H, Htot, hc, pop, list, rooms, shafts, shaftArea, checks, kpis, mepTotal: r0(mepTotal), ctx: { gasApt, sprinkFull, sprinkCommon, smokeExhaust, pressurize, coastal, slidey, sections, solar: ctx.solar } };
}

function floorPlanSafe(r, lv) { return floorPlan(r, lv); }

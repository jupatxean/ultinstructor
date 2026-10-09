import {
  DISTRICTS, LANDSLIDE, SOILS, SLOPES, FUNCTIONS, QUALITIES, STYLES, GROUNDWATER, FEATURES, byId,
} from './data';

const KPA_PER_FLOOR = 12; // tipik yaşayış binasının təməl təzyiqi, kPa/mərtəbə (təxmini)
const KPA_PER_BASEMENT = 15;

const SETBACK_FRONT = 5; // m (cənub tərəf — küçə)
const SETBACK_SIDE = 3; // m
const MAX_COVERAGE = 0.6;
const SOFT_COST = 0.06; // layihə, icazələr
const CONTINGENCY = 0.08; // gözlənilməz xərclər

const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

function heightMult(f) {
  if (f > 25) return 1.2;
  if (f > 16) return 1.12;
  if (f > 9) return 1.06;
  return 1.0;
}

function foundationAdvice(soil, slope, floors, landslide, ctx = {}) {
  const { gw, bearing, pressure, liq } = ctx;
  let type; let why;
  if (soil.id === 'qaya') {
    if (floors <= 9) { type = 'Lent (zolaq) təməl'; why = 'Möhkəm qaya əsası yükü birbaşa daşıyır, dərin təmələ ehtiyac yoxdur.'; }
    else { type = 'Monolit plita təməl'; why = 'Qaya əsası möhkəmdir, hündürlük artdıqca yükü bərabər paylamaq üçün plita kifayətdir.'; }
  } else if (soil.id === 'qum') {
    if (floors <= 5) { type = 'Lent təməl'; why = 'Az mərtəbəli bina üçün qumlu torpaq kifayət qədər daşıyıcıdır.'; }
    else if (floors <= 14) { type = 'Monolit plita təməl'; why = 'Qum çökməyə meyllidir, plita yükü geniş sahəyə yayır.'; }
    else { type = 'Svay + plita (svay-rostverk)'; why = 'Hündür bina üçün yükü dərin, sıx qatlara ötürmək lazımdır.'; }
  } else if (soil.id === 'gil') {
    if (floors <= 9) { type = 'Monolit plita təməl'; why = 'Gil nəmlikdən şişib-büzülür, plita qeyri-bərabər çökməni azaldır.'; }
    else { type = 'Svay + plita (svay-rostverk)'; why = 'Gilli torpaqda hündür bina üçün svaylar yükü möhkəm qatlara ötürür.'; }
  } else if (soil.id === 'sulu') {
    type = floors <= 9 ? 'Plita təməl, sulfata davamlı beton' : 'Svay + plita, sulfata davamlı beton';
    why = 'Duzlu (şoran) torpaq adi betonu korroziyaya uğradır; sulfata davamlı sement və qoruyucu örtük vacibdir.';
  } else {
    type = 'Dərin svay təməl (mütləq)';
    why = 'Tökmə torpaq daşıyıcı deyil; svaylar onu keçib təbii qatlara çatmalıdır.';
  }
  // Daşıma qabiliyyəti və mayeləşmə yoxlaması
  if (!/svay/i.test(type) && bearing && pressure > bearing) {
    type = 'Svay + plita (svay-rostverk)';
    why = `Binanın təxmini təzyiqi (~${Math.round(pressure)} kPa) torpağın daşıma qabiliyyətini (~${Math.round(bearing)} kPa) aşır; yük svaylarla dərin qatlara ötürülməlidir.`;
  }
  if (liq === 'high' && !/svay/i.test(type)) {
    type = 'Svay təməl (mayeləşən qatı keçməklə)';
    why = 'Zəlzələdə suya doymuş qum mayeləşə bilər; svaylar bu qatı keçib möhkəm əsasa söykənməlidir.';
  }
  const extras = [];
  if (slope.id !== 'duz') extras.push('Maili sahə üçün dayaq divarları və pilləli təməl');
  if (landslide !== 'low') extras.push('Sürüşməyə qarşı ankerli dayaq sistemi və geoloji monitorinq');
  if (gw === 'dayaz') extras.push('Tam hidroizolyasiya, drenaj və qazıntı zamanı suyun vurulması');
  else if (gw === 'orta') extras.push('Zirzəmi üçün hidroizolyasiya və drenaj');
  extras.push('Seysmik izolyasiya kəmərləri (antiseysmik kəmər)');
  return { type, why, extras };
}

const LVL_DOWN = { fail: 'warn', warn: 'ok', ok: 'ok' };

function geology({ soil, gw, slope, district, floors, basements, bearing, bearingSource, pressure, liq, features, footprint }) {
  const items = [];
  const ratio = pressure / bearing;
  const plateFloors = Math.max(1, Math.floor((bearing - basements * KPA_PER_BASEMENT) / KPA_PER_FLOOR));
  items.push({
    key: 'dasima', title: 'Daşıma qabiliyyəti',
    level: ratio <= 0.8 ? 'ok' : 'warn',
    value: `${Math.round(bearing)} kPa ${bearingSource === 'input' ? '(geoloji hesabat)' : '(təxmini)'}`,
    text: ratio <= 0.8
      ? `Bina ~${Math.round(pressure)} kPa təzyiq yaradır, torpaq bunu ehtiyatla daşıyır.`
      : `Bina ~${Math.round(pressure)} kPa təzyiq yaradır. Plita təməllə maksimum ~${plateFloors} mərtəbə; daha hündür bina üçün svay lazımdır.`,
  });
  const soilText = {
    qaya: 'Ən etibarlı əsas: çökmə minimal, dərin təmələ ehtiyac yoxdur.',
    qum: 'Yaxşı drenaj, amma titrəyişdə sıxlaşa bilər; sıxlıq (SPT) yoxlanmalıdır.',
    gil: 'Nəmlikdən şişib-büzülür, uzunmüddətli çökmə verir.',
    sulu: 'Duzlar betonu və armaturu korroziyaya uğradır; sulfata davamlı beton tələb olunur.',
    dolma: 'Süni tökmə qat daşıyıcı deyil; təbii qata qədər svay mütləqdir.',
  };
  items.push({ key: 'novu', title: 'Torpağın növü və tərkibi', level: { qaya: 'ok', qum: 'ok', gil: 'warn', sulu: 'warn', dolma: 'fail' }[soil.id], value: soil.name, text: soilText[soil.id] });
  items.push({
    key: 'su', title: 'Yeraltı suyun səviyyəsi',
    level: gw.id === 'derin' ? 'ok' : gw.id === 'orta' ? (basements > 1 ? 'warn' : 'ok') : (basements > 0 ? 'fail' : 'warn'),
    value: gw.name,
    text: gw.id === 'derin'
      ? 'Zirzəmi və təməl üçün su problemi gözlənilmir.'
      : gw.id === 'orta'
        ? 'Zirzəmi üçün hidroizolyasiya və drenaj lazımdır.'
        : `Dayaz su: ${basements > 0 ? `${basements} mərtəbəli yeraltı parkinq bahalaşır (+35%), ` : ''}qazıntıda su vurulmalı, tam hidroizolyasiya şərtdir.`,
  });
  const settle = soil.id === 'dolma' ? 'fail' : soil.id === 'gil' || (soil.id === 'qum' && gw.id === 'dayaz') || soil.id === 'sulu' ? 'warn' : 'ok';
  items.push({
    key: 'cokme', title: 'Çökmə və sıxılma', level: settle,
    value: settle === 'ok' ? 'Aşağı' : settle === 'warn' ? 'Orta' : 'Yüksək',
    text: settle === 'ok'
      ? 'Qeyri-bərabər çökmə riski aşağıdır.'
      : 'Qeyri-bərabər çökmə divarlarda çatlara səbəb ola bilər; plita və ya svay, çökmə monitorinqi tövsiyə olunur.',
  });
  const slopeLvl = district.landslide === 'high' || slope.id === 'cox' ? (district.landslide === 'high' && slope.id !== 'duz' ? 'fail' : 'warn') : district.landslide === 'medium' || slope.id === 'az' ? 'warn' : 'ok';
  items.push({
    key: 'yamac', title: 'Yamacın dayanıqlığı', level: slopeLvl,
    value: `${slope.name} · sürüşmə ${LANDSLIDE[district.landslide].label.toLowerCase()}`,
    text: slopeLvl === 'ok'
      ? 'Sürüşmə və eroziya riski aşağıdır.'
      : 'Yamac dayanıqlığı hesablanmalı, ankerli dayaq divarları və drenaj qurulmalıdır.',
  });
  let seisLvl = liq === 'high' ? 'fail' : district.seismic >= 9 || liq === 'medium' ? 'warn' : 'ok';
  const hasIso = features.includes('seysmik');
  if (hasIso) seisLvl = LVL_DOWN[seisLvl];
  items.push({
    key: 'seysmik', title: 'Seysmik xüsusiyyətlər və mayeləşmə', level: seisLvl,
    value: `~${district.seismic} bal · mayeləşmə ${liq === 'high' ? 'yüksək' : liq === 'medium' ? 'orta' : 'aşağı'}`,
    text: (liq === 'high'
      ? 'Suya doymuş qumlu torpaq zəlzələdə mayeləşə bilər; svay və ya torpağın bərkidilməsi şərtdir.'
      : district.seismic >= 9 ? '9 ballıq zonada antiseysmik kəmərlər və monolit karkas mütləqdir.' : 'Standart antiseysmik tədbirlər kifayətdir.')
      + (hasIso ? ' Seysmik izolyatorlar riski əhəmiyyətli azaldır.' : ''),
  });

  // Geoloji kəşfiyyat planı
  const boreholes = Math.max(3, Math.ceil(footprint / 250)) + (district.landslide !== 'low' ? 2 : 0);
  const depth = Math.round(Math.max(15, 10 + floors * 1.2 + basements * 3.5));
  const tests = [
    `${boreholes} qazma quyusu, hər biri ~${depth} m dərinlikdə`,
    'Standart penetrasiya testi (SPT) — torpağın sıxlığı',
    'Laboratoriya: qranulometriya, nəmlik, kəsilmə müqaviməti',
    'Qrunt suyunun səviyyəsi və kimyəvi tərkibi (sulfat, xlorid)',
  ];
  if (district.seismic >= 9) tests.push('Seysmik mikrorayonlaşdırma (sahənin seysmik təsnifatı)');
  if (district.landslide !== 'low') tests.push('Yamac dayanıqlığı hesabı və inklinometr monitorinqi');
  const surveyCost = boreholes * depth * 55 + 2500 + (district.seismic >= 9 ? 3000 : 0) + (district.landslide !== 'low' ? 4000 : 0);
  const surveyDays = 10 + boreholes * 2;
  return { items, plateFloors, survey: { boreholes, depth, tests, cost: surveyCost, days: surveyDays } };
}

function orientation(w, d, landslide) {
  const notes = [];
  const longEW = w >= d;
  notes.push(longEW
    ? 'Binanın uzun oxu şərq–qərb istiqamətindədir: əsas fasad cənuba baxır, qışda maksimum günəş, yayda kölgələnmə asandır.'
    : 'Sahə şimal–cənub istiqamətində uzanır: şərq/qərb fasadları çox qızacaq, qərb tərəfə şaquli günlüklər (brise-soleil) tövsiyə olunur.');
  notes.push('Şimal fasadı Xəzri küləyinə (şimal / şimal-qərb) açıqdır: bu tərəfdə pəncərələri azaldın, giriş və balkonları cənub və ya şərqdə yerləşdirin.');
  notes.push('Pilləkən, lift və texniki otaqları şimal tərəfdə yerləşdirmək binanı küləkdən qoruyan "bufer" yaradır.');
  if (landslide !== 'low') notes.push('Bina kütləsini yamacın yuxarı hissəsindən uzaq, mümkün qədər düz hissədə yerləşdirin.');
  return { longEW, azimuth: longEW ? 180 : 90, notes };
}

// --- Mərtəbə planı generatoru (metrlərlə, şimal yuxarıda, x = şərq, y = cənub) ---
function unitArea(type, q) {
  const base = { 1: 48, 2: 72, 3: 100 }[type];
  return base * (q === 'premium' ? 1.2 : q === 'ekonom' ? 0.9 : 1);
}

function classifyUnit(area, q) {
  const k = q === 'premium' ? 1.2 : q === 'ekonom' ? 0.9 : 1;
  const a = area / k;
  if (a < 60) return 1;
  if (a < 88) return 2;
  if (a < 135) return 3;
  return 4;
}

function fillBand(rects, x0, x1, y, h, corridorSide, kind, q, counter) {
  const pattern = kind === 'otel' ? [0] : q === 'ekonom' ? [1, 2, 1, 2, 3] : q === 'premium' ? [3, 2, 3] : [2, 3, 1, 2];
  const minW = kind === 'otel' ? 3.6 : 4.5;
  let x = x0; let i = 0;
  if (x1 - x0 < minW) {
    rects.push({ x: x0, y, w: x1 - x0, h, kind: 'tech', label: 'Texniki' });
    return;
  }
  while (x1 - x > 0.01) {
    let wantArea;
    if (kind === 'otel') wantArea = q === 'premium' ? 38 : q === 'ekonom' ? 22 : 30;
    else wantArea = unitArea(pattern[i % pattern.length], q);
    let uw = Math.max(minW, wantArea / h);
    if (x1 - (x + uw) < minW) uw = x1 - x;
    const area = uw * h;
    const wet = Math.min(3, h * 0.35);
    const wetY = corridorSide === 'north' ? y : y + h - wet;
    const roomY = corridorSide === 'north' ? y + wet : y;
    const roomH = h - wet;
    if (kind === 'otel') {
      counter.rooms += 1;
      rects.push({ x, y, w: uw, h, kind: 'unit', label: `Otaq ${counter.rooms}`, area: round(area, 1), unitType: 'otel' });
      rects.push({ x, y: wetY, w: uw * 0.45, h: wet, kind: 'wet', label: 'SQ' });
      rects.push({ x: x + uw * 0.45, y: wetY, w: uw * 0.55, h: wet, kind: 'hall', label: 'Giriş' });
      rects.push({ x, y: roomY, w: uw, h: roomH, kind: 'room', label: 'Yataq otağı' });
    } else {
      const t = classifyUnit(area, q);
      counter[t] = (counter[t] || 0) + 1;
      counter.total += 1;
      rects.push({ x, y, w: uw, h, kind: 'unit', label: `${t} otaqlı · ${round(area)} m²`, area: round(area, 1), unitType: t });
      rects.push({ x, y: wetY, w: uw * 0.55, h: wet, kind: 'wet', label: 'Mətbəx' });
      rects.push({ x: x + uw * 0.55, y: wetY, w: uw * 0.45, h: wet, kind: 'wet', label: 'SQ' });
      const cols = Math.max(1, t);
      const shares = Array.from({ length: cols }, (_, c) => (c === 0 ? 1.35 : 1));
      const sum = shares.reduce((a, b) => a + b, 0);
      let cx = x;
      shares.forEach((s, c) => {
        const cw = (uw * s) / sum;
        rects.push({ x: cx, y: roomY, w: cw, h: roomH, kind: 'room', label: c === 0 ? (t === 1 ? 'Studiya' : 'Qonaq') : 'Yataq', area: round(cw * roomH, 1) });
        cx += cw;
      });
    }
    x += uw; i += 1;
  }
}

export function generatePlan(fw, fd, func, quality, floors) {
  const rects = [];
  const coreW = floors > 9 ? 7 : 5.5;
  const coreD = 6;
  const corr = 1.8;
  const counter = { total: 0, rooms: 0 };

  if (func === 'ticaret') {
    rects.push({ x: 0, y: 0, w: fw, h: fd, kind: 'open', label: 'Satış zalı' });
    rects.push({ x: (fw - coreW) / 2, y: 0, w: coreW, h: coreD, kind: 'core', label: 'Lift + pilləkən' });
    rects.push({ x: 0, y: 0, w: Math.min(8, fw * 0.25), h: Math.min(6, fd * 0.3), kind: 'tech', label: 'Anbar' });
    return { rects, counter, typical: 'Ticarət zalı' };
  }
  if (func === 'ofis') {
    const cx = (fw - coreW) / 2; const cy = (fd - coreD) / 2;
    rects.push({ x: 0, y: 0, w: fw, h: fd, kind: 'open', label: 'Açıq ofis sahəsi' });
    rects.push({ x: cx, y: cy, w: coreW, h: coreD, kind: 'core', label: 'Lift + pilləkən' });
    rects.push({ x: cx - 5, y: cy, w: 5, h: coreD / 2, kind: 'meeting', label: 'İclas' });
    rects.push({ x: cx - 5, y: cy + coreD / 2, w: 5, h: coreD / 2, kind: 'wet', label: 'SQ' });
    rects.push({ x: cx + coreW, y: cy, w: 5, h: coreD / 2, kind: 'meeting', label: 'İclas' });
    rects.push({ x: cx + coreW, y: cy + coreD / 2, w: 5, h: coreD / 2, kind: 'hall', label: 'Mətbəxçə' });
    return { rects, counter, typical: 'Ofis mərtəbəsi' };
  }

  const kind = func === 'otel' ? 'otel' : 'yasayis';
  if (fd >= 15) {
    const bandH = (fd - corr) / 2;
    const cx = (fw - coreW) / 2;
    rects.push({ x: 0, y: bandH, w: fw, h: corr, kind: 'corridor', label: 'Dəhliz' });
    rects.push({ x: cx, y: 0, w: coreW, h: bandH, kind: 'core', label: 'Lift + pilləkən' });
    fillBand(rects, 0, cx, 0, bandH, 'south', kind, quality, counter);
    fillBand(rects, cx + coreW, fw, 0, bandH, 'south', kind, quality, counter);
    fillBand(rects, 0, fw, bandH + corr, bandH, 'north', kind, quality, counter);
  } else {
    rects.push({ x: 0, y: 0, w: coreW, h: fd, kind: 'core', label: 'Lift + pilləkən' });
    rects.push({ x: coreW, y: 0, w: fw - coreW, h: corr, kind: 'corridor', label: 'Dəhliz (şimal bufer)' });
    fillBand(rects, coreW, fw, corr, fd - corr, 'north', kind, quality, counter);
  }
  return { rects, counter, typical: kind === 'otel' ? 'Tipik otel mərtəbəsi' : 'Tipik yaşayış mərtəbəsi' };
}

export function analyze(input) {
  const district = byId(DISTRICTS, input.district);
  const soil = byId(SOILS, input.soil);
  const slope = byId(SLOPES, input.slope);
  const func = byId(FUNCTIONS, input.func);
  const quality = byId(QUALITIES, input.quality);
  const style = byId(STYLES, input.style);
  const gw = byId(GROUNDWATER, input.groundwater || district.gw || 'orta');
  const features = Array.isArray(input.features) ? input.features.filter((f) => FEATURES.some((x) => x.id === f)) : [];
  const feats = FEATURES.filter((f) => features.includes(f.id));
  const ls = LANDSLIDE[district.landslide];

  const W = Math.max(5, Number(input.plotWidth) || 0);
  const D = Math.max(5, Number(input.plotDepth) || 0);
  const plotArea = W * D;
  const floors = Math.max(1, Math.round(Number(input.floors) || 1));
  const basements = Math.max(0, Math.round(Number(input.basements) || 0));
  const budget = Math.max(0, Number(input.budget) || 0);

  // Tikinti ləkəsi
  let fw = Math.max(4, W - 2 * SETBACK_SIDE);
  let fd = Math.max(4, D - SETBACK_FRONT - SETBACK_SIDE);
  const cov = (fw * fd) / plotArea;
  if (cov > MAX_COVERAGE) {
    const k = Math.sqrt(MAX_COVERAGE / cov);
    fw *= k; fd *= k;
  }
  fw = round(fw, 1); fd = round(fd, 1);
  const footprint = fw * fd;
  const offsetX = (W - fw) / 2;
  const offsetY = SETBACK_SIDE + (D - SETBACK_FRONT - SETBACK_SIDE - fd) / 2;

  // Geoloji göstəricilər
  const bearingIn = Number(input.bearing);
  const bearing = bearingIn > 0 ? bearingIn : soil.bearing;
  const bearingSource = bearingIn > 0 ? 'input' : 'soil';
  const pressure = floors * KPA_PER_FLOOR + basements * KPA_PER_BASEMENT;
  const liq = (soil.id === 'qum' || soil.id === 'dolma') && gw.id === 'dayaz' && district.seismic >= 9
    ? 'high'
    : (soil.id === 'qum' || soil.id === 'dolma') && gw.id !== 'derin' ? 'medium' : 'low';

  // Mərtəbə limiti
  const caps = [
    { by: 'Torpaq tipi', value: soil.cap },
    { by: 'Relyef', value: slope.cap },
    { by: 'Sürüşmə riski', value: ls.cap },
    { by: 'Funksiya', value: func.cap },
  ];
  if (liq === 'high') caps.push({ by: 'Mayeləşmə riski', value: features.includes('seysmik') ? 14 : 9 });
  const floorCap = Math.min(...caps.map((c) => c.value));
  const limitingFactor = caps.find((c) => c.value === floorCap).by;

  // Xərc
  const seismicMult = district.seismic >= 9 ? 1.06 : 1.0;
  const hm = heightMult(floors);
  // Material qiyməti ssenarisi: materiallar tikinti xərcinin ~60%-i
  const materialIdx = Math.max(-30, Math.min(60, Number(input.materialIdx) || 0));
  const matMult = 1 + (materialIdx / 100) * 0.6;
  const featCostPct = feats.reduce((a, f) => a + f.cost, 0);
  const featSalePct = feats.reduce((a, f) => a + f.sale, 0);
  const costPerM2 = quality.costPerM2 * soil.mult * slope.mult * seismicMult * hm * gw.mult * style.costMult * (1 + featCostPct) * matMult;
  const grossArea = footprint * floors;
  const hardCost = grossArea * costPerM2;
  const featCost = hardCost * (featCostPct / (1 + featCostPct));
  const baseHard = hardCost - featCost;
  const bsmtArea = basements > 0 ? Math.min(footprint * 1.3, plotArea * 0.85) * basements : 0;
  const bsmtCost = bsmtArea * 900 * soil.mult * gw.bsmt * (soil.id === 'sulu' ? 1.15 : 1) * matMult;
  const softCost = (hardCost + bsmtCost) * SOFT_COST;
  const contingency = (hardCost + bsmtCost) * CONTINGENCY;
  const totalCost = hardCost + bsmtCost + softCost + contingency;

  const fShare = soil.foundationShare + (slope.id === 'cox' ? 0.04 : slope.id === 'az' ? 0.02 : 0) + (gw.id === 'dayaz' ? 0.03 : 0) + (liq === 'high' ? 0.03 : 0);
  const rest = 1 - fShare;
  const breakdown = [
    { key: 'temel', label: 'Təməl və yer işləri', value: baseHard * fShare },
    { key: 'karkas', label: 'Karkas (beton + armatur)', value: baseHard * rest * 0.4 },
    { key: 'fasad', label: `Fasad və dam (${style.name.split(' (')[0]})`, value: baseHard * rest * 0.17 },
    { key: 'muhendis', label: 'Mühəndis sistemləri (su, elektrik, HVAC, lift)', value: baseHard * rest * 0.2 },
    { key: 'daxili', label: 'Daxili işlər', value: baseHard * rest * 0.23 },
  ];
  if (featCost > 0) breakdown.push({ key: 'elave', label: `Əlavə xüsusiyyətlər (${feats.map((f) => f.name.toLowerCase()).join(', ')})`, value: featCost });
  if (bsmtCost > 0) breakdown.push({ key: 'parkinq', label: `Yeraltı parkinq (${basements} mərtəbə)`, value: bsmtCost });
  breakdown.push({ key: 'soft', label: 'Layihə, icazələr, ekspertiza', value: softCost });
  breakdown.push({ key: 'ehtiyat', label: 'Gözlənilməz xərclər ehtiyatı (8%)', value: contingency });

  // Plan və gəlir
  const plan = generatePlan(fw, fd, func.id, quality.id, floors);
  const resFloors = func.id === 'qarisiq' ? Math.max(0, floors - 1) : floors;
  let netArea;
  let units = 0;
  if (func.id === 'yasayis' || func.id === 'qarisiq') {
    const unitAreaSum = plan.rects.filter((r) => r.kind === 'unit').reduce((a, r) => a + r.area, 0);
    netArea = unitAreaSum * resFloors + (func.id === 'qarisiq' ? footprint * 0.85 : 0);
    units = plan.counter.total * resFloors;
  } else if (func.id === 'otel') {
    units = plan.counter.rooms * Math.max(1, floors - 1);
    netArea = grossArea * func.netRatio;
  } else {
    netArea = grossArea * func.netRatio;
  }
  const salePrice = district.salePrice * func.saleMult * quality.saleMult * (1 + featSalePct);
  const revenue = netArea * salePrice;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? profit / revenue : 0;
  const parkingSpots = Math.floor(bsmtArea / 30);

  const perFloorCost = totalCost / floors;
  const budgetFloors = Math.max(0, Math.floor((budget - bsmtCost * (1 + SOFT_COST + CONTINGENCY)) / (footprint * costPerM2 * (1 + SOFT_COST + CONTINGENCY))));
  const recommendedFloors = Math.max(1, Math.min(floors, floorCap, budgetFloors || 1));

  // Hökm
  const issues = [];
  const budgetRatio = budget > 0 ? totalCost / budget : 99;
  if (budgetRatio <= 1) issues.push({ level: 'ok', title: 'Büdcə kifayətdir', text: `Təxmini xərc büdcənin ${round(budgetRatio * 100)}%-ni təşkil edir.` });
  else if (budgetRatio <= 1.15) issues.push({ level: 'warn', title: 'Büdcə sərhəddədir', text: `Xərc büdcəni ${round((budgetRatio - 1) * 100)}% aşır. Keyfiyyəti və ya mərtəbə sayını azaltmaq lazımdır.` });
  else issues.push({ level: 'fail', title: 'Büdcə çatmır', text: `Xərc büdcəni ${round((budgetRatio - 1) * 100)}% aşır. Bu büdcə ilə maksimum ${budgetFloors} mərtəbə mümkündür.` });

  if (floors <= floorCap) issues.push({ level: 'ok', title: 'Mərtəbə sayı təhlükəsizdir', text: `Bu sahə üçün təxmini limit ${floorCap} mərtəbədir.` });
  else if (floors <= floorCap * 1.25) issues.push({ level: 'warn', title: 'Mərtəbə sayı limitə yaxındır', text: `${limitingFactor} səbəbindən tövsiyə olunan limit ${floorCap} mərtəbədir. Əlavə geoloji araşdırma tələb olunur.` });
  else issues.push({ level: 'fail', title: 'Mərtəbə sayı riskli', text: `${limitingFactor} səbəbindən ${floors} mərtəbə təhlükəlidir. Limit: ${floorCap} mərtəbə.` });

  if (district.landslide === 'high') issues.push({ level: 'warn', title: 'Sürüşmə zonası', text: `${district.name} tanınmış sürüşmə zonasıdır. Geoloji ekspertiza və dayaq sistemləri mütləqdir.` });
  if (soil.id === 'dolma') issues.push({ level: 'warn', title: 'Tökmə torpaq', text: 'Dərin svay təməli xərcləri əhəmiyyətli dərəcədə artırır.' });
  if (liq === 'high') issues.push({ level: 'warn', title: 'Mayeləşmə riski', text: 'Dayaz qrunt suyu + qumlu torpaq + 9 ballıq zona: zəlzələdə torpaq mayeləşə bilər. Svay təməl şərtdir.' });
  if (gw.id === 'dayaz' && basements > 0) issues.push({ level: 'warn', title: 'Dayaz qrunt suyu', text: `${basements} mərtəbəli zirzəmi üçün tam hidroizolyasiya və su vurma lazımdır; parkinq xərci ~35% artır.` });
  if (pressure > bearing) issues.push({ level: 'warn', title: 'Daşıma qabiliyyəti aşılır', text: `Təzyiq ~${round(pressure)} kPa, torpaq ~${round(bearing)} kPa daşıyır. Svay təməl tələb olunur (xərc artır).` });
  if (margin < 0) issues.push({ level: 'fail', title: 'Layihə zərərlidir', text: `Proqnoz satış gəliri xərci ödəmir (marja ${round(margin * 100)}%).` });
  else if (margin < 0.15) issues.push({ level: 'warn', title: 'Aşağı gəlirlilik', text: `Marja ${round(margin * 100)}%. Sektor üçün normal hədd 20–30%-dir.` });
  else issues.push({ level: 'ok', title: 'Gəlirlilik yaxşıdır', text: `Proqnoz marja ${round(margin * 100)}%.` });
  if ((func.id === 'yasayis' || func.id === 'qarisiq') && parkingSpots < units * 0.6) {
    issues.push({ level: 'warn', title: 'Parkinq çatışmır', text: `${units} mənzil üçün ${parkingSpots} yer var. Minimum ~${Math.ceil(units * 0.6)} yer tövsiyə olunur.` });
  }

  const status = issues.some((i) => i.level === 'fail') ? 'fail' : issues.some((i) => i.level === 'warn') ? 'warn' : 'ok';
  const months = Math.round(8 + floors * 0.9 + basements * (gw.id === 'dayaz' ? 3 : 2) + (soil.id === 'dolma' ? 3 : 0));
  const geo = geology({ soil, gw, slope, district, floors, basements, bearing, bearingSource, pressure, liq, features, footprint });

  const result = {
    input: { ...input, floors, basements, budget, features, groundwater: gw.id, materialIdx },
    refs: { district, soil, slope, func, quality, style, gw, feats, landslide: ls },
    geo: { ...geo, bearing, bearingSource, pressure, liq },
    site: { W, D, plotArea, fw, fd, footprint: round(footprint), offsetX, offsetY, coverage: round(footprint / plotArea, 2) },
    floorCap, limitingFactor, caps, recommendedFloors, budgetFloors,
    cost: { costPerM2: round(costPerM2), grossArea: round(grossArea), bsmtArea: round(bsmtArea), totalCost: round(totalCost), perFloorCost: round(perFloorCost), breakdown, budgetRatio: round(budgetRatio, 3) },
    revenue: { netArea: round(netArea), salePrice: round(salePrice), revenue: round(revenue), profit: round(profit), margin: round(margin, 3), roi: totalCost > 0 ? round(profit / totalCost, 3) : 0 },
    units, parkingSpots, months,
    foundation: foundationAdvice(soil, slope, floors, district.landslide, { gw: gw.id, bearing, pressure, liq }),
    orientation: orientation(fw, fd, district.landslide),
    plan,
    status, issues,
    floorH: func.floorH,
  };
  result.score = ultScore(result);
  return result;
}

// --- UltScore: 0–100 risk balı (bank / sığorta / alıcı üçün) ---
const LV = { ok: 1, warn: 0.55, fail: 0.1 };
export function ultScore(r) {
  const geoAvg = r.geo.items.reduce((a, g) => a + LV[g.level], 0) / r.geo.items.length;
  const geo = Math.round(geoAvg * 100);
  const br = r.cost.budgetRatio;
  const fin = Math.round(Math.max(0, Math.min(100, br <= 0.85 ? 100 : br <= 1 ? 100 - (br - 0.85) * 133 : br <= 1.15 ? 80 - (br - 1) * 300 : 35 - (br - 1.15) * 60)));
  const m = r.revenue.margin;
  const mkt = Math.round(Math.max(0, Math.min(100, m >= 0.3 ? 100 : m >= 0.2 ? 80 + (m - 0.2) * 200 : m >= 0 ? 30 + m * 250 : 30 + m * 150)));
  const f = r.input.floors; const cap = r.floorCap;
  let str = f <= cap ? 100 : f <= cap * 1.25 ? 60 : 20;
  if (r.geo.liq === 'high') str -= 15;
  if (r.input.features.includes('seysmik')) str += 10;
  str = Math.max(0, Math.min(100, str));
  const parts = [
    { key: 'geo', label: 'Geologiya', value: geo, weight: 0.3 },
    { key: 'str', label: 'Konstruktiv təhlükəsizlik', value: str, weight: 0.25 },
    { key: 'fin', label: 'Maliyyə (büdcə)', value: fin, weight: 0.25 },
    { key: 'mkt', label: 'Bazar (gəlirlilik)', value: mkt, weight: 0.2 },
  ];
  const total = Math.round(parts.reduce((a, p) => a + p.value * p.weight, 0));
  const grade = total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 55 ? 'C' : total >= 40 ? 'D' : 'E';
  const label = { A: 'Çox aşağı risk', B: 'Aşağı risk', C: 'Orta risk', D: 'Yüksək risk', E: 'Çox yüksək risk' }[grade];
  return { total, grade, label, parts };
}

// --- Ən yaxşı istifadə: eyni torpaqda 5 funksiyanın müqayisəsi ---
export function bestUse(input) {
  return FUNCTIONS.map((fn) => {
    const probe = analyze({ ...input, func: fn.id });
    const floors = Math.max(1, Math.min(Number(input.floors) || 1, probe.floorCap));
    const r = analyze({ ...input, func: fn.id, floors });
    return { id: fn.id, name: fn.name, floors, result: r };
  }).sort((a, b) => b.result.revenue.profit - a.result.revenue.profit);
}

export function scenarios(input) {
  const base = analyze(input);
  const cap = base.floorCap;
  const desired = base.input.floors;
  const defs = [
    { id: 'gelir', name: 'Maksimum gəlir', icon: '📈', desc: 'Torpağın icazə verdiyi maksimum mərtəbə, standart keyfiyyət', patch: { floors: cap, quality: 'standart', basements: Math.max(1, base.input.basements) } },
    { id: 'qenaet', name: 'Minimum xərc', icon: '💰', desc: 'Az mərtəbə, ekonom material, parkinqsiz', patch: { floors: Math.max(1, Math.min(desired, Math.ceil(cap * 0.6))), quality: 'ekonom', basements: 0 } },
    { id: 'keyfiyyet', name: 'Ən yüksək keyfiyyət', icon: '✨', desc: 'Premium material, yeraltı parkinq, təhlükəsiz hündürlük', patch: { floors: Math.max(1, Math.min(desired, cap)), quality: 'premium', basements: Math.max(1, base.input.basements) } },
  ];
  return defs.map((d) => {
    const r = analyze({ ...input, ...d.patch });
    return { ...d, result: r };
  });
}

export const fmtAZN = (n) => {
  const a = Math.abs(n);
  const s = a >= 1e6 ? `${(n / 1e6).toFixed(2)} mln` : a >= 1e3 ? `${Math.round(n / 1e3)} min` : `${Math.round(n)}`;
  return `${s} ₼`;
};
export const fmtNum = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

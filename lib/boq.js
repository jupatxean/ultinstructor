// Smeta (materialların miqdar cədvəli), iş qrafiki və risk reyestri.
// Miqdarlar binanın həndəsəsindən, mərtəbə planlarından və mühəndis sistemlərindən hesablanır.
// Qiymətlər: Bakı bazarı, 2026 (ƏDV daxil, təxmini, AZN). Material indeksi slayderi qiymətlərə tətbiq olunur.

import { systems as calcSystems } from './systems';

const r0 = (n) => Math.round(n);
const r1 = (n) => Math.round(n * 10) / 10;
const ceil = Math.ceil;

// Keyfiyyətə görə üzlük qiymətləri: [ekonom, standart, premium]
const QP = (q, a) => a[{ ekonom: 0, standart: 1, premium: 2 }[q]];

const FACADE = {
  modern: { name: 'Alüminium-şüşə fasad sistemi + A2 kompozit panel', unit: 'm²', p: 210 },
  hitech: { name: 'Parametrik alüminium panel + vitraj', unit: 'm²', p: 260 },
  baki: { name: 'Abşeron (mişar) daşı üzlük, karniz və profillər', unit: 'm²', p: 95 },
  icheri: { name: 'Abşeron daşı + daş şəbəkə elementləri, tağlar', unit: 'm²', p: 120 },
  artdeco: { name: 'Fibrobeton panellər + metal dekor', unit: 'm²', p: 140 },
  minimal: { name: 'Ağ fasad suvağı (dekorativ, silikon)', unit: 'm²', p: 38 },
  brutal: { name: 'Hamar açıq beton + hidrofob örtük', unit: 'm²', p: 30 },
  eko: { name: 'Ventilyasiyalı fasad (termo-ağac) + yaşıl fasad kasetləri', unit: 'm²', p: 150 },
  med: { name: 'Fasad suvağı + keramik detallar', unit: 'm²', p: 48 },
  skand: { name: 'Ventilyasiyalı fasad (ağac-kompozit) ', unit: 'm²', p: 115 },
};

export function boq(r, sysIn) {
  const s = sysIn || calcSystems(r);
  const q = r.input.quality; const f = r.input.func; const st = r.input.style;
  const F = r.input.floors; const B = r.input.basements; const fh = r.floorH;
  const { fw, fd, footprint, plotArea, W, D } = r.site;
  const gross = r.cost.grossArea; const bsmt = r.cost.bsmtArea;
  const bsmtFoot = B > 0 ? bsmt / B : 0;
  const perim = 2 * (fw + fd);
  const Hb = F * fh;
  const seis = r.refs.district.seismic;
  const mat = 1 + (Number(r.input.materialIdx) || 0) / 100;
  const units = r.units || 0;
  const resi = f === 'yasayis' || f === 'qarisiq';
  const env = estimateEnvelope(r, s);
  const piles = /svay/i.test(r.foundation.type);
  const sulfate = r.refs.gw.id === 'dayaz' || ['xezer', 'buzovna', 'pirallahi', 'hovsan', 'sebail', 'bayil', 'bibiheybet'].includes(r.refs.district.id);

  const sections = [];
  const qf = { ekonom: 0.92, standart: 1, premium: 1.3 }[q];
  const QSEC = ['fasad', 'pencere', 'daxili', 'mep_su', 'mep_el', 'mep_hvac', 'abad', 'dam'];
  const sec = (id, name, labour, items) => {
    const k = QSEC.includes(id) ? qf : 1;
    sections.push({ id, name, labour, items: items.filter(Boolean).filter((i) => i.qty > 0).map((i) => (k === 1 ? i : { ...i, price: Math.round(i.price * k * 100) / 100 })) });
  };
  const it = (name, unit, qty, price, note = '') => ({ name, unit, qty: unit === 't' || unit === 'm³' ? r1(qty) : r0(qty), price: r0(price * mat * 100) / 100, note });

  // ---------------- 1. Torpaq işləri
  const digDepth = B > 0 ? B * 3.3 + 0.8 : 1.6;
  const digArea = B > 0 ? bsmtFoot * 1.08 : footprint * 1.15;
  const excav = digArea * digDepth;
  sec('torpaq', 'Torpaq işləri və bünövrə çuxuru', 0.55, [
    it('Torpağın qazılması (ekskavator)', 'm³', excav, 6.5, `${r1(digDepth)} m dərinlik`),
    it('Qruntun daşınması (20–25 km poliqon)', 'm³', excav * 1.2, 7, 'Kənarlaşma əmsalı 1,2'),
    it('Geri doldurma və sıxlaşdırma', 'm³', B > 0 ? perim * 1.2 * digDepth : footprint * 0.4, 9),
    B > 0 && it(r.refs.gw.id === 'dayaz' || r.refs.landslide.cap < 20 ? 'Qazıntı divarının bərkidilməsi (burulan svay / şpunt)' : 'Qazıntı divarının bərkidilməsi (anker + torkret)', 'm²', (perim + 16) * digDepth, r.refs.gw.id === 'dayaz' || r.refs.landslide.cap < 20 ? 140 : 75),
    r.refs.gw.id === 'dayaz' && B > 0 && it('Su endirmə (iynəli filtrlər / quyular, icarə)', 'ay', 4 + B * 2, 4200),
    it('Qum-çınqıl yastıq (sıxlaşdırılmış)', 'm³', (B > 0 ? bsmtFoot : footprint) * 0.3, 32),
    it('Geotekstil', 'm²', (B > 0 ? bsmtFoot : footprint) * 1.1, 2.4),
  ]);

  // ---------------- 2. Təməl
  const slabT = Math.min(1.8, 0.6 + F * 0.045);
  const fArea = B > 0 ? bsmtFoot : footprint;
  const strip = /lent/i.test(r.foundation.type);
  const fConc = strip ? perim * 1.4 * 1.2 + (fw * fd * 0.08) : fArea * slabT;
  const pileN = piles ? ceil(fArea / (F > 16 ? 6.5 : 9)) : 0;
  const pileL = piles ? (r.refs.soil.id === 'dolma' || r.geo.liq === 'high' ? 24 : 18) : 0;
  const pileConc = pileN * Math.PI * 0.4 * 0.4 * pileL;
  const fRebar = (fConc * 110 + pileConc * 75) / 1000;
  sec('temel', `Təməl (${r.foundation.type})`, 0.35, [
    it('Hazırlıq betonu B7,5 (100 mm)', 'm³', fArea * 0.1, 95),
    piles && it(`Qazma svaylar Ø800 mm × ${pileL} m (beton B30)`, 'ədəd', pileN, pileL * 0.503 * 140 + pileL * 38, `${r0(pileConc)} m³ beton`),
    piles && it('Svayların keyfiyyət sınağı (statik + PIT)', 'ədəd', ceil(pileN * 0.1) + 2, 650),
    it(`Təməl betonu B30${sulfate ? ' sulfata davamlı (SR)' : ''} W8`, 'm³', fConc, sulfate ? 150 : 138, strip ? 'Lent təməl' : `Plita qalınlığı ${r1(slabT)} m`),
    it('Armatur A500C (təməl)', 't', fRebar, 1480, `${piles ? 'svaylar + ' : ''}~110 kq/m³`),
    it('Qəlib (təməl kənarları)', 'm²', perim * (strip ? 2.4 : slabT) * 1.1, 16),
    it('Hidroizolyasiya: bitum-polimer membran, 2 qat', 'm²', fArea * 1.15 * 2, 13),
    B > 0 && it('Profilli drenaj membranı + qoruyucu lövhə', 'm²', perim * B * 3.3, 7),
    it('Su keçirməyən şponka (genişlənən lent)', 'm', perim * (B + 1) * 1.1, 9),
  ]);

  // ---------------- 3. Yeraltı mərtəbələr
  if (B > 0) {
    const wallC = perim * 1.15 * B * 3.3 * 0.35;
    const slabC = bsmt * 0.24; const colC = bsmt * 0.05;
    sec('zirzemi', `Yeraltı parkinq (${B} mərtəbə)`, 0.38, [
      it('Divar betonu B30 W8 (350 mm)', 'm³', wallC, sulfate ? 150 : 138),
      it('Döşəmə + sütun betonu B30', 'm³', slabC + colC, 132),
      it('Armatur A500C', 't', (wallC * 120 + (slabC + colC) * 135) / 1000, 1480),
      it('Qəlib (divar + döşəmə)', 'm²', wallC / 0.35 * 2 + bsmt * 1.1, 17),
      it('Topinq döşəmə (sənaye, kvarslı)', 'm²', bsmt, 16),
      it('Parkinq nişanlama + təkər dayaqları', 'yer', r.parkingSpots, 35),
    ]);
  }

  // ---------------- 4. Karkas
  const kSeis = seis >= 9 ? 1.12 : 1.0;
  const slabsC = gross * 0.22;
  const vertC = gross * (0.1 + (F > 16 ? 0.04 : F > 9 ? 0.02 : 0)) * kSeis;
  const stairsC = F * 2.6 * (s.list.find((x) => x.id === 'yangin').stairsN);
  const frameC = slabsC + vertC + stairsC;
  const rebarFrame = (slabsC * 115 + vertC * 190 * kSeis + stairsC * 120) / 1000;
  sec('karkas', 'Monolit dəmir-beton karkas', 0.4, [
    it(`Döşəmə betonu B30 (220 mm, ${F} döşəmə)`, 'm³', slabsC, 132),
    it(`Sütun, diafraqma və lift nüvəsi betonu B${F > 16 ? 40 : 35}`, 'm³', vertC, F > 16 ? 152 : 142, `${seis} bal: diafraqmalar gücləndirilmiş`),
    it('Pilləkən marşları və meydançaları', 'm³', stairsC, 145),
    it('Armatur A500C', 't', rebarFrame, 1480, `orta ${r0(rebarFrame * 1000 / frameC)} kq/m³ (seysmik)`),
    it('Armatur birləşdiriciləri (mufta)', 'ədəd', r0(rebarFrame * 18), 3.2),
    it('Qəlib sistemi (icarə, dövriyyəli)', 'm²', gross * 1.05 + vertC * 7, 9.5),
    it('Beton nasosu xidməti', 'm³', frameC, 9),
    it('Beton qulluğu (yay: gecə tökmə, örtük, nəmləndirmə)', 'm³', frameC, 2.5, 'Bakıda +35 °C-də plastifikator-ləngidici'),
    seis >= 8 && r.input.features.includes('seysmik') && it('Seysmik izolyatorlar (rezin-qurğuşun)', 'ədəd', ceil(footprint / 36) + 4, 4200),
  ]);

  // ---------------- 5. Divarlar
  const facadeArea = env.facade; const winA = env.win;
  const extWall = Math.max(0, facadeArea - winA);
  const partFactor = { yasayis: 0.55, qarisiq: 0.5, otel: 0.65, ofis: 0.15, ticaret: 0.2 }[f];
  const partM2 = gross * partFactor * (fh - 0.25);
  const interUnit = resi || f === 'otel' ? gross * 0.12 * (fh - 0.25) : 0;
  sec('divar', 'Divarlar və arakəsmələr', 0.5, [
    it(st === 'baki' || st === 'icheri' ? 'Xarici divar: mişar daşı 250 mm + qaz-beton 100 mm' : 'Xarici divar: qaz-beton blok D500, 300 mm', 'm³', extWall * (st === 'baki' || st === 'icheri' ? 0.35 : 0.3), st === 'baki' || st === 'icheri' ? 88 : 92),
    interUnit > 0 && it('Mənzillərarası divar: qaz-beton 200 mm (səs izolyasiyalı)', 'm³', interUnit * 0.2, 92),
    it('Arakəsmələr: qaz-beton 100 mm', 'm³', partM2 * 0.1, 95),
    it('Yapışqan (hörgü qarışığı, 25 kq)', 'kisə', (extWall * 0.3 + interUnit * 0.2 + partM2 * 0.1) * 1.1, 7.5),
    it('Hörgü toru + seysmik ankerlər (karkasa bağlantı)', 'm²', extWall + interUnit + partM2, 1.6),
    it('Perəmıçkalar (dəmir-beton)', 'ədəd', r0(winA / 2.2 + gross / 25), 18),
    it('Şaxta divarları: gipskarton EI 45', 'm²', s.shaftArea * 4 * F * 0.6, 28),
  ]);

  // ---------------- 6. Fasad
  const fac = FACADE[st] || FACADE.minimal;
  sec('fasad', `Fasad (${r.refs.style.name})`, 0.35, [
    it('Fasad istilik izolyasiyası: daş yunu 100 mm (A1, yanmayan)', 'm²', extWall * 1.05, 16),
    it(fac.name, fac.unit, extWall, fac.p),
    it('Fasad iskələsi (icarə)', 'm²·ay', facadeArea * 4, 1.2),
    it('Parapet və karniz detalları', 'm', perim * 1.05, st === 'baki' || st === 'icheri' || st === 'artdeco' ? 85 : 40),
    (s.ctx && !s.ctx.gasApt) || q === 'premium' ? null : it('Kondisioner blokları üçün dekorativ qutular', 'ədəd', r0(units * 1.6), 95),
    it('Günəşdən qoruyucu jalüzlər (qərb + şərq)', 'm²', env.winEW * (q === 'ekonom' ? 0 : 1), 85),
  ]);

  // ---------------- 7. Pəncərə və qapılar
  const winP = QP(q, [140, 210, 330]);
  const aptDoors = resi ? units : f === 'otel' ? r.units : r0(gross / 120);
  const intDoors = resi ? r0(units * 4.2) : f === 'otel' ? r.units * 1 : r0(gross / 60);
  const fireDoors = (F + B) * (s.list.find((x) => x.id === 'yangin').stairsN * 2 + 3);
  sec('pencere', 'Pəncərə, vitraj və qapılar', 0.15, [
    it(q === 'ekonom' ? 'PVC pəncərə, 2 kameralı şüşə paketi' : q === 'premium' ? 'Alüminium (termo-körpülü), low-e 3-lü paket' : 'Alüminium pəncərə, low-e 2-li paket', 'm²', winA, winP, `Şüşələnmə ${r0(env.glaz * 100)}%`),
    it('Pəncərə altlığı + şəbəkə (daxili/xarici)', 'm', winA / 1.5, 22),
    it(resi ? 'Mənzil giriş qapısı (metal, səs izolyasiyalı)' : f === 'otel' ? 'Otel otağı qapısı (EI 30, kartlı)' : 'Ofis/mağaza giriş qapısı', 'ədəd', aptDoors, QP(q, [380, 520, 900])),
    it('Daxili qapılar (komplekt)', 'ədəd', intDoors, QP(q, [140, 220, 420])),
    it('Yanğına davamlı qapılar EI 30–60', 'ədəd', fireDoors, 480),
    it('Əsas giriş vitrajı + avtomatik qapı', 'ədəd', f === 'ticaret' ? 4 : 2, f === 'ticaret' || f === 'otel' ? 14000 : 6000),
    resi && it('Eyvan məhəccəri (şüşə / metal)', 'm', units * 4, QP(q, [70, 120, 220])),
  ]);

  // ---------------- 8. Dam
  sec('dam', 'Dam örtüyü', 0.35, [
    it('Buxar izolyasiyası', 'm²', footprint, 2.2),
    it('XPS istilik izolyasiyası 150 mm', 'm²', footprint, 24),
    it('Mailik yaradan keramzit + sement qatı', 'm³', footprint * 0.12, 70),
    it('PVC / TPO dam membranı (UV-davamlı)', 'm²', footprint * 1.08, 19),
    r.input.features.includes('yasildam') && it('Yaşıl dam sistemi (drenaj + substrat + bitki)', 'm²', footprint * 0.6, 75),
    it('Dam su qıfları (isitmə tələb olunmur)', 'ədəd', s.list.find((x) => x.id === 'kanal').roofDrains, 160),
    it('Dam avadanlığı üçün polad çərçivələr (külək + seysmik)', 't', s.list.find((x) => x.id === 'hvac').coolKw * 0.004 + 1, 2900),
    it('Damda gəzinti yolları və təhlükəsizlik barmaqlığı', 'm', perim, 45),
  ]);

  // ---------------- 9. Daxili işlər
  const wetA = resi ? units * 9 : f === 'otel' ? r.units * 5 : gross * 0.06;
  const commons = gross * (resi ? 0.14 : 0.18);
  const dryA = Math.max(0, gross - wetA - commons);
  const wallFin = partM2 * 2 + interUnit * 2 + extWall * 0.9;
  const finishLabel = (a) => QP(q, a);
  sec('daxili', 'Daxili bəzək işləri', 0.45, [
    it('Sement-qum şapı 60 mm', 'm²', gross, 11),
    it('Səs izolyasiya altlığı (zərbə səsi)', 'm²', gross - commons, 3.5),
    it('Gips suvaq (mexanizə)', 'm²', wallFin, 6.5),
    it('Şpaklyovka + astar + boya (2 qat)', 'm²', wallFin * 0.75 + gross, finishLabel([4.5, 6.5, 11])),
    it('Divar plitəsi (SQ, mətbəx)', 'm²', wetA * 2.6, finishLabel([18, 28, 60])),
    it('Döşəmə plitəsi (SQ, mətbəx, ümumi sahələr)', 'm²', wetA + commons, finishLabel([20, 32, 75])),
    it(q === 'premium' ? 'Mühəndis parket' : 'Laminat 33-cü sinif', 'm²', dryA, finishLabel([16, 24, 85])),
    it('Plitə yapışqanı (25 kq)', 'kisə', (wetA * 3.6 + commons) / 4, 8),
    it(f === 'ofis' || f === 'ticaret' || f === 'otel' ? 'Asma tavan (gipskarton / Armstrong)' : 'Asma tavan (dəhliz, SQ)', 'm²', f === 'ofis' || f === 'ticaret' || f === 'otel' ? gross * 0.85 : wetA + commons, finishLabel([12, 16, 28])),
    it('Hidroizolyasiya (SQ döşəməsi + divar 30 sm)', 'm²', wetA * 1.4, 9),
    it('Pilləkən üzlüyü (qranit / keramoqranit)', 'm²', F * s.list.find((x) => x.id === 'yangin').stairsN * 22, 55),
    it('Lobbi bəzəyi (daş, işıq, mebel)', 'm²', footprint * 0.15, finishLabel([120, 220, 480])),
    resi && q === 'premium' && it('Mətbəx mebeli (açar təhvil)', 'mənzil', units, 6500),
  ]);

  // ---------------- 10. Mühəndis sistemləri (miqdarlar sistemlər modulundan)
  const su = s.list.find((x) => x.id === 'su'); const el = s.list.find((x) => x.id === 'elek'); const hv = s.list.find((x) => x.id === 'hvac');
  const li = s.list.find((x) => x.id === 'lift'); const ya = s.list.find((x) => x.id === 'yangin'); const isq = s.list.find((x) => x.id === 'isiq');
  const kn = s.list.find((x) => x.id === 'kanal'); const zf = s.list.find((x) => x.id === 'zeif');
  const fixtures = resi ? units * 3.2 : f === 'otel' ? r.units * 3 : gross / 45;
  const rooms = resi ? r0(units * 2.6) : f === 'otel' ? r.units : 0;
  const split = /split/i.test(hv.items[4].v);
  sec('mep_su', 'Su təchizatı və kanalizasiya', 0.35, [
    it('Magistral + stoyak boruları (PE-100 / paslanmayan polad)', 'm', Hb * su.zones * 3 + perim * 2 + (Hb * kn.stacks * 0.6), 28),
    it('Mənzildaxili PPR/PEX borular', 'm', (resi ? units * 45 : gross / 6), 6),
    it('Kanalizasiya PP boruları Ø50–110 (səssiz)', 'm', Hb * kn.stacks + (resi ? units * 18 : gross / 10), 14),
    it('Santexnika cihazları (unitaz, lavabo, vanna/duş, mətbəx yuvası)', 'dəst', resi ? units * 1.4 : f === 'otel' ? r.units : gross / 80, QP(q, [420, 750, 2200])),
    it('Nasos stansiyası (2+1, tezlik çeviricili)', 'ədəd', su.needBoost ? 1 : 0, 9000 + su.pumpKw * 900),
    it('Su çənləri (qida təyinatlı, seysmik ankerli)', 'm³', su.tankHousehold + su.tankFire, 380),
    it('Su sayğacları (ağıllı)', 'ədəd', resi ? units * 2 + 2 : 6, 85),
    it('Təzyiq azaldıcı klapanlar', 'ədəd', resi ? units : F * 2, 60),
    r.input.basements > 0 && it('Drenaj nasosları + çalalar', 'ədəd', Math.max(2, B * 2) * 2, 1600),
    (f === 'ticaret' || f === 'otel' || f === 'qarisiq') && it('Yağ tutucu', 'ədəd', 1, 6500),
    s.ctx.solar && it('Günəş kollektorları (isti su ilkin qızdırma)', 'm²', f === 'otel' ? footprint * 0.15 : 0, 320),
    r.input.features.includes('yagis') && it('Yağış suyu çəni + filtr', 'm³', Math.max(5, footprint * 0.02), 420),
  ]);
  sec('mep_el', 'Elektrik və işıqlandırma', 0.3, [
    el.own && it(`Transformator məntəqəsi 2 × ${el.trEach} kVA (KTP)`, 'ədəd', 1, 38000 + el.trEach * 2 * 55),
    it(`Dizel generator ${el.genKva} kVA + AVR`, 'ədəd', 1, 9000 + el.genKva * 260),
    it('Giriş-paylayıcı qurğu (GPQ) + ehtiyat girişi', 'ədəd', 1, 12000 + el.kva * 8),
    it('Magistral kabellər (mis, ngLS/FRLS)', 'm', Hb * s.ctx.sections * 4 + perim * 2 + 120, 48),
    it('Mərtəbə və mənzil lövhələri', 'ədəd', (F + B) * s.ctx.sections + (resi ? units : gross / 150), QP(q, [140, 190, 320])),
    it('Daxili naqillər VVGng-LS 3×1,5–3×6', 'm', gross * (f === 'ofis' ? 6 : 4.5), 1.9),
    it('Rozetka və açarlar', 'ədəd', gross * 0.35, QP(q, [4, 7, 18])),
    it('LED işıqlandırıcılar', 'ədəd', isq.fixtures, QP(q, [18, 30, 65])),
    it('Qəza və evakuasiya işıqları ("ÇIXIŞ")', 'ədəd', (F + B) * 8 + gross / 200, 55),
    it('Fasad və həyət işıqlandırması', 'kompl.', 1, 8000 + perim * Hb * 0.4 * (q === 'premium' ? 1.6 : 1)),
    s.ctx.solar && it(`Günəş elektrik stansiyası ${el.solarKwp} kVtp (panel + invertor)`, 'kVtp', el.solarKwp, 1150),
    r.input.features.includes('ev') && it('Elektromobil şarj stansiyası 7,4 kVt', 'ədəd', ceil(r.parkingSpots * 0.1), 2200),
    it('İldırım mühafizəsi + təməl torpaqlayıcısı', 'kompl.', 1, 3500 + perim * 22),
  ]);
  sec('mep_hvac', 'İstilik, soyutma və ventilyasiya', 0.3, [
    split ? it('Split kondisionerlər (inverter, A++)', 'ədəd', rooms, QP(q, [900, 1250, 1900])) : it(/[Çç]iller/.test(hv.items[4].v) ? 'Çiller + fankoyl sistemi' : 'VRF sistemi (xarici + daxili bloklar)', 'kVt', hv.coolKw, /[Çç]iller/.test(hv.items[4].v) ? 520 : 610),
    s.ctx.gasApt ? it('Kondensasiya kombi qazanları 24 kVt + baca', 'ədəd', units, 1500) : it('Qazanxana / istilik nasosu (isitmə + isti su)', 'kVt', hv.heatKw, s.ctx.gasApt ? 0 : 230),
    resi && it('Panel radiatorlar + termostatik klapan', 'ədəd', rooms + units, 120),
    it('Hava kanalları (sinklənmiş polad)', 'm²', resi ? units * 6 : gross * 0.35, 32),
    (f !== 'yasayis' && f !== 'qarisiq') && it('Hava hazırlama qurğusu (AHU, istilik bərpalı)', 'm³/saat', s.list.find((x) => x.id === 'vent').items[0].v.match(/[\d]+/) ? Number(s.list.find((x) => x.id === 'vent').items[0].v.match(/(\d+)/)[1]) : 0, 3.2),
    resi && it('Mənzil sorma ventilyatorları', 'ədəd', units * 2, 85),
    B > 0 && it('Parkinq ventilyasiyası (jet-fan + CO sensorları)', 'kompl.', 1, 9000 + r.parkingSpots * 260),
    s.ctx.smokeExhaust && it('Tüstü sorma + hava basqısı sistemi', 'kompl.', 1, 25000 + (F + B) * 4200),
    it('Seysmik bərkitmələr və vibrasiya dayaqları', 'kompl.', 1, 3500 + gross * 1.2),
  ]);
  sec('mep_yan', 'Yanğın təhlükəsizliyi', 0.3, [
    it('Ünvanlı yanğın siqnalizasiyası (detektor + kabel)', 'ədəd', ya.items[2].v.match(/~(\d+)/) ? Number(ya.items[2].v.match(/~(\d+)/)[1]) : 0, 62),
    it('Yanğın paneli + xəbərdarlıq (SOUE)', 'kompl.', 1, 9000 + (F + B) * 650),
    (s.ctx.sprinkFull || s.ctx.sprinkCommon || B > 0) && it('Sprinkler başlıqları + boru şəbəkəsi', 'ədəd', s.ctx.sprinkFull ? gross / 12 + bsmt / 12 : s.ctx.sprinkCommon ? gross * 0.12 / 12 + bsmt / 12 : bsmt / 12, 75),
    su.hyd && it('Yanğın kranı şkafları (PK) + stoyak', 'ədəd', (F + B) * s.ctx.sections * ya.stairsN, 420),
    su.tankFire > 0 && it('Yanğın nasos stansiyası', 'ədəd', 1, 22000),
    it('Odsöndürənlər', 'ədəd', (F + B) * 4, 45),
    it('Kommunikasiya keçidlərinin yanğın möhürü', 'ədəd', (F + B) * 40, 18),
    (f === 'ticaret' || f === 'otel') && it('Mətbəx avtomatik söndürmə sistemi', 'ədəd', f === 'ticaret' ? 6 : 2, 6500),
  ]);
  sec('mep_lift', 'Liftlər və eskalatorlar', 0.15, [
    it(`Sərnişin liftləri (MRL, ${li.speed} m/s, ${F + B} dayanacaq)`, 'ədəd', li.passenger, 26000 + (F + B) * 1400 + (li.speed - 1) * 18000),
    li.total > li.passenger && it('Yük / xidmət lifti 1600 kq', 'ədəd', li.total - li.passenger, 48000 + F * 1600),
    li.fire > 0 && it('Yanğın rejimi üçün əlavə (EN 81-72)', 'ədəd', li.fire, 9000),
    li.esc > 0 && it('Eskalatorlar', 'ədəd', li.esc, 72000),
    it('Seysmik sensor + dispetçer rabitəsi', 'ədəd', li.total, 1200),
  ]);
  sec('mep_zeif', 'Zəif cərəyan, qaz və təhlükəsizlik', 0.3, [
    it('Optik / Cat6A kabel şəbəkəsi', 'port', resi ? units * 2 : gross / 8, 45),
    it('IP videokameralar + NVR', 'ədəd', zf.cams, 320),
    it('Giriş nəzarəti + domofon', 'nöqtə', resi ? units + F * 2 : F * 6, 160),
    (s.ctx.gasApt || f === 'otel' || f === 'ticaret' || f === 'qarisiq') && it('Qaz xətti + sayğaclar + seysmik klapan', 'kompl.', 1, s.ctx.gasApt ? 6000 + units * 420 : 9000),
    (r.input.features.includes('smart') || f !== 'yasayis') && it('BMS (bina idarəetmə sistemi)', 'm²', gross, r.input.features.includes('smart') ? 9 : 5),
  ]);

  // ---------------- 11. Abadlıq
  const yard = Math.max(0, plotArea - footprint);
  sec('abad', 'Ərazinin abadlaşdırılması və xarici şəbəkələr', 0.45, [
    it('Asfalt yollar və parkinq', 'm²', yard * 0.35, 24),
    it('Səki plitələri (beton / qranit)', 'm²', yard * 0.3, QP(q, [18, 28, 55])),
    it('Yaşıllıq (torpaq, ot, ağac, damcı suvarma)', 'm²', yard * 0.35, 22),
    r.input.features.includes('usaq') && it('Uşaq meydançası (rezin örtük + avadanlıq)', 'kompl.', 1, 28000),
    it('Hasar və giriş qapısı', 'm', 2 * (W + D), 75),
    it('Xarici su, kanalizasiya, yağış şəbəkələri', 'm', (W + D) * 1.6, 95),
    it('Xarici elektrik kabelləri (10 kV / 0,4 kV)', 'm', 180, 120),
    r.refs.slope.id !== 'duz' && it('Dayaq divarları (dəmir-beton)', 'm³', (W + D) * (r.refs.slope.id === 'cox' ? 3 : 1.2), 210),
  ]);

  // ---------------- Hesablama
  let matTotal = 0; let labTotal = 0;
  sections.forEach((S) => {
    S.mat = S.items.reduce((a, x) => a + x.qty * x.price, 0);
    S.lab = S.mat * S.labour / (1 - S.labour);
    S.total = S.mat + S.lab;
    matTotal += S.mat; labTotal += S.lab;
  });

  // Cədvəl (qrafik)
  const sched = schedule(r, s, { excav, pileN, frameC, sections });
  // Müvəqqəti işlər və texnika (müddətdən asılı)
  const months = sched.months;
  const cranes = gross > 12000 || Math.max(fw, fd) > 55 ? 2 : 1;
  const prel = [
    it(`Qüllə kranı (icarə + operator)`, 'ay', cranes * Math.max(4, sched.frameMonths + 2), F > 16 ? 16000 : 12500, `${cranes} kran`),
    it('Yük-sərnişin tikinti lifti', 'ay', F > 5 ? Math.max(3, sched.frameMonths) : 0, 3200),
    it('Tikinti meydançası: hasar, ofis, anbar, WC, mühafizə', 'ay', months, 6500 + gross * 0.08),
    it('Müvəqqəti elektrik və su', 'ay', months, 2200 + gross * 0.05),
    it('Əməyin mühafizəsi (HSE): torlar, məhəccərlər, fərdi vasitələr', 'ay', months, 1800 + gross * 0.04),
    it('Laboratoriya nəzarəti (beton, armatur, qaynaq sınaqları)', 'ay', months, 1500),
    it('Geodeziya xidməti və monitorinq', 'ay', months, 1200),
    it('Tullantıların daşınması', 'ay', months, 1400 + gross * 0.03),
  ].filter((x) => x.qty > 0);
  const P = { id: 'muveqqeti', name: 'Müvəqqəti işlər, texnika və meydança xərcləri', labour: 0, items: prel };
  P.mat = prel.reduce((a, x) => a + x.qty * x.price, 0); P.lab = 0; P.total = P.mat;
  sections.push(P);

  const direct = sections.reduce((a, S) => a + S.total, 0);
  const overhead = direct * 0.07; // podratçı üstə xərcləri
  const soft = (direct + overhead) * 0.06 + r.geo.survey.cost;
  const contingency = (direct + overhead) * (r.status === 'fail' ? 0.12 : r.status === 'warn' ? 0.1 : 0.08);
  const total = direct + overhead + soft + contingency;

  // Əsas materialların xülasəsi
  const allItems = sections.flatMap((S) => S.items.map((x) => ({ ...x, sec: S.name })));
  const sumBy = (re, unit) => allItems.filter((x) => re.test(x.name) && (!unit || x.unit === unit)).reduce((a, x) => a + x.qty, 0);
  const concrete = allItems.filter((x) => /beton|Döşəmə \+ sütun|Pilləkən marşları/i.test(x.name) && !/nasos|qulluğu|keramzit/i.test(x.name) && x.unit === 'm³').reduce((a, x) => a + x.qty, 0) + pileConc;
  const rebar = sumBy(/Armatur A500/i, 't');
  const cementT = concrete * 0.38 + (gross * 0.06 * 0.35) + (wallFin * 0.012 * 0.25);
  const key = [
    { k: 'Beton (hazır qarışıq)', v: `${r0(concrete)} m³`, n: `${r0(concrete / 8)} mikser reysi (8 m³)` },
    { k: 'Armatur A500C', v: `${r1(rebar)} t`, n: `${r0(rebar * 1000 / Math.max(1, concrete))} kq/m³ orta` },
    { k: 'Sement (beton + şap + suvaq daxil)', v: `${r0(cementT)} t`, n: `≈ ${r0(cementT * 20)} kisə (50 kq)` },
    { k: 'Qum + çınqıl', v: `${r0(concrete * 1.25 + gross * 0.06)} m³`, n: 'Beton tərkibində və şapda' },
    { k: 'Qaz-beton blok / mişar daşı', v: `${r0(extWall * 0.3 + interUnit * 0.2 + partM2 * 0.1)} m³`, n: `≈ ${r0((extWall * 0.3 + interUnit * 0.2 + partM2 * 0.1) / 0.0216)} blok (600×300×120 ekv.)` },
    { k: 'Qəlib sahəsi', v: `${r0(gross * 1.05 + vertC * 7)} m²`, n: 'Dövriyyəli sistem, ~8 dövr' },
    { k: 'Pəncərə və vitraj', v: `${r0(winA)} m²`, n: `${r0(winA / 2.2)} ədəd (orta 2,2 m²)` },
    { k: 'İstilik izolyasiyası', v: `${r0(extWall * 1.05 + footprint)} m²`, n: 'Daş yunu (fasad) + XPS (dam)' },
    { k: 'Hidroizolyasiya', v: `${r0(fArea * 2.3 + footprint * 1.08 + wetA * 1.4 + (B ? perim * B * 3.3 : 0))} m²`, n: 'Təməl, zirzəmi, dam, yaş otaqlar' },
    { k: 'Kabel (bütün növlər)', v: `${r0(gross * (f === 'ofis' ? 6 : 4.5) + Hb * s.ctx.sections * 4 + perim * 2 + 300)} m`, n: '' },
    { k: 'Borular (su + kanalizasiya)', v: `${r0(Hb * su.zones * 3 + perim * 2 + Hb * kn.stacks * 1.6 + (resi ? units * 63 : gross / 3.75))} m`, n: '' },
    { k: 'Döşəmə üzlüyü', v: `${r0(gross)} m²`, n: 'Plitə + laminat/parket' },
  ];

  const parametric = r.cost.totalCost;
  const diff = (total - parametric) / parametric;
  const workers = r0(labTotal / (sched.buildMonths * 1150) * 1.35);
  const cash = cashflow(sections, sched, overhead + contingency, soft);

  return {
    sections, matTotal: r0(matTotal), labTotal: r0(labTotal), direct: r0(direct), overhead: r0(overhead), soft: r0(soft), contingency: r0(contingency), total: r0(total),
    parametric, diff, key, schedule: sched, workers, cash, perM2: r0(total / (gross + bsmt)), risks: risks(r, s, { total, months, sulfate, piles }),
  };
}

function estimateEnvelope(r, s) {
  const { fw, fd } = r.site;
  const H = r.input.floors * r.floorH;
  const glaz = r.input.style === 'modern' || r.input.style === 'hitech' ? 0.45 : ['icheri', 'baki'].includes(r.input.style) ? 0.25 : 0.32;
  const facade = 2 * (fw + fd) * H;
  return { facade, glaz, win: facade * glaz, winEW: 2 * fd * H * glaz };
}

// ------------------------------------------------------------------ İŞ QRAFİKİ
function schedule(r, s, q) {
  const F = r.input.floors; const B = r.input.basements; const gross = r.cost.grossArea;
  const H = s.H; const seis = r.refs.district.seismic;
  const big = r.site.footprint > 1200;
  const cycle = (big ? 12 : 8) + (seis >= 9 ? 1 : 0) + (r.input.style === 'icheri' || r.input.style === 'baki' ? 0 : 0); // gün / mərtəbə
  const wk = (d) => d / 6; // 6 günlük iş həftəsi
  const tasks = [];
  const add = (id, name, start, dur, group, crit = false) => { tasks.push({ id, name, start: Math.round(start * 10) / 10, dur: Math.max(1, Math.round(dur * 10) / 10), group, crit }); return start + dur; };
  const permit = 10 + (H > 28 ? 4 : 0) + (r.refs.district.landslide === 'high' ? 4 : 0) + (r.refs.district.id === 'sebail' ? 3 : 0);
  let t = 0;
  const g = add('geo', 'Geoloji kəşfiyyat və topoqrafiya', 0, wk(r.geo.survey.days), 'Hazırlıq', true);
  const design = add('design', 'Layihələndirmə (eskiz → işçi layihə)', 1, 10 + F * 0.3, 'Hazırlıq', true);
  const permitEnd = add('permit', 'Ekspertiza, tikinti icazəsi, texniki şərtlər', Math.max(g, design - 4), permit, 'Hazırlıq', true);
  t = add('site', 'Meydançanın hazırlanması, hasar, müvəqqəti tikililər', permitEnd, 2.5, 'Hazırlıq', true);
  const dig = q.excav / (B > 0 ? 450 : 600) / 6 + (B > 0 ? 2 : 0) + (r.refs.gw.id === 'dayaz' && B > 0 ? 3 : 0);
  t = add('dig', `Qazıntı və divarların bərkidilməsi${r.refs.gw.id === 'dayaz' && B > 0 ? ' + su endirmə' : ''}`, t, dig, 'Yeraltı hissə', true);
  if (q.pileN) t = add('piles', `Svayların qazılması (${q.pileN} svay)`, t, q.pileN / 4 / 6 + 1, 'Yeraltı hissə', true);
  t = add('found', 'Təməl plitəsi + hidroizolyasiya', t, 3 + r.site.footprint / 1500, 'Yeraltı hissə', true);
  if (B > 0) t = add('bsmt', `Yeraltı mərtəbələr (${B})`, t, B * 4, 'Yeraltı hissə', true);
  const frameStart = t;
  const frameDur = wk(F * cycle) + 1;
  const frameEnd = add('frame', `Karkas: ${F} mərtəbə × ${cycle} gün`, frameStart, frameDur, 'Karkas', true);
  add('roof', 'Dam örtüyü və parapet', frameEnd, 3, 'Karkas');
  const wallsStart = frameStart + Math.min(frameDur * 0.3, wk(3 * cycle) + 2);
  const wallsEnd = add('walls', 'Hörgü və arakəsmələr', wallsStart, frameEnd - wallsStart + 4, 'Bağlama');
  const facStart = frameStart + frameDur * 0.5;
  const facEnd = add('facade', 'Fasad, izolyasiya, pəncərələr', facStart, Math.max(8, frameEnd - facStart + 4 + F * 0.25), 'Bağlama', true);
  const mepStart = frameStart + frameDur * 0.35;
  const mepRough = add('mep1', 'Mühəndis sistemləri — kobud montaj (stoyak, kabel, kanal)', mepStart, wallsEnd - mepStart + 3, 'Mühəndis sistemləri');
  const liftEnd = add('lift', `Liftlərin quraşdırılması (${s.list.find((x) => x.id === 'lift').total})`, frameEnd + 2, 10 + F * 0.3, 'Mühəndis sistemləri');
  add('utils', 'Şəhər şəbəkələrinə qoşulma (Azərişıq, Azərsu, Azəriqaz)', frameEnd - 4, 14, 'Mühəndis sistemləri');
  const finStart = Math.max(wallsStart + 6, frameEnd - frameDur * 0.4);
  const finEnd = add('finish', 'Daxili bəzək işləri', finStart, Math.max(12, (wallsEnd - finStart) + 6 + F * 0.5) * (r.input.quality === 'premium' ? 1.2 : 1), 'Bəzək', true);
  const mep2 = add('mep2', 'Son montaj: santexnika, işıq, kondisioner', Math.max(mepRough, finEnd - 8), 8, 'Mühəndis sistemləri', true);
  const comm = add('comm', 'Sınaqlar və sazlama (yanğın, lift, HVAC, təzyiq)', Math.max(mep2, liftEnd, facEnd) - 1, 5, 'Təhvil', true);
  add('land', 'Abadlıq və xarici şəbəkələr', Math.max(facEnd - 6, comm - 8), 8, 'Bəzək');
  const end = add('accept', 'Dövlət qəbulu və istismara vermə', comm, 4, 'Təhvil', true);
  const months = Math.round((end / 4.345) * 10) / 10;
  const buildMonths = Math.round(((end - (permitEnd)) / 4.345) * 10) / 10;
  return { tasks, weeks: Math.round(end), months, buildMonths, frameMonths: Math.round((frameDur / 4.345) * 10) / 10, cycle, permitWeeks: Math.round(permitEnd) };
}

// ------------------------------------------------------------------ RİSKLƏR
function risks(r, s, x) {
  const L = [];
  const add = (cat, name, p, i, why, steps, cost) => L.push({ cat, name, p, i, score: p * i, why, steps, cost });
  const d = r.refs.district; const F = r.input.floors; const B = r.input.basements;
  if (d.landslide !== 'low') add('Geoloji', 'Torpaq sürüşməsi', d.landslide === 'high' ? 3 : 2, 3, `${d.name} ${d.landslide === 'high' ? 'aktiv' : 'potensial'} sürüşmə zonasıdır`, ['Dərin kəşfiyyat (sürüşmə səthinin müəyyənləşdirilməsi)', 'Svay-dayaq divarı və drenaj qalereyası', 'İnklinometr ilə qazıntı və tikinti dövründə monitorinq', 'Yağış mövsümündə qazıntını dayandırma planı'], 'Smetaya daxildir (dayaq + monitorinq)');
  if (r.geo.liq !== 'low') add('Geoloji', 'Zəlzələdə torpağın mayeləşməsi', r.geo.liq === 'high' ? 3 : 2, 3, 'Qumlu torpaq + qrunt suyu + yüksək seysmiklik', ['Svayları mayeləşən qatdan dərinə endirmək', 'Torpağın sıxlaşdırılması (vibro-flotasiya / daş sütunlar)', 'SPT/CPT sınaqları ilə yoxlama'], '~3–6% təməl xərci');
  if (r.refs.gw.id === 'dayaz') add('Geoloji', 'Qrunt suyunun qazıntıya dolması', B > 0 ? 3 : 2, 2, 'Dayaz qrunt suyu', ['Qazıntıdan əvvəl su endirmə sistemi', 'Şpunt / qazma svay divarı ilə su pərdəsi', 'Ehtiyat nasoslar və generator', 'Sulfata davamlı sement (SR)'], 'Smetaya daxildir');
  if (r.geo.pressure > r.geo.bearing) add('Geoloji', 'Torpağın daşıma qabiliyyətinin çatmaması', 2, 3, `Təzyiq ~${r0(r.geo.pressure)} kPa > ${r0(r.geo.bearing)} kPa`, ['Svay təməl', 'Statik sınaq ilə svay daşıma qabiliyyətinin təsdiqi', 'Çökmə monitorinqi (geodezik markalar)'], 'Smetaya daxildir');
  add('Konstruktiv', 'Seysmik təsir', d.seismic >= 9 ? 2 : 1, 3, `${d.seismic} ballıq zona`, ['Seysmik hesabat və müstəqil konstruktiv ekspertiza', 'Düyünlərdə armaturun sıxlaşdırılması, keyfiyyət nəzarəti', r.input.features.includes('seysmik') ? 'Seysmik izolyatorlar (seçilib)' : 'Seysmik izolyatorları nəzərdən keçirmək', 'Mühəndis sistemlərinin seysmik bərkidilməsi'], 'Smetaya daxildir');
  if (B > 0 && ['nesimi', 'sebail', 'yasamal', 'kubinka', 'ganclik'].includes(d.id)) add('Konstruktiv', 'Qonşu binalara zərər (sıx şəhər mərkəzi)', 2, 3, 'Dərin qazıntı mövcud binalara yaxındır', ['Tikintidən əvvəl qonşu binaların texniki vəziyyət aktı (foto + çatlar)', 'Qazma svay divarı (titrəmə olmadan)', 'Çatlara və çökməyə real vaxt monitorinqi', 'Sığorta (üçüncü tərəfə məsuliyyət)'], '~0,5% xərc');
  const br = r.cost.budgetRatio;
  add('Maliyyə', 'Büdcənin aşılması', br > 1.05 ? 3 : br > 0.9 ? 2 : 1, 3, `Xərc büdcənin ${r0(br * 100)}%-i`, ['Sabit qiymətli (lump-sum) podrat müqaviləsi', 'Dəyişiklik sifarişləri üçün ciddi prosedur', `${r.status === 'ok' ? 8 : 10}–12% gözlənilməz xərclər ehtiyatı (smetada var)`, 'Aylıq xərc nəzarəti: plan və fakt'], 'Ehtiyat smetada');
  add('Maliyyə', 'Material qiymətlərinin artması (armatur, sement, metal)', 2 + ((Number(r.input.materialIdx) || 0) > 10 ? 1 : 0), 2, 'Armatur və sement qiymətləri dəyişkəndir; idxal məhsulları valyuta riskinə məruz qalır', ['Armaturun 50%-ni karkas başlamazdan əvvəl almaq', 'Beton zavodu ilə illik sabit qiymət müqaviləsi', 'Qiymət indeksasiyası bəndi ilə müqavilələr', '"Material qiyməti" slayderi ilə stress-test'], 'Erkən alış üçün dövriyyə kapitalı');
  if (r.revenue.margin < 0.2) add('Maliyyə', 'Satışların gözləniləndən az olması', r.revenue.margin < 0.1 ? 3 : 2, 3, `Proqnoz marja ${r0(r.revenue.margin * 100)}%`, ['Tikinti başlayanda ilkin satış (off-plan) kampaniyası', 'Bank ipoteka tərəfdaşlığı', 'Mənzil miksini bazara uyğunlaşdırmaq ("Ən yaxşı istifadə" tabı)'], 'Marketinq büdcəsi');
  add('Təchizat', 'İdxal avadanlığının gecikməsi (liftlər, VRF, pəncərə profili)', 2, 2, 'Çatdırılma müddəti 12–20 həftə', ['Lift və HVAC sifarişini karkasın 30%-ində vermək', 'Alternativ təchizatçı siyahısı', 'Gömrük rəsmiləşdirilməsi üçün broker'], '—');
  add('İcazə', 'İcazə və texniki şərtlərin gecikməsi', s.H > 28 || d.landslide === 'high' ? 3 : 2, 2, s.H > 28 ? 'Hündür bina: əlavə FHN və ekspertiza razılaşmaları' : 'Standart prosedur', ['Azərişıq / Azərsu / Azəriqaz texniki şərtləri üçün eskiz mərhələsində müraciət', 'Ekspertizadan əvvəl daxili audit (UltInstructor hesabatı)', 'İcazə gecikməsi üçün qrafikdə 4 həftə ehtiyat'], '—');
  add('İqlim', 'Xəzri küləyi kranları dayandırır', F > 9 ? 2 : 1, 1, 'Külək > 15 m/s olanda kran işləmir (ildə ~25–35 gün)', ['Qrafikdə külək günləri üçün 8% ehtiyat', 'Anemometr və külək xəbərdarlığı', 'Fasad elementlərinin külək günlərində bərkidilməsi'], 'Qrafikdə nəzərə alınıb');
  add('İqlim', 'Yay istisində betonun keyfiyyətsiz qurulması', 2, 2, 'İyul–avqustda +35…40 °C', ['Gecə betonlanması (22:00–06:00)', 'Ləngidici əlavələr, buzlu su', 'Nəmləndirmə və örtük (7 gün)', 'Laboratoriya kub sınaqları'], 'Smetada "beton qulluğu"');
  add('Əmək', 'Bacarıqlı işçi çatışmazlığı və keyfiyyət', 2, 2, `Pikdə ~${r0((x.total * 0.3) / (x.months * 0.7 * 1150) * 1.35)} işçi lazımdır`, ['Əsas briqadalarla erkən müqavilə (karkas, fasad, MEP)', 'Texniki nəzarət mühəndisi (müstəqil)', 'Gizli işlər üzrə aktlar və foto-hesabat'], '~1% xərc (texniki nəzarət)');
  add('Təhlükəsizlik', 'Hündürlükdən yıxılma və qəzalar', F > 5 ? 2 : 1, 3, 'Tikintidə ən çox rast gəlinən ağır qəza', ['HSE planı, gündəlik təlimat', 'Kənarlarda məhəccər və qoruyucu torlar', 'Kran yüklərinin qaldırılma planı', 'Hər 50 işçiyə 1 HSE mütəxəssisi'], 'Smetada HSE');
  add('Təhlükəsizlik', 'Tikinti zamanı yanğın', 1, 3, 'Qaynaq işləri + yanan izolyasiya materialları', ['Yalnız yanmayan (A1/A2) fasad izolyasiyası', 'Qaynaq üçün yazılı icazə sistemi', 'Hər mərtəbədə odsöndürən, müvəqqəti yanğın su xətti'], '—');
  if (x.sulfate) add('Davamlılıq', 'Dəniz duzu və sulfat korroziyası', 2, 2, 'Sahil zonası / duzlu qrunt suyu', ['Sulfata davamlı sement, beton W8', 'Armatur üçün beton örtüyü ≥ 50 mm (təməl)', 'Avadanlıqda antikorroziya örtüyü'], 'Smetaya daxildir');
  if (d.id === 'sebail') add('İcazə', 'Arxeoloji tapıntılar (tarixi mərkəz)', 2, 2, 'Səbail və İçərişəhər ətrafında qazıntıda tarixi qatlar ola bilər', ['Qazıntı zamanı arxeoloji müşahidə', 'Qrafikdə 4–6 həftə ehtiyat'], '~8 000 ₼');
  add('Layihə', 'Tikinti zamanı layihə dəyişiklikləri', 2, 2, 'Sifarişçi istəkləri, satış rəyinə görə dəyişikliklər', ['Layihəni ekspertizadan əvvəl dondurmaq', 'BIM model ilə toqquşmaların (clash) yoxlanması', 'Dəyişikliklərin xərcini UltInstructor-da dərhal qiymətləndirmək'], '—');
  return L.sort((a, b) => b.score - a.score);
}

// ------------------------------------------------------------------ AYLIQ MALİYYƏ AXINI
const MAP = { torpaq: [['dig', 1]], temel: [['piles', 0.5], ['found', 0.5]], zirzemi: [['bsmt', 1]], karkas: [['frame', 1]], divar: [['walls', 1]], fasad: [['facade', 1]], pencere: [['facade', 1]], dam: [['roof', 1]], daxili: [['finish', 1]],
  mep_su: [['mep1', 0.6], ['mep2', 0.4]], mep_el: [['mep1', 0.6], ['mep2', 0.4]], mep_hvac: [['mep1', 0.5], ['mep2', 0.5]], mep_yan: [['mep1', 0.6], ['comm', 0.4]], mep_lift: [['lift', 1]], mep_zeif: [['mep1', 0.5], ['mep2', 0.5]], abad: [['land', 1]] };
function cashflow(sections, sched, ohc, soft) {
  const T = Object.fromEntries(sched.tasks.map((t) => [t.id, t]));
  const nM = Math.ceil(sched.weeks / 4.345) + 1;
  const m = Array(nM).fill(0);
  const spread = (task, amount) => {
    if (!task) return false;
    const a = task.start; const b = task.start + task.dur;
    for (let w = Math.floor(a); w < Math.ceil(b); w += 1) { const ov = Math.min(b, w + 1) - Math.max(a, w); if (ov > 0) m[Math.min(nM - 1, Math.floor(w / 4.345))] += (amount * ov) / task.dur; }
    return true;
  };
  let direct = 0;
  sections.forEach((S) => {
    direct += S.total;
    if (S.id === 'muveqqeti') { spread({ start: T.site.start, dur: T.accept.start + T.accept.dur - T.site.start }, S.total); return; }
    let left = 1;
    (MAP[S.id] || []).forEach(([tid, share]) => { if (spread(T[tid], S.total * share)) left -= share; });
    if (left > 0.001) spread(T.frame, S.total * left);
  });
  spread(T.design, soft * 0.55); spread(T.permit, soft * 0.25); spread({ start: T.site.start, dur: T.accept.start + T.accept.dur - T.site.start }, soft * 0.2);
  const tot = m.reduce((a, b) => a + b, 0);
  const k = (tot + ohc) / tot;
  let cum = 0;
  return m.map((v, i) => { cum += v * k; return { month: i + 1, spend: Math.round(v * k), cum: Math.round(cum) }; });
}

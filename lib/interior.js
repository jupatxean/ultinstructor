// AI olmayanda interyer qərarları (qayda əsaslı)
const PAL = {
  modern: { dosheme: '#b08d68', divar: '#eeeeea', mebel: '#3b4148', aksent: '#5d7f95', yumsaq: '#c9d6df' },
  baki: { dosheme: '#9a6f48', divar: '#efe6d6', mebel: '#6b4f36', aksent: '#8a3b2e', yumsaq: '#d8c3a5' },
  icheri: { dosheme: '#8c6440', divar: '#f1e4c8', mebel: '#5a3b24', aksent: '#9b3d2a', yumsaq: '#c79a5b' },
  minimal: { dosheme: '#d8cfc2', divar: '#f7f6f2', mebel: '#e3ded6', aksent: '#6d6d6d', yumsaq: '#ecebe7' },
  eko: { dosheme: '#a98458', divar: '#ece6d8', mebel: '#7a5c3e', aksent: '#6f8f5a', yumsaq: '#d9d2bf' },
  hitech: { dosheme: '#8e9399', divar: '#f0f2f3', mebel: '#22303a', aksent: '#2f8fdf', yumsaq: '#c7d3dc' },
  artdeco: { dosheme: '#5a4030', divar: '#ebe2cf', mebel: '#2e3a3f', aksent: '#b8913b', yumsaq: '#d9c79d' },
  brutal: { dosheme: '#9a968f', divar: '#c9c6bf', mebel: '#4a4744', aksent: '#b5552e', yumsaq: '#d7d3cb' },
  med: { dosheme: '#c79e73', divar: '#f6f2ea', mebel: '#9b7653', aksent: '#3f7fa8', yumsaq: '#e7d9c4' },
  skand: { dosheme: '#d6bd98', divar: '#f6f3ee', mebel: '#c9ab84', aksent: '#5b6b70', yumsaq: '#e9e3d8' },
};

const ROOM = {
  Qonaq: 'Qonaq otağı pəncərəyə tərəf açılır: divan fasada baxır, TV konsolu pəncərə divarının yanında, yemək masası mətbəxə yaxın künçdə.',
  Studiya: 'Studiyada yataq və qonaq zonası xalça və rəf arakəsməsi ilə bölünür.',
  Yataq: 'Yataq daxili divara söykənir ki, pəncərədən soyuq hava birbaşa gəlməsin; şkaf yan divar boyunca.',
  'Yataq otağı': 'Otel otağında çarpayı daxili divarda, iş masası pəncərə qarşısında, giriş yanında baqaj yeri.',
  Mətbəx: 'Mətbəx tezgahı koridor tərəfdəki divar boyunca, soyuducu girişə yaxın; yer imkan verirsə ada masası.',
  SQ: 'Sanitar qovşaqda vanna uzun divar boyunca, lavabo və unitaz qapıya yaxın; nəmə davamlı kafel.',
  Giriş: 'Girişdə ayaqqabı şkafı və güzgü.',
};

export function offlineInterior(r, unitIndex = 0) {
  const style = r.refs.style;
  const units = r.plan.rects.filter((x) => x.kind === 'unit');
  const u = units[Math.min(unitIndex, units.length - 1)];
  const rooms = u ? r.plan.rects.filter((x) => ['room', 'wet', 'hall'].includes(x.kind) && x.x >= u.x - 0.05 && x.x + x.w <= u.x + u.w + 0.05 && x.y >= u.y - 0.05 && x.y + x.h <= u.y + u.h + 0.05) : [];
  const seen = new Set();
  const otaqlar = rooms.filter((x) => { const k = x.label.split(' ')[0]; if (seen.has(x.label)) return false; seen.add(x.label); return ROOM[x.label] || ROOM[k]; })
    .map((x) => ({ ad: x.label, qerar: ROOM[x.label] || ROOM[x.label.split(' ')[0]] }));
  if (!u) otaqlar.push({ ad: 'Açıq ofis sahəsi', qerar: 'İş masaları fasad boyunca təbii işığa yaxın, iclas otaqları nüvənin yanında, mətbəxçə ortaq zonada.' });
  return {
    konsept: `${style.name.split(' (')[0]} fasadının davamı olaraq ${r.refs.quality.name.toLowerCase()} səviyyəli, işıqlı və praktik interyer.`,
    palitra: PAL[style.id] || PAL.modern,
    materiallar: r.refs.quality.id === 'premium' ? ['Təbii palıd parket', 'Abşeron daşı aksent divar', 'Mat latun detallar'] : r.refs.quality.id === 'ekonom' ? ['Laminat döşəmə', 'Su əsaslı boya', 'Keramik kafel'] : ['Mühəndis parketi', 'Dekorativ suvaq', 'Porselen kafel'],
    otaqlar,
    isiqlandirma: 'Cənub pəncərələrindən gün işığı əsas mənbədir; axşam üçün isti tonlu (2700–3000K) LED tavan və yerli işıqlar.',
    iqlim: 'Yayda cənub pəncərələrində jalüz və ya günlük, qışda Xəzri tərəfdə ikiqat şüşə; mətbəx və SQ-da məcburi ventilyasiya.',
    budce_qeydi: `${r.refs.quality.name} səviyyəsinə uyğun materiallar seçilib; dəqiq təmir smetası layihə mərhələsində hazırlanır.`,
  };
}

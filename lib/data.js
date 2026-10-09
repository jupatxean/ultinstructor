// Nümunə (illüstrativ) dəyərlər. Real layihədə rəsmi mənbələrlə (AzDTN, geoloji xəritələr, daşınmaz əmlak bazası) əvəz edilməlidir.
// salePrice: yeni tikilidə təxmini orta satış qiyməti, AZN/m²; gw: ərazi üçün tipik qrunt suyu səviyyəsi (ipucu)

export const DISTRICTS = [
  // Səbail
  { id: 'sebail', lat: 40.366, lng: 49.835, group: 'Səbail', name: 'Səbail (mərkəz, dənizkənarı)', landslide: 'medium', seismic: 9, salePrice: 3300, gw: 'orta', note: 'Tarixi mərkəz, yüksək tələb, sıx tikinti məhdudiyyətləri' },
  { id: 'badamdar', lat: 40.336, lng: 49.803, group: 'Səbail', name: 'Badamdar', landslide: 'high', seismic: 9, salePrice: 2400, gw: 'derin', note: 'Tanınmış sürüşmə zonası, maili relyef, dəniz mənzərəsi' },
  { id: 'bayil', lat: 40.345, lng: 49.834, group: 'Səbail', name: 'Bayıl', landslide: 'high', seismic: 9, salePrice: 1900, gw: 'orta', note: 'Sürüşmə zonası, dəniz kənarı' },
  { id: 'bibiheybet', lat: 40.314, lng: 49.818, group: 'Səbail', name: 'Bibiheybət / Şıxov', landslide: 'high', seismic: 9, salePrice: 1700, gw: 'orta', note: 'Yamaclarda aktiv sürüşmə, neft mədənləri yaxınlığı' },
  // Nəsimi
  { id: 'nesimi', lat: 40.385, lng: 49.836, group: 'Nəsimi', name: 'Nəsimi (mərkəz)', landslide: 'low', seismic: 9, salePrice: 2900, gw: 'derin', note: 'Sıx tikinti, yüksək tələb' },
  { id: 'kubinka', lat: 40.392, lng: 49.823, group: 'Nəsimi', name: 'Nəsimi (yuxarı hissə / 5-ci mkr)', landslide: 'medium', seismic: 9, salePrice: 2300, gw: 'derin', note: 'Maili küçələr, köhnə tikililərin yenilənməsi' },
  // Yasamal
  { id: 'yasamal', lat: 40.383, lng: 49.808, group: 'Yasamal', name: 'Yasamal', landslide: 'medium', seismic: 9, salePrice: 2300, gw: 'derin', note: 'Bəzi yamaclarda sürüşmə riski' },
  { id: 'yeniyasamal', lat: 40.4, lng: 49.795, group: 'Yasamal', name: 'Yeni Yasamal', landslide: 'medium', seismic: 9, salePrice: 2000, gw: 'derin', note: 'Yamac üzərində sıx yaşayış massivi' },
  // Nərimanov
  { id: 'nerimanov', lat: 40.407, lng: 49.872, group: 'Nərimanov', name: 'Nərimanov', landslide: 'low', seismic: 9, salePrice: 2200, gw: 'orta', note: 'Stabil, yaxşı infrastruktur' },
  { id: 'ganclik', lat: 40.4, lng: 49.851, group: 'Nərimanov', name: 'Gənclik', landslide: 'low', seismic: 9, salePrice: 2600, gw: 'orta', note: 'Metro və ticarət mərkəzlərinə yaxın' },
  // Xətai
  { id: 'xetai', lat: 40.388, lng: 49.905, group: 'Xətai', name: 'Xətai', landslide: 'low', seismic: 9, salePrice: 2000, gw: 'orta', note: 'Sənaye və yaşayış qarışıq zona' },
  { id: 'agseher', lat: 40.373, lng: 49.882, group: 'Xətai', name: 'Ağ Şəhər', landslide: 'low', seismic: 9, salePrice: 3000, gw: 'dayaz', note: 'Yeni şəhərsalma zonası, keçmiş neft-sənaye torpaqları, dayaz qrunt suyu' },
  { id: 'ehmedli', lat: 40.384, lng: 49.952, group: 'Xətai', name: 'Əhmədli', landslide: 'low', seismic: 9, salePrice: 1500, gw: 'orta', note: 'Geniş yaşayış massivi, sərfəli qiymətlər' },
  // Nizami
  { id: 'nizami', lat: 40.403, lng: 49.93, group: 'Nizami', name: 'Nizami (8-ci km)', landslide: 'low', seismic: 9, salePrice: 1700, gw: 'orta', note: 'Sıx yaşayış, metroya yaxın' },
  // Binəqədi
  { id: 'binegedi', lat: 40.466, lng: 49.828, group: 'Binəqədi', name: 'Binəqədi', landslide: 'low', seismic: 8, salePrice: 1400, gw: 'derin', note: 'Genişlənən yaşayış zonası' },
  { id: 'bilecheri', lat: 40.433, lng: 49.782, group: 'Binəqədi', name: 'Biləcəri / Xocəsən', landslide: 'medium', seismic: 8, salePrice: 1100, gw: 'derin', note: 'Təpəlik relyef, şəhər kənarı' },
  // Xəzər
  { id: 'xezer', lat: 40.495, lng: 50.142, group: 'Xəzər', name: 'Mərdəkan', landslide: 'low', seismic: 8, salePrice: 1600, gw: 'orta', note: 'Qumlu torpaq, bağ evləri, kurort' },
  { id: 'buzovna', lat: 40.51, lng: 50.112, group: 'Xəzər', name: 'Buzovna / Şüvəlan', landslide: 'low', seismic: 8, salePrice: 1300, gw: 'orta', note: 'Çimərlik zonası, mövsümi tələb' },
  // Sabunçu
  { id: 'sabuncu', lat: 40.443, lng: 49.948, group: 'Sabunçu', name: 'Sabunçu', landslide: 'low', seismic: 8, salePrice: 1100, gw: 'derin', note: 'Sərfəli torpaq, aşağı satış qiyməti' },
  { id: 'bakixanov', lat: 40.424, lng: 49.958, group: 'Sabunçu', name: 'Bakıxanov', landslide: 'low', seismic: 8, salePrice: 1500, gw: 'derin', note: 'Sürətlə inkişaf edən yaşayış zonası' },
  // Suraxanı
  { id: 'suraxani', lat: 40.413, lng: 50.002, group: 'Suraxanı', name: 'Suraxanı / Qaraçuxur', landslide: 'low', seismic: 8, salePrice: 1150, gw: 'orta', note: 'Neft mədənləri yaxınlığı, torpaq çirklənməsi yoxlanmalıdır' },
  { id: 'hovsan', lat: 40.375, lng: 50.04, group: 'Suraxanı', name: 'Hövsan', landslide: 'low', seismic: 8, salePrice: 1000, gw: 'dayaz', note: 'Dənizə yaxın, dayaz qrunt suyu' },
  // Qaradağ
  { id: 'qaradag', lat: 40.325, lng: 49.73, group: 'Qaradağ', name: 'Qaradağ / Lökbatan', landslide: 'medium', seismic: 8, salePrice: 900, gw: 'orta', note: 'Palçıq vulkanları zonası, xüsusi geoloji yoxlama tələb olunur' },
  // Pirallahı
  { id: 'pirallahi', lat: 40.47, lng: 50.33, group: 'Pirallahı', name: 'Pirallahı', landslide: 'low', seismic: 8, salePrice: 800, gw: 'dayaz', note: 'Ada, duzlu torpaq və dayaz qrunt suyu' },
];

export const LANDSLIDE = {
  low: { label: 'Aşağı', cap: 30 },
  medium: { label: 'Orta', cap: 16 },
  high: { label: 'Yüksək', cap: 6 },
};

// bearing: tipik daşıma qabiliyyəti, kPa (geoloji hesabat yoxdursa istifadə olunur)
export const SOILS = [
  { id: 'qaya', name: 'Qaya / əhəngdaşı', short: 'Qaya', mult: 1.0, cap: 30, foundationShare: 0.09, bearing: 600 },
  { id: 'qum', name: 'Qumlu torpaq', short: 'Qum', mult: 1.05, cap: 25, foundationShare: 0.11, bearing: 250 },
  { id: 'gil', name: 'Gilli torpaq', short: 'Gil', mult: 1.1, cap: 18, foundationShare: 0.13, bearing: 180 },
  { id: 'sulu', name: 'Duzlu (şoran) torpaq', short: 'Duzlu', mult: 1.15, cap: 16, foundationShare: 0.15, bearing: 150 },
  { id: 'dolma', name: 'Tökmə (doldurma) torpaq', short: 'Tökmə', mult: 1.2, cap: 9, foundationShare: 0.18, bearing: 80 },
];

export const GROUNDWATER = [
  { id: 'derin', name: 'Dərin (>6 m)', short: 'Dərin', mult: 1.0, bsmt: 1.0 },
  { id: 'orta', name: 'Orta (3–6 m)', short: 'Orta', mult: 1.02, bsmt: 1.12 },
  { id: 'dayaz', name: 'Dayaz (<3 m)', short: 'Dayaz', mult: 1.06, bsmt: 1.35 },
];

export const SLOPES = [
  { id: 'duz', name: 'Düz (0–5%)', short: 'Düz', mult: 1.0, cap: 30 },
  { id: 'az', name: 'Az maili (5–15%)', short: 'Az maili', mult: 1.05, cap: 20 },
  { id: 'cox', name: 'Çox maili (>15%)', short: 'Çox maili', mult: 1.14, cap: 10 },
];

export const FUNCTIONS = [
  { id: 'yasayis', name: 'Yaşayış binası', netRatio: 0.78, floorH: 3.0, saleMult: 1.0, cap: 40 },
  { id: 'ofis', name: 'Ofis binası', netRatio: 0.8, floorH: 3.6, saleMult: 1.15, cap: 40 },
  { id: 'otel', name: 'Otel', netRatio: 0.65, floorH: 3.2, saleMult: 1.6, cap: 40 },
  { id: 'ticaret', name: 'Ticarət mərkəzi', netRatio: 0.85, floorH: 4.5, saleMult: 1.15, cap: 5 },
  { id: 'qarisiq', name: 'Qarışıq (1-ci mərtəbə ticarət + yaşayış)', netRatio: 0.76, floorH: 3.0, saleMult: 1.1, cap: 40 },
];

export const QUALITIES = [
  { id: 'ekonom', name: 'Ekonom', costPerM2: 750, saleMult: 0.85 },
  { id: 'standart', name: 'Standart', costPerM2: 1050, saleMult: 1.0 },
  { id: 'premium', name: 'Premium', costPerM2: 1500, saleMult: 1.5 },
];

// costMult: fasad mürəkkəbliyinin xərcə təsiri; colors: [fasad, trim/dam, şüşə/tünd]
export const STYLES = [
  { id: 'modern', name: 'Müasir (şüşə + metal)', costMult: 1.04, colors: ['#8fb3c9', '#e8e6e1', '#3b4a54'], desc: 'Böyük şüşə səthlər, metal profillər, təmiz xətlər' },
  { id: 'baki', name: 'Bakı neoklassik (Abşeron daşı)', costMult: 1.06, colors: ['#d9c7a3', '#efe6d2', '#8a7356'], desc: 'Neft bumu dövrünün daş fasadları, karnizlər, eyvanlar' },
  { id: 'icheri', name: 'Şərq (İçərişəhər motivləri)', costMult: 1.07, colors: ['#d6b98c', '#f1e4c8', '#7a5a3a'], desc: 'Tağlar, şəbəkə naxışları, daxili həyət, qalın daş divarlar' },
  { id: 'minimal', name: 'Minimalist (ağ beton)', costMult: 1.0, colors: ['#eceae6', '#ffffff', '#6d6d6d'], desc: 'Sadə həcmlər, ağ səthlər, gizli detallar' },
  { id: 'eko', name: 'Ekoloji (yaşıl fasad + ağac)', costMult: 1.05, colors: ['#9bb38a', '#e4dccb', '#5b4636'], desc: 'Şaquli bağlar, ağac panellər, təbii ventilyasiya' },
  { id: 'hitech', name: 'Hi-tech / parametrik fasad', costMult: 1.1, colors: ['#b8c4cc', '#f0f2f3', '#22303a'], desc: 'Kompüterlə dizayn olunmuş dalğavari fasad, alüminium panellər' },
  { id: 'artdeco', name: 'Art Deco (həndəsi, qızılı detallar)', costMult: 1.06, colors: ['#cfc6b8', '#e9d9a6', '#2e3a3f'], desc: 'Şaquli ritm, həndəsi ornamentlər, bürünc detallar' },
  { id: 'brutal', name: 'Neobrutalizm (açıq beton)', costMult: 0.98, colors: ['#a9a6a0', '#cfccc5', '#4a4744'], desc: 'Açıq beton, güclü kütlələr, dərin pəncərə nişləri' },
  { id: 'med', name: 'Aralıq dənizi (kurort üslubu)', costMult: 1.02, colors: ['#f3efe6', '#d9774a', '#5d7f95'], desc: 'Ağ suvaq, terrakota, geniş terraslar, kölgəli eyvanlar' },
  { id: 'skand', name: 'Skandinav (ağac + açıq tonlar)', costMult: 1.03, colors: ['#d8c3a5', '#f6f3ee', '#3e4a4f'], desc: 'Ağac üzlük, sadə formalar, böyük pəncərələr' },
];

// cost: hard cost-a faiz əlavəsi; sale: satış qiymətinə faiz bonusu
export const FEATURES = [
  { id: 'seysmik', name: 'Seysmik izolyatorlar', cost: 0.05, sale: 0.03, desc: 'Baza izolyasiyası zəlzələ yükünü 3–5 dəfə azaldır' },
  { id: 'gunes', name: 'Günəş panelləri', cost: 0.012, sale: 0.01, desc: 'Ümumi sahələrin enerjisi, Abşeronda ildə ~2400 günəşli saat' },
  { id: 'yasildam', name: 'Yaşıl dam / terras bağı', cost: 0.01, sale: 0.02, desc: 'Yayda dam istiliyini azaldır, sakinlər üçün istirahət zonası' },
  { id: 'smart', name: 'Ağıllı bina sistemi', cost: 0.02, sale: 0.04, desc: 'Smart home, giriş nəzarəti, enerji monitorinqi' },
  { id: 'yagis', name: 'Yağış suyu toplama', cost: 0.006, sale: 0.005, desc: 'Həyətin suvarılması, su xərclərinin azalması' },
  { id: 'usaq', name: 'Uşaq meydançası və həyət', cost: 0.004, sale: 0.01, desc: 'Ailələr üçün əsas seçim meyarı' },
  { id: 'ev', name: 'Elektromobil şarj yerləri', cost: 0.003, sale: 0.005, desc: 'Parkinqdə şarj stansiyaları' },
];

export const DEFAULT_INPUT = {
  projectName: 'Yeni layihə',
  district: 'xetai',
  plotWidth: 40,
  plotDepth: 30,
  soil: 'qum',
  groundwater: 'orta',
  bearing: '',
  slope: 'duz',
  func: 'yasayis',
  floors: 9,
  basements: 1,
  quality: 'standart',
  style: 'modern',
  features: [],
  budget: 12000000,
  notes: '',
};

export const PRESETS = [
  {
    label: 'Badamdar · 12 mərtəbə',
    input: {
      projectName: 'Badamdar Residence',
      district: 'badamdar', plotWidth: 36, plotDepth: 32, soil: 'gil', groundwater: 'derin', bearing: '', slope: 'cox',
      func: 'yasayis', floors: 12, basements: 1, quality: 'premium', style: 'baki', features: ['usaq'],
      budget: 9000000, notes: 'Dəniz mənzərəsi vacibdir',
    },
  },
  {
    label: 'Ağ Şəhər · ofis',
    input: {
      projectName: 'White City Office',
      district: 'agseher', plotWidth: 45, plotDepth: 30, soil: 'qum', groundwater: 'dayaz', bearing: '', slope: 'duz',
      func: 'ofis', floors: 10, basements: 2, quality: 'standart', style: 'hitech', features: ['gunes', 'smart', 'ev'],
      budget: 22000000, notes: 'Açıq ofis, kafe birinci mərtəbədə',
    },
  },
  {
    label: 'Mərdəkan · otel',
    input: {
      projectName: 'Caspian Boutique Hotel',
      district: 'xezer', plotWidth: 50, plotDepth: 22, soil: 'qum', groundwater: 'orta', bearing: '', slope: 'az',
      func: 'otel', floors: 5, basements: 0, quality: 'premium', style: 'med', features: ['yasildam', 'gunes', 'yagis'],
      budget: 8000000, notes: 'Yay mövsümü üçün, dənizə baxan otaqlar',
    },
  },
];

export const byId = (list, id) => list.find((x) => x.id === id) || list[0];

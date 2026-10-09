// Server-side AI çağırışları (OpenAI və ya Anthropic). Açar heç vaxt brauzerə getmir.
import { systems as calcSystems } from './systems';
import { boq as calcBoq } from './boq';
import { STYLES, FEATURES, DISTRICTS } from './data';
import { bestUse } from './engine';

export function providerInfo() {
  const p = (process.env.AI_PROVIDER || '').toLowerCase();
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  let provider = p === 'anthropic' || p === 'openai' ? p : hasOpenAI ? 'openai' : hasAnthropic ? 'anthropic' : null;
  if (provider === 'openai' && !hasOpenAI) provider = hasAnthropic ? 'anthropic' : null;
  if (provider === 'anthropic' && !hasAnthropic) provider = hasOpenAI ? 'openai' : null;
  const model = provider === 'openai'
    ? process.env.OPENAI_MODEL || 'gpt-5.4-mini'
    : provider === 'anthropic'
      ? process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'
      : null;
  return { provider, model };
}

function extractJSON(text) {
  if (!text) throw new Error('AI boş cavab qaytardı');
  try { return JSON.parse(text); } catch (_) { /* davam */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]);
  throw new Error('AI cavabı JSON formatında deyil');
}

// messages: [{role:'user'|'assistant', content:string}]
export async function callLLM({ system, messages, maxTokens = 3000, timeoutMs = 60000 }) {
  const { provider, model } = providerInfo();
  if (!provider) throw new Error('API açarı tapılmadı (.env.local faylını yoxlayın)');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, ...messages],
          response_format: { type: 'json_object' },
          max_completion_tokens: maxTokens + 4000,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `OpenAI xətası ${res.status}`);
      return { json: extractJSON(data.choices?.[0]?.message?.content), provider, model };
    }
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: `${system}\n\nYALNIZ etibarlı JSON obyekti qaytar, başqa heç nə yazma.`,
        messages,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Anthropic xətası ${res.status}`);
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { json: extractJSON(text), provider, model };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('AI cavabı gecikdi (timeout)');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Mühərrikin nəticəsini AI üçün qısa, oxunaqlı formata salır
export function summarize(r, scen) {
  const m = (n) => `${(n / 1e6).toFixed(2)} mln AZN`;
  const lines = [
    `Layihə: ${r.input.projectName}`,
    `Yer: ${r.refs.district.name} (sürüşmə riski: ${r.refs.landslide.label}, seysmiklik ~${r.refs.district.seismic} bal, qeyd: ${r.refs.district.note})`,
    `Torpaq sahəsi: ${r.site.W}×${r.site.D} m = ${r.site.plotArea} m²; tikinti ləkəsi ${r.site.fw}×${r.site.fd} m = ${r.site.footprint} m²`,
    `Torpaq tipi: ${r.refs.soil.name}; relyef: ${r.refs.slope.name}; qrunt suyu: ${r.refs.gw.name}; daşıma qabiliyyəti: ~${Math.round(r.geo.bearing)} kPa (${r.geo.bearingSource === 'input' ? 'geoloji hesabatdan' : 'təxmini'}); bina təzyiqi ~${Math.round(r.geo.pressure)} kPa; mayeləşmə riski: ${r.geo.liq}`,
    `Funksiya: ${r.refs.func.name}; mərtəbə: ${r.input.floors}; yeraltı: ${r.input.basements}; keyfiyyət: ${r.refs.quality.name}; üslub: ${r.refs.style.name} (${r.refs.style.desc})`,
    `Əlavə xüsusiyyətlər: ${r.refs.feats.length ? r.refs.feats.map((f) => f.name).join(', ') : 'yoxdur'}`,
    `Geoloji yoxlama: ${r.geo.items.map((g) => `${g.title}=${g.level}`).join('; ')}; kəşfiyyat: ${r.geo.survey.boreholes} quyu × ${r.geo.survey.depth} m, ~${r.geo.survey.cost} AZN`,
    `Büdcə: ${m(r.input.budget)}`,
    `Sifarişçinin qeydləri: ${r.input.notes || '—'}`,
    '',
    'HESABLAMA NƏTİCƏLƏRİ (kodla hesablanıb, dəyişmə):',
    `Mərtəbə limiti: ${r.floorCap} (məhdudlaşdıran amil: ${r.limitingFactor}); büdcə ilə mümkün: ${r.budgetFloors}; tövsiyə: ${r.recommendedFloors}`,
    `Ümumi sahə: ${r.cost.grossArea} m²; m² xərci: ${r.cost.costPerM2} AZN; ümumi xərc: ${m(r.cost.totalCost)} (büdcənin ${Math.round(r.cost.budgetRatio * 100)}%)`,
    `Satış sahəsi: ${r.revenue.netArea} m²; satış qiyməti: ${r.revenue.salePrice} AZN/m²; gəlir: ${m(r.revenue.revenue)}; mənfəət: ${m(r.revenue.profit)}; marja: ${Math.round(r.revenue.margin * 100)}%`,
    `Mənzil/otaq sayı: ${r.units}; parkinq yeri: ${r.parkingSpots}; müddət: ~${r.months} ay`,
    `Təməl (qayda əsaslı): ${r.foundation.type} — ${r.foundation.why}`,
    `UltScore (risk balı): ${r.score.total}/100, dərəcə ${r.score.grade} (${r.score.label}); ${r.score.parts.map((p) => `${p.label} ${p.value}`).join(', ')}`,
    `Material qiyməti ssenarisi: ${r.input.materialIdx || 0}%`,
    `Ən yaxşı istifadə (mənfəətə görə): ${bestUse(r.input).map((b, i) => `${i + 1}) ${b.name} ${b.floors} mərt., mənfəət ${m(b.result.revenue.profit)}, ROI ${Math.round(b.result.revenue.roi * 100)}%`).join('; ')}`,
    ...sysLines(r),
    ...boqLines(r),
    `Hökm: ${r.status === 'ok' ? 'ALINIR' : r.status === 'warn' ? 'ŞƏRTLƏ ALINIR' : 'BU FORMADA ALINMIR'}`,
    'Problemlər:',
    ...r.issues.map((i) => `- [${i.level}] ${i.title}: ${i.text}`),
  ];
  if (scen) {
    lines.push('', 'Alternativ ssenarilər:');
    scen.forEach((s) => lines.push(`- ${s.id} (${s.name}): ${s.result.input.floors} mərtəbə, ${s.result.refs.quality.name}, xərc ${m(s.result.cost.totalCost)}, mənfəət ${m(s.result.revenue.profit)}, ROI ${Math.round(s.result.revenue.roi * 100)}%, hökm ${s.result.status}`));
  }
  return lines.join('\n');
}

export const ANALYZE_SYSTEM = `Sən Azərbaycanda (xüsusilə Bakı və Abşeronda) işləyən təcrübəli baş memar və tikinti məsləhətçisisən.
Sənə tikinti şirkətinin torpaq və bina ideyası, həmçinin kodla hesablanmış rəqəmlər verilir.
Vəzifən: ideyanın alınıb-alınmayacağını izah etmək və ən ideal formada necə alınacağını konkret göstərmək.

Qaydalar:
- Yalnız Azərbaycan dilində yaz, sadə və peşəkar.
- Verilmiş rəqəmləri DƏYİŞMƏ və yeni xərc rəqəmləri uydurma. Rəqəmə istinad edəndə verilənlərdən istifadə et.
- Yerli şəraiti nəzərə al: seysmiklik, Xəzri (şimal) və Gilavar (cənub) küləkləri, yay istisi, Abşeron daşı, sürüşmə zonaları, qrunt suyu və duzluluq.
- Geoloji göstəricilərə (daşıma qabiliyyəti, qrunt suyu, çökmə, yamac, mayeləşmə) xüsusi diqqət yetir; risklərdə onlara istinad et.
- Fasadı seçilmiş memarlıq üslubuna uyğun təsvir et və reng_palitrasi həmin üsluba uyğun olsun.
- Konkret ol: ümumi məsləhət yox, bu layihəyə aid addımlar.
- Bu konsept səviyyəsidir; lazım gələndə mühəndis/geoloji ekspertiza tövsiyə et.

Bu JSON strukturunu qaytar:
{
  "xulase": "2-3 cümləlik əsas hökm və əsas ideya",
  "esas_ideya": "ideyanı ən ideal formaya salan bir əsas dizayn qərarı (1-2 cümlə)",
  "riskler": [{"basliq": "...", "izah": "...", "seviyye": "yuksek|orta|asagi"}],
  "tovsiyeler": ["konkret addım", "..."],
  "temel": {"basliq": "təməl tipi", "izah": "niyə və necə"},
  "yonlendirme": {"basliq": "qısa", "izah": "günəş, külək, mənzərəyə görə yerləşdirmə"},
  "planlama": {"basliq": "qısa", "izah": "otaq bölgüsü, mənzil tipləri, ictimai zonalar"},
  "fasad": {"basliq": "qısa", "izah": "xarici görünüş, materiallar", "reng_palitrasi": ["#hex fasad əsas", "#hex ikinci/trim", "#hex şüşə/tünd"]},
  "novbeti_addim": {"basliq": "qısa", "izah": "ilk görüləcək iş"},
  "tovsiye_ssenari": "gelir|qenaet|keyfiyyet",
  "investor_cumlesi": "investora deyiləcək 1 cümlə"
}
riskler 3-5, tovsiyeler 3-6 element olsun.`;

export const CHAT_SYSTEM = `Sən "UltInstructor" platformasının baş memarısan və sifarişçi ilə layihə üzərində birbaşa işləyirsən.
Azərbaycan dilində, qısa (maksimum 6-8 cümlə), konkret cavab ver. Rəqəm uydurma, verilən hesablamalara istinad et.
Su, kanalizasiya, elektrik, işıq, istilik, soyutma, ventilyasiya, yanğın, lift, qaz kimi mühəndis sistemləri haqqında suallara "MÜHƏNDİS SİSTEMLƏRİ" bölməsindəki hesablanmış həllərə əsasən cavab ver; material miqdarı, smeta, müddət və risk suallarına "DETALLI SMETA VƏ QRAFİK" bölməsinə əsasən cavab ver və Bakı şərtləri (seysmiklik, su fasilələri, yay istisi, Xəzri, dəniz duzu) ilə əsaslandır.
Əgər istifadəçi layihə parametrlərini dəyişməyi istəyirsə və ya sən dəyişiklik təklif edirsənsə və istifadəçi razıdırsa, "patch" sahəsində yalnız dəyişən parametrləri qaytar.
İcazə verilən patch açarları və dəyərləri:
- floors: tam ədəd 1-60
- basements: tam ədəd 0-5
- quality: "ekonom" | "standart" | "premium"
- func: "yasayis" | "ofis" | "otel" | "ticaret" | "qarisiq"
- style: ${STYLES.map((s) => `"${s.id}" (${s.name})`).join(' | ')}
- soil: "qaya" | "qum" | "gil" | "sulu" (duzlu) | "dolma" (tökmə)
- groundwater: "derin" | "orta" | "dayaz"
- bearing: daşıma qabiliyyəti kPa (30-2000)
- slope: "duz" | "az" | "cox"
- district: ${DISTRICTS.map((d) => `"${d.id}" (${d.name})`).join(' | ')}
- features: TAM siyahı (mövcudları da daxil et): ${FEATURES.map((f) => `"${f.id}" (${f.name})`).join(' | ')}
- plotWidth, plotDepth: metr
- budget: AZN ədəd
- materialIdx: material qiyməti dəyişməsi faizlə (-20..50)
JSON qaytar: {"reply": "cavab mətni", "patch": {…} və ya null}`;

function sysLines(r) {
  try {
    const s = calcSystems(r);
    return ['MÜHƏNDİS SİSTEMLƏRİ (kodla hesablanıb):', `Hündürlük sinfi: ${s.hc.name}, yanğın hündürlüyü ${s.H} m`, ...s.list.map((x) => `- ${x.name}: ${x.items.slice(0, 4).map((i) => `${i.k} ${i.v}`).join('; ')}`)];
  } catch (e) { return []; }
}

function boqLines(r) {
  try {
    const b = calcBoq(r);
    const m = (n) => `${(n / 1e6).toFixed(2)} mln AZN`;
    return ['DETALLI SMETA VƏ QRAFİK (kodla hesablanıb):', `Smeta: ${m(b.total)} (material ${m(b.matTotal)}, əmək ${m(b.labTotal)}), parametrik ilə fərq ${Math.round(b.diff * 100)}%`, `Əsas materiallar: ${b.key.slice(0, 6).map((k) => `${k.k} ${k.v}`).join('; ')}`, `Müddət: ümumi ${b.schedule.months} ay, tikinti ${b.schedule.buildMonths} ay, pik işçi ~${b.workers}`, `Əsas risklər: ${b.risks.slice(0, 5).map((x) => `${x.name} (bal ${x.score}/9; tədbir: ${x.steps[0]})`).join('; ')}`];
  } catch (e) { return []; }
}

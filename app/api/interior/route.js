import { analyze } from '@/lib/engine';
import { callLLM, providerInfo } from '@/lib/ai';
import { rateLimit } from '@/lib/ratelimit';
import { offlineInterior } from '@/lib/interior';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SYSTEM = `Sən Bakıda işləyən təcrübəli interyer dizayneri və planlama memarısan.
Sənə binanın funksiyası, keyfiyyət səviyyəsi, fasad üslubu, rayon və seçilmiş mənzilin/mərtəbənin otaqları (adı, sahəsi, ölçüsü) verilir.
Vəzifən: bu məkanın daxili dizaynına və planlamasına konkret qərarlar vermək.
Qaydalar:
- Yalnız Azərbaycan dilində, qısa və konkret yaz.
- Otaq sahələrini dəyişmə, verilənlərə istinad et.
- Yerli şəraiti nəzərə al: yay istisi, qış küləyi (Xəzri), günəşin cənubdan gəlməsi, Abşeron daşı, yerli istehsal materialları.
- Rənglər real interyer rəngləri olsun (çox doymuş olmasın), bir-biri ilə harmoniyada.
Bu JSON strukturunu qaytar:
{
  "konsept": "1-2 cümləlik interyer konsepti",
  "palitra": {"dosheme": "#hex döşəmə (parket) tonu", "divar": "#hex divar", "mebel": "#hex əsas mebel/ağac", "aksent": "#hex divan/kreslo aksent", "yumsaq": "#hex xalça/tekstil"},
  "materiallar": ["material 1", "material 2", "material 3"],
  "otaqlar": [{"ad": "otağın adı (verilən kimi)", "qerar": "bu otaq üçün konkret planlama və dizayn qərarı (1-2 cümlə)"}],
  "isiqlandirma": "işıqlandırma qərarı",
  "iqlim": "istilik/sərinlik və ventilyasiya qərarı",
  "budce_qeydi": "keyfiyyət səviyyəsinə uyğun m² üzrə təxmini təmir yanaşması (rəqəm uydurmadan)"
}`;

const HEX = /^#[0-9a-f]{6}$/i;

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Yanlış sorğu' }, { status: 400 }); }
  const { input, unitIndex = 0 } = body;
  const r = analyze(input);
  const fallback = offlineInterior(r, unitIndex);
  if (!rateLimit(req, { limit: 10 })) return Response.json({ interior: fallback, mode: 'offline', note: 'Çox sorğu, bir dəqiqə sonra yenidən cəhd edin.' });
  if (!providerInfo().provider) return Response.json({ interior: fallback, mode: 'offline', note: 'API açarı yoxdur — oflayn rejim' });

  const units = r.plan.rects.filter((x) => x.kind === 'unit');
  const u = units[Math.min(unitIndex, units.length - 1)];
  const rooms = u
    ? r.plan.rects.filter((x) => ['room', 'wet', 'hall'].includes(x.kind) && x.x >= u.x - 0.05 && x.x + x.w <= u.x + u.w + 0.05 && x.y >= u.y - 0.05 && x.y + x.h <= u.y + u.h + 0.05)
    : r.plan.rects.filter((x) => x.kind !== 'unit');
  const desc = [
    `Bina: ${r.refs.func.name}, ${r.input.floors} mərtəbə, keyfiyyət: ${r.refs.quality.name}, fasad üslubu: ${r.refs.style.name} (${r.refs.style.desc})`,
    `Yer: ${r.refs.district.name} (${r.refs.district.note})`,
    `Sifarişçinin qeydləri: ${r.input.notes || '—'}`,
    u ? `Seçilmiş mənzil: ${u.label}, ümumi ${Math.round(u.area)} m², ölçü ${u.w.toFixed(1)}×${u.h.toFixed(1)} m; pəncərələr ${u.y < 0.05 ? 'cənuba' : 'şimala'} baxır` : `Tipik mərtəbə: ${r.site.fw}×${r.site.fd} m`,
    'Otaqlar:',
    ...rooms.map((x) => `- ${x.label}: ${Math.round(x.area || x.w * x.h)} m² (${x.w.toFixed(1)}×${x.h.toFixed(1)} m)`),
  ].join('\n');

  try {
    const { json, model } = await callLLM({ system: SYSTEM, messages: [{ role: 'user', content: desc }], maxTokens: 1500 });
    const p = json.palitra || {};
    const palitra = { ...fallback.palitra };
    ['dosheme', 'divar', 'mebel', 'aksent', 'yumsaq'].forEach((k) => { if (HEX.test(p[k] || '')) palitra[k] = p[k]; });
    return Response.json({ interior: { ...fallback, ...json, palitra }, mode: 'ai', model });
  } catch (e) {
    return Response.json({ interior: fallback, mode: 'offline', note: `AI əlçatan deyil: ${e.message}` });
  }
}

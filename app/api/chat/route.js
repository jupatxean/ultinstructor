import { analyze, scenarios } from '@/lib/engine';
import { callLLM, summarize, CHAT_SYSTEM, providerInfo } from '@/lib/ai';
import { STYLES, FEATURES, DISTRICTS } from '@/lib/data';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED = {
  floors: (v) => Number.isFinite(+v) && +v >= 1 && +v <= 60 ? Math.round(+v) : undefined,
  basements: (v) => Number.isFinite(+v) && +v >= 0 && +v <= 5 ? Math.round(+v) : undefined,
  quality: (v) => (['ekonom', 'standart', 'premium'].includes(v) ? v : undefined),
  func: (v) => (['yasayis', 'ofis', 'otel', 'ticaret', 'qarisiq'].includes(v) ? v : undefined),
  style: (v) => (STYLES.some((s) => s.id === v) ? v : undefined),
  district: (v) => (DISTRICTS.some((d) => d.id === v) ? v : undefined),
  groundwater: (v) => (['derin', 'orta', 'dayaz'].includes(v) ? v : undefined),
  bearing: (v) => Number.isFinite(+v) && +v >= 30 && +v <= 2000 ? Math.round(+v) : undefined,
  features: (v) => (Array.isArray(v) ? v.filter((f) => FEATURES.some((x) => x.id === f)) : undefined),
  soil: (v) => (['qaya', 'qum', 'gil', 'sulu', 'dolma'].includes(v) ? v : undefined),
  slope: (v) => (['duz', 'az', 'cox'].includes(v) ? v : undefined),
  plotWidth: (v) => Number.isFinite(+v) && +v >= 8 && +v <= 300 ? +v : undefined,
  plotDepth: (v) => Number.isFinite(+v) && +v >= 8 && +v <= 300 ? +v : undefined,
  materialIdx: (v) => Number.isFinite(+v) && +v >= -30 && +v <= 60 ? Math.round(+v) : undefined,
  budget: (v) => Number.isFinite(+v) && +v > 0 ? Math.round(+v) : undefined,
};

function cleanPatch(p) {
  if (!p || typeof p !== 'object') return null;
  const out = {};
  for (const [k, fn] of Object.entries(ALLOWED)) {
    if (p[k] !== undefined && p[k] !== null) {
      const v = fn(p[k]);
      if (v !== undefined) out[k] = v;
    }
  }
  return Object.keys(out).length ? out : null;
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Yanlış sorğu' }, { status: 400 }); }
  const { input, messages = [] } = body;
  if (!rateLimit(req, { limit: 15 })) {
    return Response.json({ reply: 'Çox sorğu göndərildi, bir dəqiqə sonra yenidən yazın.', patch: null, mode: 'limited' });
  }
  if (!providerInfo().provider) {
    return Response.json({ reply: 'Söhbət üçün API açarı lazımdır. .env.local faylına OPENAI_API_KEY və ya ANTHROPIC_API_KEY əlavə edin.', patch: null, mode: 'offline' });
  }
  const r = analyze(input);
  const ctx = summarize(r, scenarios(input));
  const history = messages.slice(-10).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content).slice(0, 2000) }));
  if (history.length && history[0].role !== 'user') history.shift();
  try {
    const { json } = await callLLM({
      system: `${CHAT_SYSTEM}\n\nCARİ LAYİHƏ VƏZİYYƏTİ:\n${ctx}`,
      messages: history,
      maxTokens: 900,
    });
    return Response.json({ reply: String(json.reply || ''), patch: cleanPatch(json.patch), mode: 'ai' });
  } catch (e) {
    return Response.json({ reply: `AI cavab verə bilmədi: ${e.message}`, patch: null, mode: 'error' });
  }
}

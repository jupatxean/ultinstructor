import { analyze, scenarios } from '@/lib/engine';
import { callLLM, summarize, ANALYZE_SYSTEM, providerInfo } from '@/lib/ai';
import { offlineReview } from '@/lib/offline';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req) {
  let input;
  try {
    ({ input } = await req.json());
  } catch {
    return Response.json({ error: 'Yanlış sorğu' }, { status: 400 });
  }
  const result = analyze(input);
  const scen = scenarios(input);
  const info = providerInfo();

  if (!rateLimit(req, { limit: 10 })) {
    return Response.json({ ai: offlineReview(result, scen), mode: 'offline', note: 'Çox sorğu göndərildi, bir dəqiqə sonra yenidən cəhd edin (oflayn rəy göstərilir).' });
  }
  if (!info.provider) {
    return Response.json({ ai: offlineReview(result, scen), mode: 'offline', note: 'API açarı yoxdur — oflayn rejim' });
  }
  try {
    const { json, provider, model } = await callLLM({
      system: ANALYZE_SYSTEM,
      messages: [{ role: 'user', content: summarize(result, scen) }],
      maxTokens: 2500,
    });
    return Response.json({ ai: json, mode: 'ai', provider, model });
  } catch (e) {
    return Response.json({ ai: offlineReview(result, scen), mode: 'offline', note: `AI əlçatan deyil: ${e.message}` });
  }
}

// Sadə yaddaş-daxili limit: hər IP üçün dəqiqədə N sorğu (ictimai demo-da API balansını qorumaq üçün)
const hits = new Map();

export function rateLimit(req, { limit = 12, windowMs = 60_000 } = {}) {
  if (process.env.NODE_ENV !== 'production') return true;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return true;
}

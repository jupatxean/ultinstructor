// npm run eval tərəfindən yaradılıb
export const AI_EVAL = {
  "model": "gpt-5.4-mini",
  "passed": 10,
  "total": 10,
  "avgSec": "7.1",
  "date": "2026-10-09 11:11",
  "note": "Struktur, dil, hökm uyğunluğu və söhbətlə parametr dəyişmə dəqiqliyi",
  "checks": [
    {
      "name": "Badamdar, 12 mərtəbə (alınmır gözlənilir)",
      "ok": true,
      "detail": "13.0 san.; struktur tam; Azərbaycan dili; hökm uyğundur"
    },
    {
      "name": "Nəsimi, qaya, 7 mərtəbə (alınır gözlənilir)",
      "ok": true,
      "detail": "9.7 san.; struktur tam; Azərbaycan dili; hökm uyğundur"
    },
    {
      "name": "Ağ Şəhər, dayaz su, mayeləşmə",
      "ok": true,
      "detail": "10.2 san.; struktur tam; Azərbaycan dili; hökm uyğundur"
    },
    {
      "name": "Tökmə torpaq, 5 mərtəbə",
      "ok": true,
      "detail": "10.0 san.; struktur tam; Azərbaycan dili; hökm uyğundur"
    },
    {
      "name": "Büdcə çatmır",
      "ok": true,
      "detail": "9.9 san.; struktur tam; Azərbaycan dili; hökm uyğundur"
    },
    {
      "name": "Mərdəkan otel, yaşıl dam",
      "ok": true,
      "detail": "10.5 san.; struktur tam; Azərbaycan dili; hökm uyğundur"
    },
    {
      "name": "Söhbət: \"Mərtəbəni 6-ya endir\" → floors = 6",
      "ok": true,
      "detail": "2.1 san.; patch: {\"floors\":6}"
    },
    {
      "name": "Söhbət: \"Premium keyfiyyət et\" → quality = premium",
      "ok": true,
      "detail": "1.5 san.; patch: {\"quality\":\"premium\"}"
    },
    {
      "name": "Söhbət: \"Ofis binası olsun\" → func = ofis",
      "ok": true,
      "detail": "1.6 san.; patch: {\"func\":\"ofis\"}"
    },
    {
      "name": "Söhbət: Sual (parametr dəyişməməli) → patch = null",
      "ok": true,
      "detail": "2.1 san.; patch: null"
    }
  ]
};

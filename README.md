# UltInstructor — layihə öncəsi qərar platforması

Tikinti şirkəti torpağı, büdcəni və bina ideyasını daxil edir; UltInstructor 5 dəqiqəyə cavab verir:
ideya **alınır / şərtlə alınır / alınmır**, və ən ideal forması necədir (təməl, istiqamət, plan, fasad, xərc, 3 ssenari).

## İşə salmaq (VS Code)

1. Node.js 18+ quraşdırılmış olmalıdır (`node -v`).
2. Qovluğu VS Code-da açın, terminalda:
   ```bash
   npm install
   ```
3. `.env.example` faylını `.env.local` adı ilə kopyalayın və açarı yazın:
   ```
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-5.4-mini
   ```
   Claude istifadə etmək üçün: `AI_PROVIDER=anthropic` və `ANTHROPIC_API_KEY=...`.
   Model adı xəta verərsə, hesabınızda mövcud olan modelin adını yazın.
4. ```bash
   npm run dev
   ```
   Brauzerdə: http://localhost:3000

Açar olmasa da tətbiq işləyir: hesablamalar, 3D, plan və ssenarilər tam işləyir, AI rəyi isə "oflayn rejimdə" qayda əsaslı göstərilir.

## Deploy (Vercel)

1. Kodu GitHub-a yükləyin.
2. vercel.com → New Project → repo-nu seçin.
3. Environment Variables bölməsinə `.env.local`-dakı dəyişənləri əlavə edin → Deploy.

## Struktur

| Fayl | Nə edir |
|---|---|
| `lib/data.js` | Rayonlar, torpaq tipləri, relyef, funksiya, keyfiyyət, üslub; demo ssenarilər |
| `lib/engine.js` | Hesablama mühərriki: mərtəbə limiti, xərc, gəlir, təməl, istiqamət, mərtəbə planı, 3 ssenari |
| `lib/ai.js` | OpenAI / Claude çağırışı, prompt-lar |
| `lib/offline.js` | API olmayanda qayda əsaslı rəy |
| `app/api/analyze` | AI memarın strukturlaşdırılmış rəyi (JSON) |
| `app/api/chat` | Memarla söhbət; AI parametrləri birbaşa dəyişə bilir |
| `components/Building3D.js` | Three.js 3D model (limitdən yuxarı mərtəbələr qırmızı) |
| `components/FloorPlan.js` | Avtomatik tipik mərtəbə planı (SVG) |

## Prinsip

Rəqəmləri **kod** hesablayır (dəqiq və təkrarlanan), **AI** isə izah, risk təhlili, dizayn qərarları və söhbət üçündür.
`lib/data.js`-dəki qiymətlər illüstrativdir; real data ilə əvəz edilə bilər.

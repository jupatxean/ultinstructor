// API açarı olmayanda və ya AI cavab vermədikdə istifadə olunan qayda əsaslı rəy.
// Demo heç vaxt boş qalmasın deyə.

export function offlineReview(r, scen) {
  const best = [...scen].filter((s) => s.result.status !== 'fail').sort((a, b) => b.result.revenue.roi - a.result.revenue.roi)[0] || scen[1];
  const verdict = r.status === 'ok' ? 'İdeya bu formada alınır' : r.status === 'warn' ? 'İdeya şərtlərlə alınır' : 'İdeya bu formada alınmır';
  const risks = r.issues.filter((i) => i.level !== 'ok').map((i) => ({ basliq: i.title, izah: i.text, seviyye: i.level === 'fail' ? 'yuksek' : 'orta' }));
  if (!risks.length) risks.push({ basliq: 'Əsas risk müəyyən edilmədi', izah: 'Standart geoloji və seysmik ekspertiza yenə də tələb olunur.', seviyye: 'asagi' });
  const recs = [];
  if (r.input.floors > r.floorCap) recs.push(`Mərtəbə sayını ${r.floorCap}-ə endirin (${r.limitingFactor.toLowerCase()} səbəbindən).`);
  if (r.cost.budgetRatio > 1) recs.push(`Büdcəyə sığmaq üçün ${r.budgetFloors} mərtəbə və ya daha sərfəli keyfiyyət seçin.`);
  recs.push(`"${best.name}" ssenarisini nəzərdən keçirin: ROI ${Math.round(best.result.revenue.roi * 100)}%.`);
  recs.push('Layihəyə başlamazdan əvvəl geoloji kəşfiyyat (qazma quyuları) aparın.');
  recs.push('Lift və pilləkən nüvəsini şimal tərəfdə yerləşdirərək Xəzriyə qarşı bufer yaradın.');
  return {
    xulase: `${verdict}. Təxmini xərc ${(r.cost.totalCost / 1e6).toFixed(2)} mln ₼, büdcənin ${Math.round(r.cost.budgetRatio * 100)}%-i; torpaq üçün təhlükəsiz hədd ${r.floorCap} mərtəbədir.`,
    esas_ideya: `Tövsiyə olunan həcm: ${r.recommendedFloors} mərtəbə, ${r.foundation.type.toLowerCase()} üzərində, əsas fasad cənuba.`,
    riskler: risks,
    tovsiyeler: recs,
    temel: { basliq: r.foundation.type, izah: `${r.foundation.why} ${r.foundation.extras.join('; ')}.` },
    yonlendirme: { basliq: r.orientation.longEW ? 'Uzun ox şərq–qərb, fasad cənuba' : 'Qərb fasadında günlüklər', izah: r.orientation.notes.join(' ') },
    planlama: { basliq: r.plan.typical, izah: r.units ? `Binada ${r.units} vahid nəzərdə tutulub; yaş zonalar dəhlizə bitişik, yaşayış otaqları fasada baxır.` : 'Açıq planlı mərtəbə, nüvə mərkəzdə.' },
    fasad: { basliq: r.refs.style.name, izah: 'Seçilmiş üsluba uyğun material və rənglər.', reng_palitrasi: r.refs.style.colors },
    novbeti_addim: { basliq: 'Geoloji kəşfiyyat', izah: 'Torpağın daşıma qabiliyyətini və qrunt suyunu dəqiqləşdirin.' },
    tovsiye_ssenari: best.id,
    investor_cumlesi: `${r.input.projectName}: ${(r.revenue.revenue / 1e6).toFixed(1)} mln ₼ proqnoz gəlir, ${Math.round(r.revenue.margin * 100)}% marja.`,
  };
}

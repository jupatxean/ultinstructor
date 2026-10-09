'use client';

import { fmtAZN } from '@/lib/engine';

const C = { ok: 'var(--ok)', warn: 'var(--warn)', fail: 'var(--fail)' };
const L = { ok: 'Normal', warn: 'Diqqət', fail: 'Yüksək risk' };

export default function GeoPanel({ r }) {
  const { geo } = r;
  return (
    <div>
      <div className="card-h" style={{ borderBottom: 0 }}>
        <h2>Tikintidən əvvəl torpaq yoxlaması</h2>
        <span className="note">6 əsas göstərici · təxmini qiymətləndirmə</span>
      </div>
      <div className="geo-grid">
        {geo.items.map((g, i) => (
          <article key={g.key} className="geo-card" style={{ borderTopColor: C[g.level] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <span className="eyebrow">{String(i + 1).padStart(2, '0')}</span>
              <span className="tag" style={{ color: C[g.level] }}>{L[g.level].toUpperCase()}</span>
            </div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{g.title}</h3>
            <span className="mono" style={{ fontSize: 13 }}>{g.value}</span>
            <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 13 }}>{g.text}</p>
          </article>
        ))}
      </div>

      <div style={{ padding: '4px 18px 18px', display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '2 1 320px' }}>
          <span className="eyebrow">Geoloji kəşfiyyat planı</span>
          <ol style={{ paddingLeft: 18, margin: '8px 0 0' }}>
            {geo.survey.tests.map((t) => <li key={t} style={{ marginBottom: 4 }}>{t}</li>)}
          </ol>
        </div>
        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="kpi" style={{ border: '1px solid var(--line)' }}>
            <span className="l">Kəşfiyyatın təxmini dəyəri</span>
            <span className="v">{fmtAZN(geo.survey.cost)}</span>
            <span className="s">layihə xərcinin {((geo.survey.cost / r.cost.totalCost) * 100).toFixed(2)}%-i</span>
          </div>
          <div className="kpi" style={{ border: '1px solid var(--line)' }}>
            <span className="l">Müddət</span>
            <span className="v">~{geo.survey.days} gün</span>
            <span className="s">{geo.survey.boreholes} quyu × {geo.survey.depth} m</span>
          </div>
        </div>
      </div>
      <p className="note" style={{ padding: '10px 18px', margin: 0, borderTop: '1px solid var(--line)' }}>
        Təzyiq ~{Math.round(geo.pressure)} kPa · daşıma qabiliyyəti ~{Math.round(geo.bearing)} kPa ({geo.bearingSource === 'input' ? 'daxil edilib' : 'torpaq növünə görə təxmin'}) · plita təməllə maksimum ~{geo.plateFloors} mərtəbə.
        Bu göstəricilər qazma və laboratoriya testləri ilə təsdiqlənməlidir.
      </p>
    </div>
  );
}

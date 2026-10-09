'use client';

import { fmtAZN } from '@/lib/engine';
import { STATUS } from '@/components/Panels';

export default function BestUse({ list, current, onApply }) {
  const best = list[0];
  const cur = list.find((x) => x.id === current);
  const max = Math.max(...list.map((x) => Math.max(0, x.result.revenue.profit)), 1);
  const gain = cur && best.id !== current && cur.result.revenue.profit > 0 ? best.result.revenue.profit / cur.result.revenue.profit : null;

  return (
    <div>
      <div className="card-h" style={{ borderBottom: 0 }}>
        <h2>Bu torpağın ən yaxşı istifadəsi</h2>
        <span className="note">Eyni torpaq, büdcə və geologiya ilə 5 funksiyanın müqayisəsi</span>
      </div>

      <div style={{ margin: '0 18px 16px', background: 'var(--ink)', color: '#f3f4f0', padding: '18px 20px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="eyebrow" style={{ color: 'var(--accent-soft)' }}>Tövsiyə</span>
          <strong style={{ fontFamily: 'var(--cond)', fontSize: 26, lineHeight: 1.1 }}>{best.name} · {best.floors} mərtəbə</strong>
          <span style={{ color: '#c5c8c1' }}>
            Proqnoz mənfəət {fmtAZN(best.result.revenue.profit)}, ROI {Math.round(best.result.revenue.roi * 100)}%
            {best.id === current ? ' · hazırkı seçiminiz artıq ən gəlirlidir.' : gain && gain > 1.05 ? ` · hazırkı seçimdən ${gain.toFixed(1)} dəfə çox mənfəət.` : '.'}
          </span>
        </div>
        {best.id !== current && (
          <button type="button" className="btn-accent" onClick={() => onApply({ func: best.id, floors: best.floors })}>Bu funksiyanı tətbiq et</button>
        )}
      </div>

      <table className="table">
        <thead>
          <tr><th>Funksiya</th><th className="r">Mərtəbə</th><th className="r">Xərc</th><th className="r">Gəlir</th><th className="r">Mənfəət</th><th className="r">ROI</th><th className="r">UltScore</th><th /></tr>
        </thead>
        <tbody>
          {list.map((x, i) => {
            const st = STATUS[x.result.status];
            return (
              <tr key={x.id} style={{ background: x.id === current ? '#f7f8f5' : undefined }}>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontWeight: i === 0 ? 600 : 400 }}>{i + 1}. {x.name}{x.id === current ? ' (hazırkı)' : ''}</span>
                    <div className="bar-bg" style={{ height: 6 }}><div className="bar" style={{ height: 6, width: `${(Math.max(0, x.result.revenue.profit) / max) * 100}%`, background: i === 0 ? 'var(--accent)' : 'var(--ink)' }} /></div>
                  </div>
                </td>
                <td className="r">{x.floors}</td>
                <td className="r">{fmtAZN(x.result.cost.totalCost)}</td>
                <td className="r">{fmtAZN(x.result.revenue.revenue)}</td>
                <td className="r" style={{ color: x.result.revenue.profit < 0 ? 'var(--fail)' : undefined }}>{fmtAZN(x.result.revenue.profit)}</td>
                <td className="r">{Math.round(x.result.revenue.roi * 100)}%</td>
                <td className="r"><span style={{ color: st.color }}>{x.result.score.total} · {x.result.score.grade}</span></td>
                <td className="r">
                  {x.id !== current && <button type="button" className="btn-outline" style={{ minHeight: 34, padding: '4px 10px', fontWeight: 500 }} onClick={() => onApply({ func: x.id, floors: x.floors })}>Seç</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="note" style={{ padding: '10px 18px', margin: 0 }}>
        Hər funksiya üçün mərtəbə sayı torpağın təhlükəsiz limitinə qədər məhdudlaşdırılıb. Satış qiymətləri rayonun orta bazar dəyərinə əsaslanır (illüstrativ).
      </p>
    </div>
  );
}

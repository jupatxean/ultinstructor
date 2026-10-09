'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { STYLE_INTERIOR } from '@/components/Interior3D';

const Interior3D = dynamic(() => import('@/components/Interior3D'), { ssr: false, loading: () => <div className="stage" style={{ height: 560 }} /> });

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function InteriorPanel({ result, input }) {
  const units = result.plan.rects.filter((r) => r.kind === 'unit');
  const [unitIndex, setUnitIndex] = useState(0);
  const [cutaway, setCutaway] = useState(false);
  const [ai, setAi] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiKey, setAiKey] = useState('');

  useEffect(() => { if (unitIndex >= units.length) setUnitIndex(0); }, [units.length, unitIndex]);
  const key = `${JSON.stringify(input)}|${unitIndex}`;
  const fresh = ai && aiKey === key;

  const palette = useMemo(() => (ai?.palitra ? ai.palitra : STYLE_INTERIOR[result.refs.style.id] || STYLE_INTERIOR.modern), [ai, result.refs.style.id]);

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/interior', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, unitIndex }) });
      const d = await res.json();
      setAi(d.interior); setMeta({ mode: d.mode, model: d.model, note: d.note }); setAiKey(key);
    } catch (e) { setMeta({ mode: 'offline', note: e.message }); }
    setLoading(false);
  };

  return (
    <div>
      <div className="card-h" style={{ borderBottom: 0, alignItems: 'center' }}>
        <h2>İnteryer və planlama</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {units.length > 0 && <span className="note">Mənzil:</span>}
          {units.map((u, i) => (
            <button key={i} type="button" className={`chip${i === unitIndex ? ' on' : ''}`} style={{ boxShadow: 'none', border: '1px solid var(--line-2)' }} onClick={() => setUnitIndex(i)} title={u.label}>
              {LETTERS[i]} · {u.unitType === 'otel' ? 'otaq' : `${u.unitType}o`} · {Math.round(u.area)} m²
            </button>
          ))}
          <button type="button" className={`chip${cutaway ? ' on' : ''}`} style={{ boxShadow: 'none', border: '1px solid var(--line-2)' }} onClick={() => setCutaway(!cutaway)}>{cutaway ? '▣ Tam divarlar' : '▤ Kəsik görünüş'}</button>
        </div>
      </div>

      <Interior3D result={result} unitIndex={unitIndex} palette={palette} cutaway={cutaway} />

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {['dosheme', 'divar', 'mebel', 'aksent', 'yumsaq'].map((k) => (
              <span key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <i style={{ width: 30, height: 30, borderRadius: 8, background: palette[k], border: '1px solid var(--line-2)', display: 'inline-block' }} />
                <span className="note" style={{ fontSize: 10 }}>{{ dosheme: 'Döşəmə', divar: 'Divar', mebel: 'Mebel', aksent: 'Aksent', yumsaq: 'Tekstil' }[k]}</span>
              </span>
            ))}
          </div>
          <button type="button" className="btn-accent" onClick={run} disabled={loading}>
            {loading ? 'AI dizayner düşünür…' : fresh ? 'Yenidən dizayn et' : 'AI ilə interyer dizaynı'}
          </button>
        </div>
        {meta?.note && <span className="note" style={{ color: 'var(--warn)' }}>{meta.note}</span>}
        {ai && (
          <div className="ai" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 20 }}>AI interyer qərarları{!fresh ? ' (köhnəlib)' : ''}</h2>
              <span className="eyebrow" style={{ color: '#a9afb5' }}>{meta?.mode === 'ai' ? meta.model : 'oflayn rejim'}</span>
            </div>
            <p style={{ margin: 0, fontSize: 16 }}><span style={{ color: 'var(--accent-soft)' }}>Konsept: </span>{ai.konsept}</p>
            <div className="ai-grid">
              {(ai.otaqlar || []).map((o, i) => (
                <div key={i} className="ai-cell"><span className="eyebrow">{o.ad}</span><span className="t">{o.qerar}</span></div>
              ))}
              {ai.isiqlandirma && <div className="ai-cell"><span className="eyebrow">İşıqlandırma</span><span className="t">{ai.isiqlandirma}</span></div>}
              {ai.iqlim && <div className="ai-cell"><span className="eyebrow">İqlim</span><span className="t">{ai.iqlim}</span></div>}
            </div>
            {ai.materiallar?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ai.materiallar.map((m) => <span key={m} className="tag" style={{ border: '1px solid #3b444c', borderRadius: 999, padding: '4px 10px', color: '#e3e5e0' }}>{m}</span>)}
              </div>
            )}
            {ai.budce_qeydi && <span className="note" style={{ color: '#a9afb5' }}>{ai.budce_qeydi}</span>}
          </div>
        )}
        {!ai && <span className="note">Rənglər hazırda seçilmiş fasad üslubundan götürülüb. AI düyməsini basın: dizayner otaq-otaq qərar verəcək, palitra 3D-yə tətbiq olunacaq.</span>}
      </div>
    </div>
  );
}

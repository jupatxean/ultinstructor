'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { DISTRICTS, LANDSLIDE, SOILS, SLOPES, FUNCTIONS, QUALITIES, STYLES, GROUNDWATER, FEATURES } from '@/lib/data';
import { fmtNum } from '@/lib/engine';

function Seg({ options, value, onChange, label }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ fontWeight: 500, padding: 0, marginBottom: 6 }}>{label}</legend>
      <div className="seg">
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
            {o.short || o.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false });

const GROUPS = [...new Set(DISTRICTS.map((d) => d.group))];

export default function InputForm({ input, setInput, result, onAnalyze, loading }) {
  const set = (k) => (e) => setInput({ ...input, [k]: e?.target ? e.target.value : e });
  const setNum = (k) => (e) => setInput({ ...input, [k]: e.target.value === '' ? '' : Number(e.target.value) });
  const district = DISTRICTS.find((d) => d.id === input.district);
  const style = STYLES.find((s) => s.id === input.style);
  const soil = SOILS.find((s) => s.id === input.soil) || SOILS[0];
  const features = Array.isArray(input.features) ? input.features : [];
  const toggleFeature = (id) => setInput({ ...input, features: features.includes(id) ? features.filter((f) => f !== id) : [...features, id] });

  const [mapOpen, setMapOpen] = useState(false);
  const [picked, setPicked] = useState(null);
  const onMapApply = (patch, loc) => {
    const clean = Object.fromEntries(Object.entries(patch || {}).filter(([, v]) => v !== undefined));
    setInput({ ...input, ...clean });
    setPicked(loc || null);
    setMapOpen(false);
  };

  const onDistrict = (e) => {
    const d = DISTRICTS.find((x) => x.id === e.target.value);
    setInput({ ...input, district: d.id, groundwater: d.gw || input.groundwater });
  };

  return (
    <>
    <form className="form" onSubmit={(e) => { e.preventDefault(); onAnalyze(); }}>
      <div className="fsec">
        <span className="eyebrow">01 · Layihə</span>
        <label className="field">Layihənin adı
          <input className="input" value={input.projectName} onChange={set('projectName')} />
        </label>
      </div>

      <div className="fsec">
        <span className="eyebrow">02 · Torpaq sahəsi</span>
        <button type="button" className="btn-outline" onClick={() => setMapOpen(true)}>🗺 Xəritədən torpaq seç</button>
        {picked && <span className="hint">📍 Seçilmiş sahə: {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)} — rayon, ölçülər və relyef xəritədən dolduruldu</span>}
        <label className="field">Rayon / ərazi
          <select className="input" value={input.district} onChange={onDistrict}>
            {GROUPS.map((g) => (
              <optgroup key={g} label={`${g} rayonu`}>
                {DISTRICTS.filter((d) => d.group === g).map((d) => (
                  <option key={d.id} value={d.id}>{d.name} — sürüşmə {LANDSLIDE[d.landslide].label.toLowerCase()}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {district && <span className="hint">{district.note} · seysmiklik ~{district.seismic} bal · ~{fmtNum(district.salePrice)} ₼/m²</span>}
        <div className="grid2">
          <label className="field">En, m
            <input className="input num" type="number" min="8" max="300" value={input.plotWidth} onChange={setNum('plotWidth')} />
          </label>
          <label className="field">Dərinlik, m
            <input className="input num" type="number" min="8" max="300" value={input.plotDepth} onChange={setNum('plotDepth')} />
          </label>
        </div>
        <span className="hint">
          Sahə: {fmtNum(result.site.plotArea)} m² · tikinti ləkəsi {fmtNum(result.site.footprint)} m² ({Math.round(result.site.coverage * 100)}%)
        </span>
        <Seg label="Relyef" options={SLOPES} value={input.slope} onChange={set('slope')} />
      </div>

      <div className="fsec">
        <span className="eyebrow">03 · Geologiya</span>
        <Seg label="Torpağın növü" options={SOILS} value={input.soil} onChange={set('soil')} />
        <Seg label="Yeraltı suyun səviyyəsi" options={GROUNDWATER.map((g) => ({ ...g, short: g.name }))} value={input.groundwater || 'orta'} onChange={set('groundwater')} />
        <label className="field">Daşıma qabiliyyəti, kPa
          <input className="input num" type="number" min="30" max="2000" value={input.bearing ?? ''} onChange={setNum('bearing')} placeholder={`${soil.bearing} (təxmini, ${soil.short.toLowerCase()})`} />
        </label>
        <span className="hint">Geoloji hesabat varsa, real dəyəri yazın. Boş qalsa, torpaq növünə görə təxmin edilir.</span>
      </div>

      <div className="fsec">
        <span className="eyebrow">04 · Bina</span>
        <label className="field">Funksiya
          <select className="input" value={input.func} onChange={set('func')}>
            {FUNCTIONS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <div className="grid2">
          <label className="field">Mərtəbə
            <input className="input num" type="number" min="1" max="60" value={input.floors} onChange={setNum('floors')} />
          </label>
          <label className="field">Yeraltı parkinq
            <input className="input num" type="number" min="0" max="5" value={input.basements} onChange={setNum('basements')} />
          </label>
        </div>
        <Seg label="Keyfiyyət" options={QUALITIES} value={input.quality} onChange={set('quality')} />
        <label className="field">Memarlıq üslubu
          <select className="input" value={input.style} onChange={set('style')}>
            {STYLES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        {style && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex' }}>{style.colors.map((c) => <i key={c} style={{ width: 18, height: 18, background: c, border: '1px solid var(--line-2)', display: 'inline-block' }} />)}</div>
            <span className="hint" style={{ fontFamily: 'var(--sans)' }}>{style.desc}</span>
          </div>
        )}
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 500, padding: 0, marginBottom: 6 }}>Əlavə xüsusiyyətlər</legend>
          <div className="seg">
            {FEATURES.map((f) => (
              <button key={f.id} type="button" aria-pressed={features.includes(f.id)} onClick={() => toggleFeature(f.id)} title={f.desc} style={{ flex: '1 1 45%', fontSize: 12.5 }}>
                {features.includes(f.id) ? '✓ ' : '+ '}{f.name}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="fsec">
        <span className="eyebrow">05 · Büdcə və qeydlər</span>
        <label className="field">Büdcə, ₼
          <input
            className="input big"
            inputMode="numeric"
            value={input.budget === '' ? '' : fmtNum(input.budget)}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, '');
              setInput({ ...input, budget: v === '' ? '' : Number(v) });
            }}
          />
        </label>
        <label className="field">Əlavə istəklər
          <textarea className="input" rows={2} value={input.notes} onChange={set('notes')} placeholder="Məs: dəniz mənzərəsi, uşaq meydançası, birinci mərtəbədə kafe" />
        </label>
        <button type="submit" className="btn-accent" disabled={loading}>
          {loading ? 'AI memar düşünür…' : 'AI memarla təhlil et'}
        </button>
        <span className="note">Rəqəmlər daxil etdikcə dərhal yenilənir. AI rəyi düyməyə basanda alınır.</span>
      </div>
    </form>
    <MapPicker open={mapOpen} onClose={() => setMapOpen(false)} onApply={onMapApply} />
    </>
  );
}

'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import InputForm from '@/components/InputForm';
import FloorPlan from '@/components/FloorPlan';
import GeoPanel from '@/components/GeoPanel';
import BestUse from '@/components/BestUse';
import Passport from '@/components/Passport';
import SystemsPanel from '@/components/SystemsPanel';
import BoqPanel from '@/components/BoqPanel';
import { Verdict, Kpis, Issues, CostBreakdown, Scenarios, AIPanel, Chat } from '@/components/Panels';
import { analyze, scenarios, bestUse } from '@/lib/engine';
import { DEFAULT_INPUT, PRESETS } from '@/lib/data';

const Building3D = dynamic(() => import('@/components/Building3D'), {
  ssr: false,
  loading: () => <div className="stage" style={{ height: 460 }} />,
});

const TABS = [
  { id: '3d', label: '3D model' },
  { id: 'geo', label: 'Geologiya' },
  { id: 'plan', label: 'Mərtəbə planları' },
  { id: 'sys', label: 'Mühəndis sistemləri' },
  { id: 'boq', label: 'Smeta və qrafik' },
  { id: 'cost', label: 'Xərclər' },
  { id: 'scen', label: 'Ssenarilər' },
  { id: 'best', label: 'Ən yaxşı istifadə' },
  { id: 'pasport', label: 'Pasport' },
];

const clean = (i) => ({
  ...i,
  plotWidth: Number(i.plotWidth) || 8,
  plotDepth: Number(i.plotDepth) || 8,
  floors: Number(i.floors) || 1,
  basements: Number(i.basements) || 0,
  budget: Number(i.budget) || 0,
  bearing: Number(i.bearing) || '',
  features: Array.isArray(i.features) ? i.features : [],
});

export default function Home() {
  const [input, setInput] = useState(PRESETS[0].input);
  const [tab, setTab] = useState('3d');
  const [ai, setAi] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiKey, setAiKey] = useState(null);
  const reqId = useRef(0);

  const ci = useMemo(() => clean(input), [input]);
  const result = useMemo(() => analyze(ci), [ci]);
  const scen = useMemo(() => scenarios(ci), [ci]);
  const best = useMemo(() => bestUse(ci), [ci]);
  const key = JSON.stringify(ci);

  const runAI = useCallback(async (inp) => {
    const target = clean(inp || input);
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: target }) });
      const d = await res.json();
      if (id !== reqId.current) return;
      setAi(d.ai || null);
      setMeta({ mode: d.mode, model: d.model, provider: d.provider, note: d.note });
      setAiKey(JSON.stringify(target));
    } catch (e) {
      if (id !== reqId.current) return;
      setMeta({ mode: 'offline', note: `Şəbəkə xətası: ${e.message}` });
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [input]);

  const loadPreset = (p) => {
    setInput(p.input);
    setAi(null); setMeta(null);
    setTab('3d');
    runAI(p.input);
  };

  const applyPatch = (patch) => {
    const next = { ...input, ...patch };
    setInput(next);
    setTab('3d');
  };

  const palette = ai?.fasad?.reng_palitrasi?.length >= 3 && aiKey && JSON.parse(aiKey).style === ci.style
    ? ai.fasad.reng_palitrasi
    : result.refs.style.colors;

  const bestScen = ai?.tovsiye_ssenari || [...scen].filter((s) => s.result.status !== 'fail').sort((a, b) => b.result.revenue.roi - a.result.revenue.roi)[0]?.id;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <svg width="34" height="34" viewBox="0 0 48 48" aria-hidden="true">
            <rect x="4" y="34" width="40" height="8" fill="#C2410C" />
            <g stroke="#15181B" strokeWidth="1.2">
              <line x1="8" y1="34" x2="8" y2="38" /><line x1="16" y1="34" x2="16" y2="38" /><line x1="24" y1="34" x2="24" y2="39" />
              <line x1="32" y1="34" x2="32" y2="38" /><line x1="40" y1="34" x2="40" y2="38" />
            </g>
            <circle cx="24" cy="7" r="3.2" fill="none" stroke="#F3F4F0" strokeWidth="2.4" />
            <line x1="24" y1="3" x2="24" y2="1" stroke="#F3F4F0" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M22.4 9.8 L13 32" stroke="#F3F4F0" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M25.6 9.8 L35 32" stroke="#F3F4F0" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M17.5 21.5 Q24 25.5 30.5 21.5" fill="none" stroke="#F3F4F0" strokeWidth="2" />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="brand-name">ULT<span style={{ color: '#C2410C' }}>INSTRUCTOR</span></span>
            <span className="brand-sub">Layihə öncəsi qərar platforması</span>
          </div>
        </div>
        <nav className="presets" aria-label="Demo ssenarilər">
          <span className="eyebrow" style={{ color: '#a9afb5' }}>Demo</span>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="preset" onClick={() => loadPreset(p)}>{p.label}</button>
          ))}
          <button type="button" className="preset" onClick={() => { setInput(DEFAULT_INPUT); setAi(null); setMeta(null); }}>Boş layihə</button>
        </nav>
        <a className="preset" href="/testler" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>✓ Testlər</a>
        <button type="button" className="btn-light" onClick={() => window.print()}>Hesabatı çap et / PDF</button>
      </header>

      <div className="wrap">
        <InputForm input={input} setInput={setInput} result={result} onAnalyze={() => runAI()} loading={loading} />

        <main className="main">
          <Verdict r={result} ai={aiKey === key ? ai : null} />
          <Kpis r={result} />

          <div className="row">
            <section className="card" style={{ flex: '3 1 460px', minWidth: 0 }}>
              <div className="tabs" role="tablist" aria-label="Görünüş">
                {TABS.map((t) => (
                  <button key={t.id} type="button" role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
                ))}
              </div>
              {tab === '3d' && <Building3D result={result} palette={palette} />}
              {tab === 'geo' && <GeoPanel r={result} />}
              {tab === 'plan' && <FloorPlan result={result} />}
              {tab === 'sys' && <SystemsPanel result={result} />}
              {tab === 'boq' && <BoqPanel result={result} />}
              {tab === 'cost' && <CostBreakdown r={result} onPatch={(p) => setInput({ ...input, ...p })} />}
              {tab === 'best' && <BestUse list={best} current={ci.func} onApply={(p) => { applyPatch(p); }} />}
              {tab === 'pasport' && <Passport r={result} />}
              {tab === 'scen' && <Scenarios list={scen} best={bestScen} onApply={(p) => { applyPatch(p); runAI({ ...input, ...p }); }} />}
            </section>
            <Issues r={result} />
          </div>

          <AIPanel ai={ai} loading={loading} stale={!!ai && aiKey !== key} meta={meta} onRun={() => runAI()} />

          <Chat input={ci} onPatch={applyPatch} />

          <p className="note" style={{ margin: 0 }}>
            UltInstructor konsept səviyyəli qərar alətidir: rəqəmlər illüstrativ bazar dəyərləri və qayda əsaslı mühəndis normalarına əsaslanır, lisenziyalı mühəndis və geoloji ekspertizanı əvəz etmir.
          </p>
        </main>
      </div>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { runAll, FOUND_ISSUES, COMPARISON } from '@/lib/testcases';
import { AI_EVAL } from '@/lib/ai-eval-results';

export default function TestsPage() {
  const [res, setRes] = useState(null);
  useEffect(() => { setRes(runAll()); }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 56px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)', textDecoration: 'none' }}>
          <img src="/icon.svg" alt="" width="32" height="32" />
          <strong style={{ fontFamily: 'var(--cond)', fontSize: 20, letterSpacing: '0.04em' }}>ULT<span style={{ color: 'var(--accent)' }}>INSTRUCTOR</span></strong>
        </a>
        <button type="button" className="btn-outline" onClick={() => setRes(runAll())}>Testləri yenidən işə sal</button>
      </div>

      <section className="card" style={{ padding: '22px 24px' }}>
        <span className="eyebrow">Keyfiyyət testləri</span>
        <h1 style={{ margin: '6px 0 8px', fontFamily: 'var(--cond)', fontSize: 34 }}>Nəyi yoxladıq və nə pozuldu</h1>
        <p style={{ margin: 0, color: 'var(--ink-2)', maxWidth: 820 }}>
          Mühərrik testləri bu səhifə açılanda sizin brauzerinizdə canlı işləyir. AI testləri isə real modelə göndərilmiş sorğuların nəticəsidir.
        </p>
        {res && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <div className="kpi" style={{ '--kc': res.passed === res.total ? 'var(--ok)' : 'var(--warn)', minWidth: 180 }}>
              <span className="l">Mühərrik testləri</span>
              <span className="v" style={{ color: res.passed === res.total ? 'var(--ok)' : 'var(--warn)' }}>{res.passed}/{res.total} keçdi</span>
              <span className="s">{Math.round(res.ms)} ms · 600 fuzz girişi daxil</span>
            </div>
            {AI_EVAL && (
              <div className="kpi" style={{ '--kc': '#7a5af8', minWidth: 180 }}>
                <span className="l">AI testləri ({AI_EVAL.model})</span>
                <span className="v">{AI_EVAL.passed}/{AI_EVAL.total} keçdi</span>
                <span className="s">orta {AI_EVAL.avgSec} san. · {AI_EVAL.date}</span>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-h"><h2>Mühərrik testləri (ekspert qaydalarına qarşı)</h2></div>
        <table className="table">
          <thead><tr><th>#</th><th>Test</th><th>Gözlənilən</th><th>Alınan</th><th className="r">Nəticə</th></tr></thead>
          <tbody>
            {(res?.results || []).map((t) => (
              <tr key={t.id}>
                <td className="mono">{t.id}</td>
                <td><span className="note">{t.group}</span><br />{t.name}</td>
                <td>{t.expect}</td>
                <td className="mono" style={{ fontSize: 12 }}>{t.got}</td>
                <td className="r"><span className="badge" style={{ display: 'inline-flex', background: t.ok ? 'var(--ok)' : 'var(--fail)' }}>{t.ok ? '✓' : '✕'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {AI_EVAL && (
        <section className="card">
          <div className="card-h"><h2>AI testləri</h2><span className="note">{AI_EVAL.note}</span></div>
          <table className="table">
            <thead><tr><th>Yoxlama</th><th>Nəticə</th><th className="r">Status</th></tr></thead>
            <tbody>
              {AI_EVAL.checks.map((c) => (
                <tr key={c.name}><td>{c.name}</td><td style={{ fontSize: 13 }}>{c.detail}</td><td className="r"><span className="badge" style={{ display: 'inline-flex', background: c.ok ? 'var(--ok)' : 'var(--warn)' }}>{c.ok ? '✓' : '!'}</span></td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <div className="card-h"><h2>Testlərdə tapılan problemlər</h2></div>
        <ul className="issues">
          {FOUND_ISSUES.map((f) => (
            <li key={f.title}>
              <span className="badge" style={{ background: f.status === 'düzəldildi' ? 'var(--ok)' : 'var(--warn)' }}>{f.status === 'düzəldildi' ? '✓' : '!'}</span>
              <div><strong style={{ fontWeight: 600 }}>{f.title}</strong> <span className="note">· {f.status}</span><br /><span style={{ color: 'var(--ink-2)' }}>{f.text}</span></div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-h"><h2>Mövcud üsulla müqayisə</h2></div>
        <table className="table">
          <thead><tr><th>Meyar</th><th>İndi (ənənəvi)</th><th>UltInstructor</th></tr></thead>
          <tbody>{COMPARISON.map((c) => <tr key={c.k}><td style={{ fontWeight: 600 }}>{c.k}</td><td>{c.old}</td><td>{c.neu}</td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}

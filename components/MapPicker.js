'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { DISTRICTS, LANDSLIDE, GROUNDWATER } from '@/lib/data';

const BAKU = [40.4093, 49.8671];

function haversine(a, b) {
  const R = 6371000; const toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b[0] - a[0]); const dLng = toR(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestDistrict(lat, lng) {
  let best = null; let bd = Infinity;
  DISTRICTS.forEach((d) => { const dist = haversine([lat, lng], [d.lat, d.lng]); if (dist < bd) { bd = dist; best = d; } });
  return { district: best, km: bd / 1000 };
}

// Open-Meteo hündürlük API-si (pulsuz, açarsız): sahənin ətrafında 5 nöqtə
async function slopeAt(lat, lng, span = 80) {
  const dLat = span / 111320; const dLng = span / (111320 * Math.cos((lat * Math.PI) / 180));
  const pts = [[lat, lng], [lat + dLat, lng], [lat - dLat, lng], [lat, lng + dLng], [lat, lng - dLng]];
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${pts.map((p) => p[0].toFixed(5)).join(',')}&longitude=${pts.map((p) => p[1].toFixed(5)).join(',')}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('elevation');
  const j = await r.json();
  const e = j.elevation;
  const gNS = Math.abs(e[1] - e[2]) / (2 * span); const gEW = Math.abs(e[3] - e[4]) / (2 * span);
  const pct = Math.sqrt(gNS ** 2 + gEW ** 2) * 100;
  return { pct, elev: e[0] };
}

export default function MapPicker({ open, onClose, onApply }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const L = useRef(null);
  const layers = useRef({});
  const pts = useRef([]);
  const [info, setInfo] = useState(null);
  const [step, setStep] = useState(0);
  const [sat, setSat] = useState(true);
  const [slope, setSlope] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const leaflet = (await import('leaflet')).default;
      if (cancelled) return;
      L.current = leaflet;
      const map = leaflet.map(elRef.current, { zoomControl: true, attributionControl: true }).setView(BAKU, 12);
      layers.current.sat = leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri' });
      layers.current.labels = leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
      layers.current.osm = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
      layers.current.sat.addTo(map); layers.current.labels.addTo(map);
      // rayon nöqtələri
      DISTRICTS.forEach((d) => {
        leaflet.circleMarker([d.lat, d.lng], { radius: 5, color: '#fff', weight: 1.5, fillColor: d.landslide === 'high' ? '#d92d20' : d.landslide === 'medium' ? '#f79009' : '#12b76a', fillOpacity: 0.95 })
          .bindTooltip(`${d.name} · sürüşmə ${LANDSLIDE[d.landslide].label.toLowerCase()}`, { direction: 'top' }).addTo(map);
      });
      map.on('click', (e) => {
        const p = [e.latlng.lat, e.latlng.lng];
        if (pts.current.length >= 2) { pts.current = []; layers.current.rect?.remove(); layers.current.m1?.remove(); }
        pts.current.push(p);
        if (pts.current.length === 1) {
          layers.current.m1 = leaflet.circleMarker(p, { radius: 6, color: '#ff7a2f', weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(map);
          setStep(1); setInfo(null); setSlope(null);
        } else {
          const [a, b] = pts.current;
          layers.current.rect = leaflet.rectangle([a, b], { color: '#ff7a2f', weight: 3, fillColor: '#ff7a2f', fillOpacity: 0.25 }).addTo(map);
          const lat = (a[0] + b[0]) / 2; const lng = (a[1] + b[1]) / 2;
          const w = haversine([lat, a[1]], [lat, b[1]]); const d = haversine([a[0], lng], [b[0], lng]);
          const nd = nearestDistrict(lat, lng);
          setInfo({ lat, lng, w: Math.round(w), d: Math.round(d), ...nd });
          setStep(2);
          setSlope({ loading: true });
          slopeAt(lat, lng, Math.max(60, Math.max(w, d) / 2 + 20)).then((s) => setSlope(s)).catch(() => setSlope({ error: true }));
        }
      });
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (sat) { layers.current.osm.remove(); layers.current.sat.addTo(map); layers.current.labels.addTo(map); }
    else { layers.current.sat.remove(); layers.current.labels.remove(); layers.current.osm.addTo(map); }
  }, [sat]);

  useEffect(() => { if (open && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 150); }, [open]);

  const goto = (d) => { mapRef.current?.setView([d.lat, d.lng], 16); };

  const slopeId = slope?.pct == null ? null : slope.pct < 5 ? 'duz' : slope.pct < 15 ? 'az' : 'cox';
  const slopeName = { duz: 'Düz', az: 'Az maili', cox: 'Çox maili' };
  const tooFar = info && info.km > 12;
  const dims = info ? { w: Math.min(300, Math.max(8, info.w)), d: Math.min(300, Math.max(8, info.d)) } : null;

  const apply = () => {
    if (!info) return;
    const dd = info.district;
    onApply({
      district: dd.id,
      groundwater: dd.gw,
      plotWidth: dims.w,
      plotDepth: dims.d,
      ...(slopeId ? { slope: slopeId } : {}),
      notes: undefined,
    }, { lat: info.lat, lng: info.lng });
    onClose();
  };

  const matches = q.trim().length >= 2 ? DISTRICTS.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()) || d.group.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: open ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,12,15,0.62)', backdropFilter: 'blur(4px)', padding: 16 }} role="dialog" aria-modal="true" aria-label="Xəritədən torpaq seçimi">
      <div className="card" style={{ width: 'min(1280px, 100%)', height: 'min(820px, 100%)', display: 'flex', flexWrap: 'wrap', overflow: 'hidden' }}>
        <div style={{ flex: '999 1 520px', minWidth: 0, position: 'relative', minHeight: 360 }}>
          <div ref={elRef} style={{ position: 'absolute', inset: 0 }} />
          <div className="stage-tools" style={{ zIndex: 500, left: 56 }}>
            <button type="button" className={`chip${sat ? ' on' : ''}`} onClick={() => setSat(true)}>Peyk</button>
            <button type="button" className={`chip${!sat ? ' on' : ''}`} onClick={() => setSat(false)}>Xəritə</button>
          </div>
        </div>
        <aside style={{ flex: '1 1 320px', maxWidth: 400, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', borderLeft: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--cond)', fontSize: 22 }}>Xəritədən torpaq seçin</h2>
            <button type="button" className="btn-outline" style={{ minHeight: 36, padding: '4px 12px' }} onClick={onClose} aria-label="Bağla">✕</button>
          </div>
          <label className="field">Əraziyə get
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Məs: Badamdar, Mərdəkan, Xətai" />
          </label>
          {matches.length > 0 && (
            <div className="seg">{matches.map((d) => <button key={d.id} type="button" onClick={() => { goto(d); setQ(''); }}>{d.name}</button>)}</div>
          )}
          <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-2)' }}>
            <li style={{ fontWeight: step === 0 ? 600 : 400 }}>Peyk görüntüsündə boş torpağı tapın və yaxınlaşdırın.</li>
            <li style={{ fontWeight: step === 1 ? 600 : 400 }}>Sahənin bir küncünə, sonra qarşı küncünə klik edin.</li>
            <li style={{ fontWeight: step === 2 ? 600 : 400 }}>Məlumatlar avtomatik doldurulur, "Tətbiq et" basın.</li>
          </ol>
          {info && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tooFar && <div className="err">Seçilmiş yer ən yaxın Bakı ərazisindən {info.km.toFixed(1)} km uzaqdadır; rayon məlumatları təxmini olacaq.</div>}
              <table className="table">
                <tbody>
                  <tr><td>Rayon / ərazi</td><td className="r" style={{ fontFamily: 'var(--sans)', fontWeight: 600 }}>{info.district.group} r., {info.district.name}</td></tr>
                  <tr><td>Sahə</td><td className="r">{dims.w} × {dims.d} m = {(dims.w * dims.d).toLocaleString('en').replace(/,/g, ' ')} m²</td></tr>
                  <tr><td>Sürüşmə riski</td><td className="r" style={{ color: info.district.landslide === 'high' ? 'var(--fail)' : info.district.landslide === 'medium' ? 'var(--warn)' : 'var(--ok)' }}>{LANDSLIDE[info.district.landslide].label}</td></tr>
                  <tr><td>Seysmiklik</td><td className="r">~{info.district.seismic} bal</td></tr>
                  <tr><td>Qrunt suyu (tipik)</td><td className="r">{GROUNDWATER.find((g) => g.id === info.district.gw)?.name}</td></tr>
                  <tr><td>Relyef</td><td className="r">{slope?.loading ? 'hesablanır…' : slope?.error ? 'alınmadı' : slopeId ? `${slopeName[slopeId]} (~${slope.pct.toFixed(1)}%)` : '—'}</td></tr>
                  {slope?.elev != null && <tr><td>Dəniz səviyyəsindən</td><td className="r">{Math.round(slope.elev)} m</td></tr>}
                  <tr><td>Bazar qiyməti</td><td className="r">~{info.district.salePrice.toLocaleString('en').replace(/,/g, ' ')} ₼/m²</td></tr>
                </tbody>
              </table>
              <span className="note">{info.district.note}. Hündürlük: Open-Meteo (təxmini, ~90 m dəqiqlik). Torpaq növü sahədə qazma ilə dəqiqləşdirilməlidir.</span>
              <button type="button" className="btn-accent" onClick={apply}>Tətbiq et</button>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: 'var(--muted)', marginTop: 'auto' }}>
            <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 10, background: '#12b76a', marginRight: 4 }} />aşağı risk</span>
            <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 10, background: '#f79009', marginRight: 4 }} />orta</span>
            <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 10, background: '#d92d20', marginRight: 4 }} />yüksək sürüşmə riski</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

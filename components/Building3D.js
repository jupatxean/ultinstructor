'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ---------- Teksturalar (yüksək keyfiyyət, 4K ekranlar üçün) ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Bir mərtəbə zolağı: fasad + pəncərələr. emissive xəritə gecə işıqları üçün.
function facadeTextures({ base, glass, trim, bays, seed, bad }) {
  const W = 256 * Math.min(bays, 16); const H = 256;
  const bw = W / bays;
  const make = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cMap = make(); const cEm = make();
  const g = cMap.getContext('2d'); const e = cEm.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  // incə tekstura (daş/beton dənəsi)
  const R = rng(seed);
  for (let i = 0; i < W * 0.8; i++) {
    g.fillStyle = `rgba(0,0,0,${R() * 0.05})`;
    g.fillRect(R() * W, R() * H, 2, 2);
  }
  for (let b = 0; b < bays; b++) {
    const x = b * bw + bw * 0.14; const ww = bw * 0.72;
    const y = H * 0.16; const hh = H * 0.66;
    // pəncərə şüşəsi: vertikal qradiyent (səma əksi)
    const gr = g.createLinearGradient(0, y, 0, y + hh);
    gr.addColorStop(0, bad ? '#e7a184' : '#a9c4d6');
    gr.addColorStop(0.45, bad ? '#b65a3a' : glass);
    gr.addColorStop(1, bad ? '#7d3220' : '#1d2a33');
    g.fillStyle = gr; g.fillRect(x, y, ww, hh);
    // çərçivə və impost
    g.strokeStyle = trim; g.lineWidth = 6; g.strokeRect(x, y, ww, hh);
    g.fillStyle = trim; g.fillRect(x + ww / 2 - 3, y, 6, hh);
    // parıltı
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath(); g.moveTo(x + 8, y + 8); g.lineTo(x + ww * 0.35, y + 8); g.lineTo(x + 8, y + hh * 0.45); g.closePath(); g.fill();
    // gecə: bəzi pəncərələr yanır
    if (R() < 0.62) {
      const warm = R() < 0.8;
      const eg = e.createLinearGradient(0, y, 0, y + hh);
      eg.addColorStop(0, warm ? '#ffcf86' : '#cfe6ff');
      eg.addColorStop(1, warm ? '#ff9a3c' : '#8fb8e8');
      e.fillStyle = eg; e.fillRect(x + 4, y + 4, ww - 8, hh - 8);
      e.fillStyle = 'rgba(0,0,0,0.55)'; e.fillRect(x + ww / 2 - 3, y, 6, hh);
    }
  }
  // döşəmə xətti
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, H - 10, W, 10);
  const toTex = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping;
    return t;
  };
  return { map: toTex(cMap), emissiveMap: toTex(cEm) };
}

function skyTexture(night) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  if (night) {
    gr.addColorStop(0, '#05070d'); gr.addColorStop(0.55, '#101a33'); gr.addColorStop(1, '#2a3550');
  } else {
    gr.addColorStop(0, '#6aa6da'); gr.addColorStop(0.6, '#bcd6ec'); gr.addColorStop(1, '#dfe7ee');
  }
  g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function groundTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#d9d4c7'; g.fillRect(0, 0, 1024, 1024);
  const R = rng(42);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(80,70,50,${R() * 0.06})`; g.fillRect(R() * 1024, R() * 1024, 3, 3); }
  g.strokeStyle = 'rgba(60,60,60,0.10)'; g.lineWidth = 2;
  for (let i = 0; i <= 1024; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 1024); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(1024, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

function textSprite(text, color = '#15181B', size = 64, bg, depthTest = false) {
  const font = `700 ${size * 2}px IBM Plex Sans, system-ui, sans-serif`;
  const m = document.createElement('canvas').getContext('2d'); m.font = font;
  const tw = Math.ceil(m.measureText(text).width);
  const W = tw + size * 2.4; const H = size * 3.2;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(4, H * 0.12, W - 8, H * 0.76, H * 0.38); g.fill(); }
  g.fillStyle = color; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, H / 2 + size * 0.08);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest, transparent: true }));
  s.userData.aspect = W / H;
  return s;
}
const fitSprite = (s, h) => s.scale.set(h * s.userData.aspect, h, 1);

function tree(R) {
  const g = new THREE.Group();
  const h = 2.2 + R() * 1.8;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, h * 0.45, 6), new THREE.MeshStandardMaterial({ color: '#6b4f36', roughness: 1 }));
  trunk.position.y = h * 0.22; trunk.castShadow = true; g.add(trunk);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + R() * 0.6, 1), new THREE.MeshStandardMaterial({ color: R() < 0.5 ? '#5f8f4a' : '#4c7a3c', roughness: 0.9, flatShading: true }));
  crown.position.y = h * 0.62; crown.castShadow = true; g.add(crown);
  return g;
}

const ease = (t) => 1 - Math.pow(1 - t, 3);

export default function Building3D({ result, palette }) {
  const mountRef = useRef(null);
  const ctx = useRef(null);
  const [night, setNight] = useState(false);
  const [spin, setSpin] = useState(true);

  // Səhnə bir dəfə
  useEffect(() => {
    const mount = mountRef.current;
    const w = mount.clientWidth; const h = mount.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#dfe7ee', 180, 520);
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.5, 3000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.autoRotate = true; controls.autoRotateSpeed = 0.5;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.minDistance = 15; controls.maxDistance = 600;

    const hemi = new THREE.HemisphereLight(0xdfefff, 0xb9a98a, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    scene.add(sun); scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0xbcd4ff, 0.35);
    fill.position.set(-80, 60, -60); scene.add(fill);

    // Ətraf: geniş zəmin
    const gt = groundTexture(); gt.repeat.set(24, 24);
    const world = new THREE.Mesh(new THREE.CircleGeometry(900, 64), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
    world.rotation.x = -Math.PI / 2; world.position.y = -0.45; world.receiveShadow = true; scene.add(world);

    const group = new THREE.Group(); scene.add(group);
    const floorsGroup = new THREE.Group(); scene.add(floorsGroup);

    let raf; let last = performance.now();
    const anim = { start: 0, items: [] };
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      // tikilmə animasiyası: mərtəbələr bir-bir qalxır
      if (anim.items.length) {
        const t = (now - anim.start) / 1000;
        anim.items.forEach((it) => {
          const k = Math.max(0, Math.min(1, (t - it.delay) / 0.35));
          const e = ease(k);
          it.obj.scale.y = Math.max(0.0001, e);
          it.obj.position.y = it.y - (1 - e) * it.h * 0.5;
          it.obj.visible = k > 0;
        });
      }
      if (ctx.current?.pulse) {
        const p = ctx.current.pulse; p.material.opacity = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(now / 350));
      }
      controls.update(dt);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      const W = mount.clientWidth; const H = mount.clientHeight;
      renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    ctx.current = { renderer, scene, camera, controls, group, floorsGroup, sun, hemi, fill, anim, first: true, lastFloors: 0 };
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  // Gecə / gündüz
  useEffect(() => {
    const c = ctx.current; if (!c) return;
    c.scene.background = skyTexture(night);
    c.scene.fog.color.set(night ? '#141c2e' : '#dfe7ee');
    c.sun.intensity = night ? 0.25 : 2.4;
    c.sun.color.set(night ? '#9fb6ff' : '#fff1dc');
    c.hemi.intensity = night ? 0.18 : 0.9;
    c.fill.intensity = night ? 0.15 : 0.35;
    c.renderer.toneMappingExposure = night ? 1.25 : 1.05;
    c.floorsGroup.traverse((m) => { if (m.material) [].concat(m.material).forEach((mm) => { if (mm.userData?.facade) mm.emissiveIntensity = night ? 2.2 : 0; }); });
    c.group.traverse((m) => { if (m.userData?.lamp) m.visible = night; });
    c.night = night;
  }, [night, result, palette]);

  useEffect(() => { if (ctx.current) ctx.current.controls.autoRotate = spin; }, [spin]);

  // Binanı qur
  useEffect(() => {
    const c = ctx.current; if (!c) return;
    const { group, floorsGroup, camera, controls, sun, anim } = c;
    const dispose = (g) => {
      while (g.children.length) {
        const o = g.children.pop();
        o.traverse?.((m) => { m.geometry?.dispose?.(); if (m.material) [].concat(m.material).forEach((mm) => { mm.map?.dispose?.(); mm.emissiveMap?.dispose?.(); mm.dispose?.(); }); });
      }
    };
    dispose(group); dispose(floorsGroup); c.pulse = null;

    const { site, input, floorCap, floorH } = result;
    const floors = input.floors;
    const cx = site.W / 2; const cz = site.D / 2;
    const base = palette?.[0] || '#c9d3da';
    const trim = palette?.[1] || '#e7e9e4';
    const glass = palette?.[2] || '#4f6474';
    const R = rng(Math.round(site.W * 1000 + site.D * 10 + floors));

    // Torpaq sahəsi: yaşıl həyət + yollar + hasar xətti
    const lot = new THREE.Mesh(new THREE.BoxGeometry(site.W, 0.4, site.D), new THREE.MeshStandardMaterial({ color: '#a9c08f', roughness: 0.95 }));
    lot.position.y = -0.2; lot.receiveShadow = true; group.add(lot);
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(site.W, 0.44, site.D)), new THREE.LineBasicMaterial({ color: '#2f6f9f' }));
    border.position.y = -0.2; group.add(border);
    // küçə (cənub tərəf)
    const road = new THREE.Mesh(new THREE.BoxGeometry(site.W * 3, 0.1, 9), new THREE.MeshStandardMaterial({ color: '#4a4f55', roughness: 0.9 }));
    road.position.set(0, -0.4, site.D / 2 + 6.5); road.receiveShadow = true; group.add(road);
    for (let i = -Math.floor(site.W * 1.4 / 6); i <= Math.floor(site.W * 1.4 / 6); i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.02, 0.25), new THREE.MeshBasicMaterial({ color: '#f2f2ea' }));
      m.position.set(i * 6, -0.33, site.D / 2 + 6.5); group.add(m);
    }
    const walk = new THREE.Mesh(new THREE.BoxGeometry(site.W * 3, 0.2, 2.2), new THREE.MeshStandardMaterial({ color: '#cfc9bc', roughness: 1 }));
    walk.position.set(0, -0.3, site.D / 2 + 1.1); walk.receiveShadow = true; group.add(walk);

    const bx = site.offsetX + site.fw / 2 - cx;
    const bz = site.offsetY + site.fd / 2 - cz;

    // Ağaclar: sahənin kənarları və küçə boyu
    const trees = [];
    for (let i = 0; i < Math.round((site.W + site.D) / 4); i++) {
      const side = i % 4; const t = R();
      let x; let z;
      if (side === 0) { x = -site.W / 2 + 1.2; z = -site.D / 2 + t * site.D; }
      else if (side === 1) { x = site.W / 2 - 1.2; z = -site.D / 2 + t * site.D; }
      else if (side === 2) { x = -site.W / 2 + t * site.W; z = -site.D / 2 + 1.2; }
      else { x = -site.W / 2 + t * site.W; z = site.D / 2 + 1.1; }
      if (Math.abs(x - bx) < site.fw / 2 + 1.5 && Math.abs(z - bz) < site.fd / 2 + 1.5) continue;
      trees.push([x, z]);
    }
    for (let i = 0; i < 18; i++) trees.push([(R() - 0.5) * site.W * 3.2, -site.D / 2 - 8 - R() * 40]);
    trees.forEach(([x, z]) => { const t = tree(R); t.position.set(x, -0.2, z); group.add(t); });

    // Küçə lampaları (gecə)
    for (let i = -2; i <= 2; i++) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), new THREE.MeshStandardMaterial({ color: '#2b3036' }));
      pole.position.set(i * (site.W / 2.2), 2.1, site.D / 2 + 2.4); pole.castShadow = true; group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffd59a' }));
      bulb.position.set(pole.position.x, 4.7, pole.position.z); group.add(bulb);
      const pl = new THREE.PointLight('#ffb866', 30, 22, 2);
      pl.position.copy(bulb.position); pl.userData.lamp = true; pl.visible = !!c.night; group.add(pl);
    }

    // Mərtəbələr
    const bays = Math.max(2, Math.round(site.fw / 3.2));
    const baysD = Math.max(2, Math.round(site.fd / 3.2));
    const mats = (bad, k) => {
      const front = facadeTextures({ base: bad ? '#f2c6b4' : base, glass, trim: bad ? '#fff1ea' : trim, bays, seed: 7 + k * 13, bad });
      const side = facadeTextures({ base: bad ? '#f2c6b4' : base, glass, trim: bad ? '#fff1ea' : trim, bays: baysD, seed: 91 + k * 7, bad });
      const mk = (t) => {
        const m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissiveMap, emissive: new THREE.Color('#ffffff'), emissiveIntensity: c.night ? 2.2 : 0, roughness: 0.55, metalness: 0.08 });
        m.userData.facade = true; return m;
      };
      const roof = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.9 });
      const fm = mk(front); const sm = mk(side);
      return [sm, sm, roof, roof, fm, fm]; // +x, -x, +y, -y, +z(cənub), -z
    };

    const fh = floorH;
    const items = [];
    const prev = c.lastFloors || 0;
    const sameSite = c.lastKey === `${site.W}x${site.D}`;
    for (let k = 0; k < floors; k++) {
      const over = k >= floorCap;
      const firstH = input.func === 'qarisiq' && k === 0 ? fh * 1.4 : fh;
      const y = input.func === 'qarisiq' && k > 0 ? k * fh + fh * 0.4 : k * fh;
      const h = firstH - 0.28;
      const body = new THREE.Mesh(new THREE.BoxGeometry(site.fw, h, site.fd), mats(over, k % 4));
      body.position.set(bx, y + h / 2, bz);
      body.castShadow = true; body.receiveShadow = true;
      floorsGroup.add(body);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(site.fw + 0.5, 0.28, site.fd + 0.5), new THREE.MeshStandardMaterial({ color: over ? '#c2410c' : trim, roughness: 0.8 }));
      slab.position.set(bx, y + firstH - 0.14, bz); slab.castShadow = true; slab.receiveShadow = true;
      floorsGroup.add(slab);
      // yalnız yeni mərtəbələr animasiya olur (ilk açılışda hamısı)
      const animate = !sameSite || k >= prev || c.first;
      if (animate) {
        const d = (sameSite && !c.first ? (k - prev) : k) * 0.07;
        items.push({ obj: body, y: body.position.y, h, delay: d });
        items.push({ obj: slab, y: slab.position.y, h: 0.28, delay: d + 0.12 });
      }
    }
    anim.items = items; anim.start = performance.now();
    const totalH = floors * fh + (input.func === 'qarisiq' ? fh * 0.4 : 0);

    // Dam: parapet, yaşıl dam, günəş panelləri
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(site.fw + 0.5, 0.9, site.fd + 0.5), new THREE.MeshStandardMaterial({ color: trim, roughness: 0.8 }));
    parapet.position.set(bx, totalH + 0.3, bz); parapet.castShadow = true; floorsGroup.add(parapet);
    items.push({ obj: parapet, y: parapet.position.y, h: 0.9, delay: (items.length ? items[items.length - 1].delay : 0) + 0.15 });
    const feats = input.features || [];
    if (feats.includes('yasildam')) {
      const green = new THREE.Mesh(new THREE.BoxGeometry(site.fw * 0.88, 0.4, site.fd * 0.88), new THREE.MeshStandardMaterial({ color: '#6f9a54', roughness: 1 }));
      green.position.set(bx, totalH + 0.85, bz); green.receiveShadow = true; floorsGroup.add(green);
      for (let i = 0; i < 6; i++) { const t = tree(R); t.scale.setScalar(0.55); t.position.set(bx + (R() - 0.5) * site.fw * 0.7, totalH + 0.9, bz + (R() - 0.5) * site.fd * 0.7); floorsGroup.add(t); }
    }
    if (feats.includes('gunes')) {
      const pm = new THREE.MeshStandardMaterial({ color: '#1b3558', metalness: 0.6, roughness: 0.25 });
      const cols = Math.max(2, Math.floor((site.fw * 0.8) / 2.4));
      const rows = Math.max(1, Math.floor((site.fd * (feats.includes('yasildam') ? 0.32 : 0.7)) / 2.2));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 1.6), pm);
        p.rotation.x = -0.4;
        p.position.set(bx - (site.fw * 0.8) / 2 + 1.2 + i * 2.4, totalH + 1.4, bz + site.fd * 0.42 - 1 - j * 2.2);
        p.castShadow = true; floorsGroup.add(p);
      }
    }

    // Limit müstəvisi (pulsasiya edir)
    if (floors > floorCap) {
      const capY = floorCap * fh;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(site.fw + 8, site.fd + 8), new THREE.MeshBasicMaterial({ color: '#ff3b1f', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
      plane.rotation.x = -Math.PI / 2; plane.position.set(bx, capY, bz); group.add(plane);
      const ring = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(site.fw + 8, site.fd + 8)), new THREE.LineBasicMaterial({ color: '#ff3b1f' }));
      ring.rotation.x = -Math.PI / 2; ring.position.copy(plane.position); group.add(ring);
      const lbl = textSprite(`LİMİT · ${floorCap} MƏRTƏBƏ`, '#ffffff', 34, '#d92d20');
      fitSprite(lbl, 3.2); lbl.position.set(bx + site.fw / 2 + 4, capY + 2, bz + site.fd / 2 + 4); group.add(lbl);
      c.pulse = plane;
    }

    // Şimal və Xəzri
    const north = textSprite('Ş ↑  Şimal', '#ffffff', 40, '#15181b', true);
    fitSprite(north, 3); north.position.set(0, 2, -site.D / 2 - 6); group.add(north);
    const windDir = new THREE.Vector3(site.W * 0.95, -1, site.D * 0.35).normalize();
    const windStart = new THREE.Vector3(-site.W * 0.95, Math.max(4, totalH * 0.25), -site.D * 0.35);
    group.add(new THREE.ArrowHelper(windDir, windStart, Math.max(site.W, site.D) * 0.45, 0x2f8fdf, 3, 2));
    const wl = textSprite('Xəzri küləyi', '#ffffff', 40, '#2f6f9f', true);
    fitSprite(wl, 3); wl.position.copy(windStart).add(new THREE.Vector3(-2, 3.5, 0)); group.add(wl);

    // Günəş (cənub-qərbdən, axşamüstü işıq)
    const Rr = Math.max(site.W, site.D, totalH) * 1.8;
    sun.position.set(Rr * 0.55, Rr * 0.85, Rr * 0.75);
    sun.target.position.set(0, 0, 0);
    const sc = sun.shadow.camera; const ext = Math.max(site.W, site.D, totalH) * 1.3;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = Rr * 4; sc.updateProjectionMatrix();

    const key = `${site.W}x${site.D}`;
    if (c.first || c.lastKey !== key) {
      const dist = Math.max(site.W, site.D, totalH * 1.1) * 2.3;
      camera.position.set(dist * 0.78, dist * 0.55, dist * 0.9);
    }
    controls.target.set(0, Math.min(totalH, 60) * 0.4, 0);
    c.first = false; c.lastKey = key; c.lastFloors = floors;
  }, [result, palette]);

  return (
    <div className="stage stage3d">
      <div ref={mountRef} style={{ width: '100%', height: 520 }} aria-label={`${result.input.floors} mərtəbəli binanın 3D modeli`} role="img" />
      <div className="stage-tools">
        <button type="button" className={`chip${!night ? ' on' : ''}`} onClick={() => setNight(false)} aria-pressed={!night}>☀ Gündüz</button>
        <button type="button" className={`chip${night ? ' on' : ''}`} onClick={() => setNight(true)} aria-pressed={night}>☾ Gecə</button>
        <button type="button" className={`chip${spin ? ' on' : ''}`} onClick={() => setSpin(!spin)} aria-pressed={spin}>⟳ Fırlanma</button>
      </div>
      <div className="legend glass" style={{ position: 'absolute', left: 14, bottom: 14 }}>
        <span><i className="sw" style={{ background: palette?.[0] || '#c9d3da' }} />Təhlükəsiz mərtəbələr</span>
        <span><i className="sw" style={{ background: '#f2c6b4', borderColor: '#c2410c' }} />Limitdən yuxarı</span>
        <span><i style={{ width: 14, height: 2, background: '#2f8fdf', display: 'inline-block' }} />Xəzri küləyi</span>
      </div>
      <span className="hint glass" style={{ position: 'absolute', right: 14, bottom: 14, padding: '6px 10px' }}>Fırladın · yaxınlaşdırın</span>
    </div>
  );
}

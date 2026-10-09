'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const WALL_H = 2.8;
const WALL_T = 0.12;
const EPS = 0.06;

// ---------- teksturalar ----------
function parquet(color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const base = new THREE.Color(color);
  for (let row = 0; row < 16; row++) {
    let x = -(row % 3) * 60;
    while (x < 512) {
      const len = 140 + ((row * 37 + x) % 90);
      const k = 0.88 + (((row * 13 + Math.floor(x)) % 17) / 17) * 0.24;
      const col = base.clone().multiplyScalar(k);
      g.fillStyle = `#${col.getHexString()}`;
      g.fillRect(x, row * 32, len - 2, 30);
      g.fillStyle = 'rgba(0,0,0,0.06)';
      for (let i = 0; i < 6; i++) g.fillRect(x + 6, row * 32 + 4 + i * 4, len - 14, 1);
      x += len;
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function tiles(color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function label(text, sub) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(18,22,26,0.82)'; g.beginPath(); g.roundRect(8, 16, 496, 128, 28); g.fill();
  g.fillStyle = '#ffffff'; g.font = '700 54px IBM Plex Sans, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, sub ? 64 : 80);
  if (sub) { g.fillStyle = '#ffb07a'; g.font = '600 38px IBM Plex Mono, monospace'; g.fillText(sub, 256, 112); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2.4, 0.75, 1); s.renderOrder = 10;
  return s;
}

// ---------- köməkçilər ----------
const mats = new Map();
function mat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...opts }));
  return mats.get(key);
}
function box(group, w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true;
  group.add(m); return m;
}
function cyl(group, r, h, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), mat(color));
  m.position.set(x, y + h / 2, z); m.castShadow = true; group.add(m); return m;
}
function plant(group, x, z) {
  cyl(group, 0.18, 0.35, '#c9b9a0', x, 0, z);
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), mat('#5f8f4a', { flatShading: true, roughness: 0.9 }));
  m.position.set(x, 0.65, z); m.castShadow = true; group.add(m);
}

// Otaq daxilində lokal koordinatlarla yerləşdirmə: u = otağın eni boyunca, v = dərinliyi boyunca (0 = fasad tərəfi)
function placer(group, r, facadeAtMin) {
  return (fn) => {
    const g = new THREE.Group();
    fn(g);
    // lokal sistem: x ∈ [0,w], z ∈ [0,h], z=0 fasad tərəfi
    if (facadeAtMin) g.position.set(r.x, 0, r.y);
    else { g.rotation.y = Math.PI; g.position.set(r.x + r.w, 0, r.y + r.h); }
    group.add(g);
  };
}

function furnish(group, r, kind, P, facadeAtMin, func) {
  const place = placer(group, r, facadeAtMin);
  const W = r.w; const D = r.h;
  const wood = P.mebel; const acc = P.aksent; const soft = P.yumsaq;
  const L = r.label || '';
  if (kind === 'open' && func === 'ofis') {
    place((g) => {
      g.userData.open = true;
      for (let x = 1.2; x < W - 1.6; x += 3.4) {
        for (let z = 1.2; z < D - 1.2; z += 2.6) {
          box(g, 1.5, 0.74, 0.75, wood, x + 0.75, 0, z);
          box(g, 0.55, 0.32, 0.03, '#1d2329', x + 0.75, 0.74, z - 0.2);
          box(g, 0.5, 0.5, 0.5, acc, x + 0.75, 0, z + 0.65);
        }
      }
    });
    return;
  }
  if (kind === 'open') {
    place((g) => { g.userData.open = true; for (let x = 1.5; x < W - 1.5; x += 3) box(g, 0.6, 1.6, D * 0.55, wood, x, 0, D / 2); });
    return;
  }
  if (kind === 'meeting') {
    place((g) => { box(g, Math.min(2.4, W - 1.2), 0.74, 1.0, wood, W / 2, 0, D / 2); for (let i = -1; i <= 1; i += 2) for (let j = -1; j <= 1; j += 2) box(g, 0.45, 0.45, 0.45, acc, W / 2 + i * 0.7, 0, D / 2 + j * 0.85); });
    return;
  }
  if (/Qonaq|Studiya/.test(L)) {
    place((g) => {
      const cx = W / 2;
      box(g, Math.min(3, W - 1.2), 0.02, Math.min(2.2, D - 2), soft, cx, 0, D * 0.42); // xalça
      box(g, Math.min(1.1, W - 1), 0.4, 0.6, wood, cx, 0, D * 0.42); // jurnal masası
      // divan (fasada baxır)
      const sw = Math.min(2.4, W - 1.0);
      box(g, sw, 0.42, 0.95, acc, cx, 0, D * 0.42 + 1.35);
      box(g, sw, 0.45, 0.22, acc, cx, 0.42, D * 0.42 + 1.75);
      box(g, 0.22, 0.25, 0.95, acc, cx - sw / 2 + 0.11, 0.42, D * 0.42 + 1.35);
      box(g, 0.22, 0.25, 0.95, acc, cx + sw / 2 - 0.11, 0.42, D * 0.42 + 1.35);
      // TV konsolu
      box(g, Math.min(1.8, W - 1.2), 0.5, 0.4, wood, cx, 0, 0.55);
      box(g, 1.3, 0.75, 0.05, '#12161a', cx, 0.7, 0.55);
      plant(g, 0.5, 0.5); plant(g, W - 0.5, 0.5);
      if (/Studiya/.test(L)) { box(g, 1.4, 0.45, 2.0, '#f1ece2', W - 1.0, 0, D - 1.2); box(g, 1.4, 0.15, 0.6, soft, W - 1.0, 0.45, D - 0.5); }
      else if (W > 4.6) {
        box(g, 1.2, 0.74, 0.8, wood, W - 1.1, 0, D - 1.3);
        [-0.4, 0.4].forEach((o) => { box(g, 0.42, 0.45, 0.42, acc, W - 1.1 + o, 0, D - 0.7); box(g, 0.42, 0.45, 0.42, acc, W - 1.1 + o, 0, D - 1.9); });
      }
    });
    return;
  }
  if (/Yataq otağı/.test(L)) {
    place((g) => {
      box(g, 1.8, 0.45, 2.0, '#f3efe8', W / 2, 0, D - 1.25); box(g, 1.8, 0.12, 0.7, soft, W / 2, 0.45, D - 1.6);
      box(g, 1.9, 1.1, 0.08, wood, W / 2, 0, D - 0.2);
      box(g, 1.2, 0.74, 0.55, wood, Math.min(W - 0.8, W / 2 + 1.4), 0, 0.6);
      box(g, 0.7, 0.45, 0.7, acc, 0.8, 0, 0.9);
    });
    return;
  }
  if (/Yataq/.test(L)) {
    place((g) => {
      const bw = W > 3.2 ? 1.6 : 1.2;
      box(g, bw, 0.45, 2.0, '#f3efe8', W / 2, 0, D - 1.2); // döşək
      box(g, bw, 0.14, 0.8, soft, W / 2, 0.45, D - 1.65); // örtük
      box(g, bw + 0.1, 1.05, 0.08, wood, W / 2, 0, D - 0.16); // baş taxtası
      box(g, 0.45, 0.5, 0.4, wood, W / 2 - bw / 2 - 0.35, 0, D - 0.4);
      box(g, 0.45, 0.5, 0.4, wood, W / 2 + bw / 2 + 0.35, 0, D - 0.4);
      if (W > 3.0) box(g, 0.6, 2.2, Math.min(2.0, D - 2.8), wood, 0.36, 0, 1.4); // şkaf
      plant(g, W - 0.45, 0.45);
    });
    return;
  }
  if (/Mətbəx/.test(L)) {
    place((g) => {
      const len = Math.max(1.2, W - 0.6);
      box(g, len, 0.9, 0.6, wood, W / 2, 0, D - 0.36); // tezgah (koridor tərəfi)
      box(g, len, 0.04, 0.62, '#e9e6df', W / 2, 0.9, D - 0.36);
      box(g, 0.7, 1.9, 0.65, '#d9dcdf', 0.45, 0, D - 0.38); // soyuducu
      if (D > 2.4 && W > 2.6) box(g, 1.0, 0.9, 0.7, acc, W / 2, 0, D / 2 - 0.1); // ada
    });
    return;
  }
  if (/SQ/.test(L)) {
    place((g) => {
      box(g, Math.min(1.7, W - 0.5), 0.55, 0.75, '#f4f6f7', Math.min(1.7, W - 0.5) / 2 + 0.12, 0, D - 0.5); // vanna
      box(g, 0.4, 0.42, 0.6, '#f4f6f7', W - 0.4, 0, 0.5); // unitaz
      box(g, 0.7, 0.85, 0.45, wood, W - 0.5, 0, D / 2); // lavabo
    });
    return;
  }
  if (/Giriş/.test(L)) {
    place((g) => { box(g, Math.min(1.2, W - 0.4), 1.0, 0.35, wood, W / 2, 0, D - 0.3); });
  }
}

// Divarlar: daxili xətləri birləşdir, qapılar üçün boşluq qoy
function buildWalls(group, unit, subs, plan, site, P, low) {
  const H = low ? 1.15 : WALL_H;
  const wallMat = mat(P.divar, { roughness: 0.9 });
  const glass = mat('#9cc3dc', { transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.2 });
  const frame = mat('#2b3138');
  const corr = plan.rects.filter((r) => r.kind === 'corridor');
  const segs = [];
  const add = (o, c, a, b, type, doors = []) => segs.push({ o, c, a, b, type, doors });
  const isFacade = (o, c) => (o === 'h' ? Math.abs(c) < EPS || Math.abs(c - site.fd) < EPS : Math.abs(c) < EPS || Math.abs(c - site.fw) < EPS);
  const touchesCorr = (o, c, a, b) => corr.some((k) => (o === 'h'
    ? (Math.abs(k.y - c) < EPS || Math.abs(k.y + k.h - c) < EPS) && k.x < b - EPS && k.x + k.w > a + EPS
    : (Math.abs(k.x - c) < EPS || Math.abs(k.x + k.w - c) < EPS) && k.y < b - EPS && k.y + k.h > a + EPS));

  // xarici kontur
  const U = unit;
  const edges = [
    ['h', U.y, U.x, U.x + U.w], ['h', U.y + U.h, U.x, U.x + U.w],
    ['v', U.x, U.y, U.y + U.h], ['v', U.x + U.w, U.y, U.y + U.h],
  ];
  let entranceDone = false;
  edges.forEach(([o, c, a, b]) => {
    if (isFacade(o, c)) add(o, c, a, b, 'window');
    else if (touchesCorr(o, c, a, b) && !entranceDone) {
      // giriş qapısı: koridora bitişik ən böyük alt-otağın ortasında
      const host = subs.filter((r) => (o === 'h' ? Math.abs((r.y - c)) < EPS || Math.abs(r.y + r.h - c) < EPS : Math.abs(r.x - c) < EPS || Math.abs(r.x + r.w - c) < EPS)).sort((p, q) => (o === 'h' ? q.w - p.w : q.h - p.h))[0];
      const mid = host ? (o === 'h' ? host.x + host.w / 2 : host.y + host.h / 2) : (a + b) / 2;
      add(o, c, a, b, 'solid', [mid]); entranceDone = true;
    } else add(o, c, a, b, 'solid');
  });

  // daxili xətlər
  const lines = new Map();
  subs.forEach((r) => {
    [['h', r.y, r.x, r.x + r.w], ['h', r.y + r.h, r.x, r.x + r.w], ['v', r.x, r.y, r.y + r.h], ['v', r.x + r.w, r.y, r.y + r.h]].forEach(([o, c, a, b]) => {
      const onBoundary = o === 'h' ? (Math.abs(c - U.y) < EPS || Math.abs(c - U.y - U.h) < EPS) : (Math.abs(c - U.x) < EPS || Math.abs(c - U.x - U.w) < EPS);
      if (onBoundary) return;
      const key = `${o}${c.toFixed(2)}`;
      const L = lines.get(key) || { o, c, a, b, doors: [] };
      L.a = Math.min(L.a, a); L.b = Math.max(L.b, b);
      if (r.kind === 'room' && b - a > 1.6 && o === 'h') L.doors.push((a + b) / 2);
      lines.set(key, L);
    });
  });
  lines.forEach((L) => {
    const doors = [...new Set(L.doors.map((d) => d.toFixed(2)))].map(Number);
    if (L.o === 'v' && !doors.length) { /* otaqlar arası bərk divar */ }
    add(L.o, L.c, L.a, L.b, 'solid', doors);
  });

  const DOOR = 0.95;
  const piece = (o, c, a, b, y0, y1, m) => {
    if (b - a < 0.02) return;
    const len = b - a; const h = y1 - y0;
    const geo = o === 'h' ? new THREE.BoxGeometry(len, h, WALL_T) : new THREE.BoxGeometry(WALL_T, h, len);
    const mesh = new THREE.Mesh(geo, m);
    if (o === 'h') mesh.position.set(a + len / 2, y0 + h / 2, c); else mesh.position.set(c, y0 + h / 2, a + len / 2);
    mesh.castShadow = m !== glass; mesh.receiveShadow = true; group.add(mesh);
  };
  segs.forEach((s) => {
    if (s.type === 'window') {
      piece(s.o, s.c, s.a, s.b, 0, Math.min(0.85, H), wallMat);
      if (!low) {
        piece(s.o, s.c, s.a, s.b, 0.85, 2.45, glass);
        piece(s.o, s.c, s.a, s.b, 2.45, H, wallMat);
        // pəncərə çərçivələri hər 1.6 m
        for (let p = s.a; p <= s.b + 0.01; p += Math.max(1.2, (s.b - s.a) / Math.max(1, Math.round((s.b - s.a) / 1.6)))) piece(s.o, s.c, Math.min(p, s.b) - 0.03, Math.min(p, s.b) + 0.03, 0.85, 2.45, frame);
      }
      return;
    }
    const doors = s.doors.filter((d) => d > s.a + DOOR / 2 + 0.05 && d < s.b - DOOR / 2 - 0.05).sort((x, y) => x - y);
    let cur = s.a;
    doors.forEach((d) => {
      piece(s.o, s.c, cur, d - DOOR / 2, 0, H, wallMat);
      if (!low) piece(s.o, s.c, d - DOOR / 2, d + DOOR / 2, 2.1, H, wallMat);
      cur = d + DOOR / 2;
    });
    piece(s.o, s.c, cur, s.b, 0, H, wallMat);
  });
}

export const STYLE_INTERIOR = {
  modern: { dosheme: '#b08d68', divar: '#eeeeea', mebel: '#3b4148', aksent: '#5d7f95', yumsaq: '#c9d6df' },
  baki: { dosheme: '#9a6f48', divar: '#efe6d6', mebel: '#6b4f36', aksent: '#8a3b2e', yumsaq: '#d8c3a5' },
  icheri: { dosheme: '#8c6440', divar: '#f1e4c8', mebel: '#5a3b24', aksent: '#9b3d2a', yumsaq: '#c79a5b' },
  minimal: { dosheme: '#d8cfc2', divar: '#f7f6f2', mebel: '#e3ded6', aksent: '#6d6d6d', yumsaq: '#ecebe7' },
  eko: { dosheme: '#a98458', divar: '#ece6d8', mebel: '#7a5c3e', aksent: '#6f8f5a', yumsaq: '#d9d2bf' },
  hitech: { dosheme: '#8e9399', divar: '#f0f2f3', mebel: '#22303a', aksent: '#2f8fdf', yumsaq: '#c7d3dc' },
  artdeco: { dosheme: '#5a4030', divar: '#ebe2cf', mebel: '#2e3a3f', aksent: '#b8913b', yumsaq: '#d9c79d' },
  brutal: { dosheme: '#9a968f', divar: '#c9c6bf', mebel: '#4a4744', aksent: '#b5552e', yumsaq: '#d7d3cb' },
  med: { dosheme: '#c79e73', divar: '#f6f2ea', mebel: '#9b7653', aksent: '#3f7fa8', yumsaq: '#e7d9c4' },
  skand: { dosheme: '#d6bd98', divar: '#f6f3ee', mebel: '#c9ab84', aksent: '#5b6b70', yumsaq: '#e9e3d8' },
};

export default function Interior3D({ result, unitIndex, palette, cutaway, onReady }) {
  const mountRef = useRef(null);
  const ctx = useRef(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const mount = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#e9ece8');
    const camera = new THREE.PerspectiveCamera(40, mount.clientWidth / mount.clientHeight, 0.1, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.1; controls.minDistance = 2; controls.maxDistance = 120;
    controls.screenSpacePanning = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cdbb, 1.0));
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0003; sun.shadow.radius = 3;
    scene.add(sun); scene.add(sun.target);
    const group = new THREE.Group(); scene.add(group);
    let raf; const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); }; loop();
    const ro = new ResizeObserver(() => { renderer.setSize(mount.clientWidth, mount.clientHeight); camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix(); });
    ro.observe(mount);
    ctx.current = { renderer, scene, camera, controls, group, sun };
    setTick(1);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); mount.removeChild(renderer.domElement); };
  }, []);

  useEffect(() => {
    const c = ctx.current; if (!c) return;
    const { group, camera, controls, sun } = c;
    while (group.children.length) { const o = group.children.pop(); o.traverse?.((m) => { m.geometry?.dispose?.(); }); }
    const { plan, site, input } = result;
    const P = palette;
    const units = plan.rects.filter((r) => r.kind === 'unit');
    let area; let subs;
    if (units.length) {
      const u = units[Math.min(unitIndex, units.length - 1)];
      area = u;
      subs = plan.rects.filter((r) => r.kind !== 'unit' && ['room', 'wet', 'hall'].includes(r.kind) && r.x >= u.x - EPS && r.x + r.w <= u.x + u.w + EPS && r.y >= u.y - EPS && r.y + r.h <= u.y + u.h + EPS);
    } else {
      area = { x: 0, y: 0, w: site.fw, h: site.fd };
      subs = plan.rects.filter((r) => ['core', 'meeting', 'wet', 'hall', 'tech'].includes(r.kind));
    }
    const facadeAtMin = area.y < EPS;

    // döşəmə: yaşayış otaqlarında parket, yaş zonalarda kafel
    const pq = parquet(P.dosheme);
    const tl = tiles('#dfe3e6');
    const floorOf = (r, wet) => {
      const t = (wet ? tl : pq).clone(); t.needsUpdate = true; t.repeat.set(r.w / (wet ? 1.2 : 3), r.h / (wet ? 1.2 : 3));
      const m = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.06, r.h), new THREE.MeshStandardMaterial({ map: t, roughness: wet ? 0.35 : 0.6 }));
      m.position.set(r.x + r.w / 2, -0.03, r.y + r.h / 2); m.receiveShadow = true; group.add(m);
    };
    if (units.length) subs.forEach((r) => floorOf(r, r.kind === 'wet'));
    else floorOf(area, false);
    // ətraf bina konturu (kontekst)
    const ctxSlab = new THREE.Mesh(new THREE.BoxGeometry(site.fw, 0.04, site.fd), mat('#d4d6d0'));
    ctxSlab.position.set(site.fw / 2, -0.09, site.fd / 2); ctxSlab.receiveShadow = true; group.add(ctxSlab);

    if (units.length) buildWalls(group, area, subs, plan, site, P, cutaway);
    else {
      subs.forEach((r) => {
        if (r.kind === 'core') box(group, r.w, cutaway ? 1.15 : WALL_H, r.h, '#3b444c', r.x + r.w / 2, 0, r.y + r.h / 2);
        else buildWalls(group, r, [r], { rects: [] }, { fw: -999, fd: -999 }, P, cutaway);
      });
      // fasad şüşəsi
      buildWalls(group, area, [], { rects: [] }, site, P, cutaway);
    }

    // mebel
    if (units.length) subs.forEach((r) => furnish(group, r, r.kind, P, facadeAtMin, input.func));
    else {
      const open = { x: 0, y: 0, w: site.fw, h: site.fd, label: 'open' };
      furnish(group, open, 'open', P, true, input.func);
      subs.filter((r) => r.kind === 'meeting').forEach((r) => furnish(group, r, 'meeting', P, true, input.func));
    }
    // ofis: nüvənin üstündəki masaları gizlət
    if (!units.length) {
      const core = subs.find((r) => r.kind === 'core');
      const blocks = subs.filter((r) => ['core', 'meeting', 'wet', 'hall'].includes(r.kind));
      group.traverse((m) => {
        if (!m.isMesh || !m.parent?.userData?.open) return;
        const wp = new THREE.Vector3(); m.getWorldPosition(wp);
        if (blocks.some((b) => wp.x > b.x - 0.6 && wp.x < b.x + b.w + 0.6 && wp.z > b.y - 0.6 && wp.z < b.y + b.h + 0.6)) m.visible = false;
      });
      if (core) { const l = label('Lift + pilləkən'); l.position.set(core.x + core.w / 2, 3.4, core.y + core.h / 2); group.add(l); }
    }

    // otaq etiketləri
    subs.filter((r) => r.kind !== 'core' && r.label).forEach((r) => {
      const l = label(r.label.replace(' otağı', ''), r.area ? `${Math.round(r.area)} m²` : `${Math.round(r.w * r.h)} m²`);
      l.position.set(r.x + r.w / 2, (cutaway ? 1.6 : WALL_H) + 0.6, r.y + r.h / 2);
      const k = Math.min(1, Math.max(0.55, Math.min(r.w, r.h) / 3.2)); l.scale.multiplyScalar(k);
      group.add(l);
    });

    // işıq və kamera
    const cx = area.x + area.w / 2; const cz = area.y + area.h / 2;
    const ext = Math.max(area.w, area.h);
    sun.position.set(cx + ext * 0.6, ext * 1.6, cz + (facadeAtMin ? -ext : ext) * 0.9);
    sun.target.position.set(cx, 0, cz);
    const sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.far = ext * 6; sc.updateProjectionMatrix();
    const key = `${unitIndex}|${area.x}|${area.w}|${site.fw}`;
    if (c.key !== key) {
      const dist = ext * 1.35 + 4;
      const side = facadeAtMin ? -1 : 1;
      camera.position.set(cx + dist * 0.35, dist * 0.95, cz + side * dist * 0.75);
      controls.target.set(cx, 0, cz);
      c.key = key; c.home = { pos: camera.position.clone(), target: controls.target.clone() };
    }
    onReady?.({ area, subs });
  }, [result, unitIndex, palette, cutaway, tick]);

  const zoom = (k) => {
    const c = ctx.current; if (!c) return;
    const dir = c.camera.position.clone().sub(c.controls.target);
    c.camera.position.copy(c.controls.target.clone().add(dir.multiplyScalar(k)));
  };
  const reset = () => {
    const c = ctx.current; if (!c?.home) return;
    c.camera.position.copy(c.home.pos); c.controls.target.copy(c.home.target);
  };

  return (
    <div className="stage stage3d" style={{ background: '#e9ece8' }}>
      <div ref={mountRef} style={{ width: '100%', height: 560 }} role="img" aria-label="Mənzilin interyerinin 3D modeli" />
      <div className="stage-tools" style={{ left: 'auto', right: 12 }}>
        <button type="button" className="chip" onClick={() => zoom(0.75)} aria-label="Yaxınlaşdır">＋</button>
        <button type="button" className="chip" onClick={() => zoom(1.33)} aria-label="Uzaqlaşdır">－</button>
        <button type="button" className="chip" onClick={reset}>↺ Görünüş</button>
      </div>
      <span className="hint glass" style={{ position: 'absolute', right: 14, bottom: 14, padding: '6px 10px' }}>Fırladın · təkərlə yaxınlaşın · sağ düymə ilə sürüşdürün</span>
    </div>
  );
}

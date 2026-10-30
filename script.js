'use strict';

/* ---------- constants ---------- */
const PRESETS = [
  { name: 'Linear',         c: [0, 0, 1, 1] },
  { name: 'Ease',           c: [0.25, 0.1, 0.25, 1] },
  { name: 'Ease in',        c: [0.42, 0, 1, 1] },
  { name: 'Ease out',       c: [0, 0, 0.58, 1] },
  { name: 'Ease in out',    c: [0.42, 0, 0.58, 1] },
  { name: 'Out quint',      c: [0.22, 1, 0.36, 1] },
  { name: 'In out cubic',   c: [0.65, 0, 0.35, 1] },
  { name: 'Out back',       c: [0.34, 1.56, 0.64, 1] },
  { name: 'In back',        c: [0.36, 0, 0.66, -0.56] }
];

const FORMATS = [
  { id: 'css',  label: 'CSS' },
  { id: 'var',  label: 'CSS variable' },
  { id: 'js',   label: 'JavaScript' },
  { id: 'tw',   label: 'Tailwind' }
];

const G = { x0: 60, y0: 372, unit: 220, yMin: -0.6, yMax: 1.6 };
const gx = (v) => G.x0 + v * G.unit;
const gy = (v) => G.y0 - v * G.unit;
const SVG_NS = 'http://www.w3.org/2000/svg';
const STORE_KEY = 'curvebook:saved';

/* ---------- state ---------- */
const state = {
  curve: [0.25, 0.1, 0.25, 1],
  duration: 700,
  loop: false,
  format: 'css',
  saved: []
};

const $ = (id) => document.getElementById(id);
const el = {
  graph: $('graph'), grid: $('gridlines'), diag: $('diag'), ctrl1: $('ctrl1'), ctrl2: $('ctrl2'),
  curve: $('curve'), dot: $('dot'), h1: $('h1'), h2: $('h2'),
  inputs: [$('x1'), $('y1'), $('x2'), $('y2')],
  presets: $('presets'), formats: $('formats'), code: $('code'),
  duration: $('duration'), durationOut: $('durationOut'), loop: $('loop'),
  replay: $('replay'), copy: $('copy'), save: $('save'), toast: $('toast'),
  saved: $('saved'), emptySaved: $('emptySaved'),
  lane: $('lane'), ball: $('ball'), ghost: $('ghost'),
  scale: $('scaleShape'), rot: $('rotShape'), fade: $('fadeShape')
};

/* ---------- math ---------- */
const round2 = (n) => Math.round(n * 100) / 100;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (n) => String(+n.toFixed(2));
const bezierString = (c) => 'cubic-bezier(' + c.map(fmt).join(', ') + ')';

// Solve a CSS cubic-bezier: given time x in 0..1, return progress y.
function makeEase(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const e = sx(t);
      if (Math.abs(e - x) < 1e-6) break;
      if (x > e) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/* ---------- graph setup ---------- */
function line(parent, cls, x1, y1, x2, y2) {
  const l = document.createElementNS(SVG_NS, 'line');
  l.setAttribute('class', cls);
  l.setAttribute('x1', x1); l.setAttribute('y1', y1);
  l.setAttribute('x2', x2); l.setAttribute('y2', y2);
  parent.appendChild(l);
}

function label(parent, text, x, y, anchor) {
  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('class', 'axis');
  t.setAttribute('x', x); t.setAttribute('y', y);
  t.setAttribute('text-anchor', anchor || 'end');
  t.textContent = text;
  parent.appendChild(t);
}

function buildGrid() {
  for (let i = 0; i <= 4; i++) {
    const v = i / 4;
    line(el.grid, 'gl' + (i === 0 || i === 4 ? ' unit' : ''), gx(v), gy(G.yMax), gx(v), gy(G.yMin));
  }
  for (let v = -0.5; v <= 1.5 + 1e-9; v += 0.25) {
    const isUnit = Math.abs(v) < 1e-9 || Math.abs(v - 1) < 1e-9;
    line(el.grid, 'gl' + (isUnit ? ' unit' : ''), gx(0), gy(v), gx(1), gy(v));
  }
  label(el.grid, '0', gx(0) - 8, gy(0) + 4);
  label(el.grid, '1', gx(0) - 8, gy(1) + 4);
  label(el.grid, 'time', gx(0.5), gy(G.yMin) + 22, 'middle');
  el.diag.setAttribute('x1', gx(0)); el.diag.setAttribute('y1', gy(0));
  el.diag.setAttribute('x2', gx(1)); el.diag.setAttribute('y2', gy(1));
}

/* ---------- render ---------- */
function exportText() {
  const b = bezierString(state.curve);
  const ms = state.duration;
  switch (state.format) {
    case 'var':
      return ':root {\n  --ease-custom: ' + b + ';\n}\n\n.element {\n  transition: transform ' + ms + 'ms var(--ease-custom);\n}';
    case 'js':
      return 'element.animate(\n  [{ transform: "translateX(0)" }, { transform: "translateX(240px)" }],\n  { duration: ' + ms + ', easing: "' + b + '", fill: "forwards" }\n);';
    case 'tw':
      return '// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      transitionTimingFunction: {\n        custom: "' + b + '"\n      }\n    }\n  }\n};\n// usage: class="ease-custom duration-[' + ms + 'ms]"';
    default:
      return '.element {\n  transition: transform ' + ms + 'ms ' + b + ';\n}\n\n/* or on its own */\ntransition-timing-function: ' + b + ';';
  }
}

function sameCurve(a, b) { return a.every((v, i) => Math.abs(v - b[i]) < 0.001); }

function render() {
  const [x1, y1, x2, y2] = state.curve;

  el.curve.setAttribute('d', 'M ' + gx(0) + ' ' + gy(0) + ' C ' + gx(x1) + ' ' + gy(y1) + ', ' + gx(x2) + ' ' + gy(y2) + ', ' + gx(1) + ' ' + gy(1));
  el.ctrl1.setAttribute('x1', gx(0)); el.ctrl1.setAttribute('y1', gy(0));
  el.ctrl1.setAttribute('x2', gx(x1)); el.ctrl1.setAttribute('y2', gy(y1));
  el.ctrl2.setAttribute('x1', gx(1)); el.ctrl2.setAttribute('y1', gy(1));
  el.ctrl2.setAttribute('x2', gx(x2)); el.ctrl2.setAttribute('y2', gy(y2));
  el.h1.setAttribute('transform', 'translate(' + gx(x1) + ' ' + gy(y1) + ')');
  el.h2.setAttribute('transform', 'translate(' + gx(x2) + ' ' + gy(y2) + ')');
  el.h1.setAttribute('aria-label', 'Handle 1, x ' + fmt(x1) + ', y ' + fmt(y1) + '. Use arrow keys to move.');
  el.h2.setAttribute('aria-label', 'Handle 2, x ' + fmt(x2) + ', y ' + fmt(y2) + '. Use arrow keys to move.');
  el.h1.setAttribute('aria-valuetext', 'x ' + fmt(x1) + ', y ' + fmt(y1));
  el.h2.setAttribute('aria-valuetext', 'x ' + fmt(x2) + ', y ' + fmt(y2));

  el.inputs.forEach((inp, i) => {
    if (document.activeElement !== inp) inp.value = fmt(state.curve[i]);
  });

  Array.from(el.presets.children).forEach((b, i) => {
    b.setAttribute('aria-pressed', String(sameCurve(PRESETS[i].c, state.curve)));
  });
  Array.from(el.formats.children).forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.id === state.format));
  });

  el.code.textContent = exportText();
  el.durationOut.textContent = state.duration + ' ms';

  try {
    history.replaceState(null, '', '#' + state.curve.map(fmt).join(','));
  } catch (e) { /* hash sync is a nice-to-have */ }
}

/* ---------- animation ---------- */
let anims = [];
let loopTimer = 0;
let raf = 0;

function replay() {
  clearTimeout(loopTimer);
  cancelAnimationFrame(raf);
  anims.forEach((a) => a.cancel());
  anims = [];

  const easing = bezierString(state.curve);
  const d = state.duration;
  const dist = Math.max(0, el.lane.clientWidth - 16 - el.ball.offsetWidth);
  const opts = (e) => ({ duration: d, easing: e, fill: 'both' });

  anims.push(el.ball.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + dist + 'px)' }], opts(easing)));
  anims.push(el.ghost.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + dist + 'px)' }], opts('linear')));
  anims.push(el.scale.animate([{ transform: 'scale(0.3)' }, { transform: 'scale(1)' }], opts(easing)));
  anims.push(el.rot.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(180deg)' }], opts(easing)));
  anims.push(el.fade.animate([{ opacity: 0.1 }, { opacity: 1 }], opts(easing)));

  const ease = makeEase.apply(null, state.curve);
  const start = performance.now();
  el.dot.style.opacity = 1;
  const tick = (now) => {
    const t = clamp((now - start) / d, 0, 1);
    el.dot.setAttribute('cx', gx(t));
    el.dot.setAttribute('cy', gy(ease(t)));
    if (t < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      setTimeout(() => { if (!anims.length || anims[0].playState === 'finished') el.dot.style.opacity = 0; }, 500);
    }
  };
  raf = requestAnimationFrame(tick);

  anims[0].onfinish = () => {
    if (state.loop) loopTimer = setTimeout(replay, 450);
  };
}

/* ---------- curve changes ---------- */
function setCurve(c, autoplay) {
  state.curve = [
    clamp(round2(c[0]), 0, 1), clamp(round2(c[1]), G.yMin, G.yMax),
    clamp(round2(c[2]), 0, 1), clamp(round2(c[3]), G.yMin, G.yMax)
  ];
  render();
  if (autoplay) replay();
}

/* ---------- dragging ---------- */
function toGraph(e) {
  const pt = el.graph.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(el.graph.getScreenCTM().inverse());
  return { x: (p.x - G.x0) / G.unit, y: (G.y0 - p.y) / G.unit };
}

function wireHandle(g, xi, yi) {
  g.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    g.setPointerCapture(e.pointerId);
    g.classList.add('drag');
    g.focus();
  });
  g.addEventListener('pointermove', (e) => {
    if (!g.classList.contains('drag')) return;
    const p = toGraph(e);
    const c = state.curve.slice();
    c[xi] = p.x; c[yi] = p.y;
    setCurve(c, false);
  });
  const end = () => {
    if (!g.classList.contains('drag')) return;
    g.classList.remove('drag');
    replay();
  };
  g.addEventListener('pointerup', end);
  g.addEventListener('pointercancel', end);
  g.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const c = state.curve.slice();
    let used = true;
    if (e.key === 'ArrowLeft') c[xi] -= step;
    else if (e.key === 'ArrowRight') c[xi] += step;
    else if (e.key === 'ArrowUp') c[yi] += step;
    else if (e.key === 'ArrowDown') c[yi] -= step;
    else used = false;
    if (used) { e.preventDefault(); setCurve(c, false); }
  });
  g.addEventListener('keyup', (e) => {
    if (e.key.indexOf('Arrow') === 0) replay();
  });
}

/* ---------- saved curves ---------- */
function loadSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    if (Array.isArray(raw)) state.saved = raw.filter((c) => Array.isArray(c) && c.length === 4 && c.every(Number.isFinite)).slice(0, 12);
  } catch (e) { state.saved = []; }
}

function persistSaved() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state.saved)); } catch (e) { /* storage unavailable */ }
}

function thumbPath(c) {
  const X = (v) => 4 + v * 40;
  const Y = (v) => 44 - ((v + 0.6) / 2.2) * 40;
  return 'M ' + X(0) + ' ' + Y(0) + ' C ' + X(c[0]) + ' ' + Y(c[1]) + ', ' + X(c[2]) + ' ' + Y(c[3]) + ', ' + X(1) + ' ' + Y(1);
}

function renderSaved() {
  el.saved.textContent = '';
  el.emptySaved.hidden = state.saved.length > 0;
  state.saved.forEach((c, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'sv';

    const load = document.createElement('button');
    load.type = 'button';
    load.className = 'load';
    load.setAttribute('aria-label', 'Load curve ' + c.map(fmt).join(', '));
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', thumbPath(c));
    svg.appendChild(path);
    const txt = document.createElement('span');
    txt.textContent = c.map(fmt).join(', ');
    load.append(svg, txt);
    load.addEventListener('click', () => setCurve(c, true));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.setAttribute('aria-label', 'Delete saved curve ' + c.map(fmt).join(', '));
    del.textContent = '×';
    del.addEventListener('click', () => {
      state.saved.splice(i, 1);
      persistSaved();
      renderSaved();
    });

    wrap.append(load, del);
    el.saved.appendChild(wrap);
  });
}

/* ---------- misc UI ---------- */
let toastTimer = 0;
function toast(msg) {
  el.toast.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.textContent = ''; }, 2200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e2) { return false; }
  }
}

function buildChips() {
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = p.name;
    b.addEventListener('click', () => setCurve(p.c, true));
    el.presets.appendChild(b);
  });
  FORMATS.forEach((f) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.id = f.id;
    b.textContent = f.label;
    b.addEventListener('click', () => { state.format = f.id; render(); });
    el.formats.appendChild(b);
  });
}

function readHash() {
  const parts = location.hash.slice(1).split(',').map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite)) state.curve = [
    clamp(parts[0], 0, 1), clamp(parts[1], G.yMin, G.yMax), clamp(parts[2], 0, 1), clamp(parts[3], G.yMin, G.yMax)
  ];
}

/* ---------- init ---------- */
function init() {
  buildGrid();
  buildChips();
  readHash();
  loadSaved();
  wireHandle(el.h1, 0, 1);
  wireHandle(el.h2, 2, 3);

  el.inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      if (!Number.isFinite(v)) return;
      const c = state.curve.slice();
      c[i] = v;
      setCurve(c, false);
    });
    inp.addEventListener('change', () => { inp.value = fmt(state.curve[i]); replay(); });
  });

  el.duration.addEventListener('input', () => {
    state.duration = Number(el.duration.value);
    render();
  });
  el.duration.addEventListener('change', replay);
  el.loop.addEventListener('change', () => {
    state.loop = el.loop.checked;
    if (state.loop) replay(); else clearTimeout(loopTimer);
  });
  el.replay.addEventListener('click', replay);

  el.copy.addEventListener('click', async () => {
    toast((await copyText(el.code.textContent)) ? 'Copied to clipboard' : 'Copy blocked, select the code instead');
  });
  el.save.addEventListener('click', () => {
    if (state.saved.some((c) => sameCurve(c, state.curve))) { toast('Already saved'); return; }
    state.saved.unshift(state.curve.slice());
    state.saved = state.saved.slice(0, 12);
    persistSaved();
    renderSaved();
    toast('Saved');
  });

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    const t = e.target;
    if (t.closest && t.closest('button, input, textarea, select, a')) return;
    e.preventDefault();
    replay();
  });

  window.addEventListener('hashchange', () => { readHash(); render(); replay(); });

  renderSaved();
  render();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setTimeout(replay, 500);
}

init();

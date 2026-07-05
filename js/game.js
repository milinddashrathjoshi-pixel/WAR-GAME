'use strict';

// ============================================================
// Core engine: canvas/camera, save state, home village economy,
// building placement/upgrades, HUD & modals, render loop.
// Battle logic lives in battle.js (global `Battle`).
// ============================================================

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const now = () => Date.now();

function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 10000) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 0xff) + amt, b = (n & 0xff) + amt;
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
  return `rgb(${r},${g},${b})`;
}

// ---------- iso math (world units: tile = 48 wide x 24 tall) ----------
const TILE_W = 24, TILE_H = 12; // half-extents
function g2w(gx, gy) { return { x: (gx - gy) * TILE_W, y: (gx + gy) * TILE_H }; }
function w2g(wx, wy) { return { x: wx / (2 * TILE_W) + wy / (2 * TILE_H), y: wy / (2 * TILE_H) - wx / (2 * TILE_W) }; }

function distRect(px, py, bx, by, s) {
  const dx = Math.max(bx - px, 0, px - (bx + s));
  const dy = Math.max(by - py, 0, py - (by + s));
  return Math.hypot(dx, dy);
}

// ---------- canvas & camera ----------
const canvas = $('game');
const ctx = canvas.getContext('2d');
const cam = { x: 0, y: 0, z: 1 };
let T = 0; // global animation clock

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}
window.addEventListener('resize', resize);

function centerCamera() {
  const c = g2w(GRID / 2, GRID / 2);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  cam.z = clamp(Math.min(W / 2200, H / 1300) * 1.9, 0.45, 1.2);
  cam.x = W / 2 - c.x * cam.z;
  cam.y = H / 2 - c.y * cam.z;
}

function s2w(sx, sy) { return { x: (sx - cam.x) / cam.z, y: (sy - cam.y) / cam.z }; }

// ---------- ground (pre-rendered once) ----------
let groundCanvas = null;
const GROUND_PAD = 120;
const GROUND_OX = -(GRID * TILE_W) - GROUND_PAD, GROUND_OY = -GROUND_PAD;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function buildGround() {
  groundCanvas = document.createElement('canvas');
  groundCanvas.width = GRID * TILE_W * 2 + GROUND_PAD * 2;
  groundCanvas.height = GRID * TILE_H * 2 + GROUND_PAD * 2;
  const g = groundCanvas.getContext('2d');
  g.translate(-GROUND_OX, -GROUND_OY);

  const diamond = (gx, gy, w) => {
    const p0 = g2w(gx, gy), p1 = g2w(gx + w, gy), p2 = g2w(gx + w, gy + w), p3 = g2w(gx, gy + w);
    g.beginPath();
    g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y);
    g.closePath();
  };

  // outer skirt
  diamond(-1.2, -1.2, GRID + 2.4);
  g.fillStyle = '#5a9140';
  g.fill();
  // checkered grass
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      diamond(x, y, 1);
      g.fillStyle = (x + y) % 2 === 0 ? '#7ec850' : '#76bf4a';
      g.fill();
    }
  }
  // border line
  diamond(0, 0, GRID);
  g.strokeStyle = 'rgba(0,0,0,.25)';
  g.lineWidth = 2;
  g.stroke();

  // decorative trees around the edge
  const rnd = mulberry32(1337);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  for (let i = 0; i < 90; i++) {
    const side = Math.floor(rnd() * 4);
    const along = rnd() * (GRID + 4) - 2;
    const off = 0.4 + rnd() * 1.6;
    let gx, gy;
    if (side === 0) { gx = along; gy = -off; }
    else if (side === 1) { gx = along; gy = GRID + off - 1; }
    else if (side === 2) { gx = -off; gy = along; }
    else { gx = GRID + off - 1; gy = along; }
    const p = g2w(gx + 0.5, gy + 0.5);
    g.font = `${20 + rnd() * 14}px serif`;
    g.fillText(rnd() < 0.5 ? '🌲' : '🌳', p.x, p.y);
  }
}

// ---------- persistent state ----------
const SAVE_KEY = 'villageWarsSave_v1';
let state = null;
let nextId = 1;

function mkBuilding(type, x, y, level) {
  return { id: nextId++, type, x, y, level, stored: 0 };
}

function newGame() {
  nextId = 1;
  state = {
    gold: 500, elixir: 500, trophies: 0,
    buildings: [
      mkBuilding('townhall', 18, 18, 1),
      mkBuilding('goldmine', 13, 19, 1),
      mkBuilding('elixirpump', 19, 13, 1),
      mkBuilding('cannon', 13, 14, 1),
      mkBuilding('barracks', 24, 19, 1),
      mkBuilding('armycamp', 19, 24, 1),
    ],
    army: {}, queue: [],
    savedAt: now(),
    seenHelp: false,
  };
}

function save() {
  if (!state) return;
  state.savedAt = now();
  state.nextId = nextId;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* private mode etc. */ }
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* ignore */ }
  if (!raw) return false;
  try {
    state = JSON.parse(raw);
    nextId = state.nextId || (Math.max(0, ...state.buildings.map(b => b.id)) + 1);
    state.army = state.army || {};
    state.queue = state.queue || [];
    applyOffline();
    return true;
  } catch (e) {
    state = null;
    return false;
  }
}

function applyOffline() {
  const elapsed = clamp((now() - (state.savedAt || now())) / 1000, 0, 8 * 3600);
  if (elapsed < 2) return;
  // production
  for (const b of state.buildings) {
    const d = BUILDINGS[b.type];
    if (d.prod && b.level >= 1) {
      b.stored = Math.min((b.stored || 0) + d.prod[b.level - 1] * elapsed, d.capacity[b.level - 1]);
    }
  }
  // training
  let t = elapsed;
  while (t > 0 && state.queue.length) {
    const q = state.queue[0];
    if (q.remain > t) { q.remain -= t; break; }
    t -= q.remain;
    state.queue.shift();
    state.army[q.type] = (state.army[q.type] || 0) + 1;
  }
  // constructions use absolute timestamps, handled by homeUpdate
}

// ---------- derived helpers ----------
function thBuilding() { return state.buildings.find(b => b.type === 'townhall'); }
function thLevel() { const th = thBuilding(); return th ? Math.max(th.level, 1) : 1; }

function resCap(kind) {
  let cap = BUILDINGS.townhall.store[thLevel() - 1];
  for (const b of state.buildings) {
    const d = BUILDINGS[b.type];
    if (d.capAdd && d.stores === kind && b.level >= 1) cap += d.capAdd[b.level - 1];
  }
  return cap;
}

function addRes(kind, amt) {
  const before = state[kind];
  state[kind] = Math.min(state[kind] + amt, resCap(kind));
  return state[kind] - before;
}

function countType(type) { return state.buildings.filter(b => b.type === type).length; }

function campCapacity() {
  let cap = 0;
  for (const b of state.buildings) {
    if (b.type === 'armycamp' && b.level >= 1) cap += BUILDINGS.armycamp.capacity[b.level - 1];
  }
  return cap;
}

function armyHousing() {
  let used = 0;
  for (const t of TROOP_ORDER) used += (state.army[t] || 0) * TROOPS[t].housing;
  return used;
}

function queueHousing() {
  let used = 0;
  for (const q of state.queue) used += TROOPS[q.type].housing;
  return used;
}

function armyCount() {
  let n = 0;
  for (const t of TROOP_ORDER) n += state.army[t] || 0;
  return n;
}

function barracksLevel() {
  let lv = 0;
  for (const b of state.buildings) if (b.type === 'barracks') lv = Math.max(lv, b.level);
  return lv;
}

function rectsOverlap(x1, y1, s1, x2, y2, s2) {
  return !(x1 + s1 <= x2 || x2 + s2 <= x1 || y1 + s1 <= y2 || y2 + s2 <= y1);
}

function areaFree(x, y, size, ignoreId) {
  if (x < PLACE_MARGIN || y < PLACE_MARGIN) return false;
  if (x + size > GRID - PLACE_MARGIN || y + size > GRID - PLACE_MARGIN) return false;
  for (const b of state.buildings) {
    if (b.id === ignoreId) continue;
    if (rectsOverlap(x, y, size, b.x, b.y, BUILDINGS[b.type].size)) return false;
  }
  return true;
}

// ---------- home simulation ----------
function homeUpdate(dt) {
  const t = now();
  for (const b of state.buildings) {
    const d = BUILDINGS[b.type];
    // finish construction / upgrade
    if (b.pending && t >= b.doneAt) {
      b.level = b.pending;
      delete b.pending; delete b.doneAt;
      toast(`${d.emoji} ${d.name} ${b.level === 1 ? 'built' : 'upgraded to level ' + b.level}!`);
      if (selected && selected.id === b.id) refreshPanel();
    }
    // production
    if (d.prod && b.level >= 1) {
      b.stored = Math.min((b.stored || 0) + d.prod[b.level - 1] * dt, d.capacity[b.level - 1]);
    }
  }
  // troop training
  if (state.queue.length) {
    const q = state.queue[0];
    q.remain -= dt;
    if (q.remain <= 0) {
      state.queue.shift();
      state.army[q.type] = (state.army[q.type] || 0) + 1;
      floatText(g2wCenterOfType('barracks'), `+1 ${TROOPS[q.type].emoji}`);
    }
  }
}

function g2wCenterOfType(type) {
  const b = state.buildings.find(b => b.type === type);
  if (!b) return { x: 0, y: 400 };
  const s = BUILDINGS[type].size;
  return g2w(b.x + s / 2, b.y + s / 2);
}

// ---------- floating texts / particles (shared with battle) ----------
const floaters = [];
function floatText(wpos, txt, color) {
  floaters.push({ x: wpos.x, y: wpos.y - 30, txt, color: color || '#ffe9a3', ttl: 1.4 });
}

const particles = [];
function boom(wpos, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 120;
    particles.push({
      x: wpos.x, y: wpos.y - 10,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55 - 60,
      r: 2 + Math.random() * 4, ttl: 0.5 + Math.random() * 0.5,
      color: color || (Math.random() < 0.5 ? '#ffb648' : '#8a8a8a'),
    });
  }
}

function updateFx(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.y -= 28 * dt; f.ttl -= dt;
    if (f.ttl <= 0) floaters.splice(i, 1);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.ttl -= dt;
    if (p.ttl <= 0) particles.splice(i, 1);
  }
}

// ---------- selection / placement ----------
let selected = null;      // home building
let placing = null;       // {type} for new, {move: building} for relocation
let hoverCell = null;     // {x, y} last pointed-at cell

function select(b) {
  selected = b || null;
  refreshPanel();
}

function startPlacing(type) {
  placing = { type };
  select(null);
  $('placeHint').classList.remove('hidden');
  canvas.classList.add('placing');
}

function startMoving(b) {
  placing = { move: b };
  select(null);
  $('placeHint').classList.remove('hidden');
  canvas.classList.add('placing');
}

function stopPlacing() {
  placing = null;
  $('placeHint').classList.add('hidden');
  canvas.classList.remove('placing');
}

function placeAnchor(g, size) {
  return {
    x: clamp(Math.round(g.x - size / 2), PLACE_MARGIN, GRID - PLACE_MARGIN - size),
    y: clamp(Math.round(g.y - size / 2), PLACE_MARGIN, GRID - PLACE_MARGIN - size),
  };
}

function tryPlace(g) {
  const type = placing.move ? placing.move.type : placing.type;
  const d = BUILDINGS[type];
  const a = placeAnchor(g, d.size);
  const ignore = placing.move ? placing.move.id : -1;
  if (!areaFree(a.x, a.y, d.size, ignore)) {
    toast('Can\'t build there!');
    return;
  }
  if (placing.move) {
    const moved = placing.move;
    moved.x = a.x; moved.y = a.y;
    stopPlacing();
    select(moved);
    save();
    return;
  }
  // buying a new one
  if (countType(type) >= d.limit[thLevel() - 1]) { toast('Limit reached for this Town Hall level.'); stopPlacing(); return; }
  const cost = d.cost[0];
  if (state[d.res] < cost) { toast(`Not enough ${d.res}!`); stopPlacing(); return; }
  state[d.res] -= cost;
  const b = mkBuilding(type, a.x, a.y, 0);
  if (d.time[0] > 0) {
    b.pending = 1;
    b.doneAt = now() + d.time[0] * 1000;
  } else {
    b.level = 1;
  }
  state.buildings.push(b);
  boom(g2w(a.x + d.size / 2, a.y + d.size / 2), 8, '#c9b458');
  save();
  // chain-place walls, single-place everything else
  const canChain = type === 'wall'
    && countType(type) < d.limit[thLevel() - 1]
    && state[d.res] >= d.cost[0];
  if (!canChain) stopPlacing();
}

function startUpgrade(b) {
  const d = BUILDINGS[b.type];
  if (b.pending) { toast('Already under construction!'); return; }
  if (b.level >= MAX_LEVEL) { toast('Already at max level!'); return; }
  if (b.type !== 'townhall' && b.level > thLevel()) { toast('Upgrade your Town Hall first!'); return; }
  const cost = d.cost[b.level];
  if (state[d.res] < cost) { toast(`Not enough ${d.res}! Need ${fmt(cost)}.`); return; }
  state[d.res] -= cost;
  const dur = d.time[b.level];
  if (dur > 0) {
    b.pending = b.level + 1;
    b.doneAt = now() + dur * 1000;
  } else {
    b.level += 1;
    toast(`${d.emoji || '🧱'} ${d.name} upgraded to level ${b.level}!`);
  }
  save();
  refreshPanel();
}

function collect(b) {
  const d = BUILDINGS[b.type];
  if (!d.prod || b.level < 1) return;
  const amount = Math.floor(b.stored || 0);
  if (amount < 1) return;
  const got = addRes(d.produces, amount);
  b.stored -= got;
  if (got > 0) {
    floatText(g2w(b.x + d.size / 2, b.y + d.size / 2), `+${fmt(got)} ${d.produces === 'gold' ? '🪙' : '⚗️'}`);
    save();
  } else {
    toast(`${d.produces === 'gold' ? 'Gold' : 'Elixir'} storage is full!`);
  }
}

// ---------- troop training ----------
function trainTroop(type) {
  const t = TROOPS[type];
  if (barracksLevel() < t.unlock) { toast(`Needs Barracks level ${t.unlock}.`); return; }
  if (armyHousing() + queueHousing() + t.housing > campCapacity()) { toast('Army camps are full!'); return; }
  if (state.elixir < t.cost) { toast('Not enough elixir!'); return; }
  state.elixir -= t.cost;
  state.queue.push({ type, remain: t.trainTime });
  save();
  renderArmyModal();
}

function cancelTrain(index) {
  const q = state.queue[index];
  if (!q) return;
  state.queue.splice(index, 1);
  state.elixir = Math.min(state.elixir + TROOPS[q.type].cost, resCap('elixir'));
  save();
  renderArmyModal();
}

// ---------- input ----------
const pointers = new Map();
let dragTotal = 0, pinchDist = 0;

canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) dragTotal = 0;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
  }
});

canvas.addEventListener('pointermove', e => {
  const w = s2w(e.clientX, e.clientY);
  const g = w2g(w.x, w.y);
  hoverCell = { x: g.x, y: g.y };

  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 1) {
    dragTotal += Math.abs(dx) + Math.abs(dy);
    if (dragTotal > 6) { cam.x += dx; cam.y += dy; }
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist > 0) {
      const cxs = (a.x + b.x) / 2, cys = (a.y + b.y) / 2;
      zoomAt(cxs, cys, d / pinchDist);
    }
    pinchDist = d;
  }
});

canvas.addEventListener('pointerup', e => {
  const wasSingle = pointers.size === 1;
  pointers.delete(e.pointerId);
  if (wasSingle && dragTotal <= 6) handleTap(e.clientX, e.clientY, e.button);
});
canvas.addEventListener('pointercancel', e => pointers.delete(e.pointerId));

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive: false });

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (placing) stopPlacing();
  else select(null);
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!$('modalWrap').classList.contains('hidden')) closeModal();
    else if (placing) stopPlacing();
    else select(null);
  }
});

function zoomAt(sx, sy, factor) {
  const before = s2w(sx, sy);
  cam.z = clamp(cam.z * factor, 0.3, 2.4);
  cam.x = sx - before.x * cam.z;
  cam.y = sy - before.y * cam.z;
}

function handleTap(sx, sy, button) {
  if (button === 2) return;
  const w = s2w(sx, sy);
  const g = w2g(w.x, w.y);
  if (Battle.active) { Battle.tap(g); return; }
  if (placing) { tryPlace(g); return; }
  const cx = Math.floor(g.x), cy = Math.floor(g.y);
  const b = state.buildings.find(b => {
    const s = BUILDINGS[b.type].size;
    return cx >= b.x && cx < b.x + s && cy >= b.y && cy < b.y + s;
  });
  select(b || null);
  if (b) collect(b);
}

// ---------- rendering ----------
function render() {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.z, cam.z);

  if (groundCanvas) ctx.drawImage(groundCanvas, GROUND_OX, GROUND_OY);

  if (Battle.active) Battle.render(ctx);
  else renderHome();

  // shared fx
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.ttl * 2, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const f of floaters) {
    ctx.globalAlpha = clamp(f.ttl, 0, 1);
    ctx.font = 'bold 16px Trebuchet MS';
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.txt, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.txt, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function renderHome() {
  const list = [...state.buildings].sort(depthSort);
  for (const b of list) {
    drawBuilding(b, { selected: selected && selected.id === b.id, home: true });
  }
  // placement ghost
  if (placing && hoverCell) {
    const type = placing.move ? placing.move.type : placing.type;
    const d = BUILDINGS[type];
    const a = placeAnchor(hoverCell, d.size);
    const ok = areaFree(a.x, a.y, d.size, placing.move ? placing.move.id : -1);
    const ghost = { type, x: a.x, y: a.y, level: placing.move ? placing.move.level : 1 };
    drawBuilding(ghost, { ghost: true, valid: ok });
  }
}

function depthSort(a, b) {
  const da = a.x + a.y + BUILDINGS[a.type].size;
  const db = b.x + b.y + BUILDINGS[b.type].size;
  return da - db;
}

function diamondPath(gx, gy, w) {
  const p0 = g2w(gx, gy), p1 = g2w(gx + w, gy), p2 = g2w(gx + w, gy + w), p3 = g2w(gx, gy + w);
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
  ctx.closePath();
}

function drawBuilding(b, opts = {}) {
  const d = BUILDINGS[b.type];
  const s = d.size;
  const lvl = Math.max(b.level, b.pending || 0, 1);
  const dead = b.maxHp !== undefined && b.hp <= 0;

  if (opts.ghost) {
    ctx.globalAlpha = 0.4;
    diamondPath(b.x, b.y, s);
    ctx.fillStyle = opts.valid ? '#3dd63d' : '#e03030';
    ctx.fill();
    ctx.globalAlpha = 0.75;
  }

  const p0 = g2w(b.x, b.y), p1 = g2w(b.x + s, b.y), p2 = g2w(b.x + s, b.y + s), p3 = g2w(b.x, b.y + s);
  const c = g2w(b.x + s / 2, b.y + s / 2);

  if (dead) {
    diamondPath(b.x, b.y, s);
    ctx.fillStyle = 'rgba(40,32,26,.6)';
    ctx.fill();
    ctx.font = `${s * 9}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🪨', c.x, c.y + 4);
    ctx.globalAlpha = 1;
    return;
  }

  // base plate
  diamondPath(b.x, b.y, s);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fill();

  const h = d.kind === 'wall' ? 14 : s * 7 + lvl * 2;
  const up = p => ({ x: p.x, y: p.y - h });
  const t0 = up(p0), t1 = up(p1), t2 = up(p2), t3 = up(p3);

  // left face (p3 -> p2)
  ctx.beginPath();
  ctx.moveTo(p3.x, p3.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y);
  ctx.closePath();
  ctx.fillStyle = shade(d.color, -42);
  ctx.fill();
  // right face (p2 -> p1)
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t1.x, t1.y);
  ctx.closePath();
  ctx.fillStyle = shade(d.color, -22);
  ctx.fill();
  // top face
  ctx.beginPath();
  ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y);
  ctx.closePath();
  ctx.fillStyle = d.color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // emoji
  if (d.emoji) {
    ctx.font = `${s * 11}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(d.emoji, c.x, c.y - h + s * 2.5);
  }

  // level pips
  if (lvl > 1 && d.kind !== 'wall') {
    ctx.fillStyle = '#ffd94d';
    for (let i = 0; i < lvl; i++) {
      ctx.beginPath();
      ctx.arc(c.x - (lvl - 1) * 4 + i * 8, p2.y - 5, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // construction overlay
  if (b.pending && !opts.ghost) {
    ctx.font = `${s * 8}px serif`;
    ctx.fillText('🚧', c.x, c.y - h - 6);
    const total = d.time[b.pending - 1] * 1000;
    const frac = total > 0 ? clamp(1 - (b.doneAt - now()) / total, 0, 1) : 1;
    const bw = s * 16;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(c.x - bw / 2, c.y - h - 2, bw, 6);
    ctx.fillStyle = '#63c157';
    ctx.fillRect(c.x - bw / 2, c.y - h - 2, bw * frac, 6);
  }

  // stored-resource bubble
  if (opts.home && d.prod && b.level >= 1 && (b.stored || 0) >= 30) {
    const bob = Math.sin(T * 3 + b.id) * 3;
    ctx.font = '18px serif';
    ctx.fillText(d.produces === 'gold' ? '🪙' : '⚗️', c.x, c.y - h - 16 + bob);
  }

  // battle hp bar
  if (b.maxHp !== undefined && b.hp < b.maxHp && b.hp > 0) {
    const bw = s * 14;
    const frac = b.hp / b.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(c.x - bw / 2, c.y - h - 12, bw, 5);
    ctx.fillStyle = frac > 0.5 ? '#63c157' : (frac > 0.25 ? '#e0b83a' : '#e2574b');
    ctx.fillRect(c.x - bw / 2, c.y - h - 12, bw * frac, 5);
  }

  if (opts.selected) {
    diamondPath(b.x, b.y, s);
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ---------- HUD ----------
function updateHud() {
  $('goldTxt').textContent = fmt(state.gold);
  $('elixTxt').textContent = fmt(state.elixir);
  $('goldBar').style.width = clamp(state.gold / resCap('gold') * 100, 0, 100) + '%';
  $('elixBar').style.width = clamp(state.elixir / resCap('elixir') * 100, 0, 100) + '%';
  $('trophyTxt').textContent = fmt(state.trophies);
  $('armyTxt').textContent = `${armyHousing()}/${campCapacity()}`;
  $('thBadge').textContent = 'TH ' + thLevel();
  if (Battle.active) Battle.updateHud();
}

// ---------- toast ----------
let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.classList.add('hidden'), 350);
  }, 2200);
}

// ---------- modals ----------
let modalKind = null;
function openModal(kind, html) {
  modalKind = kind;
  $('modalBody').innerHTML = html;
  $('modalWrap').classList.remove('hidden');
}
function closeModal() {
  modalKind = null;
  $('modalWrap').classList.add('hidden');
}
$('modalClose').addEventListener('click', () => {
  if (modalKind === 'result') returnHome();
  else closeModal();
});
$('modalWrap').addEventListener('pointerdown', e => {
  if (e.target === $('modalWrap')) {
    if (modalKind === 'result') returnHome();
    else closeModal();
  }
});

// --- shop ---
function renderShopModal() {
  const th = thLevel();
  let cards = '';
  for (const type of SHOP_ORDER) {
    const d = BUILDINGS[type];
    const limit = d.limit[th - 1];
    const have = countType(type);
    const cost = d.cost[0];
    const resIco = d.res === 'gold' ? '🪙' : '⚗️';
    const locked = limit === 0;
    const maxed = !locked && have >= limit;
    const cantAfford = state[d.res] < cost;
    let btn;
    if (locked) {
      const unlockTh = d.limit.findIndex(v => v > 0) + 1;
      btn = `<button class="btn" disabled>🔒 TH ${unlockTh}</button>`;
    } else if (maxed) {
      btn = `<button class="btn" disabled>Max (${have}/${limit})</button>`;
    } else {
      btn = `<button class="btn good" data-shop="${type}" ${cantAfford ? 'disabled' : ''}>${resIco} ${fmt(cost)}</button>`;
    }
    cards += `<div class="card ${locked ? 'locked' : ''}">
      <div class="cHead"><span class="em">${d.emoji || '🧱'}</span>${d.name}<span style="margin-left:auto;font-size:11px;opacity:.7">${have}/${limit}</span></div>
      <div class="cInfo">${d.desc}</div>
      ${btn}
    </div>`;
  }
  openModal('shop', `<h2>🛒 Shop</h2><div class="mSub">Build your village. Higher Town Hall levels unlock more buildings.</div><div class="cardGrid">${cards}</div>`);
  for (const el of $('modalBody').querySelectorAll('[data-shop]')) {
    el.addEventListener('click', () => {
      closeModal();
      startPlacing(el.dataset.shop);
    });
  }
}

// --- army ---
function renderArmyModal() {
  if (modalKind && modalKind !== 'army') return;
  const bLvl = barracksLevel();
  const cap = campCapacity();
  const used = armyHousing() + queueHousing();
  let queue = '';
  state.queue.forEach((q, i) => {
    const t = TROOPS[q.type];
    const frac = i === 0 ? clamp(1 - q.remain / t.trainTime, 0, 1) : 0;
    queue += `<div class="qChip" data-cancel="${i}" title="Tap to cancel (refund)">${t.emoji}<div class="qBar"><i style="width:${frac * 100}%"></i></div></div>`;
  });
  if (!queue) queue = '<span style="opacity:.6;font-size:13px">Training queue is empty.</span>';

  let cards = '';
  for (const type of TROOP_ORDER) {
    const t = TROOPS[type];
    const locked = bLvl < t.unlock;
    const have = state.army[type] || 0;
    const noRoom = used + t.housing > cap;
    let btn;
    if (locked) btn = `<button class="btn" disabled>🔒 Barracks lv ${t.unlock}</button>`;
    else btn = `<button class="btn good" data-train="${type}" ${state.elixir < t.cost || noRoom ? 'disabled' : ''}>⚗️ ${t.cost} · Train</button>`;
    cards += `<div class="card ${locked ? 'locked' : ''}">
      <div class="cHead"><span class="em">${t.emoji}</span>${t.name}<span style="margin-left:auto;font-size:12px;color:#ffd94d">x${have}</span></div>
      <div class="cInfo">${t.desc}<br>❤️ ${t.hp} · ⚔️ ${t.dps || '💥'} dps · 🏠 ${t.housing} · ⏱️ ${t.trainTime}s</div>
      ${btn}
    </div>`;
  }
  openModal('army', `<h2>⚔️ Army</h2>
    <div class="mSub">Camp space: <b>${used}/${cap}</b> (troops + queue). Troops are spent when deployed in battle.</div>
    <div class="queueRow">${queue}</div>
    <div class="cardGrid">${cards}</div>`);
  for (const el of $('modalBody').querySelectorAll('[data-train]')) {
    el.addEventListener('click', () => trainTroop(el.dataset.train));
  }
  for (const el of $('modalBody').querySelectorAll('[data-cancel]')) {
    el.addEventListener('click', () => cancelTrain(+el.dataset.cancel));
  }
}

// --- help ---
function renderHelpModal() {
  openModal('help', `<h2>🏯 Village Wars</h2>
  <div class="mSub">A tiny Clash-of-Clans-style strategy game. Everything is saved in your browser.</div>
  <div style="font-size:14px;line-height:1.7">
    <p><b>🪙 Economy</b> — Gold Mines and Elixir Collectors produce resources over time (even while you're away). Tap them to collect. Storages raise your caps.</p>
    <p><b>🛒 Building</b> — Open the Shop to buy buildings, then tap a green spot to place them. Tap any building to inspect, upgrade or move it. Upgrading your Town Hall unlocks more of everything.</p>
    <p><b>⚔️ Army</b> — Build a Barracks and train troops. Each Barracks level unlocks a new unit. Army Camps limit your army size.</p>
    <p><b>🗺️ Raiding</b> — Hit Attack to raid a procedurally generated enemy village. Pick a troop, then tap the outskirts (outside the red zone) to deploy. Destroy buildings to steal loot; 50% destruction or the Town Hall earns stars and trophies. Deployed troops don't come back — win or lose!</p>
    <p><b>🕹️ Controls</b> — Drag to pan, scroll/pinch to zoom, tap to select. Esc or right-click cancels.</p>
  </div>
  <div class="center" style="margin-top:14px"><button class="btn good" id="helpOk">To battle, chief! 🫡</button></div>`);
  $('helpOk').addEventListener('click', closeModal);
}

// ---------- building panel ----------
function refreshPanel() {
  const panel = $('panel');
  if (!selected || Battle.active) { panel.classList.add('hidden'); return; }
  const b = selected;
  const d = BUILDINGS[b.type];
  const lvl = Math.max(b.level, 1);
  let stats = '';
  if (b.level >= 1) {
    stats += `❤️ HP: <b>${d.hp[lvl - 1]}</b><br>`;
    if (d.prod) stats += `⛏️ Produces: <b>${Math.round(d.prod[lvl - 1] * 60)}</b> ${d.produces}/min<br>📦 Stored: <b>${fmt(b.stored || 0)}</b> / ${fmt(d.capacity[lvl - 1])}<br>`;
    if (d.capAdd) stats += `📦 Adds <b>${fmt(d.capAdd[lvl - 1])}</b> ${d.stores} capacity<br>`;
    if (d.dps) stats += `⚔️ DPS: <b>${d.dps[lvl - 1]}</b> · 🎯 Range: <b>${d.range}</b><br>`;
    if (d.dmg) stats += `💥 ${d.dmg[lvl - 1]} splash dmg / ${d.atk}s · 🎯 Range ${d.rangeMin}–${d.range}<br>`;
    if (d.capacity && b.type === 'armycamp') stats += `🏠 Houses <b>${d.capacity[lvl - 1]}</b> troops<br>`;
    if (b.type === 'barracks') {
      const unlocked = TROOP_ORDER.filter(t => TROOPS[t].unlock <= lvl).map(t => TROOPS[t].emoji).join(' ');
      stats += `🎖️ Unlocked: ${unlocked}<br>`;
    }
    if (d.store) stats += `🛡️ Safeguards ${fmt(d.store[lvl - 1])} of each resource<br>`;
  }
  if (b.pending) stats += `🚧 ${b.level === 0 ? 'Building' : 'Upgrading'}… <b>${fmtTime((b.doneAt - now()) / 1000)}</b> left<br>`;

  let upgradeBtn = '';
  if (!b.pending && b.level >= 1 && b.level < MAX_LEVEL) {
    const cost = d.cost[b.level];
    const gated = b.type !== 'townhall' && b.level > thLevel();
    const resIco = d.res === 'gold' ? '🪙' : '⚗️';
    upgradeBtn = `<button class="btn good" id="pUpgrade" ${gated || state[d.res] < cost ? 'disabled' : ''} title="${gated ? 'Requires higher Town Hall' : ''}">
      ⬆️ Lv ${b.level + 1} · ${resIco} ${fmt(cost)}${gated ? ' 🔒' : ''}</button>`;
  } else if (b.level >= MAX_LEVEL) {
    upgradeBtn = `<button class="btn" disabled>⭐ Max level</button>`;
  }

  panel.innerHTML = `<h3>${d.emoji || '🧱'} ${d.name} <span style="opacity:.7;font-size:13px">· Lv ${b.pending ? b.level + '→' + b.pending : lvl}</span></h3>
    <div class="sub">${d.desc}</div>
    <div class="stats">${stats}</div>
    <div class="row">
      ${upgradeBtn}
      ${d.prod ? '<button class="btn" id="pCollect">📥 Collect</button>' : ''}
      <button class="btn" id="pMove">✋ Move</button>
      <button class="btn" id="pClose">✖</button>
    </div>`;
  panel.classList.remove('hidden');

  const up = $('pUpgrade');
  if (up) up.addEventListener('click', () => startUpgrade(b));
  const col = $('pCollect');
  if (col) col.addEventListener('click', () => { collect(b); refreshPanel(); });
  $('pMove').addEventListener('click', () => startMoving(b));
  $('pClose').addEventListener('click', () => select(null));
}

// ---------- battle <-> home mode switching ----------
function enterBattleUi() {
  $('homebar').classList.add('hidden');
  $('battlebar').classList.remove('hidden');
  $('panel').classList.add('hidden');
  stopPlacing();
  select(null);
}

function returnHome() {
  closeModal();
  Battle.active = false;
  $('battlebar').classList.add('hidden');
  $('homebar').classList.remove('hidden');
  centerCamera();
  save();
}

// ---------- main loop ----------
let lastFrame = performance.now();
function frame(nowMs) {
  const dt = clamp((nowMs - lastFrame) / 1000, 0, 0.1);
  lastFrame = nowMs;
  T += dt;
  if (Battle.active) Battle.update(dt);
  else homeUpdate(dt);
  updateFx(dt);
  render();
  updateHud();
  requestAnimationFrame(frame);
}

// ---------- init ----------
function init() {
  resize();
  buildGround();
  const hadSave = load();
  if (!hadSave) newGame();
  centerCamera();

  $('btnShop').addEventListener('click', renderShopModal);
  $('btnArmy').addEventListener('click', renderArmyModal);
  $('btnHelp').addEventListener('click', renderHelpModal);
  $('btnAttack').addEventListener('click', () => {
    if (armyCount() === 0) { toast('Train some troops first! (⚔️ Army)'); renderArmyModal(); return; }
    Battle.start();
  });
  $('btnCancelPlace').addEventListener('click', stopPlacing);
  $('btnNext').addEventListener('click', () => Battle.next());
  $('btnEndBattle').addEventListener('click', () => Battle.surrender());

  setInterval(() => {
    save();
    if (selected) refreshPanel();
    if (modalKind === 'army') renderArmyModal();
  }, 1000);
  window.addEventListener('beforeunload', save);

  if (!state.seenHelp) {
    state.seenHelp = true;
    renderHelpModal();
    save();
  }
  requestAnimationFrame(frame);
}

window.addEventListener('load', init);

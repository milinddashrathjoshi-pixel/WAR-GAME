'use strict';

// ============================================================
// Battle mode: procedural enemy villages, troop AI (Dijkstra
// pathfinding that treats walls as breakable obstacles),
// defenses, loot and trophies.
// ============================================================

const Battle = {
  active: false,
};

const WALL_PATH_COST = 40; // extra path cost of smashing through a wall

// ---------- tiny binary min-heap ----------
function Heap() { this.a = []; }
Heap.prototype.push = function (k, v) {
  const a = this.a;
  a.push({ k, v });
  let i = a.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (a[p].k <= a[i].k) break;
    const t = a[p]; a[p] = a[i]; a[i] = t;
    i = p;
  }
};
Heap.prototype.pop = function () {
  const a = this.a;
  if (!a.length) return null;
  const top = a[0];
  const last = a.pop();
  if (a.length) {
    a[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < a.length && a[l].k < a[m].k) m = l;
      if (r < a.length && a[r].k < a[m].k) m = r;
      if (m === i) break;
      const t = a[m]; a[m] = a[i]; a[i] = t;
      i = m;
    }
  }
  return top;
};

// ---------- helpers ----------
const bIdx = (x, y) => y * GRID + x;
const inGrid = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID;
const isDefense = b => BUILDINGS[b.type].kind === 'defense';
const isResource = b => BUILDINGS[b.type].kind === 'resource';
const bSize = b => BUILDINGS[b.type].size;

function occAt(x, y) {
  if (!inGrid(x, y)) return null;
  const b = Battle.occ[bIdx(x, y)];
  return b && b.hp > 0 ? b : null;
}

// ---------- battle lifecycle ----------
Battle.start = function () {
  Battle.active = true;
  Battle.started = false;
  Battle.ended = false;
  Battle.time = 180;
  Battle.endDelay = 0;
  Battle.troops = [];
  Battle.shots = [];   // instant tracers {x0,y0,x1,y1,ttl,color} in world coords
  Battle.shells = [];  // mortar shells {sx,sy,tx,ty,t,dur,dmg,splash} in grid coords
  Battle.lootGold = 0;
  Battle.lootElixir = 0;
  Battle.stars = 0;
  Battle.pct = 0;
  Battle.genVillage(thLevel());
  Battle.pickDefaultTroop();
  Battle.buildBar();
  enterBattleUi();
  centerCamera();
  toast(`Raiding ${Battle.name}! Deploy troops on the outskirts.`);
};

Battle.next = function () {
  if (Battle.started || Battle.ended) return;
  Battle.genVillage(thLevel());
  Battle.buildBar();
  toast(`Next target: ${Battle.name}`);
};

Battle.surrender = function () {
  if (Battle.ended) return;
  if (!Battle.started) { returnHome(); return; }
  Battle.finish();
};

// ---------- enemy village generation ----------
Battle.genVillage = function (th) {
  const buildings = [];
  const occ = new Array(GRID * GRID).fill(null);
  let eid = 1;

  const put = (type, level, x, y) => {
    const d = BUILDINGS[type];
    const b = {
      id: 'e' + (eid++), type, level, x, y,
      hp: d.hp[level - 1], maxHp: d.hp[level - 1],
      cd: Math.random() * 0.5,
    };
    buildings.push(b);
    for (let i = x; i < x + d.size; i++)
      for (let j = y; j < y + d.size; j++)
        occ[bIdx(i, j)] = b;
    return b;
  };

  const canPlace = (x, y, s, pad) => {
    if (x < 3 || y < 3 || x + s > GRID - 3 || y + s > GRID - 3) return false;
    for (let i = x - pad; i < x + s + pad; i++)
      for (let j = y - pad; j < y + s + pad; j++)
        if (inGrid(i, j) && occ[bIdx(i, j)]) return false;
    return true;
  };

  const tryPlaceIn = (type, level, x0, y0, x1, y1, pad) => {
    const s = BUILDINGS[type].size;
    for (let att = 0; att < 300; att++) {
      const x = x0 + Math.floor(Math.random() * Math.max(1, x1 - x0 - s + 1));
      const y = y0 + Math.floor(Math.random() * Math.max(1, y1 - y0 - s + 1));
      if (canPlace(x, y, s, pad)) return put(type, level, x, y);
    }
    return null;
  };

  const lvl = () => clamp(th - (Math.random() < 0.4 ? 1 : 0), 1, MAX_LEVEL);

  Battle.occ = occ; // canPlace/put need it live
  // core: town hall dead-center, ring of walls, defenses + storages inside
  put('townhall', th, 18, 18);
  const CORE0 = 13, CORE1 = 27; // interior placement band
  const coreTypes = [];
  for (const type of ['goldstorage', 'elixirstorage', 'cannon', 'archertower', 'mortar']) {
    const n = BUILDINGS[type].limit[th - 1];
    for (let i = 0; i < n; i++) coreTypes.push(type);
  }
  for (const type of coreTypes) {
    tryPlaceIn(type, lvl(), CORE0, CORE0, CORE1 + 1, CORE1 + 1, 0)
      || tryPlaceIn(type, lvl(), 4, 4, GRID - 4, GRID - 4, 1);
  }

  // wall ring on the boundary of [12..28]
  const ring = [];
  const R0 = 12, R1 = 28;
  for (let x = R0; x <= R1; x++) ring.push([x, R0]);
  for (let y = R0 + 1; y <= R1; y++) ring.push([R1, y]);
  for (let x = R1 - 1; x >= R0; x--) ring.push([x, R1]);
  for (let y = R1 - 1; y > R0; y--) ring.push([R0, y]);
  let walls = Math.min(BUILDINGS.wall.limit[th - 1], ring.length);
  const startAt = Math.floor(Math.random() * ring.length);
  const wLvl = lvl();
  for (let i = 0; i < ring.length && walls > 0; i++) {
    const [x, y] = ring[(startAt + i) % ring.length];
    if (!occ[bIdx(x, y)]) { put('wall', wLvl, x, y); walls--; }
  }

  // outskirts: economy & army buildings
  const outer = [];
  for (const type of ['goldmine', 'elixirpump', 'barracks', 'armycamp']) {
    const n = Math.min(BUILDINGS[type].limit[th - 1], 4);
    for (let i = 0; i < n; i++) outer.push(type);
  }
  for (const type of outer) {
    // keep trying random spots outside the wall ring
    const s = BUILDINGS[type].size;
    let placed = null;
    for (let att = 0; att < 400 && !placed; att++) {
      const x = 3 + Math.floor(Math.random() * (GRID - 6 - s));
      const y = 3 + Math.floor(Math.random() * (GRID - 6 - s));
      const insideRing = x + s > R0 - 1 && x <= R1 + 1 && y + s > R0 - 1 && y <= R1 + 1;
      if (insideRing) continue;
      if (canPlace(x, y, s, 1)) placed = put(type, lvl(), x, y);
    }
  }

  // distribute loot among resource holders
  const totGold = Math.round(250 * th * th + Math.random() * 150 * th);
  const totElix = Math.round(250 * th * th + Math.random() * 150 * th);
  const gH = [], eH = [];
  for (const b of buildings) {
    if (b.type === 'townhall') { gH.push([b, 3]); eH.push([b, 3]); }
    else if (b.type === 'goldstorage') gH.push([b, 2]);
    else if (b.type === 'goldmine') gH.push([b, 1]);
    else if (b.type === 'elixirstorage') eH.push([b, 2]);
    else if (b.type === 'elixirpump') eH.push([b, 1]);
    b.loot = { gold: 0, elixir: 0 };
  }
  const spread = (holders, total, key) => {
    const wSum = holders.reduce((s, [, w]) => s + w, 0) || 1;
    for (const [b, w] of holders) b.loot[key] = Math.round(total * w / wSum);
  };
  spread(gH, totGold, 'gold');
  spread(eH, totElix, 'elixir');

  Battle.enemy = buildings;
  Battle.name = ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)];
  Battle.totalTargets = buildings.filter(b => b.type !== 'wall').length;
  Battle.buildBlockedMap();
};

Battle.buildBlockedMap = function () {
  const blocked = new Uint8Array(GRID * GRID);
  for (const b of Battle.enemy) {
    const s = bSize(b);
    for (let i = b.x - 1; i < b.x + s + 1; i++)
      for (let j = b.y - 1; j < b.y + s + 1; j++)
        if (inGrid(i, j)) blocked[bIdx(i, j)] = 1;
  }
  Battle.blocked = blocked;

  // pre-render the red no-deploy overlay
  const cv = document.createElement('canvas');
  cv.width = GRID * TILE_W * 2;
  cv.height = GRID * TILE_H * 2;
  const g = cv.getContext('2d');
  g.translate(GRID * TILE_W, 0);
  g.fillStyle = 'rgba(230,60,50,.22)';
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      if (!blocked[bIdx(x, y)]) continue;
      const p0 = g2w(x, y), p1 = g2w(x + 1, y), p2 = g2w(x + 1, y + 1), p3 = g2w(x, y + 1);
      g.beginPath();
      g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y);
      g.closePath();
      g.fill();
    }
  }
  Battle.overlay = cv;
};

// ---------- deployment ----------
Battle.troopSel = null;

Battle.pickDefaultTroop = function () {
  Battle.troopSel = TROOP_ORDER.find(t => (state.army[t] || 0) > 0) || null;
};

Battle.tap = function (g) {
  if (Battle.ended) return;
  const x = Math.floor(g.x), y = Math.floor(g.y);
  if (!inGrid(x, y)) return;
  const sel = Battle.troopSel;
  if (!sel || (state.army[sel] || 0) <= 0) { toast('No troops left to deploy!'); return; }
  if (Battle.blocked[bIdx(x, y)]) { toast('Too close to the village — deploy on the outskirts!'); return; }
  state.army[sel]--;
  const d = TROOPS[sel];
  Battle.troops.push({
    type: sel, def: d,
    x: g.x, y: g.y,
    hp: d.hp, maxHp: d.hp,
    target: null, obstacle: null, path: null, pi: 0,
    attacking: false,
  });
  if (!Battle.started) {
    Battle.started = true;
    $('btnNext').classList.add('hidden');
  }
  if ((state.army[sel] || 0) <= 0) Battle.pickDefaultTroop();
  save();
};

// ---------- pathfinding ----------
// Dijkstra over the tile grid. Walls are passable at a heavy cost
// (troops will smash through if the detour is long); other buildings block.
Battle.findPath = function (sx, sy, goalMask) {
  const N = GRID * GRID;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const start = bIdx(clamp(sx, 0, GRID - 1), clamp(sy, 0, GRID - 1));
  dist[start] = 0;
  const heap = new Heap();
  heap.push(0, start);

  const cellCost = (x, y) => {
    const b = occAt(x, y);
    if (!b) return 1;
    if (b.type === 'wall') return 1 + WALL_PATH_COST;
    return -1; // solid building
  };

  let goal = -1;
  while (true) {
    const top = heap.pop();
    if (!top) break;
    const u = top.v;
    if (top.k > dist[u]) continue;
    if (goalMask[u]) { goal = u; break; }
    const ux = u % GRID, uy = (u / GRID) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = ux + dx, ny = uy + dy;
        if (!inGrid(nx, ny)) continue;
        const c = cellCost(nx, ny);
        if (c < 0) continue;
        if (dx && dy) {
          // no corner-cutting through solid buildings
          const c1 = cellCost(ux + dx, uy), c2 = cellCost(ux, uy + dy);
          if (c1 < 0 || c2 < 0) continue;
        }
        const nd = dist[u] + c * (dx && dy ? 1.41 : 1);
        const v = bIdx(nx, ny);
        if (nd < dist[v]) {
          dist[v] = nd;
          prev[v] = u;
          heap.push(nd, v);
        }
      }
    }
  }
  if (goal < 0) return null;
  const path = [];
  let u = goal;
  while (u !== start && u >= 0) {
    path.push({ x: (u % GRID) + 0.5, y: ((u / GRID) | 0) + 0.5 });
    u = prev[u];
  }
  path.reverse();
  return path;
};

Battle.goalMaskFor = function (target, range) {
  const mask = new Uint8Array(GRID * GRID);
  const s = bSize(target);
  const r = Math.max(range, 0.8) + 0.05;
  const pad = Math.ceil(r) + 1;
  let any = false;
  for (let x = target.x - pad; x < target.x + s + pad; x++) {
    for (let y = target.y - pad; y < target.y + s + pad; y++) {
      if (!inGrid(x, y)) continue;
      if (distRect(x + 0.5, y + 0.5, target.x, target.y, s) > r) continue;
      const o = occAt(x, y);
      if (o && o !== target && o.type !== 'wall') continue;
      if (o && o === target && target.type !== 'wall') continue;
      mask[bIdx(x, y)] = 1;
      any = true;
    }
  }
  return any ? mask : null;
};

// ---------- troop AI ----------
function acquireTarget(t) {
  const alive = Battle.enemy.filter(b => b.hp > 0 && b.type !== 'wall');
  let pool = alive;
  if (t.def.pref === 'defense') {
    const de = alive.filter(isDefense);
    if (de.length) pool = de;
  } else if (t.def.pref === 'resource') {
    const re = alive.filter(isResource);
    if (re.length) pool = re;
  } else if (t.def.pref === 'wall') {
    const w = Battle.enemy.filter(b => b.hp > 0 && b.type === 'wall');
    if (w.length) pool = w;
  }
  if (!pool.length) { t.target = null; return; }
  let best = null, bd = Infinity;
  for (const b of pool) {
    const d = distRect(t.x, t.y, b.x, b.y, bSize(b));
    if (d < bd) { bd = d; best = b; }
  }
  t.target = best;
  t.path = null;
  t.pi = 0;
}

function nearestWall(t) {
  let best = null, bd = Infinity;
  for (const b of Battle.enemy) {
    if (b.hp <= 0 || b.type !== 'wall') continue;
    const d = distRect(t.x, t.y, b.x, b.y, 1);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function explodeWallbreaker(t) {
  t.hp = 0;
  const w = g2w(t.x, t.y);
  boom(w, 18, '#ffb648');
  for (const b of Battle.enemy) {
    if (b.hp <= 0) continue;
    const d = distRect(t.x, t.y, b.x, b.y, bSize(b));
    if (d <= t.def.splash) {
      damageBuilding(b, b.type === 'wall' ? t.def.blast : t.def.blast * 0.1);
    }
  }
}

function damageBuilding(b, dmg) {
  if (b.hp <= 0) return;
  b.hp -= dmg;
  if (b.hp <= 0) destroyBuilding(b);
}

function destroyBuilding(b) {
  b.hp = 0;
  const s = bSize(b);
  for (let i = b.x; i < b.x + s; i++)
    for (let j = b.y; j < b.y + s; j++)
      if (Battle.occ[bIdx(i, j)] === b) Battle.occ[bIdx(i, j)] = null;
  const c = g2w(b.x + s / 2, b.y + s / 2);
  boom(c, b.type === 'wall' ? 6 : 16);
  if (b.loot && (b.loot.gold || b.loot.elixir)) {
    const g = addRes('gold', b.loot.gold);
    const e = addRes('elixir', b.loot.elixir);
    Battle.lootGold += g;
    Battle.lootElixir += e;
    if (g > 0) floatText(c, `+${fmt(g)} 🪙`);
    if (e > 0) floatText({ x: c.x, y: c.y + 18 }, `+${fmt(e)} ⚗️`, '#e2a9ff');
  }
  // repath everyone — the map changed
  for (const t of Battle.troops) { t.path = null; t.pi = 0; }
  // score
  if (b.type !== 'wall') {
    const destroyed = Battle.enemy.filter(x => x.hp <= 0 && x.type !== 'wall').length;
    Battle.pct = Math.round(destroyed / Battle.totalTargets * 100);
    let stars = 0;
    if (Battle.enemy.some(x => x.type === 'townhall' && x.hp <= 0)) stars++;
    if (Battle.pct >= 50) stars++;
    if (Battle.pct >= 100) stars++;
    if (stars > Battle.stars) Battle.stars = stars;
  }
}

function updateTroop(t, dt) {
  if (t.hp <= 0) return;
  t.attacking = false;

  if (t.obstacle && t.obstacle.hp <= 0) t.obstacle = null;
  if (!t.target || t.target.hp <= 0) {
    acquireTarget(t);
    if (!t.target && !t.obstacle) return; // nothing left to do
  }

  const focus = t.obstacle || t.target;
  if (!focus) return;
  const range = Math.max(t.def.range, 0.8);
  const d = distRect(t.x, t.y, focus.x, focus.y, bSize(focus));

  if (d <= range) {
    if (t.def.blast) { explodeWallbreaker(t); return; }
    t.attacking = true;
    t.attackAt = focus;
    damageBuilding(focus, t.def.dps * dt);
    if (focus.hp <= 0) {
      if (focus === t.target) t.target = null;
      t.obstacle = null;
    }
    return;
  }

  // approach
  if (t.obstacle) {
    moveToward(t, t.obstacle.x + 0.5, t.obstacle.y + 0.5, dt);
    return;
  }
  if (!t.path || t.pi >= t.path.length) {
    const mask = Battle.goalMaskFor(t.target, t.def.range);
    t.path = mask ? Battle.findPath(Math.floor(t.x), Math.floor(t.y), mask) : null;
    t.pi = 0;
    if (!t.path) {
      // boxed in — smash the nearest wall instead
      const w = nearestWall(t);
      if (w) t.obstacle = w;
      else t.target = null;
      return;
    }
  }
  const wp = t.path[t.pi];
  if (!wp) return;
  const cellB = occAt(Math.floor(wp.x), Math.floor(wp.y));
  if (cellB && cellB.type === 'wall' && cellB !== t.target) {
    t.obstacle = cellB;
    return;
  }
  if (moveToward(t, wp.x, wp.y, dt)) t.pi++;
}

function moveToward(t, tx, ty, dt) {
  const dx = tx - t.x, dy = ty - t.y;
  const m = Math.hypot(dx, dy);
  const step = t.def.speed * dt;
  if (m <= step) { t.x = tx; t.y = ty; return true; }
  t.x += dx / m * step;
  t.y += dy / m * step;
  return false;
}

// ---------- defenses ----------
function updateDefenses(dt) {
  for (const b of Battle.enemy) {
    if (b.hp <= 0 || !isDefense(b)) continue;
    const d = BUILDINGS[b.type];
    b.cd -= dt;
    if (b.cd > 0) continue;
    const s = d.size;
    const cx = b.x + s / 2, cy = b.y + s / 2;
    let best = null, bd = Infinity;
    for (const t of Battle.troops) {
      if (t.hp <= 0) continue;
      const dd = Math.hypot(t.x - cx, t.y - cy);
      if (dd > d.range) continue;
      if (d.rangeMin && dd < d.rangeMin) continue;
      if (dd < bd) { bd = dd; best = t; }
    }
    if (!best) { b.cd = 0.15; continue; }
    if (d.splash) {
      Battle.shells.push({
        sx: cx, sy: cy, tx: best.x, ty: best.y,
        t: 0, dur: 1.1, dmg: d.dmg[b.level - 1], splash: d.splash,
      });
    } else {
      const dmg = d.dps[b.level - 1] * d.atk;
      damageTroop(best, dmg);
      const a = g2w(cx, cy), bb = g2w(best.x, best.y);
      Battle.shots.push({
        x0: a.x, y0: a.y - s * 9, x1: bb.x, y1: bb.y - 8,
        ttl: 0.12, color: b.type === 'cannon' ? '#ffb648' : '#d18cff',
      });
    }
    b.cd = d.atk;
  }
}

function damageTroop(t, dmg) {
  if (t.hp <= 0) return;
  t.hp -= dmg;
  if (t.hp <= 0) boom(g2w(t.x, t.y), 8, '#c0c0c0');
}

function updateShells(dt) {
  for (let i = Battle.shells.length - 1; i >= 0; i--) {
    const sh = Battle.shells[i];
    sh.t += dt;
    if (sh.t < sh.dur) continue;
    Battle.shells.splice(i, 1);
    boom(g2w(sh.tx, sh.ty), 12, '#ff8438');
    for (const t of Battle.troops) {
      if (t.hp <= 0) continue;
      if (Math.hypot(t.x - sh.tx, t.y - sh.ty) <= sh.splash) damageTroop(t, sh.dmg);
    }
  }
}

// ---------- update ----------
Battle.update = function (dt) {
  if (Battle.ended) return;
  if (Battle.started) {
    Battle.time -= dt;
    if (Battle.time <= 0) { Battle.time = 0; Battle.finish(); return; }
  }
  for (const t of Battle.troops) updateTroop(t, dt);
  Battle.troops = Battle.troops.filter(t => t.hp > 0);
  updateDefenses(dt);
  updateShells(dt);
  for (let i = Battle.shots.length - 1; i >= 0; i--) {
    Battle.shots[i].ttl -= dt;
    if (Battle.shots[i].ttl <= 0) Battle.shots.splice(i, 1);
  }

  if (Battle.pct >= 100) { Battle.finish(); return; }
  const anyToDeploy = TROOP_ORDER.some(t => (state.army[t] || 0) > 0);
  if (Battle.started && !Battle.troops.length && !anyToDeploy) {
    Battle.endDelay += dt;
    if (Battle.endDelay > 1.4) Battle.finish();
  } else {
    Battle.endDelay = 0;
  }
};

Battle.finish = function () {
  if (Battle.ended) return;
  Battle.ended = true;
  const win = Battle.stars > 0;
  let delta = 0;
  if (Battle.started) {
    delta = win ? 10 + Battle.stars * 6 : -12;
    state.trophies = Math.max(0, state.trophies + delta);
  }
  save();

  const starStr = '★'.repeat(Battle.stars) + '☆'.repeat(3 - Battle.stars);
  openModal('result', `<h2 class="center">${win ? '🎉 Victory!' : '💀 Defeat'}</h2>
    <div class="mSub center">Raid on ${Battle.name}</div>
    <div class="starsBig">${starStr}</div>
    <div class="resultLine">Destruction: <b>${Battle.pct}%</b></div>
    <div class="resultLine">Loot: <b>+${fmt(Battle.lootGold)}</b> 🪙 &nbsp; <b>+${fmt(Battle.lootElixir)}</b> ⚗️</div>
    <div class="resultLine">Trophies: <b>${delta >= 0 ? '+' : ''}${delta}</b> 🏆</div>
    <div class="center" style="margin-top:16px"><button class="btn good" id="resultHome">🏠 Return home</button></div>`);
  $('resultHome').addEventListener('click', returnHome);
};

// ---------- battle UI ----------
Battle.buildBar = function () {
  const wrap = $('troopChips');
  wrap.innerHTML = '';
  for (const type of TROOP_ORDER) {
    if ((state.army[type] || 0) <= 0) continue;
    const t = TROOPS[type];
    const btn = document.createElement('button');
    btn.className = 'chip' + (Battle.troopSel === type ? ' sel' : '');
    btn.dataset.chip = type;
    btn.innerHTML = `<span class="cico">${t.emoji}</span><span class="cnt">${state.army[type]}</span>`;
    btn.addEventListener('click', () => {
      Battle.troopSel = type;
      for (const el of wrap.querySelectorAll('.chip')) el.classList.toggle('sel', el.dataset.chip === type);
    });
    wrap.appendChild(btn);
  }
  $('btnNext').classList.toggle('hidden', Battle.started);
};

Battle.updateHud = function () {
  const m = Math.floor(Battle.time / 60), s = Math.floor(Battle.time % 60);
  $('bTimer').textContent = `${m}:${String(s).padStart(2, '0')}`;
  $('bPct').textContent = Battle.pct + '%';
  $('bStars').textContent = '★'.repeat(Battle.stars) + '☆'.repeat(3 - Battle.stars);
  $('bLoot').textContent = `+${fmt(Battle.lootGold)}🪙 +${fmt(Battle.lootElixir)}⚗️`;
  for (const el of $('troopChips').querySelectorAll('.chip')) {
    const type = el.dataset.chip;
    const n = state.army[type] || 0;
    el.querySelector('.cnt').textContent = n;
    el.disabled = n <= 0;
    el.classList.toggle('sel', Battle.troopSel === type && n > 0);
  }
};

// ---------- battle rendering (called inside world transform) ----------
Battle.render = function (c) {
  // no-deploy overlay while units remain to be placed
  const anyToDeploy = TROOP_ORDER.some(t => (state.army[t] || 0) > 0);
  if (!Battle.ended && anyToDeploy && Battle.overlay) {
    c.globalAlpha = 0.8;
    c.drawImage(Battle.overlay, -GRID * TILE_W, 0);
    c.globalAlpha = 1;
  }

  // buildings + troops in depth order
  const ents = [];
  for (const b of Battle.enemy) ents.push({ d: b.x + b.y + bSize(b), b });
  for (const t of Battle.troops) ents.push({ d: t.x + t.y, t });
  ents.sort((a, b) => a.d - b.d);
  for (const e of ents) {
    if (e.b) drawBuilding(e.b, {});
    else drawTroop(c, e.t);
  }

  // tracer shots
  for (const s of Battle.shots) {
    c.globalAlpha = clamp(s.ttl * 8, 0, 1);
    c.strokeStyle = s.color;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(s.x0, s.y0);
    c.lineTo(s.x1, s.y1);
    c.stroke();
  }
  c.globalAlpha = 1;

  // mortar shells (arcing)
  for (const sh of Battle.shells) {
    const f = clamp(sh.t / sh.dur, 0, 1);
    const a = g2w(sh.sx, sh.sy), b = g2w(sh.tx, sh.ty);
    const x = a.x + (b.x - a.x) * f;
    const y = a.y + (b.y - a.y) * f - Math.sin(f * Math.PI) * 90 - 20;
    c.fillStyle = '#2a2a2a';
    c.beginPath();
    c.arc(x, y, 5, 0, Math.PI * 2);
    c.fill();
  }

  // battle name banner
  c.font = 'bold 20px Trebuchet MS';
  c.textAlign = 'center';
  const banner = { x: 0, y: -36 }; // above the top corner of the iso diamond
  c.strokeStyle = 'rgba(0,0,0,.7)';
  c.lineWidth = 4;
  c.strokeText(`⚔️ ${Battle.name}`, banner.x, banner.y);
  c.fillStyle = '#fff';
  c.fillText(`⚔️ ${Battle.name}`, banner.x, banner.y);
};

function drawTroop(c, t) {
  const w = g2w(t.x, t.y);
  // shadow
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.beginPath();
  c.ellipse(w.x, w.y, 8, 4, 0, 0, Math.PI * 2);
  c.fill();
  // body
  const bounce = t.attacking ? Math.abs(Math.sin(T * 14)) * 3 : 0;
  c.font = '20px serif';
  c.textAlign = 'center';
  c.fillText(t.def.emoji, w.x, w.y - 6 - bounce);
  // hp bar
  if (t.hp < t.maxHp) {
    const frac = clamp(t.hp / t.maxHp, 0, 1);
    c.fillStyle = 'rgba(0,0,0,.6)';
    c.fillRect(w.x - 10, w.y - 30, 20, 3.5);
    c.fillStyle = frac > 0.5 ? '#63c157' : (frac > 0.25 ? '#e0b83a' : '#e2574b');
    c.fillRect(w.x - 10, w.y - 30, 20 * frac, 3.5);
  }
}

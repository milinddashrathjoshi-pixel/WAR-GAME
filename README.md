# ⚔️ Village Wars

A Clash-of-Clans-style base-building and raiding game that runs entirely in the
browser — no build step, no dependencies, no server. Pure HTML5 canvas + vanilla JS.

## ▶️ Play

Open `index.html` in any modern browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Progress is saved automatically in your browser (`localStorage`), including
resource production while you're away (up to 8 hours).

## 🏯 Features

- **Isometric village** on a 40×40 tile grid — drag to pan, scroll/pinch to zoom
- **Economy** — Gold Mines and Elixir Collectors produce over time; tap to
  collect; Storages raise your caps
- **Building & upgrading** — 11 building types with 5 levels each, gated by
  your Town Hall level, with real construction timers
- **Defenses** — Cannons, Archer Towers and splash-damage Mortars (with a
  blind spot, just like the real thing)
- **Walls** — chain-place rings of walls to slow attackers down
- **Army** — train Barbarians, Archers, Goblins, Giants and Wall Breakers in
  the Barracks; Army Camps cap your army size
- **Raiding** — attack procedurally generated enemy villages scaled to your
  Town Hall level. Deploy troops on the outskirts, steal loot as buildings
  fall, earn up to ★★★ and trophies
- **Troop AI** — Dijkstra pathfinding that smashes through walls when the
  detour is too long; Giants hunt defenses, Goblins raid resources, Wall
  Breakers charge the nearest wall

## 🕹️ Controls

| Action | Input |
| --- | --- |
| Pan | drag |
| Zoom | mouse wheel / pinch |
| Select / collect / deploy | tap or click |
| Cancel placement or selection | right-click or `Esc` |

## 📁 Project layout

```
index.html      – page shell & HUD markup
css/style.css   – all UI styling
js/data.js      – building/troop stats & balancing tables
js/game.js      – engine: camera, rendering, save state, home village, UI
js/battle.js    – raids: enemy generation, troop AI, pathfinding, defenses
```

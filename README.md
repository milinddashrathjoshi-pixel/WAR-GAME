# War Ops: Global Conquest

A mobile military strategy game (Clash of Clans-style) built in **Godot 4.x**.
Top-down 2D, base-building, resource economy, troops, and an upcoming "Jugaad"
low-cost tech tree.

> Status: **MVP — Phase 3 (Combat & Victory)** complete. Full core loop playable.

## Phase 1 — Base Building & Economy

- Orthogonal grid placement system with footprint occupancy + collision checks.
- Tap-to-select / drag-ghost placement for two buildings: **Command Center** &
  **Barracks** (green = valid, red = blocked/unaffordable).
- Continuous **Credits** generator (`Economy` autoload).
- Minimal HUD: live credits readout + build/cancel buttons.

## Phase 2 — Troop Spawning & Pathfinding

- A pre-placed **Enemy Command Center** spawned by the `Level` coordinator.
- **Tap the Barracks** to spawn an **Infantry** unit.
- **AStar2D pathfinding** built from the grid occupancy: units route *around*
  buildings to a free cell beside the enemy and walk the waypoints.
- Reaching the target stops the unit beside it and transitions to combat.

## Phase 3 — Combat & Victory

- Infantry auto-attacks the enemy building once in range (25 dmg / 0.7s).
- `Building.take_damage` emits `hp_changed` and `destroyed` signals.
- Live HP bar above the enemy Command Center (red → green gradient).
- Enemy CC destroyed → `Level` emits `victory_triggered` → HUD shows a
  **VICTORY!** overlay with a **Play Again** button (reloads the scene).

## Run

Open the project folder in **Godot 4.4+** and press Play (main scene is
`scenes/main/main.tscn`). Touch input is mouse-emulated, so it works on desktop
and device with the same code.

## Project layout

```
autoload/   Economy singleton (Credits)
data/       BuildingData .tres definitions (add buildings without code)
scenes/     main / buildings / ui scenes
scripts/    grid / buildings / ui logic
assets/     AI-generated placeholder art (modular, swap freely)
```

## Roadmap (not yet implemented)

- Jugaad tech tree (low-cost unconventional early defenses).
- Multiple unit types, defensive towers, enemy AI attacks.
- Jets, navies, global conquest map.

## Assets

All 2D art is generated locally (Stable Diffusion / ComfyUI) and dropped into
`assets/`. Current visuals are solid-color placeholders sharing `icon.svg` —
replace per category without touching game logic.

# War Ops: Global Conquest

A mobile military strategy game (Clash of Clans-style) built in **Godot 4.x**.
Top-down 2D, base-building, resource economy, troops, and an upcoming "Jugaad"
low-cost tech tree.

> Status: **MVP — Phase 1 (Base Building & Economy)** complete.

## Phase 1 (this build)

- Orthogonal grid placement system with footprint occupancy + collision checks.
- Tap-to-select / drag-ghost placement for two buildings: **Command Center** &
  **Barracks** (green = valid, red = blocked/unaffordable).
- Continuous **Credits** generator (`Economy` autoload).
- Minimal HUD: live credits readout + build/cancel buttons.

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

- **Phase 2** — Infantry spawn from Barracks + NavigationRegion2D/AStar2D
  pathfinding toward an enemy building.
- **Phase 3** — auto-attack range loop, building HP depletion, Victory state.
- Jugaad tech tree, jets/navies, global conquest map.

## Assets

All 2D art is generated locally (Stable Diffusion / ComfyUI) and dropped into
`assets/`. Current visuals are solid-color placeholders sharing `icon.svg` —
replace per category without touching game logic.

---
name: verify
description: Verify Village Wars changes by driving the game in a headless browser — load, build, train, raid — and capturing screenshots + console errors.
---

# Verifying Village Wars

Zero-build static site. Surface = the browser canvas + HTML HUD.

## Launch

```bash
python3 -m http.server 8377 &          # serve repo root
npm install playwright-core            # in a scratch dir
```

Launch Chromium via playwright-core with
`executablePath: '/opt/pw-browsers/chromium'` and `--no-sandbox`
(don't `playwright install` — the browser is pre-provisioned).

## Drive

Attach `page.on('pageerror')` + console-error listeners — the game has no
build step, so runtime errors are the only failure signal.

Useful handles (all globals, loaded from `js/*.js`):

- `state` — save state (gold, elixir, buildings, army, queue, trophies)
- `Battle` — battle state (`active`, `pct`, `stars`, `troops`, `enemy`, `name`)
- Click a grid tile from Playwright:
  ```js
  const pt = await page.evaluate(([x, y]) => {
    const w = g2w(x, y);
    return { x: w.x * cam.z + cam.x, y: w.y * cam.z + cam.y };
  }, [gx, gy]);
  await page.mouse.click(pt.x, pt.y);
  ```

Flows worth driving: close help modal (`#helpOk`, first run only) → tap the
gold mine (grid ~14.5, 20.5) to collect/select → `#pUpgrade` → Shop
(`#btnShop`, `[data-shop=...]`) and place on an empty tile → Army
(`#btnArmy`, `[data-train=...]`) → seed an army fast with
`state.army = { barbarian: 10, ... }` → `#btnAttack` → deploy on outskirt
tiles (edge rows are never in the red zone) → wait for `Battle.ended`
(a full raid takes 1–3 real minutes; there is no time-scale hook)
→ `#resultHome`.

## Gotchas

- A fresh browser profile = a fresh game; do NOT `localStorage.clear()` +
  reload to reset — the `beforeunload` save handler rewrites the save first.
- Deploy clicks inside the red zone are silently rejected (toast only);
  count `Battle.troops.length` to confirm deployment.
- Trees/decor are seeded, but enemy villages are `Math.random()` — assert on
  invariants (pct climbs, loot > 0), not exact layouts.

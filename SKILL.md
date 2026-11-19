---
name: sweet-blast
description: A faceted jewel match-3 puzzle (Gem Cascade) for HTML5 Canvas, with cascading combos, line-clearer and bomb specials, 12 levels, and a PWA shell.
---

# Gem Cascade

## What this skill gives the model

After reading this skill, the model understands:
- the genre and core loop of Gem Cascade (a jewel-themed match-3 puzzle)
- the exact mechanics (board, swap, matches, specials, cascades, scoring, levels, win/lose)
- the controls (touch + keyboard + mouse, all three fully supported)
- the PWA structure required (manifest, service worker, icons)
- the file layout and how to deploy on GitHub Pages

## Game design

Gem Cascade is an 8×8 match-3 puzzle with a jewel/gem identity. Six gem types fill the board, each drawn as a distinct faceted polygon: Ruby (red hexagon), Sapphire (blue diamond), Emerald (green octagon), Topaz (yellow triangle), Amethyst (purple pentagon), and Pearl (white circle). Every gem is rendered with canvas primitives only — a dark outline, a primary-color facet body, internal facet cuts from the center to each vertex, a top-left highlight facet, and a sparkle dot. No external images are used.

The objective is to clear 12 levels, each with a target score and a move limit. The player swaps two adjacent gems; if the swap forms a row or column of three or more matching gems, those gems clear, gems above fall, new gems spawn at the top, and any new matches formed by the fall cascade automatically — each cascade in a single move raises the combo multiplier (×1, ×2, ×3, …).

Matching four gems in a line spawns a "line clearer" special that clears an entire row or column (the direction is chosen randomly at creation and shown by an arrow on the gem). Matching five gems in an L/T shape (or five in a straight line) spawns a "bomb" special that clears a 3×3 area, drawn with a pulsing amber ring and a white star burst. Detonating a special — either by including it in a match or by swapping it — triggers its effect, which can chain into other specials caught in the blast.

The visual identity is dark slate: a rounded board panel with a faint cell grid and a sapphire-blue inner border glow. A selected gem wears a pulsing gold ring with the four adjacent cells pulsed as a swap hint; the keyboard cursor is a gold rounded outline. Cleared gems emit a burst of small colored particles. The board is sized in multiples of 8 cells and centered responsively, so it fits a 375px phone portrait up to a desktop.

## Mechanics in detail

- **Board**: 8 columns × 8 rows, 6 gem types. Initialization fills cell-by-cell, forbidding any type that would complete a 3-run with the two cells to the left or the two cells above; the board is re-rolled until it has zero pre-existing matches and at least one valid move.
- **Swap**: click/tap a gem then an adjacent gem, swipe a gem in a cardinal direction, or use the keyboard cursor + Enter/Space. Two non-special gems swap only if the result forms a match; otherwise they swap back and no move is consumed. Swapping any special gem is always valid and detonates it.
- **Match detection**: horizontal and vertical runs of ≥3 of the same type are merged into connected clusters of shared type. Per cluster: total cells, max run length, and whether both axes are present.
- **Special creation**: a cluster with a 4-in-a-row spawns a line clearer (random H/V). A cluster with a 5+ straight run, or an L/T (both axes present and ≥5 total cells), spawns a bomb. The spawn cell is the cluster cell nearest the cluster centroid; that gem survives the clear and is transformed into the special.
- **Scoring**: base points per cluster by size — 3→30, 4→40, 5+→60 — times the current combo multiplier. Special detonation bonuses (line clearer +50, bomb +80) are also multiplied by the combo. A cascade's total is `(Σ cluster bases + Σ special bonuses) × combo`. The combo starts at ×1 for the swap's own match and increments each cascade.
- **Gravity & refill**: cleared cells become null; each column compacts downward, then empty top cells are filled with brand-new random gems whose visual start position is above the board, so they fall in. Fall duration scales with the longest fall distance.
- **Cascade loop**: after a clear + gravity, the board is re-checked for matches; if any exist, combo increments and another clear/fall runs; the loop terminates when no matches remain (verified against infinite loops).
- **Deadlock**: if after a move resolves there are no valid swaps, the board reshuffles its gem types until it has no matches and at least one move.
- **Levels**: 12 levels with target score and move limit (Level 1: 500 in 15 moves → Level 12: 8000 in 25 moves). Reach the target before moves run out to clear the level; running out of moves below target fails the level (retry or open the level map).
- **Persistence**: `localStorage["gemCascade.progress"]` stores `{ unlockedLevel, bestScores:[] }`. Best score per level and the highest unlocked level are saved on every level completion.
- **Win**: clearing all 12 levels shows a victory screen with the total score across the run.
- **HUD**: level number + target (top-left), animated score with a target progress bar (top-center), moves left and pause button (top-right). A combo callout appears briefly on cascades of ×2 or higher.

## Controls

- **Touch**: tap a gem then tap an adjacent gem to swap; or swipe a gem toward a neighbor. Pinch/scroll is suppressed on the canvas. Works at 375px portrait with no horizontal overflow.
- **Keyboard**: arrow keys (or WASD) move a gold cursor; Enter/Space selects the cursor cell, then arrow to an adjacent cell + Enter/Space swaps. Escape pauses. Enter/Space advances start / level-complete / failed / victory screens.
- **Mouse**: click a gem then click an adjacent gem to swap. Click the selected gem to deselect; click a non-adjacent gem to reselect.

## File layout

- `index.html` — entry point; HUD + canvas + screen overlays; registers `sw.js`; links `styles.css` and `main.js`.
- `styles.css` — all styling, responsive (clamp, flex/grid, 100dvh, safe-area insets), no fixed root width.
- `main.js` — the whole game: board, match detection, specials, cascades, particles, renderer, input, state machine, main loop.
- `manifest.json` — PWA manifest, `start_url: "./"`, `scope: "./"`, `orientation: "portrait"`, SVG icon.
- `sw.js` — service worker: precaches the shell (`./`, `index.html`, `styles.css`, `main.js`, `manifest.json`, `icon.svg`) and serves offline.
- `icon.svg` — a faceted blue sapphire diamond on a dark-slate rounded square; also the manifest icon.

## How to run / deploy

1. Open `index.html` directly in a browser, OR
2. Push the `sweet-blast/` folder to a GitHub repo and enable Pages — the game runs from the repo root or a subfolder because all paths are relative.

## PWA install

The manifest + service worker make the game installable on Android/iOS/desktop. After the first load the shell is cached and the game runs fully offline.

## Customization hooks

All tunables live at the top of `main.js`:
- `GRID` (default 8) — board dimension; keep square.
- `NUM_TYPES` (default 6) and the `GEMS` array — add/remove gem types, or recolor each gem's `primary`/`light`/`dark` and change its `shape` (`hexagon`, `diamond`, `octagon`, `triangle`, `pentagon`, `circle`).
- `SHAPES` — polygon side counts and rotations per shape name.
- `LEVELS` — per-level `target` score and `moves` limit; add or remove entries to change the level count.
- Scoring: `sizeBase(total)` (3→30, 4→40, 5+→60) and the special bonuses inside `expandSpecials` (line clearer +50, bomb +80), all multiplied by the combo.
- Special rules in `findMatches` — adjust the conditions that spawn a line clearer vs. a bomb.
- Animation timing: `phaseDur` values in `attemptSwap` (swap 0.18s, swapback 0.18s, clear 0.22s) and the fall duration formula in `onClearComplete`.
- `STORAGE_KEY` (`"gemCascade.progress"`) — the localStorage key for progress.

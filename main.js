/* Gem Cascade — a faceted jewel match-3 puzzle.
 * Vanilla JS, no libraries. Plays on touch, keyboard, and mouse.
 * 8x8 board, 6 gem types, 4-match -> line clearer, 5 L/T -> bomb,
 * cascade chains with combo multipliers, 12 levels.
 */
(function () {
  'use strict';

  // ===== Constants ==========================================================
  var GRID = 8;
  var NUM_TYPES = 6;
  var STORAGE_KEY = 'gemCascade.progress';

  // Special kinds carried on a gem.
  var SP_NONE = 0;
  var SP_LINE_H = 1; // clears entire row
  var SP_LINE_V = 2; // clears entire column
  var SP_BOMB = 3;   // clears 3x3

  // Gem palette — each is a faceted polygon with primary/light/dark shades.
  var GEMS = [
    { name: 'Ruby',     primary: '#E63946', light: '#FF8FA3', dark: '#7A1A24', shape: 'hexagon'  },
    { name: 'Sapphire', primary: '#3A86FF', light: '#A0C8FF', dark: '#1B3F8A', shape: 'diamond'  },
    { name: 'Emerald',  primary: '#2A9D8F', light: '#7FE3D2', dark: '#13524A', shape: 'octagon' },
    { name: 'Topaz',    primary: '#FFB703', light: '#FFE08A', dark: '#8A5E00', shape: 'triangle'},
    { name: 'Amethyst', primary: '#9D4EDD', light: '#D7B3F5', dark: '#4E1F75', shape: 'pentagon'},
    { name: 'Pearl',    primary: '#F1FAEE', light: '#FFFFFF', dark: '#9AA5A0', shape: 'circle'  }
  ];

  var SHAPES = {
    hexagon:  { sides: 6, rot: -Math.PI / 2 },
    diamond:  { sides: 4, rot: -Math.PI / 2 },
    octagon:  { sides: 8, rot: -Math.PI / 2 + Math.PI / 8 },
    triangle: { sides: 3, rot: -Math.PI / 2 },
    pentagon: { sides: 5, rot: -Math.PI / 2 }
  };

  var COMBO_LABELS = ['', '', 'Nice!', 'Brilliant!', 'Superb!', 'Cascade!', 'Cascade!', 'Cascade!'];

  // 12 levels: target score / move limit. Curve from 500/15 to 8000/25.
  var LEVELS = [
    { id: 1,  target: 500,  moves: 15 },
    { id: 2,  target: 800,  moves: 16 },
    { id: 3,  target: 1200, moves: 17 },
    { id: 4,  target: 1600, moves: 18 },
    { id: 5,  target: 2200, moves: 19 },
    { id: 6,  target: 2800, moves: 20 },
    { id: 7,  target: 3500, moves: 21 },
    { id: 8,  target: 4200, moves: 22 },
    { id: 9,  target: 5000, moves: 23 },
    { id: 10, target: 5800, moves: 24 },
    { id: 11, target: 6800, moves: 25 },
    { id: 12, target: 8000, moves: 25 },
    // v0.0.2 — Frost tier: frozen board, all cascade points ×2 (risk/reward)
    { id: 13, target: 10000, moves: 22, frost: true },
    { id: 14, target: 12500, moves: 24, frost: true },
    { id: 15, target: 15000, moves: 25, frost: true }
  ];

  // ===== Utilities ==========================================================
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
  function easeInQuad(t) { return t * t; }
  function randInt(n) { return Math.floor(Math.random() * n); }

  // ===== Storage ============================================================
  function loadProgress() {
    var def = { unlockedLevel: 1, bestScores: [] };
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return def;
      var p = JSON.parse(raw);
      var u = (typeof p.unlockedLevel === 'number' && p.unlockedLevel >= 1) ? p.unlockedLevel : 1;
      var b = Array.isArray(p.bestScores) ? p.bestScores.slice() : [];
      return { unlockedLevel: clamp(u, 1, LEVELS.length), bestScores: b };
    } catch (e) { return def; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) {}
  }

  // ===== Gem model ==========================================================
  var _nextId = 1;
  function makeGem(row, col, type, special) {
    return {
      id: _nextId++,
      row: row, col: col,
      type: type,
      special: special || SP_NONE,
      // visual position (cell units, float)
      x: col, y: row,
      scale: 1, alpha: 1,
      _sX: col, _sY: row
    };
  }

  // ===== Board ==============================================================
  function Board() {
    this.rows = GRID; this.cols = GRID;
    this.cells = [];
    for (var r = 0; r < GRID; r++) {
      var row = [];
      for (var c = 0; c < GRID; c++) row.push(null);
      this.cells.push(row);
    }
  }

  // Populate with no pre-existing matches: pick a type that avoids completing
  // a horizontal or vertical run with the two cells to the left / above.
  Board.prototype.fillNoMatches = function () {
    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        var forbid = {};
        if (c >= 2 && this.cells[r][c - 1] && this.cells[r][c - 2] &&
            this.cells[r][c - 1].type === this.cells[r][c - 2].type) {
          forbid[this.cells[r][c - 1].type] = true;
        }
        if (r >= 2 && this.cells[r - 1][c] && this.cells[r - 2][c] &&
            this.cells[r - 1][c].type === this.cells[r - 2][c].type) {
          forbid[this.cells[r - 1][c].type] = true;
        }
        var choices = [];
        for (var t = 0; t < NUM_TYPES; t++) if (!forbid[t]) choices.push(t);
        if (choices.length === 0) choices = [0, 1, 2, 3, 4, 5];
        var type = choices[randInt(choices.length)];
        var g = makeGem(r, c, type, SP_NONE);
        this.cells[r][c] = g;
      }
    }
    // Safety: if somehow matches exist, re-roll a few times.
    var tries = 0;
    while (findMatches(this).length > 0 && tries < 30) {
      this.fillNoMatches();
      tries++;
    }
  };

  Board.prototype.swap = function (r1, c1, r2, c2) {
    var a = this.cells[r1][c1];
    var b = this.cells[r2][c2];
    this.cells[r1][c1] = b;
    this.cells[r2][c2] = a;
    if (a) { a.row = r2; a.col = c2; }
    if (b) { b.row = r1; b.col = c1; }
  };

  // Compact each column downward, then spawn new gems at the top.
  // Sets each gem's visual x/y to its pre-fall position so the renderer can
  // tween it into place.
  Board.prototype.applyGravityAndRefill = function () {
    var maxDist = 0;
    for (var c = 0; c < GRID; c++) {
      var stack = [];
      for (var r = 0; r < GRID; r++) {
        if (this.cells[r][c]) stack.push(this.cells[r][c]);
      }
      for (var r = 0; r < GRID; r++) this.cells[r][c] = null;
      var placeRow = GRID - 1;
      for (var i = stack.length - 1; i >= 0; i--) {
        var g = stack[i];
        var oldRow = g.row;
        this.cells[placeRow][c] = g;
        g.row = placeRow; g.col = c;
        g.x = c; g.y = oldRow; // visual starts at old row, falls to placeRow
        var d = placeRow - oldRow;
        if (d > maxDist) maxDist = d;
        placeRow--;
      }
      // Fill remaining top rows with brand new gems, visually stacked above.
      var above = 0;
      for (var r2 = placeRow; r2 >= 0; r2--) {
        var type = randInt(NUM_TYPES);
        var ng = makeGem(r2, c, type, SP_NONE);
        this.cells[r2][c] = ng;
        ng.x = c; ng.y = (r2 - placeRow - 1); // start above the board
        above++;
      }
    }
    return maxDist;
  };

  // ===== Match detection ====================================================
  // Returns array of clusters: { type, cells:[{r,c}], total, maxRun, hasH, hasV,
  // special, spawnCell }.
  function findMatches(board) {
    var hRuns = [], vRuns = [];
    var r, c, start, type;

    for (r = 0; r < GRID; r++) {
      c = 0;
      while (c < GRID) {
        var g = board.cells[r][c];
        if (!g) { c++; continue; }
        type = g.type;
        start = c;
        while (c + 1 < GRID && board.cells[r][c + 1] && board.cells[r][c + 1].type === type) c++;
        if (c - start + 1 >= 3) {
          var hCells = [];
          for (var k = start; k <= c; k++) hCells.push({ r: r, c: k });
          hRuns.push({ axis: 'h', type: type, cells: hCells, len: hCells.length });
        }
        c++;
      }
    }
    for (c = 0; c < GRID; c++) {
      r = 0;
      while (r < GRID) {
        var g2 = board.cells[r][c];
        if (!g2) { r++; continue; }
        type = g2.type;
        start = r;
        while (r + 1 < GRID && board.cells[r + 1][c] && board.cells[r + 1][c].type === type) r++;
        if (r - start + 1 >= 3) {
          var vCells = [];
          for (var kk = start; kk <= r; kk++) vCells.push({ r: kk, c: c });
          vRuns.push({ axis: 'v', type: type, cells: vCells, len: vCells.length });
        }
        r++;
      }
    }

    var allRuns = hRuns.concat(vRuns);
    if (allRuns.length === 0) return [];

    // Merge intersecting runs of the same type into clusters.
    var visited = new Array(allRuns.length);
    for (var i = 0; i < visited.length; i++) visited[i] = false;
    var clusters = [];

    for (var i0 = 0; i0 < allRuns.length; i0++) {
      if (visited[i0]) continue;
      visited[i0] = true;
      var comp = [allRuns[i0]];
      var q = [i0];
      while (q.length) {
        var idx = q.shift();
        var cur = allRuns[idx];
        for (var j = 0; j < allRuns.length; j++) {
          if (visited[j] || allRuns[j].type !== cur.type) continue;
          var shares = false;
          for (var a = 0; a < cur.cells.length && !shares; a++) {
            for (var b = 0; b < allRuns[j].cells.length; b++) {
              if (cur.cells[a].r === allRuns[j].cells[b].r && cur.cells[a].c === allRuns[j].cells[b].c) {
                shares = true; break;
              }
            }
          }
          if (shares) { visited[j] = true; comp.push(allRuns[j]); q.push(j); }
        }
      }

      // Summarize geometry.
      var map = {};
      var uniq = [];
      var maxH = 0, maxV = 0, hasH = false, hasV = false;
      for (var m = 0; m < comp.length; m++) {
        var run = comp[m];
        if (run.axis === 'h') { hasH = true; if (run.len > maxH) maxH = run.len; }
        else { hasV = true; if (run.len > maxV) maxV = run.len; }
        for (var n = 0; n < run.cells.length; n++) {
          var pt = run.cells[n];
          var key = pt.r + ',' + pt.c;
          if (!map[key]) { map[key] = pt; uniq.push(pt); }
        }
      }
      var total = uniq.length;

      // Special spawn rules: 5+ straight OR L/T (both axes, total>=5) -> bomb;
      // 4 straight -> line clearer (random row/column direction at creation).
      var special = SP_NONE;
      if (maxH >= 5 || maxV >= 5 || (hasH && hasV && total >= 5)) {
        special = SP_BOMB;
      } else if (maxH === 4 || maxV === 4) {
        special = (Math.random() < 0.5) ? SP_LINE_H : SP_LINE_V;
      }

      // Spawn cell: prefer the cell nearest the cluster center.
      var spawnCell = null;
      if (special !== SP_NONE) {
        var sr = 0, sc = 0;
        for (var p = 0; p < uniq.length; p++) { sr += uniq[p].r; sc += uniq[p].c; }
        sr = Math.round(sr / uniq.length); sc = Math.round(sc / uniq.length);
        // snap to nearest cluster cell
        var best = uniq[0], bestD = 1e9;
        for (var p2 = 0; p2 < uniq.length; p2++) {
          var d = Math.abs(uniq[p2].r - sr) + Math.abs(uniq[p2].c - sc);
          if (d < bestD) { bestD = d; best = uniq[p2]; }
        }
        spawnCell = best;
      }

      clusters.push({
        type: comp[0].type, cells: uniq, total: total,
        maxRun: Math.max(maxH, maxV), hasH: hasH, hasV: hasV,
        special: special, spawnCell: spawnCell
      });
    }
    return clusters;
  }

  function isValidSwap(board, r1, c1, r2, c2) {
    if (r1 < 0 || r1 >= GRID || c1 < 0 || c1 >= GRID || r2 < 0 || r2 >= GRID || c2 < 0 || c2 >= GRID) return false;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
    var a = board.cells[r1][c1], b = board.cells[r2][c2];
    if (!a || !b) return false;
    // Swapping any special gem is always a valid move (detonates it).
    if (a.special !== SP_NONE || b.special !== SP_NONE) return true;
    board.swap(r1, c1, r2, c2);
    var m = findMatches(board);
    board.swap(r1, c1, r2, c2);
    return m.length > 0;
  }

  function findValidMoves(board) {
    var moves = [];
    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        if (!board.cells[r][c]) continue;
        if (c + 1 < GRID && isValidSwap(board, r, c, r, c + 1)) moves.push({ r1: r, c1: c, r2: r, c2: c + 1 });
        if (r + 1 < GRID && isValidSwap(board, r, c, r + 1, c)) moves.push({ r1: r, c1: c, r2: r + 1, c2: c });
      }
    }
    return moves;
  }

  // ===== Special detonation expansion ======================================
  // Given the set of cells already marked to clear, expand any special gems
  // caught in them (plus the seed specials from a swap). Mutates clearSet and
  // returns the bonus point total.
  function expandSpecials(board, clearSet, seeds) {
    var visited = {};
    var queue = [];
    var bonus = 0;
    function mark(r, c) {
      if (r < 0 || r >= GRID || c < 0 || c >= GRID) return;
      var key = r + ',' + c;
      clearSet[key] = { r: r, c: c };
      var g = board.cells[r][c];
      if (g && g.special !== SP_NONE && !visited[g.id]) queue.push({ r: r, c: c, gem: g });
    }
    for (var s = 0; s < seeds.length; s++) {
      var sg = seeds[s].gem;
      if (sg && !visited[sg.id]) queue.push({ r: seeds[s].r, c: seeds[s].c, gem: sg });
    }
    while (queue.length) {
      var item = queue.shift();
      var gem = item.gem;
      if (!gem || visited[gem.id]) continue;
      visited[gem.id] = true;
      if (gem.special === SP_LINE_H) {
        bonus += 50;
        for (var cc = 0; cc < GRID; cc++) mark(item.r, cc);
      } else if (gem.special === SP_LINE_V) {
        bonus += 50;
        for (var rr = 0; rr < GRID; rr++) mark(rr, item.c);
      } else if (gem.special === SP_BOMB) {
        bonus += 80;
        for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) mark(item.r + dr, item.c + dc);
      }
    }
    return bonus;
  }

  function sizeBase(total) { return total >= 5 ? 60 : total === 4 ? 40 : 30; }

  // ===== Particles ==========================================================
  var particles = [];
  var MAX_P = 360;
  function initParticles() {
    particles.length = 0;
    for (var i = 0; i < MAX_P; i++) {
      particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, size: 3, color: '#fff', life: 0, max: 0.5 });
    }
  }
  function emitBurst(x, y, color, count) {
    var n = count || 8;
    for (var i = 0; i < n; i++) {
      var p = particles[i % MAX_P];
      // find a free slot
      var idx = i;
      while (particles[idx].active) idx = (idx + 1) % MAX_P;
      p = particles[idx];
      var a = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.5;
      var sp = 60 + Math.random() * 140;
      p.active = true; p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 30;
      p.size = 2 + Math.random() * 3.5;
      p.color = color;
      p.life = 0; p.max = 0.35 + Math.random() * 0.25;
    }
  }
  function updateParticles(dt) {
    for (var i = 0; i < MAX_P; i++) {
      var p = particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.max) { p.active = false; continue; }
      p.vy += 320 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  // ===== Renderer ===========================================================
  var canvas, ctx;
  var boardPx = 0, cellPx = 0, dpr = 1;

  function polygonPath(cx, cy, rad, sides, rot) {
    ctx.beginPath();
    for (var i = 0; i < sides; i++) {
      var a = rot + (i / sides) * Math.PI * 2;
      var x = cx + Math.cos(a) * rad;
      var y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawGem(cx, cy, cell, gem, time) {
    if (gem.alpha <= 0.01) return;
    var rad = cell * 0.40;
    var G = GEMS[gem.type];
    ctx.save();
    ctx.globalAlpha = gem.alpha;
    ctx.translate(cx, cy);
    ctx.scale(gem.scale, gem.scale);

    if (G.shape === 'circle') {
      // Pearl: radial gradient body + bright highlight dot.
      var grad = ctx.createRadialGradient(-rad * 0.25, -rad * 0.25, rad * 0.08, 0, 0, rad);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.65, G.primary);
      grad.addColorStop(1, G.dark);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = G.dark; ctx.lineWidth = cell * 0.03; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(-rad * 0.3, -rad * 0.3, rad * 0.16, 0, Math.PI * 2); ctx.fill();
    } else {
      var sh = SHAPES[G.shape];
      // Dark outline (slightly larger).
      polygonPath(0, 0, rad, sh.sides, sh.rot);
      ctx.fillStyle = G.dark; ctx.fill();
      // Main facet body.
      polygonPath(0, 0, rad * 0.94, sh.sides, sh.rot);
      ctx.fillStyle = G.primary; ctx.fill();
      // Internal facet cuts from center to each vertex.
      ctx.save();
      ctx.globalAlpha = gem.alpha * 0.45;
      ctx.strokeStyle = G.dark; ctx.lineWidth = cell * 0.014;
      for (var i = 0; i < sh.sides; i++) {
        var a = sh.rot + (i / sh.sides) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * rad * 0.94, Math.sin(a) * rad * 0.94); ctx.stroke();
      }
      ctx.restore();
      // Top-left highlight facet.
      ctx.save();
      ctx.translate(-rad * 0.14, -rad * 0.14);
      ctx.globalAlpha = gem.alpha * 0.6;
      polygonPath(0, 0, rad * 0.5, sh.sides, sh.rot);
      ctx.fillStyle = G.light; ctx.fill();
      ctx.restore();
      // Sparkle dot.
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(-rad * 0.28, -rad * 0.28, rad * 0.09, 0, Math.PI * 2); ctx.fill();
    }

    // Special overlays.
    if (gem.special === SP_LINE_H || gem.special === SP_LINE_V) {
      drawLineClearerOverlay(rad, gem.special, time);
    } else if (gem.special === SP_BOMB) {
      drawBombOverlay(rad, time);
    }
    ctx.restore();
  }

  function drawLineClearerOverlay(rad, kind, time) {
    // v0.0.3 — distinctive "beam gem": glowing stripe + symmetric arrowheads at both ends
    var pulse = 0.5 + 0.5 * Math.sin(time * 6);
    var horiz = (kind === SP_LINE_H);
    ctx.save();
    // glowing beam stripe across the whole gem
    ctx.globalAlpha = 0.42 + 0.3 * pulse;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = rad * 0.32;
    ctx.lineCap = 'round';
    ctx.shadowBlur = rad * 0.55;
    ctx.shadowColor = '#FFFFFF';
    ctx.beginPath();
    if (horiz) { ctx.moveTo(-rad * 0.8, 0); ctx.lineTo(rad * 0.8, 0); }
    else { ctx.moveTo(0, -rad * 0.8); ctx.lineTo(0, rad * 0.8); }
    ctx.stroke();
    // arrowheads at BOTH ends -> reads as a line clearer, not a single direction arrow
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#FFFFFF';
    var tip = rad * 0.8, base = rad * 0.52, ah = rad * 0.24;
    for (var s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      if (horiz) {
        ctx.moveTo(s * tip, 0); ctx.lineTo(s * base, -ah); ctx.lineTo(s * base, ah);
      } else {
        ctx.moveTo(0, s * tip); ctx.lineTo(-ah, s * base); ctx.lineTo(ah, s * base);
      }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawBombOverlay(rad, time) {
    // v0.0.3 — distinctive "bomb star": pulsing glow ring + 8-point star + bright core
    var pulse = 0.5 + 0.5 * Math.sin(time * 7);
    ctx.save();
    // pulsing outer glow ring
    ctx.globalAlpha = 0.35 + 0.3 * pulse;
    ctx.strokeStyle = '#FFB703';
    ctx.lineWidth = rad * 0.14;
    ctx.shadowBlur = rad * 0.5;
    ctx.shadowColor = '#FFB703';
    ctx.beginPath(); ctx.arc(0, 0, rad * (0.62 + 0.08 * pulse), 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    // 8-point star burst
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#FFFFFF';
    var R = rad * 0.52, r = rad * 0.2;
    ctx.beginPath();
    for (var i = 0; i < 16; i++) {
      var ang = (i / 16) * Math.PI * 2 - Math.PI / 2;
      var rr = (i % 2 === 0) ? R : r;
      var px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    // bright gold core
    ctx.fillStyle = '#FFD66B';
    ctx.beginPath(); ctx.arc(0, 0, rad * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawBoardBg() {
    // Dark slate panel with subtle inner border.
    ctx.save();
    roundRect(0, 0, boardPx, boardPx, 14);
    var bg = ctx.createLinearGradient(0, 0, boardPx, boardPx);
    bg.addColorStop(0, '#0F172A');
    bg.addColorStop(1, '#0B1220');
    ctx.fillStyle = bg; ctx.fill();
    // cell grid
    ctx.strokeStyle = 'rgba(148,163,184,0.10)';
    ctx.lineWidth = 1;
    for (var i = 1; i < GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * cellPx, 4); ctx.lineTo(i * cellPx, boardPx - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, i * cellPx); ctx.lineTo(boardPx - 4, i * cellPx); ctx.stroke();
    }
    // inner border glow
    roundRect(2, 2, boardPx - 4, boardPx - 4, 12);
    ctx.strokeStyle = 'rgba(58,134,255,0.45)';
    ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }

  function drawSelectionAndCursor(time) {
    if (game.state !== 'playing') return;
    // keyboard cursor outline
    var cur = game.cursor;
    var cx = (cur.c + 0.5) * cellPx, cy = (cur.r + 0.5) * cellPx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,183,3,0.85)';
    ctx.lineWidth = 2;
    roundRect(cx - cellPx * 0.46, cy - cellPx * 0.46, cellPx * 0.92, cellPx * 0.92, 8);
    ctx.stroke();
    ctx.restore();

    // selection ring + valid-swap hint pulse on neighbors
    if (game.selected) {
      var s = game.selected;
      var sx = (s.c + 0.5) * cellPx, sy = (s.r + 0.5) * cellPx;
      var pulse = 0.5 + 0.5 * Math.sin(time * 6);
      ctx.save();
      ctx.strokeStyle = '#FFB703';
      ctx.lineWidth = 3 + pulse * 2;
      ctx.globalAlpha = 0.8 + 0.2 * pulse;
      ctx.shadowColor = '#FFB703'; ctx.shadowBlur = 12 + pulse * 8;
      ctx.beginPath(); ctx.arc(sx, sy, cellPx * 0.46, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      // pulse the 4 adjacent cells
      var nbrs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.2 * pulse;
      ctx.fillStyle = '#A0C8FF';
      for (var i = 0; i < nbrs.length; i++) {
        var nr = s.r + nbrs[i].dr, nc = s.c + nbrs[i].dc;
        if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
        roundRect(nc * cellPx + 3, nr * cellPx + 3, cellPx - 6, cellPx - 6, 8);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawParticles() {
    ctx.save();
    for (var i = 0; i < MAX_P; i++) {
      var p = particles[i];
      if (!p.active) continue;
      var t = p.life / p.max;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function render(time) {
    if (!ctx) return;
    ctx.clearRect(0, 0, boardPx, boardPx);
    drawBoardBg();
    // gems
    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        var g = game.board.cells[r][c];
        if (!g) continue;
        var cx = (g.x + 0.5) * cellPx;
        var cy = (g.y + 0.5) * cellPx;
        drawGem(cx, cy, cellPx, g, time);
      }
    }
    drawParticles();
    drawSelectionAndCursor(time);
  }

  function resize() {
    if (!canvas) return;
    var stage = document.getElementById('stage');
    var rect = stage.getBoundingClientRect();
    var size = Math.floor(Math.min(rect.width, rect.height));
    size = Math.floor(size / GRID) * GRID;
    if (size < 240) size = 240;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    boardPx = size; cellPx = size / GRID;
  }

  // ===== Game state =========================================================
  var game = {
    state: 'start',        // start | playing | paused | complete | failed | victory | map
    board: new Board(),
    levelIndex: 0,
    score: 0, displayedScore: 0,
    target: 0, movesLeft: 0,
    combo: 0, comboTimer: 0,
    totalScore: 0,
    progress: loadProgress(),
    selected: null,        // {r,c}
    cursor: { r: 3, c: 3 },
    // animation phase
    phase: 'idle',         // idle | swap | swapback | clear | fall
    phaseTimer: 0, phaseDur: 0,
    pending: null          // per-phase scratch data
  };

  // ===== DOM refs ===========================================================
  var els = {};
  function cacheEls() {
    var ids = ['hud-level', 'hud-target', 'hud-score', 'hud-moves', 'progress-fill', 'pause-btn',
      'combo-callout', 'screen-start', 'screen-paused', 'screen-complete', 'screen-failed',
      'screen-victory', 'screen-map', 'btn-play', 'btn-continue', 'btn-resume', 'btn-restart-pause',
      'btn-quit', 'btn-next', 'btn-map-complete', 'btn-retry', 'btn-map', 'btn-play-again',
      'btn-map-back', 'complete-level', 'complete-score', 'complete-best', 'failed-level',
      'failed-target', 'failed-score', 'victory-total', 'start-progress', 'start-unlocked',
      'map-grid'];
    for (var i = 0; i < ids.length; i++) els[ids[i]] = document.getElementById(ids[i]);
  }

  function showScreen(id) {
    var screens = ['screen-start', 'screen-paused', 'screen-complete', 'screen-failed', 'screen-victory', 'screen-map'];
    for (var i = 0; i < screens.length; i++) {
      var el = els[screens[i]];
      if (el) el.classList.toggle('hidden', screens[i] !== id);
    }
  }
  function hideAllScreens() {
    var screens = ['screen-start', 'screen-paused', 'screen-complete', 'screen-failed', 'screen-victory', 'screen-map'];
    for (var i = 0; i < screens.length; i++) {
      var el = els[screens[i]];
      if (el) el.classList.add('hidden');
    }
  }

  function updateHUD() {
    els['hud-level'].textContent = String(LEVELS[game.levelIndex].id);
    els['hud-target'].textContent = String(game.target);
    els['hud-moves'].textContent = String(game.movesLeft);
    els['hud-score'].textContent = String(Math.round(game.displayedScore));
    var pct = game.target > 0 ? clamp(game.score / game.target, 0, 1) : 0;
    els['progress-fill'].style.width = (pct * 100) + '%';
  }

  function showComboCallout(combo) {
    var el = els['combo-callout'];
    var label = COMBO_LABELS[Math.min(combo, COMBO_LABELS.length - 1)] || 'Cascade!';
    el.textContent = label + ' ×' + combo;
    el.classList.remove('hidden');
    el.classList.remove('show');
    // re-trigger animation
    void el.offsetWidth;
    el.classList.add('show');
    game.comboTimer = 1.0;
  }
  function hideComboCallout() { els['combo-callout'].classList.add('hidden'); }

  // ===== Level flow =========================================================
  function startLevel(index) {
    game.levelIndex = clamp(index, 0, LEVELS.length - 1);
    var def = LEVELS[game.levelIndex];
    game.target = def.target;
    game.movesLeft = def.moves;
    game.score = 0; game.displayedScore = 0; game.combo = 0; game.comboTimer = 0;
    game.selected = null;
    game.cursor = { r: 3, c: 3 };
    game.board = new Board();
    game.board.fillNoMatches();
    // guarantee at least one valid move
    var tries = 0;
    while (findValidMoves(game.board).length === 0 && tries < 20) {
      game.board = new Board();
      game.board.fillNoMatches();
      tries++;
    }
    game.phase = 'idle'; game.pending = null;
    hideComboCallout();
    hideAllScreens();
    game.state = 'playing';
    updateHUD();
    resize();
  }

  function finalizeMove() {
    // update best score
    var idx = game.levelIndex;
    var prev = game.progress.bestScores[idx] || 0;
    if (game.score > prev) game.progress.bestScores[idx] = game.score;
    saveProgress(game.progress);

    if (game.score >= game.target) {
      // level complete
      if (game.levelIndex + 1 > game.progress.unlockedLevel - 1) {
        game.progress.unlockedLevel = Math.min(LEVELS.length, game.levelIndex + 2);
      }
      saveProgress(game.progress);
      game.totalScore += game.score;
      game.state = 'complete';
      game.phase = 'idle';
      els['complete-level'].textContent = String(LEVELS[idx].id);
      els['complete-score'].textContent = String(game.score);
      els['complete-best'].textContent = String(game.progress.bestScores[idx] || game.score);
      showScreen('screen-complete');
    } else if (game.movesLeft <= 0) {
      game.state = 'failed';
      game.phase = 'idle';
      els['failed-level'].textContent = String(LEVELS[idx].id);
      els['failed-target'].textContent = String(game.target);
      els['failed-score'].textContent = String(game.score);
      if (window.GK) GK.recordRun({ score: game.totalScore, result: 'failed' });
      showScreen('screen-failed');
    } else {
      // check deadlock -> reshuffle
      if (findValidMoves(game.board).length === 0) reshuffleBoard();
      game.phase = 'idle';
    }
    updateHUD();
  }

  function reshuffleBoard() {
    // collect gems, shuffle types until no matches and at least one move.
    var types = [];
    for (var r = 0; r < GRID; r++) for (var c = 0; c < GRID; c++) {
      if (game.board.cells[r][c]) types.push(game.board.cells[r][c].type);
    }
    for (var attempt = 0; attempt < 40; attempt++) {
      // Fisher-Yates
      for (var i = types.length - 1; i > 0; i--) {
        var j = randInt(i + 1);
        var tmp = types[i]; types[i] = types[j]; types[j] = tmp;
      }
      var k = 0;
      for (var r2 = 0; r2 < GRID; r2++) for (var c2 = 0; c2 < GRID; c2++) {
        if (game.board.cells[r2][c2]) game.board.cells[r2][c2].type = types[k++];
      }
      if (findMatches(game.board).length === 0 && findValidMoves(game.board).length > 0) break;
    }
  }

  // ===== Swap / cascade pipeline ===========================================
  function attemptSwap(r1, c1, r2, c2) {
    if (game.state !== 'playing' || game.phase !== 'idle') return;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
    var a = game.board.cells[r1][c1], b = game.board.cells[r2][c2];
    if (!a || !b) return;

    // Start swap animation (visual only; logical swap happens on completion).
    game.phase = 'swap';
    game.phaseTimer = 0; game.phaseDur = 0.18;
    a._sX = c1; a._sY = r1; b._sX = c2; b._sY = r2;
    game.pending = { r1: r1, c1: c1, r2: r2, c2: c2, a: a, b: b,
      aSx: c1, aSy: r1, aEx: c2, aEy: r2, bSx: c2, bSy: r2, bEx: c1, bEy: r1 };
  }

  function onSwapComplete() {
    var p = game.pending;
    game.board.swap(p.r1, p.c1, p.r2, p.c2);
    // snap visuals to logical positions
    p.a.x = p.a.col; p.a.y = p.a.row; p.b.x = p.b.col; p.b.y = p.b.row;

    var hasSpecial = (p.a.special !== SP_NONE) || (p.b.special !== SP_NONE);
    if (!hasSpecial) {
      var clusters = findMatches(game.board);
      if (clusters.length === 0) {
        // Invalid swap: swap back logically, then animate from the swapped-to
        // positions back to the original positions. a had moved to (r2,c2),
        // b to (r1,c1); after swapping back, a is at (r1,c1), b at (r2,c2).
        game.board.swap(p.r1, p.c1, p.r2, p.c2);
        game.pending = {
          a: p.a, b: p.b,
          aSx: p.c2, aSy: p.r2, aEx: p.a.col, aEy: p.a.row,
          bSx: p.c1, bSy: p.r1, bEx: p.b.col, bEy: p.b.row
        };
        game.phase = 'swapback'; game.phaseTimer = 0; game.phaseDur = 0.18;
        return;
      }
      game.movesLeft--;
      updateHUD();
      game.combo = 0;
      runCascadeStep([], true);
    } else {
      // Special swap: always valid. Seeds = the specials at their new positions.
      game.movesLeft--;
      updateHUD();
      game.combo = 0;
      var seeds = [];
      if (p.a.special !== SP_NONE) seeds.push({ r: p.a.row, c: p.a.col, gem: p.a });
      if (p.b.special !== SP_NONE) seeds.push({ r: p.b.row, c: p.b.col, gem: p.b });
      runCascadeStep(seeds, true);
    }
  }

  function runCascadeStep(seeds, isFirst) {
    game.combo++;
    var clusters = findMatches(game.board);
    var clearSet = {};
    var spawns = [];
    var clusterBases = 0;

    for (var i = 0; i < clusters.length; i++) {
      var cl = clusters[i];
      for (var j = 0; j < cl.cells.length; j++) {
        var pt = cl.cells[j];
        clearSet[pt.r + ',' + pt.c] = { r: pt.r, c: pt.c };
      }
      clusterBases += sizeBase(cl.total);
      if (cl.special !== SP_NONE && cl.spawnCell) {
        spawns.push({ r: cl.spawnCell.r, c: cl.spawnCell.c, special: cl.special, type: cl.type });
      }
    }

    // Collect pre-existing specials caught in matched cells.
    var initSpecials = [];
    var keys1 = Object.keys(clearSet);
    for (var k = 0; k < keys1.length; k++) {
      var cell = clearSet[keys1[k]];
      var gg = game.board.cells[cell.r][cell.c];
      if (gg && gg.special !== SP_NONE) initSpecials.push({ r: cell.r, c: cell.c, gem: gg });
    }

    var bonus = expandSpecials(game.board, clearSet, initSpecials.concat(seeds));

    // Remove spawn cells from the clear set so the new special survives.
    for (var s = 0; s < spawns.length; s++) {
      delete clearSet[spawns[s].r + ',' + spawns[s].c];
    }

    var clearList = [];
    var keys2 = Object.keys(clearSet);
    for (var m = 0; m < keys2.length; m++) clearList.push(clearSet[keys2[m]]);

    if (clearList.length === 0 && spawns.length === 0) {
      // nothing happened (e.g., a special swap with no chain-in) -> finalize
      finalizeMove();
      return;
    }

    var frostMult = (LEVELS[game.levelIndex] && LEVELS[game.levelIndex].frost) ? 2 : 1;
    var points = (clusterBases + bonus) * game.combo * frostMult;
    game.score += points;
    if (window.MUX) MUX.bump();

    // emit particle bursts + mark gems for shrink/fade
    var clearingGems = [];
    for (var n = 0; n < clearList.length; n++) {
      var cc = clearList[n];
      var ggem = game.board.cells[cc.r][cc.c];
      if (ggem) {
        ggem.scale = 1; ggem.alpha = 1;
        clearingGems.push(ggem);
        var px = (ggem.x + 0.5) * cellPx, py = (ggem.y + 0.5) * cellPx;
        emitBurst(px, py, GEMS[ggem.type].light, 10);
      }
    }

    if (game.combo >= 2) showComboCallout(game.combo);
    updateHUD();

    game.phase = 'clear';
    game.phaseTimer = 0; game.phaseDur = 0.22;
    game.pending = { clearList: clearList, clearingGems: clearingGems, spawns: spawns };
  }

  function onClearComplete() {
    var p = game.pending;
    // remove cleared gems
    for (var i = 0; i < p.clearList.length; i++) {
      var cell = p.clearList[i];
      game.board.cells[cell.r][cell.c] = null;
    }
    // transform surviving spawn-cell gems into specials
    for (var s = 0; s < p.spawns.length; s++) {
      var sp = p.spawns[s];
      var g = game.board.cells[sp.r][sp.c];
      if (g) { g.special = sp.special; g.scale = 1; g.alpha = 1; }
    }
    // gravity + refill
    game.board.applyGravityAndRefill();
    // snapshot fall starts
    var maxDist = 0;
    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        var gg = game.board.cells[r][c];
        if (gg) {
          gg._sX = gg.x; gg._sY = gg.y;
          var d = gg.row - gg.y;
          if (d > maxDist) maxDist = d;
        }
      }
    }
    game.phase = 'fall';
    game.phaseTimer = 0;
    game.phaseDur = clamp(0.18 + maxDist * 0.04, 0.2, 0.55);
  }

  function onFallComplete() {
    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        var g = game.board.cells[r][c];
        if (g) { g.x = g.col; g.y = g.row; }
      }
    }
    runCascadeStep([], false);
  }

  // ===== Phase update =======================================================
  function updatePhase(dt) {
    if (game.phase === 'idle') return;
    game.phaseTimer += dt;
    var t = clamp(game.phaseTimer / game.phaseDur, 0, 1);
    var p = game.pending;

    if (game.phase === 'swap') {
      var e = easeInOutQuad(t);
      p.a.x = lerp(p.aSx, p.aEx, e); p.a.y = lerp(p.aSy, p.aEy, e);
      p.b.x = lerp(p.bSx, p.bEx, e); p.b.y = lerp(p.bSy, p.bEy, e);
      if (t >= 1) onSwapComplete();
    } else if (game.phase === 'swapback') {
      var e2 = easeInOutQuad(t);
      p.a.x = lerp(p.aSx, p.aEx, e2); p.a.y = lerp(p.aSy, p.aEy, e2);
      p.b.x = lerp(p.bSx, p.bEx, e2); p.b.y = lerp(p.bSy, p.bEy, e2);
      if (t >= 1) { game.phase = 'idle'; game.pending = null; }
    } else if (game.phase === 'clear') {
      var ec = easeInQuad(t);
      for (var i = 0; i < p.clearingGems.length; i++) {
        p.clearingGems[i].scale = 1 - ec;
        p.clearingGems[i].alpha = 1 - t;
      }
      if (t >= 1) onClearComplete();
    } else if (game.phase === 'fall') {
      var ef = easeOutQuad(t);
      for (var r = 0; r < GRID; r++) {
        for (var c = 0; c < GRID; c++) {
          var g = game.board.cells[r][c];
          if (g) {
            g.x = lerp(g._sX, g.col, ef);
            g.y = lerp(g._sY, g.row, ef);
          }
        }
      }
      if (t >= 1) onFallComplete();
    }
  }

  function updateScoreDisplay(dt) {
    if (game.displayedScore < game.score) {
      var diff = game.score - game.displayedScore;
      var step = Math.max(1, Math.ceil(diff * Math.min(1, dt * 12)));
      game.displayedScore = Math.min(game.score, game.displayedScore + step);
      els['hud-score'].textContent = String(Math.round(game.displayedScore));
      var pct = game.target > 0 ? clamp(game.displayedScore / game.target, 0, 1) : 0;
      els['progress-fill'].style.width = (pct * 100) + '%';
    } else if (game.displayedScore > game.score) {
      game.displayedScore = game.score;
      els['hud-score'].textContent = String(Math.round(game.displayedScore));
    }
  }

  function updateComboCallout(dt) {
    if (game.comboTimer > 0) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) hideComboCallout();
    }
  }

  // ===== Input: pointer =====================================================
  var pointer = { active: false, startR: -1, startC: -1, startX: 0, startY: 0, handled: false };

  function clientToCell(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var x = clientX - rect.left;
    var y = clientY - rect.top;
    var c = Math.floor(x / cellPx);
    var r = Math.floor(y / cellPx);
    return { r: r, c: c };
  }

  function handleTap(r, c) {
    if (game.state !== 'playing' || game.phase !== 'idle') return;
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return;
    if (!game.board.cells[r][c]) return;
    game.cursor = { r: r, c: c };
    if (!game.selected) {
      game.selected = { r: r, c: c };
    } else if (game.selected.r === r && game.selected.c === c) {
      game.selected = null;
    } else if (Math.abs(game.selected.r - r) + Math.abs(game.selected.c - c) === 1) {
      attemptSwap(game.selected.r, game.selected.c, r, c);
      game.selected = null;
    } else {
      game.selected = { r: r, c: c };
    }
  }

  function onPointerDown(e) {
    if (game.state !== 'playing') return;
    if (!e.isPrimary && e.pointerType === 'mouse') return;
    var cell = clientToCell(e.clientX, e.clientY);
    if (cell.r < 0 || cell.r >= GRID || cell.c < 0 || cell.c >= GRID) return;
    pointer.active = true;
    pointer.startR = cell.r; pointer.startC = cell.c;
    pointer.startX = e.clientX; pointer.startY = e.clientY;
    pointer.handled = false;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }
  function onPointerMove(e) {
    if (!pointer.active || pointer.handled) return;
    var dx = e.clientX - pointer.startX;
    var dy = e.clientY - pointer.startY;
    var thresh = cellPx * 0.35;
    if (Math.abs(dx) < thresh && Math.abs(dy) < thresh) return;
    var dr = 0, dc = 0;
    if (Math.abs(dx) > Math.abs(dy)) dc = dx > 0 ? 1 : -1;
    else dr = dy > 0 ? 1 : -1;
    var tr = pointer.startR + dr, tc = pointer.startC + dc;
    pointer.handled = true;
    game.selected = null;
    attemptSwap(pointer.startR, pointer.startC, tr, tc);
  }
  function onPointerUp(e) {
    if (!pointer.active) { pointer.active = false; return; }
    if (!pointer.handled) {
      handleTap(pointer.startR, pointer.startC);
    }
    pointer.active = false; pointer.handled = false;
  }

  // ===== Input: keyboard ====================================================
  function onKeyDown(e) {
    var k = e.key;
    if (game.state === 'start') {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); startLevel(0); return; }
      return;
    }
    if (game.state === 'paused') {
      if (k === 'Escape') { e.preventDefault(); resumeGame(); }
      return;
    }
    if (game.state === 'complete') {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); nextLevel(); return; }
      return;
    }
    if (game.state === 'failed') {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); startLevel(game.levelIndex); return; }
      return;
    }
    if (game.state === 'victory') {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); startLevel(0); return; }
      return;
    }
    if (game.state !== 'playing') return;

    if (k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); moveCursor(-1, 0); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); moveCursor(1, 0); }
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { e.preventDefault(); moveCursor(0, -1); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { e.preventDefault(); moveCursor(0, 1); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); confirmCursor(); }
    else if (k === 'Escape') { e.preventDefault(); pauseGame(); }
  }
  function moveCursor(dr, dc) {
    game.cursor.r = clamp(game.cursor.r + dr, 0, GRID - 1);
    game.cursor.c = clamp(game.cursor.c + dc, 0, GRID - 1);
  }
  function confirmCursor() {
    if (game.phase !== 'idle') return;
    var r = game.cursor.r, c = game.cursor.c;
    if (!game.board.cells[r][c]) return;
    if (!game.selected) {
      game.selected = { r: r, c: c };
    } else if (game.selected.r === r && game.selected.c === c) {
      game.selected = null;
    } else if (Math.abs(game.selected.r - r) + Math.abs(game.selected.c - c) === 1) {
      attemptSwap(game.selected.r, game.selected.c, r, c);
      game.selected = null;
    } else {
      game.selected = { r: r, c: c };
    }
  }

  // ===== Pause / resume / screens ==========================================
  function pauseGame() {
    if (game.state !== 'playing') return;
    game.state = 'paused';
    showScreen('screen-paused');
  }
  function resumeGame() {
    if (game.state !== 'paused') return;
    hideAllScreens();
    game.state = 'playing';
  }
  function nextLevel() {
    if (game.levelIndex + 1 >= LEVELS.length) {
      showVictory();
      return;
    }
    startLevel(game.levelIndex + 1);
  }
  function showVictory() {
    game.state = 'victory';
    els['victory-total'].textContent = String(game.totalScore);
    if (window.GK) GK.recordRun({ score: game.totalScore, result: 'victory' });
    showScreen('screen-victory');
  }
  function quitToMenu() {
    game.state = 'start';
    game.totalScore = 0;
    showStartScreen();
  }

  function showStartScreen() {
    game.state = 'start';
    var u = game.progress.unlockedLevel;
    if (u > 1) {
      els['start-progress'].classList.remove('hidden');
      els['start-unlocked'].textContent = String(u);
    } else {
      els['start-progress'].classList.add('hidden');
    }
    showScreen('screen-start');
  }

  function showMap() {
    game.state = 'map';
    var grid = els['map-grid'];
    grid.innerHTML = '';
    for (var i = 0; i < LEVELS.length; i++) {
      (function (idx) {
        var unlocked = (idx + 1) <= game.progress.unlockedLevel;
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'map-cell ' + (unlocked ? 'unlocked' : 'locked');
        cell.disabled = !unlocked;
        var best = game.progress.bestScores[idx] || 0;
        var num = document.createElement('span');
        num.textContent = String(idx + 1);
        var bestEl = document.createElement('span');
        bestEl.className = 'map-best';
        bestEl.textContent = unlocked ? (best ? 'Best ' + best : 'Play') : 'Locked';
        cell.appendChild(num);
        cell.appendChild(bestEl);
        if (unlocked) {
          cell.addEventListener('click', function () { startLevel(idx); });
        }
        grid.appendChild(cell);
      })(i);
    }
    showScreen('screen-map');
  }

  // ===== Wiring =============================================================
  function wireButtons() {
    els['btn-play'].addEventListener('click', function () { game.totalScore = 0; startLevel(0); });
    els['btn-continue'].addEventListener('click', function () {
      game.totalScore = 0;
      startLevel(clamp(game.progress.unlockedLevel - 1, 0, LEVELS.length - 1));
    });
    els['btn-resume'].addEventListener('click', resumeGame);
    els['btn-restart-pause'].addEventListener('click', function () { startLevel(game.levelIndex); });
    els['btn-quit'].addEventListener('click', quitToMenu);
    els['btn-next'].addEventListener('click', nextLevel);
    els['btn-map-complete'].addEventListener('click', showMap);
    els['btn-retry'].addEventListener('click', function () { startLevel(game.levelIndex); });
    els['btn-map'].addEventListener('click', showMap);
    els['btn-play-again'].addEventListener('click', function () { game.totalScore = 0; startLevel(0); });
    els['btn-map-back'].addEventListener('click', showStartScreen);
    els['pause-btn'].addEventListener('click', pauseGame);
  }

  function wireCanvas() {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    // prevent context menu / default touch behaviors
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  }

  // ===== Main loop ==========================================================
  var lastTs = 0;
  function loop(ts) {
    if (!lastTs) lastTs = ts;
    var dt = (ts - lastTs) / 1000;
    lastTs = ts;
    dt = clamp(dt, 0, 0.05);

    if (game.state === 'playing') updatePhase(dt);
    updateParticles(dt);
    updateScoreDisplay(dt);
    updateComboCallout(dt);
    render(ts / 1000);
    requestAnimationFrame(loop);
  }

  // ===== Init ===============================================================
  function init() {
    canvas = document.getElementById('board');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    cacheEls();
    initParticles();
    wireButtons();
    wireCanvas();
    window.addEventListener('keydown', onKeyDown);
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 100);
    });
    // also resize when orientation changes / after first paint
    setTimeout(resize, 0);
    showStartScreen();
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
// ---- v0.0.5 gamekit wiring (splash + menu + stats + leaderboard + auto-update) ----
if (window.GK) {
  GK.boot({ title: "Gem Cascade", tagline: "Match-3 gem puzzle", theme: "#120a18" });
  GK.help({ title: "Gem Cascade", objective: "Match 3+ gems to clear them and progress through levels.", controls: ["Mouse / Touch: drag to swap adjacent gems","Match 4+ for special gems","P: pause","F: fullscreen"], tips: "Chain cascades for big scores." });
  GK.exposeState(function () { try { return { score: (window.S && window.S.score) || window.score || 0, mode: (window.S && window.S.mode) || 'play', wave: (window.S && window.S.wave) || 0 }; } catch (e) { return {}; } });
  GK._manualRecord = true;
  setTimeout(function () { GK.ready(); }, 600);
}

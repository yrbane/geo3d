/**
 * geo3d — animated nested wireframe polyhedra on a 2D canvas.
 *
 * Zero dependencies, no build step, ~4 KB. Renders geodesic spheres and the
 * Platonic solids as glowing nested wireframes, tilted by pointer movement.
 *
 * Auto-init (grabs the first `<canvas id="geo">` or `<canvas data-geo3d>` and
 * reads options from the URL query string):
 *
 *     <canvas id="geo"></canvas>
 *     <script src="geo3d.js"></script>
 *
 * Programmatic:
 *
 *     const anim = new Geo3D(canvas, { preset: 'fire', layers: 4 });
 *     anim.stop(); anim.start(); anim.destroy();
 *
 * Options — all also accepted as `?query` params on the auto-init canvas:
 *
 *   shapes        array | 'a,b,c'   per-layer shapes, cycled  ['geo1','ico','oct',…]
 *   preset        string | string[] colour preset name or ['r,g,b', …]     'default'
 *   colors        string[]          explicit colours, overrides preset      null
 *   layers        1–6               number of nested layers                 3
 *   speed         slow|normal|fast|insane | number                          'normal'
 *   background,bg #rrggbb           canvas fill (bare hex via ?bg=)          transparent
 *   breathe       0–1               outer-layer pulsation                    0.04
 *   subdivisions  0–3               geodesic detail                          1
 *   fov           0.3–2             field of view                            0.9
 *   camera        1.5–8             camera distance                          3.5
 *   mouse         0–1               pointer follow (higher = snappier)       0.035
 *   random        flag              seeded generative layout                 off
 *   seed          uint32            reproduce a given random layout          auto
 *
 * Shapes:  ico · oct · tet · cube · dodec · geo1 · geo2
 * Presets: default · neon · fire · ice · pastel · mono · gold · matrix
 *
 * MIT — https://github.com/yrbane/geo3d
 */
(() => {
  'use strict';

  /* ── Geometry ──────────────────────────────────────────────────────────
     Solids as [vertices, faces]; faces are polygons (any arity) so wireframe
     edges stay clean — no triangulation diagonals. Vertices land on the unit
     sphere. */
  const PHI = (1 + Math.sqrt(5)) / 2, IPHI = 1 / PHI;
  const unit = ([x, y, z]) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };

  const ICO_V = [[-1,PHI,0],[1,PHI,0],[-1,-PHI,0],[1,-PHI,0],[0,-1,PHI],[0,1,PHI],
                 [0,-1,-PHI],[0,1,-PHI],[PHI,0,-1],[PHI,0,1],[-PHI,0,-1],[-PHI,0,1]].map(unit);
  const ICO_F = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],
                 [10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];

  const OCT_V = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const OCT_F = [[0,2,4],[0,4,3],[0,3,5],[0,5,2],[1,2,5],[1,5,3],[1,3,4],[1,4,2]];

  const TET_V = [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(unit);
  const TET_F = [[0,1,2],[0,2,3],[0,3,1],[1,3,2]];

  const CUBE_V = [[-1,-1,-1],[-1,-1,1],[-1,1,-1],[-1,1,1],[1,-1,-1],[1,-1,1],[1,1,-1],[1,1,1]].map(unit);
  const CUBE_F = [[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]];

  const DODEC_V = [[1,1,1],[1,1,-1],[1,-1,1],[1,-1,-1],[-1,1,1],[-1,1,-1],[-1,-1,1],[-1,-1,-1],
                   [0,PHI,IPHI],[0,PHI,-IPHI],[0,-PHI,IPHI],[0,-PHI,-IPHI],
                   [IPHI,0,PHI],[-IPHI,0,PHI],[IPHI,0,-PHI],[-IPHI,0,-PHI],
                   [PHI,IPHI,0],[PHI,-IPHI,0],[-PHI,IPHI,0],[-PHI,-IPHI,0]].map(unit);
  const DODEC_F = [[0,8,9,1,16],[0,16,17,2,12],[0,12,13,4,8],[3,17,16,1,14],[3,14,15,7,11],
                   [3,11,10,2,17],[5,9,8,4,18],[5,18,19,7,15],[5,15,14,1,9],[6,13,12,2,10],
                   [6,10,11,7,19],[6,19,18,4,13]];

  // Unique undirected edges of a polygon-face list.
  const edgesOf = faces => {
    const seen = new Set(), out = [];
    for (const f of faces) for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length], k = a < b ? a * 1e4 + b : b * 1e4 + a;
      if (!seen.has(k)) { seen.add(k); out.push([a, b]); }
    }
    return out;
  };

  // One geodesic subdivision: split each triangle, project midpoints to the sphere.
  const subdivide = (v, f) => {
    const nv = v.map(p => p.slice()), cache = new Map(), nf = [];
    const mid = (i, j) => {
      const k = i < j ? i * 1e4 + j : j * 1e4 + i;
      if (cache.has(k)) return cache.get(k);
      const a = nv[i], b = nv[j];
      cache.set(k, nv.length); nv.push(unit([(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2]));
      return nv.length - 1;
    };
    for (const [a, b, c] of f) { const x = mid(a,b), y = mid(b,c), z = mid(c,a); nf.push([a,x,z],[b,y,x],[c,z,y],[x,y,z]); }
    return [nv, nf];
  };
  const geodesic = n => { let v = ICO_V, f = ICO_F; while (n-- > 0) [v, f] = subdivide(v, f); return [v, f]; };

  const shape = (v, f) => ({ v, f, e: edgesOf(f) });
  const SHAPE_NAMES = ['ico', 'oct', 'tet', 'cube', 'dodec', 'geo1', 'geo2'];
  const catalogue = sub => ({
    ico:  shape(ICO_V, ICO_F),   oct: shape(OCT_V, OCT_F),   tet: shape(TET_V, TET_F),
    cube: shape(CUBE_V, CUBE_F), dodec: shape(DODEC_V, DODEC_F),
    geo1: shape(...geodesic(sub)), geo2: shape(...geodesic(Math.min(sub + 1, 3))),
  });

  /* ── Colour & speed presets ────────────────────────────────────────────── */
  const PRESETS = {
    default: ['108,99,255', '0,212,170', '255,107,107'],
    neon:    ['255,20,147', '57,255,20', '0,120,255', '255,0,255'],
    fire:    ['255,220,50', '255,140,0', '255,50,20', '200,30,0'],
    ice:     ['140,200,255', '220,240,255', '0,220,220', '180,220,255'],
    pastel:  ['255,182,193', '200,180,255', '152,251,178', '255,218,185'],
    mono:    ['255,255,255', '200,200,200', '160,160,160', '120,120,120'],
    gold:    ['255,215,0', '255,180,40', '205,133,63', '180,120,40'],
    matrix:  ['0,255,65', '0,200,50', '0,150,40'],
  };
  const SPEEDS = { slow: 0.4, normal: 1, fast: 2.5, insane: 6 };

  /* ── Helpers ───────────────────────────────────────────────────────────── */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // View-space lighting: a fixed key light + its Blinn-Phong half-vector (view
  // dir is +z). The solids rotate under it, so highlights sweep across faces.
  const _unit3 = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const LIGHT = _unit3(0.35, -0.55, 0.85);
  const HALF = _unit3(LIGHT[0], LIGHT[1], LIGHT[2] + 1);
  // mulberry32 — tiny seeded PRNG so `?random` layouts are reproducible via `?seed`.
  const prng = a => () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  // Compact HSL→'r,g,b' (h 0–360, s/l 0–100).
  const hsl = (h, s, l) => {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l), k = n => (n + h / 30) % 12;
    const f = n => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))) * 255);
    return `${f(0)},${f(8)},${f(4)}`;
  };
  // 'r,g,b' → [h(0–360), s(0–100), l(0–100)] — used to drift a layer's hue over time.
  const rgbToHsl = str => {
    const [r, g, b] = str.split(',').map(n => +n / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
    const l = (mx + mn) / 2, s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    return [h, s * 100, l * 100];
  };
  const MAX_SHARDS = 160;   // glass-shard particle pool cap
  // Pre-rendered radial glow sprite (drawn once, blitted per vertex).
  const glowSprite = (col, alpha, radius) => {
    const sz = Math.max(2, Math.ceil(radius * 2)), oc = document.createElement('canvas');
    oc.width = oc.height = sz;
    const ox = oc.getContext('2d'), g = ox.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
    g.addColorStop(0, `rgba(${col},${alpha})`); g.addColorStop(1, `rgba(${col},0)`);
    ox.fillStyle = g; ox.fillRect(0, 0, sz, sz);
    return oc;
  };

  /* ── Adaptive quality ──────────────────────────────────────────────────
     Tiers 0 (lowest) → 4 (highest), each capping the user's options. A runtime
     FPS monitor climbs/drops tiers so the animation stays smooth on the actual
     GPU/CPU, degrading cheap→expensive: pixel ratio, then vertex glow, then
     layer count, then geodesic detail. */
  const TIERS = [
    { dpr: 1,   glow: false, layers: 2, sub: 0, fill: false, spec: false },
    { dpr: 1,   glow: false, layers: 3, sub: 1, fill: false, spec: false },
    { dpr: 1.5, glow: true,  layers: 4, sub: 1, fill: false, spec: false },
    { dpr: 2,   glow: true,  layers: 6, sub: 1, fill: true,  spec: false },
    { dpr: 2,   glow: true,  layers: 6, sub: 2, fill: true,  spec: true  },
  ];
  const QUALITY_NAMES = { low: 1, medium: 2, high: 3, ultra: 4 };
  // Coarse starting tier from device hints (logical cores, RAM, pixel density).
  const guessTier = () => {
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
    let s = 2;
    s += cores >= 8 ? 1 : cores >= 4 ? 0 : -1;
    s += mem >= 8 ? 1 : mem >= 4 ? 0 : -1;
    s += (window.devicePixelRatio || 1) > 2 ? -1 : 0;
    return clamp(s, 1, 4);
  };

  const DEFAULTS = {
    shapes: ['geo1', 'ico', 'oct', 'tet', 'cube', 'dodec'],
    preset: 'default', colors: null, layers: 3, speed: 'normal',
    background: null, breathe: 0.04, subdivisions: 1, quality: 'auto',
    fov: 0.9, camera: 3.5, mouse: 0.035, random: false, seed: null,
    // Living-glass shatter (all tunable):
    shatter: true,        // enable click / spontaneous shatter
    breakInterval: 6,     // avg seconds between spontaneous breaks (slower = calmer)
    reform: 5,            // base seconds a shattered face stays gone before reforming
    bounce: 'auto',       // shards bounce off the outer layer: 'auto' (ultra) | true | false
    hueDrift: 5,          // colour drift, degrees/second
    shardLife: 6,         // shard safety max-age seconds (they mostly fall off-screen first)
  };

  /* ── Engine ────────────────────────────────────────────────────────────── */
  class Geo3D {
    constructor(canvas, options = {}) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const o = { ...DEFAULTS, ...options };
      this.canvas = canvas; this.ctx = ctx;

      this._maxDpr = options.dpr || Math.min(window.devicePixelRatio || 1, 2);
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.speed = (typeof o.speed === 'number' ? o.speed : SPEEDS[o.speed] ?? 1) * (this.reduced ? 0.12 : 1);
      this.bg = o.background;
      this.fov = clamp(+o.fov || 0.9, 0.3, 2);
      this.camZ = clamp(+o.camera || 3.5, 1.5, 8);
      this.mouse = clamp(o.mouse ?? 0.035, 0, 1);
      this.breathe = clamp(o.breathe ?? 0.04, 0, 1);
      this.random = !!o.random;
      this.seed = (o.seed != null ? o.seed : Math.random() * 2 ** 32) >>> 0;

      // Quality: 'auto' (default) starts from a device-hint tier then self-tunes
      // on measured FPS; a number (0–4) or name (low/medium/high/ultra) pins it.
      this._o = o;
      this.userSub = clamp(o.subdivisions | 0, 0, 3);
      this.auto = o.quality === 'auto' || o.quality == null;
      let lvl = this.auto ? guessTier()
        : typeof o.quality === 'number' ? clamp(o.quality | 0, 0, 4) : (QUALITY_NAMES[o.quality] ?? 3);
      if (this.reduced) lvl = Math.min(lvl, 1);
      this.level = lvl;
      this.curSub = Math.min(this.userSub, TIERS[lvl].sub);
      this.dpr = Math.min(this._maxDpr, TIERS[lvl].dpr);
      this.glowOn = TIERS[lvl].glow;
      this.fillOn = TIERS[lvl].fill;
      this.specOn = TIERS[lvl].spec;

      // Living-glass shatter — all tunable.
      this.shatterOn = o.shatter !== false;
      this.breakInterval = Math.max(0.3, +o.breakInterval || 6);
      this.reformBase = Math.max(0.5, +o.reform || 5);
      this.bounceOpt = o.bounce;                       // 'auto' | true | false
      this.hueRate = o.hueDrift == null ? 5 : +o.hueDrift;
      this.shardTTL = clamp(+o.shardLife || 6, 1, 30);   // safety max age; shards mostly die off the bottom
      this.hue = 0; this._dt = 0;
      this.breakTimer = this.breakInterval * (0.5 + Math.random());
      // Reusable shard pool — each shard is a triangular glass piece of a face
      // (its 3 vertices, relative to the piece's centre), so no per-frame alloc.
      const M = MAX_SHARDS;
      this.sh = {
        x: new Float32Array(M), y: new Float32Array(M), vx: new Float32Array(M), vy: new Float32Array(M),
        rot: new Float32Array(M), vr: new Float32Array(M), life: new Float32Array(M), ml: new Float32Array(M), hue: new Float32Array(M),
        ax: new Float32Array(M), ay: new Float32Array(M), bx: new Float32Array(M), by: new Float32Array(M), cx: new Float32Array(M), cy: new Float32Array(M),
        gen: new Float32Array(M),   // remaining re-break generations (splits on bounce)
        bri: new Float32Array(M),   // colour intensity, dimmed on each bounce
        i: 0,
      };

      this.shapes = catalogue(this.curSub);
      this.layers = this._layers(o, prng(this.seed));
      this.activeCount = Math.min(this.layers.length, TIERS[lvl].layers);
      this.info = `${this.activeCount}L · ${this.random ? 'random#' + this.seed
        : Array.isArray(o.preset) || Array.isArray(o.colors) ? 'custom' : o.preset} · ${this.layers.slice(0, this.activeCount).map(l => l.name).join('+')}`;
      this._fps = 60; this._cooldown = 60;

      this.R = new Float64Array(9);
      this.mx = this.my = this.smx = this.smy = this.t = this.last = 0;
      this.visible = true; this.raf = 0; this._dirty = false;
      this._loop = this._frame.bind(this);

      this.resize();
      this._bind();
      this.start();
    }

    // Build per-layer geometry (typed arrays) + style. Style is a smooth
    // outer→inner gradient: big/thin/faint → small/thick/bright, dots inside.
    _layers(o, rnd) {
      const n = this.random ? 2 + Math.floor(rnd() * 4) : clamp(o.layers | 0 || 3, 1, 6);
      const palette = Array.isArray(o.colors) ? o.colors
        : Array.isArray(o.preset) ? o.preset : (PRESETS[o.preset] || PRESETS.default);
      const shapeList = typeof o.shapes === 'string' ? o.shapes.split(',') : o.shapes;
      const hue0 = this.random ? rnd() * 360 : 0, out = [];

      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0, sign = i % 2 ? -1 : 1;
        let name, col, spd;
        if (this.random) {
          name = SHAPE_NAMES[Math.floor(rnd() * SHAPE_NAMES.length)];
          col = hsl((hue0 + i * (40 + rnd() * 80)) % 360, 60 + rnd() * 40, 50 + rnd() * 30);
          spd = [sign * (0.3 + rnd() * 1.2), sign * -(0.2 + rnd() * 1), sign * (0.1 + rnd() * 0.7)];
        } else {
          name = shapeList[i % shapeList.length];
          col = palette[i % palette.length];
          spd = [sign * (0.5 + t * 0.8), sign * -(0.35 + t * 0.55), sign * (0.2 + t * 0.5)];
        }
        const geo = this.shapes[name] || this.shapes.ico, nv = geo.v.length, ne = geo.e.length;
        const fv = new Float64Array(nv * 3);
        for (let k = 0, a = 0; k < nv; k++, a += 3) { fv[a] = geo.v[k][0]; fv[a+1] = geo.v[k][1]; fv[a+2] = geo.v[k][2]; }
        const fe = new Uint16Array(ne * 2);
        for (let k = 0, a = 0; k < ne; k++, a += 2) { fe[a] = geo.e[k][0]; fe[a+1] = geo.e[k][1]; }
        // "Sometimes fill some polygons" — a seeded subset of faces gets a
        // translucent, lit fill (drawn only when the quality tier allows it).
        let fillFaces = null, fa = null, fst = null;
        if (rnd() < 0.62) {
          fillFaces = [];
          for (let fi = 0; fi < geo.f.length; fi++) if (rnd() < 0.6) fillFaces.push(fi);
          if (fillFaces.length) {
            fa = new Float32Array(fillFaces.length);      // per-face base alpha (varied)
            fst = new Float32Array(fillFaces.length);     // 0 = solid ; >0 = seconds until reform
            for (let q = 0; q < fa.length; q++) fa[q] = 0.35 + rnd() * 0.65;
          } else fillFaces = null;
        }
        const [ch, cs, cl] = rgbToHsl(col);
        out.push({
          name, spd, fv, fe, nv, ne, col, h: ch, s: cs, l: cl, _col: col,
          proj: new Float64Array(nv * 2), rv: new Float64Array(nv * 3),
          faces: geo.f, fillFaces, fa, fst,
          sc: 1.5 * Math.pow(0.3, t), mInf: 0.6 + t * 0.35,
          lw: 0.6 + t * 1.3, la: 0.12 + t * 0.38, pa: 0.25 + t * 0.55,
          pr: 1.5 + t * 3, dots: i > 0,
        });
      }
      return out;
    }

    resize() {
      const c = this.canvas, w = Math.round(c.clientWidth * this.dpr), h = Math.round(c.clientHeight * this.dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      this.sprites = this.layers.map(L => glowSprite(L.col, L.pa, L.pr * this.dpr * 2.5));
    }

    // Re-tune to quality `level`, rebuilding only what changed. Geometry is
    // regenerated from the same seed, so the layout is stable across changes.
    _retune(level) {
      level = clamp(level, 0, 4);
      if (level === this.level) return;
      this.level = level;
      const T = TIERS[level], sub = Math.min(this.userSub, T.sub);
      if (sub !== this.curSub) {
        this.curSub = sub;
        this.shapes = catalogue(sub);
        this.layers = this._layers(this._o, prng(this.seed));
      }
      this.glowOn = T.glow;
      this.fillOn = T.fill;
      this.specOn = T.spec;
      this.activeCount = Math.min(this.layers.length, T.layers);
      this.dpr = Math.min(this._maxDpr, T.dpr);
      this.resize();
      this._cooldown = 120; // ~2 s to settle before the next change
    }

    // Nudge quality from smoothed FPS (hysteresis gap + cooldown = no flapping).
    _adapt() {
      if (this._cooldown > 0) { this._cooldown--; return; }
      if (this._fps < 45 && this.level > 0) this._retune(this.level - 1);
      else if (this._fps > 58 && this.level < 4) this._retune(this.level + 1);
    }

    _bind() {
      const aim = (x, y) => { this.mx = (x / innerWidth - 0.5) * 2; this.my = (y / innerHeight - 0.5) * 2; };
      this._h = {
        mousemove: e => aim(e.clientX, e.clientY),
        touchmove: e => { if (e.touches[0]) { aim(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); } },
        pointerdown: e => this._click(e.clientX, e.clientY),
        dblclick: () => this._explodeAll(),
        resize: () => { this._dirty = true; },
        visibilitychange: () => { this.visible = !document.hidden; },
      };
      addEventListener('mousemove', this._h.mousemove);
      addEventListener('touchmove', this._h.touchmove, { passive: false });
      addEventListener('pointerdown', this._h.pointerdown);
      addEventListener('dblclick', this._h.dblclick);
      addEventListener('resize', this._h.resize);
      document.addEventListener('visibilitychange', this._h.visibilitychange);
      this._io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting && !document.hidden; }, { threshold: 0 });
      this._io.observe(this.canvas);
    }

    // Rz·Rx·Ry composed analytically into one 3×3 (a single trig pass, no matmul).
    _rot(ay, ax, az) {
      const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax),
            cz = Math.cos(az), sz = Math.sin(az), R = this.R;
      R[0] = cz*cy + sz*sx*sy; R[1] = sz*cx; R[2] = -cz*sy + sz*sx*cy;
      R[3] = -sz*cy + cz*sx*sy; R[4] = cz*cx; R[5] =  sz*sy + cz*sx*cy;
      R[6] = cx*sy;             R[7] = -sx;   R[8] =  cx*cy;
    }

    // Holographic face pass: fill this layer's selected faces as translucent,
    // two-sided-lit, depth-sorted polygons, with an optional specular sheen
    // ("reflections"). Uses reusable typed scratch buffers — no per-frame GC.
    _fill(L) {
      const { rv, proj, faces, fillFaces, fa, fst, _col } = L, ctx = this.ctx, dt = this._dt, n = fillFaces.length;
      if (!this._fz || this._fz.length < n) {
        this._fz = new Float64Array(n); this._ford = new Int32Array(n);
        this._fin = new Float32Array(n); this._fsp = new Float32Array(n);
      }
      const fz = this._fz, ord = this._ford, fin = this._fin, fsp = this._fsp;
      for (let k = 0; k < n; k++) {
        ord[k] = k;
        if (fst[k] > 0) { fst[k] -= dt; if (fst[k] > 0) { fin[k] = -1; fz[k] = 1e9; continue; } } // shattered → reforming
        const face = faces[fillFaces[k]], a = face[0]*3, b = face[1]*3, c = face[2]*3;
        const e1x = rv[b]-rv[a], e1y = rv[b+1]-rv[a+1], e1z = rv[b+2]-rv[a+2];
        const e2x = rv[c]-rv[a], e2y = rv[c+1]-rv[a+1], e2z = rv[c+2]-rv[a+2];
        let nx = e1y*e2z - e1z*e2y, ny = e1z*e2x - e1x*e2z, nz = e1x*e2y - e1y*e2x;
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        fin[k] = fa[k] * (0.28 + Math.abs(nx*LIGHT[0] + ny*LIGHT[1] + nz*LIGHT[2]) * 0.72); // varied α × lighting
        if (this.specOn) { const h = Math.abs(nx*HALF[0] + ny*HALF[1] + nz*HALF[2]), h2 = h*h; fsp[k] = h2*h2*h2; }
        let z = 0; for (let j = 0; j < face.length; j++) z += rv[face[j]*3 + 2];
        fz[k] = z / face.length;
      }
      const view = ord.subarray(0, n);
      view.sort((p, q) => fz[p] - fz[q]);      // farthest first (back-to-front)
      for (let m = 0; m < n; m++) {
        const k = view[m]; if (fin[k] < 0) continue;      // skip shattered faces
        const face = faces[fillFaces[k]];
        ctx.beginPath();
        ctx.moveTo(proj[face[0]*2], proj[face[0]*2 + 1]);
        for (let j = 1; j < face.length; j++) ctx.lineTo(proj[face[j]*2], proj[face[j]*2 + 1]);
        ctx.closePath();
        ctx.fillStyle = `rgba(${_col},${0.04 + fin[k] * 0.16})`;
        ctx.fill();
        if (this.specOn && fsp[k] > 0.03) { ctx.fillStyle = `rgba(255,255,255,${fsp[k] * 0.22})`; ctx.fill(); }
      }
    }

    // ── Shatter: click / spontaneous break → glass shards ─────────────────
    // Point-in-polygon (screen space) against a face's last projected vertices.
    _inFace(proj, face, px, py) {
      let inside = false;
      for (let i = 0, j = face.length - 1; i < face.length; j = i++) {
        const xi = proj[face[i]*2], yi = proj[face[i]*2+1], xj = proj[face[j]*2], yj = proj[face[j]*2+1];
        if (((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }

    // Click → shatter the front-most filled face under the pointer.
    _click(cx, cy) {
      if (!this.shatterOn || !this.fillOn) return;   // only when resources allow fills
      const r = this.canvas.getBoundingClientRect();
      const px = (cx - r.left) * this.canvas.width / r.width, py = (cy - r.top) * this.canvas.height / r.height;
      for (let li = this.activeCount - 1; li >= 0; li--) {          // inner (top) layers first
        const L = this.layers[li];
        if (!L.fillFaces) continue;
        for (let k = 0; k < L.fillFaces.length; k++) {
          if (L.fst[k] > 0) continue;
          if (this._inFace(L.proj, L.faces[L.fillFaces[k]], px, py)) { this._break(L, k); return; }
        }
      }
    }

    // Pick a random living filled face and shatter it (the spontaneous "pops").
    _breakRandom() {
      const live = [];
      for (let li = 0; li < this.activeCount; li++) if (this.layers[li].fillFaces) live.push(li);
      if (!live.length) return;
      const L = this.layers[live[(Math.random() * live.length) | 0]];
      const k = (Math.random() * L.fillFaces.length) | 0;
      if (L.fst[k] <= 0) this._break(L, k);
    }

    // Double-click → shatter every solid filled face at once (big burst).
    _explodeAll() {
      if (!this.shatterOn || !this.fillOn) return;
      for (let li = 0; li < this.activeCount; li++) {
        const L = this.layers[li];
        if (!L.fillFaces) continue;
        for (let k = 0; k < L.fillFaces.length; k++) if (L.fst[k] <= 0) this._break(L, k);
      }
    }

    // Shatter face k of L: split its projected polygon into real triangular
    // pieces (fan, then centre-split at ultra) — so shards vary in size and
    // together cover the face's surface — and fling them out from the centre.
    // The face is then gone for ~`reform`s before it comes back.
    _break(L, k) {
      const face = L.faces[L.fillFaces[k]], proj = L.proj, hue = (L.h + this.hue) % 360;
      let fcx = 0, fcy = 0;
      for (let j = 0; j < face.length; j++) { fcx += proj[face[j]*2]; fcy += proj[face[j]*2+1]; }
      fcx /= face.length; fcy /= face.length;
      const x0 = proj[face[0]*2], y0 = proj[face[0]*2+1];
      for (let j = 1; j < face.length - 1; j++) {
        const x1 = proj[face[j]*2], y1 = proj[face[j]*2+1], x2 = proj[face[j+1]*2], y2 = proj[face[j+1]*2+1];
        if (this.specOn) {                       // finer shatter: centre-split each triangle
          const tx = (x0+x1+x2)/3, ty = (y0+y1+y2)/3;
          this._piece(x0, y0, x1, y1, tx, ty, fcx, fcy, hue);
          this._piece(x1, y1, x2, y2, tx, ty, fcx, fcy, hue);
          this._piece(x2, y2, x0, y0, tx, ty, fcx, fcy, hue);
        } else {
          this._piece(x0, y0, x1, y1, x2, y2, fcx, fcy, hue);
        }
      }
      L.fst[k] = this.reformBase * (0.7 + Math.random() * 0.9);
    }

    // Low-level: write a triangular shard (screen coords) into slot idx.
    _writeShard(idx, x1, y1, x2, y2, x3, y3, vx, vy, gen, hue, life, bri) {
      const S = this.sh, cx = (x1+x2+x3) / 3, cy = (y1+y2+y3) / 3;
      S.x[idx] = cx; S.y[idx] = cy;
      S.ax[idx] = x1-cx; S.ay[idx] = y1-cy; S.bx[idx] = x2-cx; S.by[idx] = y2-cy; S.cx[idx] = x3-cx; S.cy[idx] = y3-cy;
      S.vx[idx] = vx; S.vy[idx] = vy; S.rot[idx] = 0; S.vr[idx] = (Math.random()-0.5) * 8;
      S.life[idx] = S.ml[idx] = life; S.hue[idx] = hue; S.gen[idx] = gen; S.bri[idx] = bri;
    }

    // A fresh piece flung outward from the face centre (fcx,fcy).
    _piece(x1, y1, x2, y2, x3, y3, fcx, fcy, hue) {
      const cx = (x1+x2+x3) / 3, cy = (y1+y2+y3) / 3;
      let dx = cx-fcx, dy = cy-fcy; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const spd = (35 + Math.random() * 135) * this.dpr, jt = 55 * this.dpr;
      this._writeShard(this.sh.i++ % MAX_SHARDS, x1, y1, x2, y2, x3, y3,
        dx*spd + (Math.random()-0.5)*jt, dy*spd + (Math.random()-0.5)*jt - 25*this.dpr,
        this.specOn ? 2 : 1, hue + (Math.random()-0.5) * 70, this.shardTTL, 1);
    }

    // Re-break shard i on bounce into a RANDOM but physically coherent number
    // of smaller pieces (sometimes 2, sometimes many — more when the impact is
    // fast). The pieces exactly tile the original triangle (area conserved):
    // a 2-way longest-edge cut, or a fan from an interior point to the boundary
    // (vertices + occasional edge points). Bounded + generation-limited = light.
    _splitShard(i) {
      const S = this.sh;
      if (S.gen[i] <= 0) return;
      const Ax = S.x[i]+S.ax[i], Ay = S.y[i]+S.ay[i], Bx = S.x[i]+S.bx[i], By = S.y[i]+S.by[i], Cx = S.x[i]+S.cx[i], Cy = S.y[i]+S.cy[i];
      if (Math.abs((Bx-Ax)*(Cy-Ay) - (Cx-Ax)*(By-Ay)) * 0.5 < 22 * this.dpr * this.dpr) return; // too small
      const vx = S.vx[i], vy = S.vy[i], sp = Math.hypot(vx, vy);
      const gen = S.gen[i] - 1, hue = S.hue[i], bri = S.bri[i], life = this.shardTTL;

      if (Math.random() < 0.4) {                    // simple 2-way cut along the longest edge
        const dAB = (Ax-Bx)**2+(Ay-By)**2, dBC = (Bx-Cx)**2+(By-Cy)**2, dCA = (Cx-Ax)**2+(Cy-Ay)**2;
        let px, py, q1x, q1y, q2x, q2y;
        if (dAB >= dBC && dAB >= dCA) { px = Cx; py = Cy; q1x = Ax; q1y = Ay; q2x = Bx; q2y = By; }
        else if (dBC >= dCA)          { px = Ax; py = Ay; q1x = Bx; q1y = By; q2x = Cx; q2y = Cy; }
        else                          { px = Bx; py = By; q1x = Cx; q1y = Cy; q2x = Ax; q2y = Ay; }
        const mx = (q1x+q2x)/2, my = (q1y+q2y)/2, vl = sp || 1, nx = -vy/vl, ny = vx/vl, kick = (20 + Math.random()*45) * this.dpr;
        this._writeShard(i, px, py, q1x, q1y, mx, my, vx + nx*kick, vy + ny*kick, gen, hue, life, bri);
        this._writeShard(this.sh.i++ % MAX_SHARDS, px, py, mx, my, q2x, q2y, vx - nx*kick, vy - ny*kick, gen, hue, life, bri);
        return;
      }

      // Fan-shatter: interior point P (biased toward centroid, always inside).
      const r1 = Math.sqrt(Math.random()), r2 = Math.random();
      const ux = Ax*(1-r1) + Bx*(r1*(1-r2)) + Cx*(r1*r2), uy = Ay*(1-r1) + By*(r1*(1-r2)) + Cy*(r1*r2);
      const gx = (Ax+Bx+Cx)/3, gy = (Ay+By+Cy)/3, Px = gx + (ux-gx)*0.5, Py = gy + (uy-gy)*0.5;
      // Boundary polygon: the 3 vertices, plus an edge point per edge with a
      // probability that grows with impact speed → more, smaller pieces.
      if (!this._px) { this._px = new Float32Array(6); this._py = new Float32Array(6); }
      const px = this._px, py = this._py;
      const pMid = Math.min(0.85, 0.25 + sp / (220 * this.dpr));
      let m = 0, tt;
      px[m] = Ax; py[m] = Ay; m++;
      if (Math.random() < pMid) { tt = 0.35 + Math.random()*0.3; px[m] = Ax+(Bx-Ax)*tt; py[m] = Ay+(By-Ay)*tt; m++; }
      px[m] = Bx; py[m] = By; m++;
      if (Math.random() < pMid) { tt = 0.35 + Math.random()*0.3; px[m] = Bx+(Cx-Bx)*tt; py[m] = By+(Cy-By)*tt; m++; }
      px[m] = Cx; py[m] = Cy; m++;
      if (Math.random() < pMid) { tt = 0.35 + Math.random()*0.3; px[m] = Cx+(Ax-Cx)*tt; py[m] = Cy+(Ay-Cy)*tt; m++; }
      const div = (22 + Math.random()*36) * this.dpr;
      for (let j = 0; j < m; j++) {
        const n = (j+1) % m, tcx = (Px+px[j]+px[n])/3, tcy = (Py+py[j]+py[n])/3;
        let dx = tcx-Px, dy = tcy-Py; const dl = Math.hypot(dx, dy) || 1;
        const idx = j === 0 ? i : this.sh.i++ % MAX_SHARDS;   // reuse slot i for the first piece
        this._writeShard(idx, Px, Py, px[j], py[j], px[n], py[n],
          vx + dx/dl*div, vy + dy/dl*div, gen, hue + (Math.random()-0.5)*30, life, bri);
      }
    }

    // Update + draw live shards: gravity, optional bounce off the OUTER layer's
    // facets (its projected edges), additive iridescent triangles fading out.
    _shards(dt) {
      const S = this.sh, ctx = this.ctx, grav = 460 * this.dpr;   // strong gravity → shards fall to the bottom
      const H = this.canvas.height, floor = H + 40 * this.dpr;
      const bounce = this.shatterOn && (this.bounceOpt === 'auto' ? this.specOn : this.bounceOpt === true && this.fillOn);
      const L0 = bounce && this.activeCount ? this.layers[0] : null;
      const ep = L0 && L0.proj, ee = L0 && L0.fe, en = L0 ? L0.ne : 0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < MAX_SHARDS; i++) {
        if (S.life[i] <= 0) continue;
        S.life[i] -= dt;                          // safety age cap (they usually exit the bottom first)
        if (S.life[i] <= 0) continue;
        S.vy[i] += grav * dt;
        const px = S.x[i], py = S.y[i]; let nx = px + S.vx[i]*dt, ny = py + S.vy[i]*dt, bounced = false;
        if (L0) {                                 // reflect off the nearest crossed outer edge
          let bt = 2, bex = 0, bey = 0;
          const rx = nx-px, ry = ny-py;
          for (let e = 0, q = 0; e < en; e++, q += 2) {
            const a1 = ee[q] << 1, b1 = ee[q+1] << 1, ax1 = ep[a1], ay1 = ep[a1+1], sx = ep[b1]-ax1, sy = ep[b1+1]-ay1;
            const den = rx*sy - ry*sx; if (den > -1e-6 && den < 1e-6) continue;
            const t = ((ax1-px)*sy - (ay1-py)*sx) / den, u = ((ax1-px)*ry - (ay1-py)*rx) / den;
            if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < bt) { bt = t; bex = sx; bey = sy; }
          }
          if (bt <= 1) {
            const el = Math.hypot(bex, bey) || 1, dxu = bex/el, dyu = bey/el, vd = S.vx[i]*dxu + S.vy[i]*dyu;
            S.vx[i] = (2*vd*dxu - S.vx[i]) * 0.72; S.vy[i] = (2*vd*dyu - S.vy[i]) * 0.72; S.vr[i] *= -0.7;
            nx = px + rx*bt*0.9; ny = py + ry*bt*0.9; bounced = true;
          }
        }
        S.x[i] = nx; S.y[i] = ny; S.rot[i] += S.vr[i] * dt;
        if (bounced) { S.bri[i] *= 0.72; this._splitShard(i); }   // each bounce dims the colour + re-breaks
        if (ny > floor || S.bri[i] < 0.05) { S.life[i] = 0; continue; }   // fell off the bottom / faded out
        const bri = S.bri[i];
        const hue = ((S.hue[i] + this.hue*2 + (1-bri)*120) % 360 + 360) % 360;   // iridescence shifts as it dims
        ctx.save();
        ctx.translate(nx, ny); ctx.rotate(S.rot[i]);
        ctx.fillStyle = `rgba(${hsl(hue, 95, 66)},${bri * 0.75})`;
        ctx.beginPath(); ctx.moveTo(S.ax[i], S.ay[i]); ctx.lineTo(S.bx[i], S.by[i]); ctx.lineTo(S.cx[i], S.cy[i]); ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    _frame(now) {
      this.raf = requestAnimationFrame(this._loop);
      if (!this.visible) { this.last = 0; return; }
      if (!this.last) this.last = now;
      const dt = Math.min((now - this.last) / 1000, 0.1);  // seconds, clamped
      this._dt = dt;
      this.t += dt * 4e-3 * this.speed;
      this.last = now;
      if (this.auto && dt > 0) {
        this._fps += (1 / dt - this._fps) * 0.05;
        this._adapt();
      }
      if (this._dirty) { this.resize(); this._dirty = false; }

      // Living glass: hue drift + spontaneous shatters (both tunable, gated).
      this.hue = (this.hue + dt * this.hueRate + 360) % 360;
      if (this.shatterOn && this.fillOn) {
        this.breakTimer -= dt;
        if (this.breakTimer <= 0) { this._breakRandom(); this.breakTimer = this.breakInterval * (0.6 + Math.random() * 0.8); }
      }

      const { ctx, R } = this, W = this.canvas.width, H = this.canvas.height;
      const hw = W / 2, hh = H / 2, fov = Math.min(W, H) * this.fov;
      this.smx += (this.mx - this.smx) * this.mouse;
      this.smy += (this.my - this.smy) * this.mouse;

      ctx.clearRect(0, 0, W, H);
      if (this.bg) { ctx.fillStyle = this.bg; ctx.fillRect(0, 0, W, H); }
      const pulse = 1 + Math.sin(this.t * 1.5) * this.breathe;

      const camZ = this.camZ;
      for (let li = 0; li < this.activeCount; li++) {
        const L = this.layers[li], { fv, rv, fe, nv, ne, proj } = L, sc = L.sc * (li === 0 ? pulse : 1);
        this._rot(this.t * L.spd[0] + this.smx * L.mInf, this.t * L.spd[1] + this.smy * L.mInf, this.t * L.spd[2]);
        for (let i = 0, a = 0, b = 0; i < nv; i++, a += 3, b += 2) {
          const x = fv[a], y = fv[a+1], z = fv[a+2];
          const rx = (R[0]*x + R[1]*y + R[2]*z) * sc, ry = (R[3]*x + R[4]*y + R[5]*z) * sc, rz = (R[6]*x + R[7]*y + R[8]*z) * sc;
          rv[a] = rx; rv[a+1] = ry; rv[a+2] = rz;
          const f = fov / (camZ - rz);      // perspective (–tz = camZ – rz)
          proj[b] = hw + rx * f; proj[b+1] = hh - ry * f;
        }
        // Current colour = base hue drifted over time ("colours change").
        L._col = hsl((L.h + this.hue) % 360, L.s, L.l);
        // Holographic pass: translucent, lit, depth-sorted faces (tier-gated).
        if (this.fillOn && L.fillFaces) this._fill(L);
        ctx.lineWidth = L.lw * this.dpr;
        ctx.strokeStyle = `rgba(${L._col},${L.la})`;
        ctx.beginPath();
        for (let i = 0, e = 0; i < ne; i++, e += 2) {
          const a = fe[e] << 1, b = fe[e+1] << 1;
          ctx.moveTo(proj[a], proj[a+1]); ctx.lineTo(proj[b], proj[b+1]);
        }
        ctx.stroke();
        if (L.dots && this.glowOn) {
          const s = this.sprites[li], h = s.width / 2;
          for (let i = 0, b = 0; i < nv; i++, b += 2) ctx.drawImage(s, proj[b] - h, proj[b+1] - h);
        }
      }
      this._shards(dt);   // flying glass debris on top of everything
    }

    start()   { if (!this.raf) this.raf = requestAnimationFrame(this._loop); }
    stop()    { cancelAnimationFrame(this.raf); this.raf = 0; }
    destroy() {
      this.stop();
      removeEventListener('mousemove', this._h.mousemove);
      removeEventListener('touchmove', this._h.touchmove);
      removeEventListener('pointerdown', this._h.pointerdown);
      removeEventListener('dblclick', this._h.dblclick);
      removeEventListener('resize', this._h.resize);
      document.removeEventListener('visibilitychange', this._h.visibilitychange);
      this._io?.disconnect();
    }
  }

  /* ── Options from a key→value source (URL query or canvas dataset) ─────────
     `has(k)`/`get(k)` abstract the source so the same parser serves both. */
  const readOpts = (has, get) => {
    const o = {};
    if (has('random')) o.random = true;
    if (has('seed')) o.seed = parseInt(get('seed'), 10);
    if (has('preset')) o.preset = get('preset');
    if (has('colors')) o.colors = get('colors').split(';');
    if (has('shapes')) o.shapes = get('shapes').split(',');
    if (has('speed')) o.speed = get('speed');
    if (has('quality')) { const q = get('quality'); o.quality = /^\d+$/.test(q) ? parseInt(q, 10) : q; }
    if (has('layers')) o.layers = parseInt(get('layers'), 10);
    if (has('shatter')) o.shatter = get('shatter') !== 'false' && get('shatter') !== '0';
    if (has('bounce')) { const v = get('bounce'); o.bounce = v === 'auto' ? 'auto' : (v !== 'false' && v !== '0'); }
    for (const k of ['breakInterval', 'reform', 'hueDrift', 'shardLife']) if (has(k)) o[k] = parseFloat(get(k));
    if (has('bg')) o.background = '#' + get('bg');
    if (has('background')) o.background = get('background');
    for (const k of ['breathe', 'fov', 'camera', 'mouse']) if (has(k)) o[k] = parseFloat(get(k));
    if (has('subdivisions')) o.subdivisions = parseInt(get('subdivisions'), 10);
    return o;
  };

  // Auto-init from `data-*` attributes (CSP-friendly — no inline script needed)
  // overridden by the URL query string (more specific / user-driven).
  const init = () => {
    const c = document.querySelector('canvas#geo, canvas[data-geo3d]');
    if (!c || c._geo3d) return;
    const d = c.dataset || {}, p = new URLSearchParams(location.search);
    c._geo3d = new Geo3D(c, {
      ...readOpts(k => k in d, k => d[k]),
      ...readOpts(k => p.has(k), k => p.get(k)),
    });
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init);
  else init();

  window.Geo3D = Geo3D;
})();

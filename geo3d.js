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

  const shape = (v, f) => ({ v, e: edgesOf(f) });
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
    { dpr: 1,   glow: false, layers: 2, sub: 0 },
    { dpr: 1,   glow: false, layers: 3, sub: 1 },
    { dpr: 1.5, glow: true,  layers: 4, sub: 1 },
    { dpr: 2,   glow: true,  layers: 6, sub: 1 },
    { dpr: 2,   glow: true,  layers: 6, sub: 2 },
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
        out.push({
          name, spd, fv, fe, nv, ne, col, proj: new Float64Array(nv * 2),
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
        resize: () => { this._dirty = true; },
        visibilitychange: () => { this.visible = !document.hidden; },
      };
      addEventListener('mousemove', this._h.mousemove);
      addEventListener('touchmove', this._h.touchmove, { passive: false });
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

    _frame(now) {
      this.raf = requestAnimationFrame(this._loop);
      if (!this.visible) { this.last = 0; return; }
      if (!this.last) this.last = now;
      const dt = now - this.last;
      this.t += dt * 4e-6 * this.speed;
      this.last = now;
      if (this.auto && dt > 0 && dt < 200) { // skip stalls / tab-wake spikes
        this._fps += (1000 / dt - this._fps) * 0.05;
        this._adapt();
      }
      if (this._dirty) { this.resize(); this._dirty = false; }

      const { ctx, R } = this, W = this.canvas.width, H = this.canvas.height;
      const hw = W / 2, hh = H / 2, fov = Math.min(W, H) * this.fov;
      this.smx += (this.mx - this.smx) * this.mouse;
      this.smy += (this.my - this.smy) * this.mouse;

      ctx.clearRect(0, 0, W, H);
      if (this.bg) { ctx.fillStyle = this.bg; ctx.fillRect(0, 0, W, H); }
      const pulse = 1 + Math.sin(this.t * 1.5) * this.breathe;

      for (let li = 0; li < this.activeCount; li++) {
        const L = this.layers[li], { fv, fe, nv, ne, proj } = L, sc = L.sc * (li === 0 ? pulse : 1);
        this._rot(this.t * L.spd[0] + this.smx * L.mInf, this.t * L.spd[1] + this.smy * L.mInf, this.t * L.spd[2]);
        for (let i = 0, a = 0, b = 0; i < nv; i++, a += 3, b += 2) {
          const x = fv[a], y = fv[a+1], z = fv[a+2];
          const tz = (R[6]*x + R[7]*y + R[8]*z) * sc - this.camZ, f = fov / -tz;
          proj[b]   = hw + (R[0]*x + R[1]*y + R[2]*z) * sc * f;
          proj[b+1] = hh - (R[3]*x + R[4]*y + R[5]*z) * sc * f;
        }
        ctx.lineWidth = L.lw * this.dpr;
        ctx.strokeStyle = `rgba(${L.col},${L.la})`;
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
    }

    start()   { if (!this.raf) this.raf = requestAnimationFrame(this._loop); }
    stop()    { cancelAnimationFrame(this.raf); this.raf = 0; }
    destroy() {
      this.stop();
      removeEventListener('mousemove', this._h.mousemove);
      removeEventListener('touchmove', this._h.touchmove);
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

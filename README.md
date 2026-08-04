# geo3d

Animated nested wireframe polyhedra on a 2D canvas — geodesic spheres and
Platonic solids as glowing nested wireframes, tilted by pointer movement.
**Zero dependencies, no build step, ~4 KB.**

**[▶ Live demo](https://yrbane.github.io/geo3d/)** · **[🎲 Random](https://yrbane.github.io/geo3d/?random)** · **[🔥 fire ×4](https://yrbane.github.io/geo3d/?preset=fire&layers=4)** · **[🟢 matrix](https://yrbane.github.io/geo3d/?preset=matrix&bg=000000)**

## Features

- **7 shapes** — icosahedron, octahedron, tetrahedron, cube, dodecahedron, and two geodesic spheres
- **8 colour presets** + fully custom palettes
- **Holographic faces** — a random subset of polygons fills translucently (each
  with its own transparency), with two-sided lighting and specular "reflections"
  that sweep as the solids turn (enabled only on capable hardware — see below)
- **Living glass** — **click a face to shatter it** (or **double-click to blow up
  every face at once**) into iridescent shards that are the face's own triangulated
  pieces (varied sizes, matching its surface). They live in **3D** and **bounce off whichever geode sphere they cross** — an inner piece flung outward ricochets off a bigger shell, an outer piece falling inward hits a smaller shell it passes in front of — **re-break into a random number of smaller pieces** and **dim a little
  on each bounce**, then **fall off the bottom of the screen** under gravity. Faces
  also pop and reform on their own, and the palette slowly drifts. Fully tunable.
- **Seeded generative mode** — `?random` picks a seed you can permalink and reproduce
- **Pointer & touch** driven rotation with smooth easing
- **Adaptive quality** — probes the device and continuously watches the frame
  rate, dialling detail up or down so it stays smooth on any GPU/CPU
- **Retina-crisp** (device-pixel-ratio aware), pauses off-screen / in background tab, respects `prefers-reduced-motion`
- Configurable by **URL query** *or* a **programmatic API**

## Quick start

```html
<canvas id="geo"></canvas>
<script src="geo3d.js"></script>
```

The script auto-initialises the first `<canvas id="geo">` (or any
`<canvas data-geo3d>`) and reads its options from the page's `?query` string.

## Programmatic API

```js
const anim = new Geo3D(canvas, { preset: 'fire', layers: 4, shapes: ['dodec', 'ico'] });

anim.stop();      // pause
anim.start();     // resume
anim.destroy();   // remove listeners + observers
anim.info;        // e.g. "4L · fire · dodec+ico+dodec+ico"
anim.seed;        // uint32 seed (reproduce a ?random run)
```

## Options

Every option is also accepted as a URL query parameter on the auto-init canvas.

| Option | Values | Default |
|--------|--------|---------|
| `shapes` | `array` or `a,b,c` (cycled per layer) | `geo1,ico,oct,tet,cube,dodec` |
| `preset` | preset name or `['r,g,b', …]` | `default` |
| `colors` | explicit `['r,g,b', …]` (query: `r,g,b;r,g,b`) | — |
| `layers` | `1`–`6` | `3` |
| `quality` | `auto` · `low` `medium` `high` `ultra` · `0`–`4` | `auto` |
| `speed` | `slow` `normal` `fast` `insane` or a number | `normal` |
| `background` / `bg` | `#rrggbb` (bare hex via `?bg=`) | transparent |
| `breathe` | `0`–`1` (outer pulsation) | `0.04` |
| `subdivisions` | `0`–`3` (geodesic detail) | `1` |
| `fov` | `0.3`–`2` | `0.9` |
| `camera` | `1.5`–`8` | `3.5` |
| `mouse` | `0`–`1` (higher = snappier) | `0.035` |
| `random` | flag | off |
| `seed` | uint32 | auto |
| `shatter` | flag (`0`/`false` to disable) | on |
| `breakInterval` | avg seconds between spontaneous shatters | `6` |
| `reform` | seconds a shattered face stays gone | `5` |
| `bounce` | shards bounce in 3D off the geode spheres they cross — `auto` (ultra) · `true` · `false` | `auto` |
| `hueDrift` | palette drift, degrees/second | `5` |
| `shardLife` | shard safety max-age, seconds (they usually fall off-screen first) | `6` |

```
?random
?preset=fire&layers=4
?shapes=dodec,cube&preset=neon&speed=fast
?preset=matrix&bg=000000&subdivisions=2
?seed=1234567890          # reproduce a random you liked
```

**Shapes:** `ico` `oct` `tet` `cube` `dodec` `geo1` `geo2`
**Presets:** `default` `neon` `fire` `ice` `pastel` `mono` `gold` `matrix`

## Adaptive performance

By default (`quality: 'auto'`) geo3d **tests the machine it runs on** and keeps
itself smooth:

1. It picks a **starting tier** from device hints — logical cores
   (`navigator.hardwareConcurrency`), memory (`navigator.deviceMemory`) and
   pixel density.
2. It then **watches the real frame rate** (smoothed) and climbs or drops one
   quality tier at a time, with hysteresis and a cooldown so it never flaps.

The heavy, pretty extras only switch on when there's headroom and are the first
to go under load: **specular reflections** (ultra) and **translucent lit faces**
(high) appear on capable machines, then degradation continues cheapest-impact
first — **pixel ratio → vertex glow → layer count → geodesic detail**. The
layout is regenerated from the same seed on every change, so re-tuning is
seamless — no popping to a different figure.

Pin a fixed tier with `quality: 'high'` / `?quality=4` to opt out.

## How it works

Wireframes are rendered with Canvas 2D and a hand-rolled 3D pipeline, tuned for
a steady 60 fps on modest hardware:

- **Typed arrays** (`Float64Array` / `Uint16Array`) for vertices, edges and
  projections — cache-friendly, zero per-frame allocation.
- **Rotation matrix composed analytically** (`Rz·Rx·Ry` in a single trig pass,
  no intermediate matrix multiply).
- **Pre-rendered glow sprites** on an offscreen canvas — no gradient allocated
  per frame; vertices are blitted, not redrawn.
- **Batched stroke path** — one `beginPath`/`stroke` per layer.
- **`IntersectionObserver` + `visibilitychange`** pause rendering when the
  canvas is off-screen or the tab is hidden.
- **Timestamp-based** animation, so speed is frame-rate independent.

## License

MIT

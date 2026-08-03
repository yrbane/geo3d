# geo3d

Lightweight 3D wireframe geometry animation. Three nested polyhedra rotating in a canvas, driven by mouse movement. Zero dependencies.

![demo](https://img.shields.io/badge/demo-live-6c63ff?style=flat-square)

**[Live demo](https://yrbane.github.io/geo3d/)**

## What it does

Renders three nested wireframe polyhedra with Canvas 2D and manual 3D projection:

| Layer | Shape | Vertices | Edges | Color |
|-------|-------|----------|-------|-------|
| Outer | Geodesic sphere (subdivided icosahedron) | 42 | 120 | Purple |
| Middle | Icosahedron | 12 | 30 | Cyan |
| Inner | Octahedron | 6 | 12 | Red |

Each layer rotates on 3 axes at different speeds. Mouse movement tilts the assembly with smooth interpolation.

## Performance

Optimized for 60fps on modest hardware:

- **Pre-rendered glow sprites** on offscreen canvas (zero gradient allocation per frame)
- **Float64Array** for vertices and projection buffers (cache-friendly, zero GC)
- **Analytically composed rotation matrix** Rz * Rx * Ry in one pass (no intermediate matrix multiply)
- **IntersectionObserver** pauses rendering when off-screen
- **Timestamp-based animation** for frame-rate independence

Total per frame: 162 edge draw ops + 18 sprite blits.

## Usage

```html
<canvas id="geo" style="width:500px;height:500px"></canvas>
<script src="geo3d.js"></script>
```

Or just open `index.html`.

## Configuration

Edit the `CONFIG` object and `layerDefs` array at the top of the script:

```javascript
var CONFIG = {
  cameraZ: 3.5,        // camera distance
  fovFactor: 0.9,      // field-of-view
  mouseSmooth: 0.035,   // mouse lerp (lower = smoother)
  breathe: 0.04,       // outer layer pulsation
  subdivisions: 1,     // 1 = 42 vertices, 2 = 162 vertices
};

// Per layer: scale, speed, color, line width, opacity...
var layerDefs = [
  { sc:1.5, spd:[.5,.35,.2], col:'108,99,255', ... },
  ...
];
```

## Advanced version

A richer, URL-configurable build lives in [`geo3d/`](geo3d/): 7 shapes
(`ico` `oct` `tet` `cube` `dodec` `geo1` `geo2`), 8 color presets
(`default` `neon` `fire` `ice` `pastel` `mono` `gold` `matrix`), a `?random`
mode, touch support, and 11 URL parameters (`preset`, `layers`, `shapes`,
`speed`, `bg`, `breathe`, `subdivisions`, `fov`, `camera`, `mouse`). See
[`geo3d/README.md`](geo3d/README.md) for the full parameter reference.

```
geo3d/?random
geo3d/?preset=fire&layers=4
geo3d/?shapes=cube,dodec&preset=neon
```

## License

MIT

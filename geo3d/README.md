# geo3d

Wireframe polyhedra animation. Canvas 2D, zero deps.

**[Demo](https://yrbane.github.io/geo3d/)** · **[Random](https://yrbane.github.io/geo3d/?random)**

## Shapes

`geo1` `geo2` `ico` `oct` `tet` `cube` `dodec`

## Presets

`default` `neon` `fire` `ice` `pastel` `mono` `gold` `matrix`

## URL params

| Param | Values | Default |
|-------|--------|---------|
| `random` | flag | off |
| `preset` | preset name | `default` |
| `layers` | 1–6 | 3 |
| `shapes` | comma-separated | auto |
| `speed` | `slow` `normal` `fast` `insane` | `normal` |
| `bg` | hex sans `#` | transparent |
| `breathe` | 0–1 | 0.04 |
| `subdivisions` | 0–3 | 1 |
| `fov` | 0.3–2.0 | 0.9 |
| `camera` | 1.5–8.0 | 3.5 |
| `mouse` | 0–1 | 0.035 |

```
?random
?preset=fire&layers=4
?shapes=cube,dodec&preset=neon
?speed=insane&breathe=0.2
?preset=matrix&bg=000000
```

## License

MIT

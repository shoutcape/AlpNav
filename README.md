# AlpNav

## Local Panorama Artwork

For MVP speed, Zillertal Arena panorama tiles should live in the repo instead of being fetched from the reference site at runtime.

Run:

```bash
pnpm sync:arena-artwork
```

This mirrors the reference panorama tiles into `public/resorts/zillertal-arena/panorama/` and writes a manifest at `public/resorts/zillertal-arena/panorama/manifest.json`.

Current assumptions:

- the reference site exposes four artwork resolutions through its `zoomLevels` config
- remote tile zooms start at `17`
- each tile is `256x256`

Use the local template `/resorts/zillertal-arena/panorama/{z}/pano_{x}_{y}.jpg` in the app so the browser only hits local static assets.

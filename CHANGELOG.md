# Changelog

## 2026-03-17

- Added a local Zillertal Arena panorama sync script and cached the resort artwork into `public/resorts/zillertal-arena/panorama/`.
- Replaced the placeholder home page with a PixiJS v8 panorama map shell that supports smooth pan and zoom from local tiles.
- Tuned level blending and zoom limits so higher zoom uses sharper artwork without flashing or low-res fallback artifacts.

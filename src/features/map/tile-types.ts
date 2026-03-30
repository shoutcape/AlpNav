import type { PanoramaLevel, PanoramaManifest } from "./types";

export type TileDescriptor = {
  key: string;
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  srcWidth: number;
  srcHeight: number;
};

export function buildTileUrl(template: string, remoteZoom: number, x: number, y: number) {
  return template
    .replaceAll("{z}", String(remoteZoom))
    .replaceAll("{x}", String(x))
    .replaceAll("{y}", String(y));
}

export function createTileDescriptors(manifest: PanoramaManifest, level: PanoramaLevel, maxLevel: PanoramaLevel) {
  const scale = maxLevel.width / level.width;
  const tiles: TileDescriptor[] = [];

  for (let y = 0; y < level.rows; y += 1) {
    for (let x = 0; x < level.columns; x += 1) {
      const tileWidth = Math.min(manifest.tileSize, level.width - x * manifest.tileSize);
      const tileHeight = Math.min(manifest.tileSize, level.height - y * manifest.tileSize);

      tiles.push({
        key: `${level.remoteZoom}-${x}-${y}`,
        src: buildTileUrl(manifest.localTemplate, level.remoteZoom, x, y),
        left: x * manifest.tileSize * scale,
        top: y * manifest.tileSize * scale,
        width: tileWidth * scale,
        height: tileHeight * scale,
        srcWidth: tileWidth,
        srcHeight: tileHeight,
      });
    }
  }

  return tiles;
}

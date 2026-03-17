export type PanoramaLevel = {
  localIndex: number;
  remoteZoom: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
};

export type PanoramaManifest = {
  resortId: string;
  pageUrl: string;
  tileSize: number;
  remoteBaseZoom: number;
  localTemplate: string;
  levels: PanoramaLevel[];
};

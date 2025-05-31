export interface TileTask {
	z: number;
	x: number;
	y: number;
}

export type TileFormat = "png" | "jpg" | "webp" | "avif";

export interface SharedWorkerData {
	inputPath: string;
	outputPathBase: string;
	tileSize: number;
	tileFormat: TileFormat;
	imageWidth: number;
	imageHeight: number;
	maxZoom: number;
	maxMag: number;
}

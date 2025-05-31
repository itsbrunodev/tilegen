import fs from "node:fs/promises";
import { join } from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import sharp, { type SharpOptions } from "sharp";

import type { SharedWorkerData, TileTask } from "@/lib/types";

import { SHARP_CONFIG } from "@/constants/sharp";

const {
	inputPath,
	outputPathBase,
	tileSize,
	tileFormat,
	imageWidth,
	imageHeight,
	maxZoom,
	maxMag,
} = workerData as SharedWorkerData;

const baseImage = sharp(inputPath, SHARP_CONFIG);
const emptyTileBuffer = await sharp({
	create: {
		width: tileSize,
		height: tileSize,
		channels: 4,
		background: { r: 0, g: 0, b: 0, alpha: 0 },
	},
})
	.toFormat(tileFormat)
	.toBuffer();

const canvasTemplate: SharpOptions = {
	create: {
		width: tileSize,
		height: tileSize,
		channels: 4,
		background: { r: 0, g: 0, b: 0, alpha: 0 },
	},
};

if (!parentPort) {
	console.error("Worker started without a parent port.");
	process.exit(1);
}

parentPort.on("message", async (task: TileTask | "done") => {
	if (task === "done") {
		parentPort!.postMessage("terminated");
		parentPort!.close();
		return;
	}

	const { z, x, y } = task;
	const outputPath = join(outputPathBase, `${z}`, `${x}`, `${y}.png`);

	try {
		// coverage in source pixels per tile
		const coverage = (tileSize / maxMag) * 2 ** (maxZoom - z);

		// compute source coords, clamped
		const sx = Math.max(0, Math.round(x * coverage));
		const sy = Math.max(0, Math.round(y * coverage));
		const ex = Math.min(imageWidth, Math.round((x + 1) * coverage));
		const ey = Math.min(imageHeight, Math.round((y + 1) * coverage));

		const sw = ex - sx;
		const sh = ey - sy;

		if (sw > 0 && sh > 0) {
			const sourceImage = baseImage
				.clone()
				.extract({ left: sx, top: sy, width: sw, height: sh })
				.resize({
					width: Math.round((sw / coverage) * tileSize),
					height: Math.round((sh / coverage) * tileSize),
					fit: sharp.fit.fill,
					kernel: sharp.kernel.nearest,
				});

			// compute offsets onto canvas
			const offsetX = Math.round(((sx - x * coverage) / coverage) * tileSize);
			const offsetY = Math.round(((sy - y * coverage) / coverage) * tileSize);

			await sharp(canvasTemplate)
				.composite([
					{
						input: await sourceImage.toBuffer(),
						left: offsetX,
						top: offsetY,
					},
				])
				.toFormat(tileFormat)
				.toFile(outputPath);
		} else {
			await fs.writeFile(outputPath, emptyTileBuffer);
		}

		parentPort!.postMessage("done");
	} catch (err) {
		console.error(`Worker error z${z}-x${x}-y${y}:`, err);
		parentPort!.postMessage("error");
	}
});

import { parentPort, workerData } from "node:worker_threads";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import sharp from "sharp";

import type { TileTask } from "@/lib/types";

interface SharedWorkerData {
	inputPath: string;
	outputPathBase: string;
	tileSize: number;
	imageWidth: number;
	imageHeight: number;
	maxZoom: number;
	maxMag: number;
}

// Destructure once
const {
	inputPath,
	outputPathBase,
	tileSize,
	imageWidth,
	imageHeight,
	maxZoom,
	maxMag,
} = workerData as SharedWorkerData;

if (!parentPort) process.exit(1);

const emptyTilePromise = sharp({
	create: {
		width: tileSize,
		height: tileSize,
		channels: 4,
		background: { r: 0, g: 0, b: 0, alpha: 0 },
	},
})
	.png({ compressionLevel: 6 })
	.toBuffer();

function newCanvas() {
	return sharp({
		create: {
			width: tileSize,
			height: tileSize,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	});
}

parentPort.on("message", async (task: TileTask | "done") => {
	if (task === "done") {
		parentPort!.postMessage("terminated");
		parentPort!.close();
		return;
	}

	const { z, x, y } = task;
	const dir = join(outputPathBase, `${z}`, `${x}`);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const outputPath = join(dir, `${y}.png`);

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
			// extract + resize
			const resized = await sharp(inputPath)
				.extract({ left: sx, top: sy, width: sw, height: sh })
				.resize({
					width: Math.round((sw / coverage) * tileSize),
					height: Math.round((sh / coverage) * tileSize),
					fit: sharp.fit.fill,
					kernel: sharp.kernel.nearest,
				})
				.png(
					// for zooms 0-2, use palette quantization & max compression
					z <= 2
						? { palette: true, quality: 50, compressionLevel: 9 }
						: { compressionLevel: 6 },
				)
				.toBuffer();

			// compute offsets onto canvas
			const offsetX = Math.round(((sx - x * coverage) / coverage) * tileSize);
			const offsetY = Math.round(((sy - y * coverage) / coverage) * tileSize);

			await newCanvas()
				.composite([{ input: resized, left: offsetX, top: offsetY }])
				.png(
					// again choose low‑ or high‑quality by zoom
					z <= 2
						? { palette: true, quality: 50, compressionLevel: 9 }
						: { compressionLevel: 6 },
				)
				.toFile(outputPath);
		} else {
			// write the prebuilt empty tile
			const buf = await emptyTilePromise;
			await sharp(buf).toFile(outputPath);
		}

		parentPort!.postMessage("done");
	} catch (err) {
		console.error(`Worker error z${z}-x${x}-y${y}:`, err);
		parentPort!.postMessage("error");
	}
});

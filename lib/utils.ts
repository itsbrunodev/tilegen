import sharp from "sharp";

import { SHARP_CONFIG } from "@/constants/sharp";

import type { TileTask } from "./types";

/**
 * Get the width and height of an image
 */
export async function getImageMetadata(path: string) {
	const { width, height } = await sharp(path, SHARP_CONFIG).metadata();

	if (!width || !height) throw new Error("Invalid image dimensions");

	return { width, height };
}

/**
 * Calculate the maximum zoom level for a given image
 */
export function calculateMaxZoom(
	maxMagnification: number,
	tileSize: number,
	width: number,
	height: number,
): number {
	const maxDim = Math.max(width, height);
	return Math.ceil(Math.log2((maxDim * maxMagnification) / tileSize));
}

/**
 * Build a list of tasks to process
 */
export function buildTasks(
	width: number,
	height: number,
	maxZoom: number,
	tileSize: number,
	maxMag: number,
): TileTask[] {
	const tasks: TileTask[] = [];
	for (let z = 0; z <= maxZoom; z++) {
		const pxPerTile = (tileSize / maxMag) * 2 ** (maxZoom - z);
		const cols = Math.ceil(width / pxPerTile);
		const rows = Math.ceil(height / pxPerTile);
		for (let x = 0; x < cols; x++) {
			for (let y = 0; y < rows; y++) {
				tasks.push({ z, x, y });
			}
		}
	}
	return tasks;
}

/**
 * Render a progress bar
 */
export function renderProgressBar(
	completed: number,
	total: number,
	width = 40,
): string {
	const ratio = completed / total;
	const filledCount = Math.floor(ratio * width);
	const emptyCount = width - filledCount;
	const percent = Math.floor(ratio * 100);

	// Fill and empty chars
	const fillChar = "█";
	const emptyChar = "░";

	const bar = fillChar.repeat(filledCount) + emptyChar.repeat(emptyCount);

	return `${bar} ${percent.toString().padStart(3)}% (${completed}/${total})`;
}

/**
 * Format seconds into HH:MM:SS
 */
export function formatDuration(sec: number): string {
	const hrs = Math.floor(sec / 3600);
	const mins = Math.floor((sec % 3600) / 60);
	const secs = Math.floor(sec % 60);
	return [
		hrs.toString().padStart(2, "0"),
		mins.toString().padStart(2, "0"),
		secs.toString().padStart(2, "0"),
	].join(":");
}

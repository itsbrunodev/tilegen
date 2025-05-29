import type { SharpOptions } from "sharp";

export const SHARP_CONFIG = {
	/**
	 * Disable the default input pixel limit of 268402689.
	 */
	limitInputPixels: false,
} as SharpOptions;

export const CONFIG = {
	/**
	 * The tile size of each image. (most commonly used in leaflet)
	 * 
	 * Recommended amount is `256`.
	 */
	TILE_SIZE: 256,
	/**
	 * **What this is**:
	 * - At the deepest zoom level, each tile‑pixel corresponds to
	 * `MAXIMUM_MAGNIFICATION * MAXIMUM_MAGNIFICATION` original pixels.
	 * - A higher value here lets you zoom in further (more detail),
	 * at the cost of more tiles and more storage.
	 *
	 * If you want one additional zoom‑in level,
	 * increase `MAXIMUM_MAGNIFICATION` by 1 (each step doubles the source‑pixel
	 * density before tiling).
	 *
	 * Recommended level is `1`.
	 */
	MAXIMUM_MAGNIFICATION: 1,
	/**
	 * The high-quality image path which will be used to generate the tiles relative to the root.
	 */
	INPUT_PATH: "./input.png",
	/**
	 * The output directory for the tiles relative to the root.
	 */
	OUTPUT_DIR: "./out/",
} as const;

import chalk from "chalk";
import fs from "node:fs";
import { cpus } from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";

import { Command } from "commander";

import {
	buildTasks,
	calculateMaxZoom,
	formatDuration,
	getImageMetadata,
	renderProgressBar,
} from "@/lib/utils";
import type { SharedWorkerData, TileFormat } from "@/lib/types";

import { CONFIG } from "@/constants/config";

import { version } from "@/package.json" assert { type: "json" };

async function main() {
	const program = new Command();

	const {
		TILE_SIZE: TILE_SIZE_DEFAULT,
		TILE_FORMAT: TILE_FORMAT_DEFAULT,
		MAXIMUM_MAGNIFICATION: MAXIMUM_MAGNIFICATION_DEFAULT,
		INPUT_PATH: INPUT_PATH_DEFAULT,
		OUTPUT_DIR: OUTPUT_DIR_DEFAULT,
	} = CONFIG;

	program
		.name("tilegen")
		.description(
			"A fast, multi-threaded tool to slice large images into map-style tiles at multiple zoom levels.",
		)
		.version(version, "-v, --version", "Display the version number.")
		.option(
			"-t, --tile-size <TILE_SIZE>",
			"The tile size of each image.",
			(value) => Number(value),
			TILE_SIZE_DEFAULT,
		)
		.option<TileFormat>(
			"-f, --tile-format <TILE_FORMAT>",
			"The tile format to use.",
			(value) => {
				// use the default if the value is invalid
				switch (value.toLowerCase()) {
					case "png":
					case "jpg":
					case "webp":
					case "avif":
						return value as TileFormat;
					default:
						return TILE_FORMAT_DEFAULT;
				}
			},
			TILE_FORMAT_DEFAULT,
		)
		.option(
			"-m, --max-mag <MAXIMUM_MAGNIFICATION>",
			"The maximum magnification factor.",
			(value) => Number(value),
			MAXIMUM_MAGNIFICATION_DEFAULT,
		)
		.option(
			"-i, --input <INPUT_PATH>",
			"The path to the input image.",
			INPUT_PATH_DEFAULT,
		)
		.option(
			"-o, --output <OUTPUT_DIR>",
			"The path to the output directory where the tiles will be saved.",
			OUTPUT_DIR_DEFAULT,
		)
		.parse();

	const {
		tileSize: TILE_SIZE,
		tileFormat,
		maxMag: MAXIMUM_MAGNIFICATION,
		input: INPUT_PATH,
		output: OUTPUT_DIR,
	} = program.opts<{
		tileSize: number;
		tileFormat: TileFormat;
		maxMag: number;
		input: string;
		output: string;
	}>();

	if (
		!TILE_SIZE ||
		!tileFormat ||
		!MAXIMUM_MAGNIFICATION ||
		!INPUT_PATH ||
		!OUTPUT_DIR
	) {
		program.help();
		process.exit(1);
	}

	// resolve input and output paths
	const inputPath = path.resolve(INPUT_PATH);
	const outputDir = path.resolve(OUTPUT_DIR);

	const tileSize = Number(TILE_SIZE);

	console.log(
		`Reading image metadata from ${chalk.bold(
			path.relative(process.cwd(), inputPath),
		)}...`,
	);

	const { width, height } = await getImageMetadata(inputPath);

	// calculate the maximum zoom level if not provided
	const maxZoom = calculateMaxZoom(
		MAXIMUM_MAGNIFICATION,
		tileSize,
		width,
		height,
	);

	console.log(`Tile size: ${chalk.bold(`${tileSize}×${tileSize}`)}`);
	console.log(`Tile format: ${chalk.bold(tileFormat.toUpperCase())}`);
	console.log(`Computed max zoom level: ${chalk.bold(`${maxZoom}`)}`);

	// create a list of tasks to generate image tiles
	const tasks = buildTasks(
		width,
		height,
		maxZoom,
		tileSize,
		MAXIMUM_MAGNIFICATION,
	);
	const totalTasks = tasks.length;

	const uniqueDirs = new Set<string>();

	for (const task of tasks) {
		const dir = path.join(outputDir, `${task.z}`, `${task.x}`);
		uniqueDirs.add(dir);
	}

	for (const dir of uniqueDirs) {
		// only create if it doesn't exist to avoid potential errors on re-runs
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	}

	console.log(
		`Created ${chalk.bold(`${uniqueDirs.size}`)} output directories.`,
	);

	let completed = 0;
	let activeWorkers = 0;
	let taskIndex = 0;

	// record the start time for tiles per second calculation
	const startTime = Date.now();

	console.log(
		`Spawning ${chalk.bold(`${cpus().length}`)} workers for ${chalk.bold(
			`${totalTasks}`,
		)} tiles.`,
	);

	// dispatch tasks to a worker
	function dispatch(worker: Worker): void {
		// get the next task
		const next = tasks[taskIndex];
		if (taskIndex < totalTasks) {
			taskIndex++; // increment index for the next dispatch
		}
		worker.postMessage(next ?? "done"); // send the task or "done" signal
	}

	// launch a pool of worker threads
	for (let i = 0; i < cpus().length; i++) {
		const worker = new Worker(path.join(__dirname, "worker.ts"), {
			workerData: {
				inputPath,
				outputPathBase: outputDir,
				tileSize,
				tileFormat,
				imageWidth: width,
				imageHeight: height,
				maxZoom,
				maxMag: MAXIMUM_MAGNIFICATION,
			} as SharedWorkerData,
		});

		activeWorkers++;

		// handle messages from the worker
		worker.on("message", (msg) => {
			if (msg === "done") {
				completed++;

				const elapsedSecs = (Date.now() - startTime) / 1000;
				const tps = completed / elapsedSecs;
				const remaining = totalTasks - completed;
				const etaSecs = tps > 0 ? remaining / tps : 0;

				// update progress bar in the terminal
				process.stdout.write(
					`\r${renderProgressBar(
						completed,
						totalTasks,
					)}, ${chalk.bold(`${Math.round(tps)}`)} tiles/s, elapsed: ${chalk.bold(
						formatDuration(elapsedSecs),
					)}, eta: ${chalk.bold(formatDuration(etaSecs))}`,
				);

				dispatch(worker); // dispatch next task to the worker
			} else if (msg === "terminated") {
				activeWorkers--;

				if (completed === totalTasks && activeWorkers === 0) {
					const totalElapsed = (Date.now() - startTime) / 1000;

					process.stdout.write(
						`\n${chalk.greenBright(
							`Success! Generated ${chalk.bold(
								`${totalTasks}`,
							)} tiles in ${chalk.bold(formatDuration(totalElapsed))}.\n`,
						)}`,
					);

					process.exit(0); // exit when all tasks are done
				}
			}
		});

		// handle worker errors
		worker.on("error", (err) => {
			console.error("\nWorker encountered error:", err);
		});

		// start the first task for each worker
		dispatch(worker);
	}
}

// execute the main function and handle any errors
main().catch((err) => {
	console.error("error:", err);
	process.exit(1);
});

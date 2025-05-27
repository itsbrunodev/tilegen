import { cpus } from "node:os";
import { Worker } from "node:worker_threads";
import path from "node:path";
import fs from "node:fs";

import {
	getImageMetadata,
	calculateMaxZoom,
	buildTasks,
	renderProgressBar,
	formatDuration,
} from "../lib/utils";

import { DEFAULTS } from "../constants/config";

async function main() {
	const { TILE_SIZE, MAXIMUM_MAGNIFICATION, INPUT_PATH, OUTPUT_DIR } = DEFAULTS;

	// resolve input and output paths
	const inputPath = path.resolve(INPUT_PATH);
	const outputDir = path.resolve(OUTPUT_DIR);

	const tileSize = Number(TILE_SIZE);

	// ensure the output directory exists
	if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

	console.log("Reading image metadata...");

	const { width, height } = await getImageMetadata(inputPath);

	// calculate the maximum zoom level if not provided
	const maxZoom =calculateMaxZoom(MAXIMUM_MAGNIFICATION, tileSize, width, height);

	console.log(`Computed max zoom level: ${maxZoom}`);

	// create a list of tasks to generate image tiles
	const tasks = buildTasks(
		width,
		height,
		maxZoom,
		tileSize,
		DEFAULTS.MAXIMUM_MAGNIFICATION,
	);
	const totalTasks = tasks.length;
	let completed = 0;
	let activeWorkers = 0;

	// record the start time for tiles per second calculation
	const startTime = Date.now();

	console.log(`Spawning ${cpus().length} workers for ${totalTasks} tiles`);

	// dispatch tasks to a worker
	function dispatch(worker: Worker) {
		const next = tasks.shift();
		worker.postMessage(next ?? "done");
	}

	// launch a pool of worker threads
	for (let i = 0; i < cpus().length; i++) {
		const worker = new Worker(path.join(__dirname, "worker.js"), {
			workerData: {
				inputPath,
				outputPathBase: outputDir,
				tileSize,
				imageWidth: width,
				imageHeight: height,
				maxZoom,
				maxMag: DEFAULTS.MAXIMUM_MAGNIFICATION,
			},
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
					`\r${renderProgressBar(completed, totalTasks)}, ${Math.round(tps)} tiles/s, eta: ${formatDuration(etaSecs)}`,
				);

				dispatch(worker); // dispatch next task to the worker
			} else if (msg === "terminated") {
				activeWorkers--;

				if (completed === totalTasks && activeWorkers === 0) {
					const totalElapsed = (Date.now() - startTime) / 1000;

					process.stdout.write(
						`\nSuccess! Generated ${totalTasks} tiles in ${formatDuration(
							totalElapsed,
						)}.\n`,
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

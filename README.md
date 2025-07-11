# 🗺️ tilegen

A fast, multi-threaded tool to slice large images into map‑style tiles at multiple zoom levels.

## Features

- **Automatic zoom‑level calculation**: Dynamically determines how deep to go based on image dimensions and a configurable magnification factor.
- **Worker‑thread pool**: Fully utilizes all CPU cores via `worker_threads`.

## Installation

### NPM

```bash
# npm
npm install tilegen -g
# yarn
yarn add tilegen -g
# pnpm
pnpm add tilegen -g
# bun
bun add tilegen -g
```

### Source

Before installing, make sure you have [Bun](https://bun.sh/docs/installation) installed on your system.

```bash
git clone https://github.com/itsbrunodev/tilegen.git
cd tilegen
bun install
````

## Usage

### Help

To get help, run the following command:

```bash
tilegen -h
```

### CLI

tilegen can be used from the command-line with the following options:

| Option | Description | Default |
| --- | --- | --- |
| `-t, --tile-size <TILE_SIZE>` | The tile size of each image. | `256` |
| `-f, --tile-format <TILE_FORMAT>` | The format of the output tiles. | `webp` |
| `-m, --max-mag <MAXIMUM_MAGNIFICATION>` | The maximum magnification factor. | `1` |
| `-i, --input <INPUT_PATH>` | The path to the input image. | `./input.png` |
| `-o, --output <OUTPUT_DIR>` | The path to the output directory where the tiles will be saved. | `./out/` |

### Example usage

```bash
tilegen -t 512 -f webp -m 4 -i ./input.png -o ./out/
```

This will generate tiles at `./out/{z}/{x}/{y}.webp`, with a tile size of `512` and a maximum magnification of `4` from the input image `./input.png`.

### What is maximum magnification?

`MAXIMUM_MAGNIFICATION` controls how deep your zoom levels go. It adjusts how many source‑pixels each tile covers at the deepest level.

Increasing it by 1 gives you one extra zoom‑in level (more detail at deepest zoom), at the cost of more tiles and storage.

For example, if `MAXIMUM_MAGNIFICATION` is `4`, at the deepest zoom level, each tile will cover 4x4 = 16 source pixels. If the input image is 1024x1024, this means there will be 4 zoom levels in total (`2^4 = 16`).

## Demo

[itsbrunodev/colonycraft](https://github.com/itsbrunodev/colonycraft) is a map based on the ColonyCraft Minecraft server. The image of the map was generated using [mc-mapper](https://github.com/itsbrunodev/mc-mapper).

## How it works

- First, the tool reads the input image's dimensions to understand its size.
- It then automatically calculates the optimal number of zoom levels based on the image's resolution and a configurable `MAXIMUM_MAGNIFICATION` setting.
- A queue of tasks is created, where each task corresponds to a single tile at a specific zoom level and coordinate.
- A pool of worker threads then uses all available CPU cores to process these tasks in parallel, rapidly slicing and resizing sections of the source image.
- Finally, the generated tiles are saved into a standard `z/x/y.png` directory structure, making them ready for use with web viewers (like Leaflet).

## License

tilegen is under the [MIT](./LICENSE.md) license.

/*
 * Variant generation: decodes each declared source once, applies the optional
 * crop, emits every width/format combination, deletes stale outputs, and
 * writes the generated manifest. The only module here that needs sharp.
 *
 * Raster sources have EXIF orientation applied, metadata (including GPS)
 * stripped, and are never upscaled. SVG sources are rasterized at each target
 * width (vectors scale freely).
 */

import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { defaultPublicPath, entryFingerprint } from "./manifest.mjs";
import { checkDrift, listSourceFiles } from "./sources.mjs";

/** @type {Record<import("./index.mjs").Format, { toFormat: "avif" | "jpeg" | "png" | "webp", options: object }>} */
const formatSettings = {
  avif: { toFormat: "avif", options: { quality: 60 } },
  jpg: { toFormat: "jpeg", options: { quality: 80, mozjpeg: true } },
  png: { toFormat: "png", options: { compressionLevel: 9 } },
  webp: { toFormat: "webp", options: { quality: 80 } },
};

/** The default pixel density sharp assumes when reading an SVG. */
const svgBaseDensity = 72;

/**
 * Pixel region of a source matching the requested aspect and zoom, centered
 * on the focal point and clamped inside the source's edges.
 *
 * @param {{ width: number, height: number }} source
 * @param {import("./index.mjs").Crop} crop
 */
function cropRegion(source, crop) {
  const width = Math.round(source.width * crop.width);
  const height = Math.min(source.height, Math.round(width / crop.aspect));

  /** @param {number} value @param {number} max */
  const clamp = (value, max) => Math.round(Math.min(Math.max(value, 0), max));

  return {
    width,
    height,
    left: clamp(crop.focus.x * source.width - width / 2, source.width - width),
    top: clamp(
      crop.focus.y * source.height - height / 2,
      source.height - height,
    ),
  };
}

/**
 * Generates every variant the manifest declares and deletes stale files from
 * the output directory.
 *
 * @param {import("./index.mjs").GenerateOptions} options
 */
export async function generateImages({
  sourceDir,
  outputDir,
  images,
  manifestPath,
  publicPath,
  defaultWidths = [480, 960],
  defaultFormats = ["avif", "jpg"],
}) {
  const sourceFiles = await listSourceFiles(sourceDir);

  checkDrift(sourceDir, images, sourceFiles);
  await mkdir(outputDir, { recursive: true });

  const basePath = publicPath ?? defaultPublicPath(outputDir);
  const expected = new Set();
  /** @type {Record<string, import("./index.mjs").ManifestEntry>} */
  const manifestImages = {};

  for (const [name, entry] of Object.entries(images)) {
    const widths = entry.widths ?? defaultWidths;
    const formats = entry.formats ?? defaultFormats;
    const sourcePath = path.join(sourceDir, entry.source);
    const isVector = /\.svg$/i.test(entry.source);

    for (const format of formats) {
      if (!formatSettings[format]) {
        throw new Error(`"${name}": unknown format "${format}"`);
      }
    }

    if (isVector && entry.crop) {
      throw new Error(`"${name}": crop is not supported for SVG sources`);
    }

    /*
     * Raster sources are decoded once and cloned per variant; SVG sources are
     * re-read per width at a density that rasterizes the vector directly at
     * the target size, so no variant is ever an upscaled raster.
     */
    const rotated = isVector ? null : sharp(sourcePath).rotate();
    const metadata = await (rotated ?? sharp(sourcePath)).metadata();
    const region = entry.crop ? cropRegion(metadata, entry.crop) : null;
    const source = region && rotated ? rotated.extract(region) : rotated;
    // Upscaling is measured against what survives the crop, not the original.
    const available = region ? region.width : metadata.width;

    if (region) {
      console.log(
        `${entry.source}: cropped to ${region.width}x${region.height} at ${region.left},${region.top}`,
      );
    }

    const emittedWidths = [];
    let largest = { width: 0, height: 0 };

    for (const width of widths) {
      if (!isVector && width > available) {
        console.warn(
          `${entry.source}: skipping ${width}w (source is ${available}w)`,
        );
        continue;
      }

      const variant = source
        ? source.clone().resize(width)
        : sharp(sourcePath, {
            density: (svgBaseDensity * width) / metadata.width,
          }).resize(width);

      emittedWidths.push(width);

      for (const format of formats) {
        const { toFormat, options } = formatSettings[format];
        const outputName = `${name}-${width}.${format}`;
        const outputPath = path.join(outputDir, outputName);
        const info = await variant
          .clone()
          .toFormat(toFormat, options)
          .toFile(outputPath);

        if (info.width > largest.width) {
          largest = { width: info.width, height: info.height };
        }

        expected.add(outputName);
        console.log(`${outputPath} (${Math.round(info.size / 1024)} KB)`);
      }
    }

    if (emittedWidths.length === 0) {
      throw new Error(`"${name}": no variant fits the source; nothing emitted`);
    }

    manifestImages[name] = {
      widths: emittedWidths,
      formats,
      width: largest.width,
      height: largest.height,
      fingerprint: await entryFingerprint(sourcePath, entry, {
        widths,
        formats,
        basePath,
      }),
    };
  }

  for (const file of await readdir(outputDir)) {
    if (!expected.has(file)) {
      await unlink(path.join(outputDir, file));
      console.log(`${path.join(outputDir, file)} deleted (stale)`);
    }
  }

  if (manifestPath) {
    const manifest = { basePath, images: manifestImages };

    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`${manifestPath} written`);
  }
}

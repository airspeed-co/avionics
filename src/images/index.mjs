/*
 * Manifest-driven image pipeline: generates optimized web variants for every
 * source image a site declares. Runs under plain Node (no bundler), so this
 * module is .mjs with JSDoc types; sharp is an optional peer dependency that
 * the consuming site provides.
 *
 * The site passes a manifest mapping output base names to entries; the engine
 * emits `${name}-${width}.${format}` files into the output directory, e.g.
 * portrait.jpg -> portrait-480.avif, portrait-480.jpg. With `manifestPath`
 * set it also writes a JSON module recording, per entry, the variants that
 * actually exist and their intrinsic dimensions; the site feeds that JSON to
 * provideImageManifest so the <Picture> block renders from generated truth
 * instead of hand-kept props. checkImages verifies the JSON and the output
 * files are current without needing sharp, so builds can fail fast when
 * someone forgets to rerun the generator.
 *
 * The output directory is fully owned by the engine: stale files are deleted,
 * so sites can gitignore it and treat the manifest as the source of truth.
 * Drift is an error in both directions (a manifest entry whose source file is
 * missing, or a source file no entry claims), never a silent skip.
 *
 * Raster sources have EXIF orientation applied, metadata (including GPS)
 * stripped, and are never upscaled. SVG sources are rasterized at each target
 * width (vectors scale freely). HEIC is not supported; convert iPhone photos
 * first: sips -s format jpeg photo.heic --out photo.jpg
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/**
 * @typedef {"avif" | "jpg" | "png" | "webp"} Format
 */

/**
 * @typedef {object} Crop
 * @property {number} aspect output width / height
 * @property {number} width fraction of the source width to keep, so smaller
 *   values zoom in
 * @property {{ x: number, y: number }} focus point held at the center, also
 *   in fractions
 */

/**
 * @typedef {object} ImageEntry
 * @property {string} source file name inside `sourceDir`
 * @property {number[]} [widths] variant widths, overriding the default
 * @property {Format[]} [formats] output formats, overriding the default. The
 *   last one is the <img> fallback, so use ["avif", "png"] for images with
 *   real transparency (JPEG has no alpha channel).
 * @property {Crop} [crop] optional crop, applied before resizing so each
 *   variant carries the cropped region at full resolution. Cropping here
 *   rather than in CSS keeps the detail: a 960w variant holds 960px of the
 *   subject instead of 960px of the whole frame with most of it hidden by
 *   object-fit. Not supported for SVG sources.
 */

/**
 * @typedef {object} GenerateOptions
 * @property {string} sourceDir directory of original images
 * @property {string} outputDir directory the engine owns; stale files are
 *   deleted
 * @property {Record<string, ImageEntry>} images manifest keyed by output base
 *   name
 * @property {string} [manifestPath] where to write the generated JSON manifest
 *   the <Picture> block consumes; omit to skip writing it
 * @property {string} [publicPath] URL prefix the output directory is served
 *   under, recorded in the generated manifest. Defaults to `outputDir` with a
 *   leading "public/" stripped, e.g. "public/images" -> "/images".
 * @property {number[]} [defaultWidths] widths for entries without their own
 * @property {Format[]} [defaultFormats] formats for entries without their own
 */

/**
 * @typedef {object} ManifestEntry
 * @property {number[]} widths variants that actually exist on disk (upscale
 *   skips excluded)
 * @property {string[]} formats output formats, <img> fallback last
 * @property {number} width intrinsic width of the largest variant
 * @property {number} height intrinsic height of the largest variant
 * @property {string} fingerprint hash of the source bytes and entry config,
 *   compared by checkImages to detect stale outputs
 */

/** @type {Record<Format, { toFormat: "avif" | "jpeg" | "png" | "webp", options: object }>} */
const formatSettings = {
  avif: { toFormat: "avif", options: { quality: 60 } },
  jpg: { toFormat: "jpeg", options: { quality: 80, mozjpeg: true } },
  png: { toFormat: "png", options: { compressionLevel: 9 } },
  webp: { toFormat: "webp", options: { quality: 80 } },
};

const imagePattern = /\.(jpe?g|png|webp|tiff?|svg)$/i;

/** The default pixel density sharp assumes when reading an SVG. */
const svgBaseDensity = 72;

/**
 * Pixel region of a source matching the requested aspect and zoom, centered
 * on the focal point and clamped inside the source's edges.
 *
 * @param {{ width: number, height: number }} source
 * @param {Crop} crop
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
 * URL prefix for a served output directory: "public/images" -> "/images".
 * Derive it from the config-relative directory, never a resolved absolute
 * path (see the Vite plugin), or the stripped prefix misses.
 *
 * @param {string} outputDir
 */
export function defaultPublicPath(outputDir) {
  const normalized = path.normalize(outputDir).split(path.sep).join("/");

  return "/" + normalized.replace(/^public\//, "").replace(/^\/+/, "");
}

/**
 * Fingerprint of everything that determines an entry's outputs: the source
 * file's bytes plus the resolved config. checkImages recomputes this without
 * sharp, so a changed source, crop, width list, or format list all read as
 * stale.
 *
 * @param {string} sourcePath
 * @param {ImageEntry} entry
 * @param {object} resolved the entry's effective widths/formats/publicPath
 */
async function entryFingerprint(sourcePath, entry, resolved) {
  const hash = createHash("sha256");

  hash.update(await readFile(sourcePath));
  hash.update(JSON.stringify({ entry, resolved }));

  return hash.digest("hex").slice(0, 16);
}

/**
 * Validates the manifest against the source directory and throws on drift in
 * either direction, listing every offender.
 *
 * @param {string} sourceDir
 * @param {Record<string, ImageEntry>} images
 * @param {string[]} sourceFiles image files found in `sourceDir`
 */
function checkDrift(sourceDir, images, sourceFiles) {
  const claimed = new Set(Object.values(images).map((entry) => entry.source));
  const missing = Object.entries(images)
    .filter(([, entry]) => !sourceFiles.includes(entry.source))
    .map(([name, entry]) => `"${name}" -> ${entry.source}`);
  const unclaimed = sourceFiles.filter((file) => !claimed.has(file));
  const problems = [
    ...missing.map((item) => `manifest entry has no source file: ${item}`),
    ...unclaimed.map(
      (file) =>
        `source file has no manifest entry: ${path.join(sourceDir, file)}`,
    ),
  ];

  if (problems.length > 0) {
    throw new Error(
      `Image manifest out of sync with ${sourceDir}:\n  ${problems.join("\n  ")}`,
    );
  }
}

/**
 * Generates every variant the manifest declares and deletes stale files from
 * the output directory. Logs each emitted file.
 *
 * @param {GenerateOptions} options
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
  const sourceFiles = (await readdir(sourceDir)).filter((file) =>
    imagePattern.test(file),
  );

  checkDrift(sourceDir, images, sourceFiles);
  await mkdir(outputDir, { recursive: true });

  const basePath = publicPath ?? defaultPublicPath(outputDir);
  const expected = new Set();
  /** @type {Record<string, ManifestEntry>} */
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

/**
 * Verifies the generated manifest and output files are current with the
 * sources and config, throwing with a "run npm run images" pointer when not.
 * Recomputes only fingerprints (no sharp), so it is cheap enough to gate every
 * build.
 *
 * @param {GenerateOptions} options the same options passed to generateImages
 */
export async function checkImages({
  sourceDir,
  outputDir,
  images,
  manifestPath,
  publicPath,
  defaultWidths = [480, 960],
  defaultFormats = ["avif", "jpg"],
}) {
  if (!manifestPath) {
    throw new Error("checkImages requires manifestPath");
  }

  const sourceFiles = (await readdir(sourceDir)).filter((file) =>
    imagePattern.test(file),
  );

  checkDrift(sourceDir, images, sourceFiles);

  const basePath = publicPath ?? defaultPublicPath(outputDir);
  const manifest = await readFile(manifestPath, "utf8").then(
    JSON.parse,
    () => null,
  );
  const problems = [];

  if (!manifest || manifest.basePath !== basePath) {
    problems.push(`${manifestPath} is missing or built for another basePath`);
  } else {
    const outputFiles = new Set(await readdir(outputDir).catch(() => []));

    for (const [name, entry] of Object.entries(images)) {
      const generated = manifest.images[name];
      const fingerprint = await entryFingerprint(
        path.join(sourceDir, entry.source),
        entry,
        {
          widths: entry.widths ?? defaultWidths,
          formats: entry.formats ?? defaultFormats,
          basePath,
        },
      );

      if (!generated) {
        problems.push(`"${name}" has no generated entry`);
      } else if (generated.fingerprint !== fingerprint) {
        problems.push(`"${name}" is stale (source or config changed)`);
      } else {
        for (const width of generated.widths) {
          for (const format of generated.formats) {
            const outputName = `${name}-${width}.${format}`;

            if (!outputFiles.has(outputName)) {
              problems.push(`missing output file: ${outputName}`);
            }
          }
        }
      }
    }

    for (const name of Object.keys(manifest.images)) {
      if (!images[name]) {
        problems.push(`"${name}" was removed but is still in ${manifestPath}`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Generated images out of date (run npm run images):\n  ${problems.join("\n  ")}`,
    );
  }

  console.log(`${manifestPath}: images up to date`);
}

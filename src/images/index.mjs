/*
 * Manifest-driven image pipeline: generates optimized web variants for every
 * source image a site declares. Runs under plain Node (no bundler), so these
 * modules are .mjs with JSDoc types; sharp is an optional peer dependency
 * that the consuming site provides.
 *
 * The site passes a manifest mapping output base names to entries; the engine
 * emits `${name}-${width}.${format}` files into the output directory, e.g.
 * photos/portrait.jpg -> portrait-480.avif, portrait-480.jpg. With
 * `manifestPath` set it also writes a JSON module recording, per entry, the
 * variants that actually exist and their intrinsic dimensions; the site feeds
 * that JSON to provideImageManifest so the <Picture> block renders from
 * generated truth instead of hand-kept props. checkImages verifies the JSON
 * and the output files are current without needing sharp, so builds can fail
 * fast when someone forgets to rerun the generator.
 *
 * The output directory is fully owned by the engine: stale files are deleted,
 * so sites can gitignore it and treat the manifest as the source of truth.
 * Drift is an error in both directions (a manifest entry whose source file is
 * missing, or a source file no entry claims), never a silent skip.
 *
 * One module per role: sources.mjs discovers files and enforces drift,
 * manifest.mjs owns the fingerprint/publicPath contract, generate.mjs emits
 * variants (the only module needing sharp), check.mjs verifies without it.
 * HEIC is not supported; convert iPhone photos first:
 * sips -s format jpeg photo.heic --out photo.jpg
 */

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
 * @property {string} source file path relative to `sourceDir`, "/"-separated
 *   (subfolders welcome: "photos/team.jpg")
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

export { checkImages } from "./check.mjs";
export { generateImages } from "./generate.mjs";
export { defaultPublicPath } from "./manifest.mjs";

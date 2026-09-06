/*
 * Hand-written types for index.mjs. The implementation stays .mjs because
 * sites run it under plain Node from inside node_modules, where Node's type
 * stripping is disallowed; keep this file in sync with the JSDoc there.
 */

export type Format = "avif" | "jpg" | "png" | "webp";

export interface Crop {
  /** Output width / height. */
  aspect: number;
  /** Fraction of the source width to keep, so smaller values zoom in. */
  width: number;
  /** Point held at the center, also in fractions. */
  focus: { x: number; y: number };
}

export interface ImageEntry {
  /** File path relative to `sourceDir`, "/"-separated (subfolders welcome). */
  source: string;
  /** Variant widths, overriding the default. */
  widths?: number[];
  /**
   * Output formats, overriding the default. The last one is the <img>
   * fallback, so use ["avif", "png"] for images with real transparency.
   */
  formats?: Format[];
  /** Optional crop, applied before resizing. Not supported for SVG sources. */
  crop?: Crop;
}

export interface GenerateOptions {
  /** Directory of original images. */
  sourceDir: string;
  /** Directory the engine owns; stale files are deleted. */
  outputDir: string;
  /** Manifest keyed by output base name. */
  images: Record<string, ImageEntry>;
  /**
   * Where to write the generated JSON manifest the <Picture> block consumes;
   * omit to skip writing it.
   */
  manifestPath?: string;
  /**
   * URL prefix the output directory is served under, recorded in the
   * generated manifest. Defaults to `outputDir` with a leading "public/"
   * stripped, e.g. "public/images" -> "/images".
   */
  publicPath?: string;
  /** Widths for entries without their own. Default [480, 960]. */
  defaultWidths?: number[];
  /** Formats for entries without their own. Default ["avif", "jpg"]. */
  defaultFormats?: Format[];
  /**
   * What to do when the manifest and the source directory disagree (an
   * entry whose file is missing, or a file no entry claims). "error" (the
   * default) throws, listing every offender, which is what builds want.
   * "warn" logs each one, prints a ready-to-paste entry for every unclaimed
   * file, drops entries whose file is missing, and carries on with the rest;
   * the dev server uses it so a new photo never takes the site down before
   * the config catches up.
   */
  drift?: "error" | "warn";
}

/**
 * Generates every variant the manifest declares, deletes stale files from the
 * output directory, and (with `manifestPath`) writes the generated JSON
 * manifest. Throws on manifest/source-directory drift.
 */
export function generateImages(options: GenerateOptions): Promise<void>;

/**
 * Verifies the generated manifest and output files are current with the
 * sources and config, throwing with a "run npm run images" pointer when not.
 * Recomputes only fingerprints (no sharp), so it is cheap enough to gate
 * every build.
 */
export function checkImages(options: GenerateOptions): Promise<void>;

/**
 * URL prefix for a served output directory: "public/images" -> "/images".
 * Derive it from the config-relative directory, never a resolved absolute
 * path.
 */
export function defaultPublicPath(outputDir: string): string;

/**
 * Both directions of drift between a manifest and the files found under its
 * source directory: entry names whose file is absent, and files no entry
 * claims.
 */
export function findDrift(
  images: Record<string, ImageEntry>,
  sourceFiles: string[],
): { missing: string[]; unclaimed: string[] };

/** A manifest entry to paste for an unclaimed source file. */
export function entrySnippet(file: string): string;

/**
 * The dev-server counterpart of the strict drift check: warns instead of
 * throwing, prints an entry snippet for every unclaimed file, and returns the
 * manifest without entries whose source is missing.
 */
export function tolerateDrift(
  sourceDir: string,
  images: Record<string, ImageEntry>,
  sourceFiles: string[],
  warn?: (message: string) => void,
): Record<string, ImageEntry>;

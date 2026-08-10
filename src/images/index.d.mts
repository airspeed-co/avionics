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
  /** File name inside `sourceDir`. */
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
  /** Widths for entries without their own. Default [480, 960]. */
  defaultWidths?: number[];
  /** Formats for entries without their own. Default ["avif", "jpg"]. */
  defaultFormats?: Format[];
}

/**
 * Generates every variant the manifest declares and deletes stale files from
 * the output directory. Throws on manifest/source-directory drift.
 */
export function generateImages(options: GenerateOptions): Promise<void>;

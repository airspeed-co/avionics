/*
 * The generated image manifest the <Picture> block renders from: the JSON the
 * image engine writes at `manifestPath` (see ../../images). Under the
 * avionics Vite plugin it arrives through ./manifest-data.mjs, whose import
 * the plugin redirects to the generated JSON, so both prerendering and the
 * hydrated client see it with no site wiring. Module state rather than
 * context because the manifest is build-time data with exactly one value per
 * site, not something that varies by tree position.
 */

import manifestData from "./manifest-data.mjs";

/** One entry of the generated manifest; matches what the engine writes. */
export interface ImageManifestEntry {
  /** Variant widths that actually exist on disk. */
  widths: number[];
  /** Output formats, best first; the last is the <img> fallback. */
  formats: string[];
  /** Intrinsic dimensions of the largest variant. */
  width: number;
  height: number;
  /** Staleness hash, used by the engine's checkImages; unused here. */
  fingerprint: string;
}

export interface ImageManifest {
  /** URL prefix the variants are served under, e.g. "/images". */
  basePath: string;
  images: Record<string, ImageManifestEntry>;
}

let provided: ImageManifest | undefined;

/**
 * Registers a manifest manually, overriding the one the avionics Vite plugin
 * supplies (see ./manifest-data.mjs). Only needed by consumers not building
 * with the plugin.
 */
export function provideImageManifest(value: ImageManifest) {
  provided = value;
}

/** The manifest entry and base path for a name, throwing a pointed error when
 *  the manifest is absent or the name unknown (surfaces at prerender time, so
 *  a bad name fails the build instead of shipping a broken image). */
export function imageEntry(name: string) {
  const manifest = provided ?? manifestData;

  if (!manifest) {
    throw new Error(
      "No image manifest available; add the avionics Vite plugin (an images section in avionics.config.mjs) or call provideImageManifest",
    );
  }

  const entry = manifest.images[name];

  if (!entry) {
    throw new Error(
      `Unknown image "${name}"; expected one of: ${Object.keys(manifest.images).join(", ")}`,
    );
  }

  return { entry, basePath: manifest.basePath };
}

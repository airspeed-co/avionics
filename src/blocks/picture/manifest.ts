/*
 * The generated image manifest the <Picture> block renders from: the JSON the
 * image engine writes at `manifestPath` (see ../../images). The site imports
 * that JSON and registers it once at entry-module scope, so both prerendering
 * and the hydrated client see it before any Picture renders. Module state
 * rather than context because the manifest is build-time data with exactly one
 * value per site, not something that varies by tree position.
 */

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

let manifest: ImageManifest | undefined;

/** Registers the generated manifest. Call once from the site's entry module. */
export function provideImageManifest(value: ImageManifest) {
  manifest = value;
}

/** The manifest entry and base path for a name, throwing a pointed error when
 *  the manifest is absent or the name unknown (surfaces at prerender time, so
 *  a bad name fails the build instead of shipping a broken image). */
export function imageEntry(name: string) {
  if (!manifest) {
    throw new Error(
      "No image manifest registered; import the generated manifest JSON and call provideImageManifest in the site entry",
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

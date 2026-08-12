/*
 * Hand-written types for index.mjs; keep in sync with the JSDoc there (see
 * ../images/index.d.mts for why the implementation stays .mjs).
 */

import type { Plugin } from "vite";

export interface AvionicsPluginOptions {
  /** Config path relative to the Vite root. Default "avionics.config.mjs". */
  configFile?: string;
}

/**
 * The avionics Vite plugin. Reads `avionics.config.mjs` from the site root
 * and, when it has an `images` section, owns image generation end to end:
 * generates at dev/build start (fingerprint-skipped when clean), serves the
 * generated manifest to the <Picture> block, and regenerates on config or
 * source changes in dev.
 */
export function avionics(options?: AvionicsPluginOptions): Plugin;

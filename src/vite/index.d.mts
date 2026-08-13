/*
 * Hand-written types for index.mjs; keep in sync with the JSDoc there (see
 * ../images/index.d.mts for why the implementation stays .mjs).
 */

import type { PluginOption } from "vite";

export interface AvionicsPluginOptions {
  /**
   * Config path relative to the working directory.
   * Default "avionics.config.mjs".
   */
  configFile?: string;
  /**
   * Replaces %HOME_TITLE% in index.html. Passed here rather than configured
   * in avionics.config.mjs because the title lives in the site's TypeScript
   * content layer, which vite.config.ts can import and plain Node cannot.
   */
  homeTitle?: string;
}

/**
 * The avionics Vite preset. Reads `avionics.config.mjs` and returns the
 * shared plugin set: base config (preact dedupe, avionics served as source,
 * Lightning CSS with the site's browser targets), the image pipeline,
 * breakpoint injection, index.html stamping (home title, noindex outside
 * production), and the preact preset with prerendering. Async because Vite
 * awaits promises in the plugins array.
 */
export function avionics(
  options?: AvionicsPluginOptions,
): Promise<PluginOption[]>;

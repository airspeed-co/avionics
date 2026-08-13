/*
 * Hand-written types for index.mjs; keep in sync with the JSDoc there (see
 * ../images/index.d.mts for why the implementation stays .mjs).
 */

import type { Format, ImageEntry } from "../images/index.mjs";

export interface ImagesConfig {
  /** Directory of original images. */
  sourceDir: string;
  /** Generated-variant directory the engine owns. Default "public/images". */
  outputDir?: string;
  /**
   * URL prefix the output directory is served under. Defaults to `outputDir`
   * with a leading "public/" stripped, e.g. "public/images" -> "/images".
   */
  publicPath?: string;
  /** Manifest keyed by output base name. */
  entries: Record<string, ImageEntry>;
  /** Widths for entries without their own. Default [480, 960]. */
  defaultWidths?: number[];
  /** Formats for entries without their own. Default ["avif", "jpg"]. */
  defaultFormats?: Format[];
}

export interface PrerenderConfig {
  /**
   * Routes not reachable by links, prerendered in addition to everything
   * discovered from the home page.
   */
  routes?: string[];
  /** Selector the app hydrates into. Default "#app". */
  renderTarget?: string;
}

export interface AvionicsConfig {
  /** The image pipeline (see the images module). */
  images?: ImagesConfig;
  /** Prerendering, wired through the preact preset by the Vite plugin. */
  prerender?: PrerenderConfig;
  /**
   * Stylesheet of shared @custom-media definitions, prepended to every CSS
   * module so Lightning CSS can resolve named breakpoints per file.
   */
  breakpoints?: string;
  /**
   * Browserslist query for CSS targets.
   * Default "defaults, safari >= 15, ios_saf >= 15".
   */
  browsers?: string;
}

/**
 * Identity helper that carries the config type, so editors autocomplete and
 * type-check `avionics.config.mjs` without any annotation in the site file.
 */
export function defineConfig(config: AvionicsConfig): AvionicsConfig;

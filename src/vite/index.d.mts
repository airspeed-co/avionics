/*
 * Hand-written types for index.mjs; keep in sync with the JSDoc there (see
 * ../images/index.d.mts for why the implementation stays .mjs).
 */

import type { Plugin, PluginOption } from "vite";

export interface SitemapOptions {
  /**
   * Canonical production origin for absolute URLs, no trailing slash
   * ("https://airspeed.co"). Defaults to the origin of the config's `site`.
   */
  origin?: string;
  /**
   * Locale-agnostic page pathnames ("/", "/audit"). Noindexed pages (the
   * 404) do not belong here.
   */
  paths: string[];
  /**
   * Each locale's home prefix (["/", "/es"]), matching what the site's
   * splitLocale parses. Defaults to the prefixes of the config's
   * `site.locales`, or a single unprefixed locale without a `site`.
   */
  localePrefixes?: string[];
}

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
  /**
   * Emits sitemap.xml into the client bundle: the page paths expanded across
   * the locale prefixes. Passed here rather than configured in
   * avionics.config.mjs for the same reason as homeTitle (the paths live in
   * the site's TypeScript). Replaces any public/sitemap.xml, so remove the
   * static file when adopting the option.
   */
  sitemap?: SitemapOptions;
}

/**
 * The avionics Vite preset. Reads `avionics.config.mjs` and returns the
 * shared plugin set: base config (preact dedupe, avionics served as source,
 * Lightning CSS with the site's browser targets), the image pipeline,
 * breakpoint injection, index.html stamping (home title, noindex outside
 * production), and the preact preset with prerendering. With a `site`
 * section in the config it also serves the site data to
 * "@airspeed-co/avionics/site", injects the site-wide Open Graph tags, and
 * emits robots.txt. Async because Vite awaits promises in the plugins array.
 */
export function avionics(
  options?: AvionicsPluginOptions,
): Promise<PluginOption[]>;

/**
 * The site-data plugin on its own, for a site's vitest config: tests do not
 * load the full preset, but site code under test still imports
 * "@airspeed-co/avionics/site".
 */
export function avionicsSite(options?: {
  /**
   * Config path relative to the working directory.
   * Default "avionics.config.mjs".
   */
  configFile?: string;
}): Promise<Plugin>;

/*
 * The avionics Vite preset: loads the site's `avionics.config.mjs` and turns
 * it into the full build setup, so a site's vite.config.ts holds only truly
 * site-specific plugins. Each concern lives in its own module; this one only
 * loads the config and assembles them:
 *
 * - the core plugin (./core.mjs): shared base Vite config plus the image
 *   pipeline.
 * - breakpoint injection (./breakpoints.mjs), when `breakpoints` is
 *   configured.
 * - site data (./site-data.mjs): the config's `site` section, served to
 *   site code as "@airspeed-co/avionics/site".
 * - index.html stamping (./index-html.mjs): home title, noindex outside
 *   production, and the site-wide Open Graph tags from `site`.
 * - sitemap emission (./sitemap.mjs), when the `sitemap` option is passed;
 *   its origin and locale prefixes default from `site`.
 * - robots.txt emission (./robots.mjs), when `site` is configured.
 * - the preact preset with prerendering enabled, routes from `prerender`.
 * - critical CSS inlining (./inline-css.mjs): prerendered pages carry their
 *   stylesheet in a <style> tag instead of a render-blocking link.
 *
 * The factory is async (Vite awaits promises in the plugins array) because
 * the preact preset needs the config's prerender routes at construction. The
 * config file is read from the process working directory; image and
 * breakpoint paths resolve against the Vite root as usual.
 *
 * Plain .mjs with JSDoc types for the same reason as ../images: Vite loads
 * the site config (and therefore these modules) under plain Node, where type
 * stripping inside node_modules is disallowed.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

import preact from "@preact/preset-vite";

import { localePrefixes, resolveSite } from "../config/index.mjs";
import { breakpointsPlugin } from "./breakpoints.mjs";
import { corePlugin } from "./core.mjs";
import { indexHtmlPlugin } from "./index-html.mjs";
import { inlineCssPlugin } from "./inline-css.mjs";
import { robotsPlugin } from "./robots.mjs";
import { siteDataPlugin } from "./site-data.mjs";
import { sitemapPlugin } from "./sitemap.mjs";

export { avionicsSite } from "./site-data.mjs";

/**
 * @typedef {object} SitemapOptions
 * @property {string[]} paths locale-agnostic page pathnames ("/", "/audit");
 *   noindexed pages (the 404) do not belong here
 * @property {string} [origin] canonical production origin, no trailing
 *   slash; defaults to the origin of the config's `site`
 * @property {string[]} [localePrefixes] each locale's home prefix
 *   (["/", "/es"]); defaults to the prefixes of the config's `site.locales`,
 *   or a single unprefixed locale without a `site`
 */

/**
 * @typedef {object} AvionicsPluginOptions
 * @property {string} [configFile] config path relative to the working
 *   directory, defaulting to "avionics.config.mjs"
 * @property {string} [homeTitle] replaces %HOME_TITLE% in index.html; passed
 *   here rather than configured in avionics.config.mjs because the title
 *   lives in the site's TypeScript content layer, which vite.config.ts can
 *   import and plain Node cannot
 * @property {SitemapOptions} [sitemap] emits sitemap.xml into the client
 *   bundle; passed here rather than configured in avionics.config.mjs for
 *   the same reason as homeTitle (the paths live in the site's TypeScript)
 */

/**
 * The avionics Vite preset. Reads `avionics.config.mjs` and returns the
 * shared plugin set; see the module comment for what it covers.
 *
 * @param {AvionicsPluginOptions} [options]
 * @returns {Promise<import("vite").PluginOption[]>}
 */
export async function avionics({
  configFile = "avionics.config.mjs",
  homeTitle,
  sitemap,
} = {}) {
  const configPath = path.resolve(process.cwd(), configFile);

  /** Re-imported with a cache-busting query because Node caches ESM imports
   *  forever and dev regenerates on config edits. */
  async function importConfig() {
    const url = `${pathToFileURL(configPath).href}?t=${Date.now()}`;

    return (await import(url)).default ?? {};
  }

  const config = await importConfig();
  const site = resolveSite(config);

  /** @type {import("vite").PluginOption[]} */
  const plugins = [corePlugin({ config, configPath, importConfig })];

  if (config.breakpoints) {
    plugins.push(breakpointsPlugin(config.breakpoints));
  }

  plugins.push(siteDataPlugin(site), indexHtmlPlugin(homeTitle, site));

  if (sitemap) {
    const origin = sitemap.origin ?? site?.origin;

    if (!origin) {
      throw new Error(
        "avionics: the sitemap needs an origin; add a `site` section to avionics.config.mjs or pass sitemap.origin",
      );
    }

    plugins.push(
      sitemapPlugin({
        origin,
        paths: sitemap.paths,
        localePrefixes:
          sitemap.localePrefixes ?? (site && localePrefixes(site.locales)),
      }),
    );
  }

  if (site) {
    plugins.push(robotsPlugin(site.origin));
  }

  plugins.push(
    preact({
      prerender: {
        enabled: true,
        renderTarget: config.prerender?.renderTarget ?? "#app",
        additionalPrerenderRoutes: config.prerender?.routes ?? [],
      },
    }),
  );

  plugins.push(inlineCssPlugin());

  return plugins;
}

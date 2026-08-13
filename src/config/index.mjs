/*
 * The site-wide avionics config: one `avionics.config.mjs` at the site root
 * describing everything avionics acts on (images today; more sections as the
 * framework grows). The Vite plugin (see ../vite) loads it and drives the
 * image engine from it, so sites keep exactly one hand-written config file
 * and no generated files in the tree.
 *
 * Plain .mjs with JSDoc types for the same reason as ../images: it is loaded
 * by Node from inside node_modules, where type stripping is disallowed.
 */

/**
 * @typedef {import("../images/index.mjs").ImageEntry} ImageEntry
 * @typedef {import("../images/index.mjs").Format} Format
 */

/**
 * @typedef {ImageEntry & { name: string }} NamedImageEntry an image entry
 *   plus its output base name (the <Picture> key). A list rather than an
 *   object keyed by name, so hyphenated names read like every other one
 *   instead of needing quotes.
 */

/**
 * @typedef {object} ImagesConfig
 * @property {string} sourceDir directory of original images
 * @property {string} [outputDir] generated-variant directory the engine owns;
 *   defaults to "public/images"
 * @property {string} [publicPath] URL prefix the output directory is served
 *   under; defaults to `outputDir` with a leading "public/" stripped
 * @property {NamedImageEntry[]} entries the images to generate; names must be
 *   unique
 * @property {number[]} [defaultWidths] widths for entries without their own
 * @property {Format[]} [defaultFormats] formats for entries without their own
 */

/**
 * @typedef {object} PrerenderConfig
 * @property {string[]} [routes] routes not reachable by links, prerendered in
 *   addition to everything discovered from the home page
 * @property {string} [renderTarget] selector the app hydrates into,
 *   defaulting to "#app"
 */

/**
 * @typedef {object} AvionicsConfig
 * @property {ImagesConfig} [images] the image pipeline (see ../images)
 * @property {PrerenderConfig} [prerender] prerendering, wired through the
 *   preact preset by the Vite plugin (see ../vite)
 * @property {string} [breakpoints] stylesheet of shared @custom-media
 *   definitions, prepended to every CSS module so Lightning CSS can resolve
 *   named breakpoints per file
 * @property {string} [browsers] browserslist query for CSS targets,
 *   defaulting to "defaults, safari >= 15, ios_saf >= 15"
 */

/**
 * Identity helper that carries the config type, so editors autocomplete and
 * type-check `avionics.config.mjs` without any annotation in the site file.
 *
 * @param {AvionicsConfig} config
 */
export const defineConfig = (config) => config;

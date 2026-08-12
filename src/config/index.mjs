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
 * @typedef {object} ImagesConfig
 * @property {string} sourceDir directory of original images
 * @property {string} [outputDir] generated-variant directory the engine owns;
 *   defaults to "public/images"
 * @property {string} [publicPath] URL prefix the output directory is served
 *   under; defaults to `outputDir` with a leading "public/" stripped
 * @property {Record<string, ImageEntry>} entries manifest keyed by output
 *   base name
 * @property {number[]} [defaultWidths] widths for entries without their own
 * @property {Format[]} [defaultFormats] formats for entries without their own
 */

/**
 * @typedef {object} AvionicsConfig
 * @property {ImagesConfig} [images] the image pipeline (see ../images)
 */

/**
 * Identity helper that carries the config type, so editors autocomplete and
 * type-check `avionics.config.mjs` without any annotation in the site file.
 *
 * @param {AvionicsConfig} config
 */
export const defineConfig = (config) => config;

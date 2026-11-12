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
 * @typedef {object} SocialImageConfig
 * @property {string} [path] served path of the Open Graph image, defaulting
 *   to "/og-image.png"
 * @property {string} [alt] alt text, defaulting to the site name
 * @property {number} [width] pixel width, defaulting to 1200
 * @property {number} [height] pixel height, defaulting to 630
 */

/**
 * @typedef {object} SiteConfig
 * @property {string} name the brand name ("Example Co.")
 * @property {string} domain apex host of the production site, no scheme or
 *   path ("example.com")
 * @property {string} [email] public contact email
 * @property {string} [phone] public contact phone
 * @property {string[]} [locales] locale codes, default locale first; the
 *   first is served unprefixed and every other one under "/<code>".
 *   Defaults to ["en"]
 * @property {SocialImageConfig} [socialImage] the Open Graph image
 */

/**
 * @typedef {object} AnalyticsConfig
 * @property {string} [measurementId] GA4 measurement id ("G-XXXXXXXXXX");
 *   preflight verifies a deployed bundle carries it
 */

/**
 * @typedef {object} PreflightConfig
 * @property {string[]} [apiEndpoints] POST-only API paths that must reject
 *   GET with 405
 * @property {Record<string, string[]>} [redirects] launch redirects to
 *   verify, current path -> previous paths
 * @property {string[]} [wellKnownFiles] paths that must return 200
 * @property {string[]} [allowedScriptHosts] hosts the served home page may
 *   load scripts from, besides its own
 * @property {string} [previewOrigin] the standing preview deployment
 *   (`avionics preflight --preview` checks it)
 * @property {(context: import("../preflight/index.mjs").PreflightContext) => Promise<void> | void} [extraChecks]
 *   site-specific checks, run before the summary
 */

/**
 * @typedef {object} ScreensConfig
 * @property {{ name: string, path: string }[]} [routes] pages to shoot,
 *   defaulting to the home page
 * @property {{ name: string, width: number, height: number }[]} [viewports]
 *   viewports to shoot at, defaulting to one per breakpoint tier
 */

/**
 * @typedef {object} PlaceholdersConfig
 * @property {string[]} [ignore] tracked paths (files, or directories ending
 *   in "/") that `avionics placeholders` skips
 */

/**
 * @typedef {object} AvionicsConfig
 * @property {SiteConfig} [site] the site's identity; the single place the
 *   name and domain are written (see resolveSite)
 * @property {AnalyticsConfig} [analytics] Google Analytics
 * @property {PreflightConfig} [preflight] inputs for `avionics preflight`
 * @property {ScreensConfig} [screens] inputs for `avionics screens`
 * @property {PlaceholdersConfig} [placeholders] inputs for
 *   `avionics placeholders`
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

/**
 * @typedef {object} Site the resolved site identity: the config's `site`
 *   section with defaults applied and the values derived from it. This is
 *   what the build stamps into pages and what site code imports from
 *   "@airspeed-co/avionics/site".
 * @property {string} name
 * @property {string} domain
 * @property {string} origin canonical production origin, no trailing slash
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string[]} locales
 * @property {Required<SocialImageConfig>} socialImage
 * @property {string} [analyticsMeasurementId]
 */

/**
 * Each locale's home prefix: the first (default) locale is unprefixed, every
 * other one lives under its code (["en", "es"] -> ["/", "/es"]).
 *
 * @param {string[]} locales
 */
export const localePrefixes = (locales) =>
  locales.map((locale, index) => (index === 0 ? "/" : `/${locale}`));

/**
 * Resolves the config's `site` section into the identity everything else
 * derives from, or undefined for a config without one (sites that have not
 * adopted it yet). Throws on a malformed section, since a typo here would
 * otherwise be stamped into every page.
 *
 * @param {AvionicsConfig} config
 * @returns {Site | undefined}
 */
export function resolveSite(config) {
  const site = config.site;

  if (!site) return undefined;

  if (typeof site.name !== "string" || site.name.trim() === "") {
    throw new Error("avionics config: site.name must be a non-empty string");
  }

  if (
    typeof site.domain !== "string" ||
    !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(
      site.domain,
    )
  ) {
    throw new Error(
      `avionics config: site.domain must be a bare lowercase host like "example.com", got "${site.domain}"`,
    );
  }

  const locales = site.locales ?? ["en"];

  if (!Array.isArray(locales) || locales.length === 0) {
    throw new Error("avionics config: site.locales must list a locale");
  }

  const measurementId = config.analytics?.measurementId;

  return {
    name: site.name,
    domain: site.domain,
    origin: `https://${site.domain}`,
    ...(site.email && { email: site.email }),
    ...(site.phone && { phone: site.phone }),
    locales,
    socialImage: {
      path: site.socialImage?.path ?? "/og-image.png",
      alt: site.socialImage?.alt ?? site.name,
      width: site.socialImage?.width ?? 1200,
      height: site.socialImage?.height ?? 630,
    },
    ...(measurementId && { analyticsMeasurementId: measurementId }),
  };
}
